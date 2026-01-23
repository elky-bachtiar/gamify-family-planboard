import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  getCorsHeaders,
  checkRateLimit,
  rateLimitedResponse,
  getClientId,
  RATE_LIMITS,
  errorResponse,
  successResponse,
} from '../_shared/security.ts';

// Constants for streak freeze feature
const STREAK_FREEZE_COST = 50; // Points to purchase one freeze
const MAX_STREAK_FREEZES = 3; // Maximum freezes a user can hold

/**
 * Purchase Streak Freeze Edge Function
 *
 * Allows any family member to purchase a streak freeze using their points.
 * - Costs 50 points per freeze
 * - Maximum 3 freezes can be held at once
 * - Freezes are automatically consumed when a streak would be lost
 *
 * Security:
 * - Rate limited to prevent abuse
 * - Must have enough points
 * - Cannot exceed max freezes
 */
Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Rate limiting
    const clientId = getClientId(req);
    const rateLimitKey = `purchase-streak-freeze:${clientId}`;
    const rateLimit = checkRateLimit(rateLimitKey, RATE_LIMITS['purchase-streak-freeze']);

    if (!rateLimit.allowed) {
      return rateLimitedResponse(corsHeaders, rateLimit.resetIn);
    }

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse('Missing authorization header', 401, corsHeaders);
    }

    // Create Supabase client with service role for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Create client with user's token to verify authentication
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify user is authenticated - check both regular auth and PIN user JWT claims
    const {
      data: { user },
    } = await supabaseUser.auth.getUser();

    let memberId: string | null = null;

    if (user) {
      // Regular user - get member from user_id
      const { data: memberData, error: memberError } = await supabaseAdmin
        .from('family_members')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (memberError || !memberData) {
        return errorResponse('User is not a family member', 403, corsHeaders);
      }

      memberId = memberData.id;
    } else {
      // Check for PIN user JWT claims
      try {
        const token = authHeader.replace('Bearer ', '');
        const payload = JSON.parse(atob(token.split('.')[1]));

        if (payload.family_member_id) {
          memberId = payload.family_member_id;
        }
      } catch {
        // Token parsing failed
      }
    }

    if (!memberId) {
      return errorResponse('Unauthorized', 401, corsHeaders);
    }

    // Get member's current state
    const { data: member, error: memberError } = await supabaseAdmin
      .from('family_members')
      .select('id, family_id, name, total_points, streak_freezes')
      .eq('id', memberId)
      .single();

    if (memberError || !member) {
      return errorResponse('Member not found', 404, corsHeaders);
    }

    const currentPoints = member.total_points || 0;
    const currentFreezes = member.streak_freezes || 0;

    // Check if at max freezes
    if (currentFreezes >= MAX_STREAK_FREEZES) {
      return errorResponse(
        `You already have the maximum of ${MAX_STREAK_FREEZES} streak freezes`,
        400,
        corsHeaders
      );
    }

    // Check if enough points
    if (currentPoints < STREAK_FREEZE_COST) {
      return errorResponse(
        `Not enough points. You need ${STREAK_FREEZE_COST} points but have ${currentPoints}`,
        400,
        corsHeaders
      );
    }

    // Deduct points and add freeze
    const newPoints = currentPoints - STREAK_FREEZE_COST;
    const newFreezes = currentFreezes + 1;

    const { error: updateError } = await supabaseAdmin
      .from('family_members')
      .update({
        total_points: newPoints,
        streak_freezes: newFreezes,
      })
      .eq('id', memberId);

    if (updateError) {
      console.error('Error updating member:', updateError);
      return errorResponse('Failed to purchase streak freeze', 500, corsHeaders);
    }

    // Log to points history
    const { error: historyError } = await supabaseAdmin.from('points_history').insert({
      member_id: memberId,
      family_id: member.family_id,
      points: -STREAK_FREEZE_COST,
      reason: 'Purchased streak freeze',
    });

    if (historyError) {
      console.error('Error logging points history:', historyError);
      // Purchase was successful, don't fail
    }

    return successResponse(
      {
        success: true,
        member_id: memberId,
        member_name: member.name,
        points_spent: STREAK_FREEZE_COST,
        previous_points: currentPoints,
        new_points: newPoints,
        previous_freezes: currentFreezes,
        new_freezes: newFreezes,
        max_freezes: MAX_STREAK_FREEZES,
      },
      corsHeaders
    );
  } catch (error) {
    console.error('Error:', error);
    return errorResponse('Internal server error', 500, corsHeaders);
  }
});
