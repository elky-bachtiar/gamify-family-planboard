import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  getCorsHeaders,
  checkRateLimit,
  rateLimitedResponse,
  getClientId,
  RATE_LIMITS,
  validatePositiveInt,
  parseJsonBody,
  errorResponse,
  successResponse,
} from '../_shared/security.ts';

interface BirthdayAwardRequest {
  bonus_points?: number;  // Optional custom bonus, defaults to 100
}

interface BirthdayMember {
  id: string;
  name: string;
  family_id: string;
  total_points: number;
}

/**
 * Award Birthday Points Edge Function
 *
 * This function awards birthday bonus points to family members whose birthday
 * matches today's date (month and day).
 *
 * Can be called:
 * 1. By admins to manually trigger for their family
 * 2. By a scheduled cron job to run daily for all families
 *
 * When called by an authenticated admin, only awards to their family.
 * When called with a service role key (cron), awards to all families.
 *
 * Security:
 * - Only admins can manually trigger awards
 * - Includes idempotency check to prevent duplicate awards
 * - Rate limited to prevent abuse
 */
Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Rate limiting
    const clientId = getClientId(req);
    const rateLimitKey = `award-birthday-points:${clientId}`;
    const rateLimit = checkRateLimit(rateLimitKey, RATE_LIMITS['award-birthday-points']);

    if (!rateLimit.allowed) {
      return rateLimitedResponse(corsHeaders, rateLimit.resetIn);
    }

    // Create Supabase client with service role for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get optional bonus points from request body
    let bonusPoints = 100; // Default birthday bonus
    let familyIdFilter: string | null = null;

    // Check for authorization header to determine if admin or cron
    const authHeader = req.headers.get('Authorization');

    if (authHeader && !authHeader.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')) {
      // User-initiated request - verify they are admin and filter to their family
      const supabaseUser = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
          global: {
            headers: { Authorization: authHeader },
          },
        }
      );

      const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
      if (authError || !user) {
        return errorResponse('Unauthorized', 401, corsHeaders);
      }

      // Verify user is admin
      const { data: memberData, error: memberError } = await supabaseAdmin
        .from('family_members')
        .select('id, family_id, is_admin')
        .eq('user_id', user.id)
        .single();

      if (memberError || !memberData || !memberData.is_admin) {
        return errorResponse('Only admins can manually trigger birthday awards', 403, corsHeaders);
      }

      familyIdFilter = memberData.family_id;
    }

    // Parse request body for custom bonus points
    try {
      const body = await parseJsonBody<BirthdayAwardRequest>(req, 1000); // 1KB max
      if (body.bonus_points !== undefined) {
        const pointsError = validatePositiveInt(body.bonus_points, 'bonus_points', 1000);
        if (pointsError) {
          return errorResponse(pointsError, 400, corsHeaders);
        }
        bonusPoints = body.bonus_points;
      }
    } catch {
      // No body or invalid JSON - use defaults
    }

    // Get today's month and day
    const today = new Date();
    const currentMonth = today.getMonth() + 1; // JavaScript months are 0-indexed
    const currentDay = today.getDate();

    // Find all family members with today's birthday
    let query = supabaseAdmin
      .from('family_members')
      .select('id, name, family_id, total_points, birthdate')
      .not('birthdate', 'is', null);

    if (familyIdFilter) {
      query = query.eq('family_id', familyIdFilter);
    }

    const { data: members, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching members:', fetchError);
      return errorResponse('Failed to fetch family members', 500, corsHeaders);
    }

    // Filter members whose birthdate matches today (month and day)
    const birthdayMembers: BirthdayMember[] = (members || []).filter((member) => {
      if (!member.birthdate) return false;
      const birthdate = new Date(member.birthdate);
      return birthdate.getMonth() + 1 === currentMonth && birthdate.getDate() === currentDay;
    });

    if (birthdayMembers.length === 0) {
      return successResponse({
        success: true,
        message: 'No birthdays today',
        awarded_count: 0,
      }, corsHeaders);
    }

    // Check for already-awarded birthday points today to prevent duplicates (idempotency)
    const todayStart = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const todayEnd = new Date(today.setHours(23, 59, 59, 999)).toISOString();

    const { data: existingAwards } = await supabaseAdmin
      .from('points_history')
      .select('member_id')
      .eq('reason', 'Birthday bonus')
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd);

    const alreadyAwarded = new Set((existingAwards || []).map(a => a.member_id));

    // Filter out members who already received birthday points today
    const membersToAward = birthdayMembers.filter(m => !alreadyAwarded.has(m.id));

    if (membersToAward.length === 0) {
      return successResponse({
        success: true,
        message: 'Birthday points already awarded today',
        awarded_count: 0,
      }, corsHeaders);
    }

    // Award points to each birthday member
    const results = [];
    for (const member of membersToAward) {
      // Update member's total points
      const { error: updateError } = await supabaseAdmin
        .from('family_members')
        .update({ total_points: member.total_points + bonusPoints })
        .eq('id', member.id);

      if (updateError) {
        console.error(`Error updating points for ${member.id}:`, updateError);
        continue;
      }

      // Log to points history
      const { error: historyError } = await supabaseAdmin
        .from('points_history')
        .insert({
          member_id: member.id,
          family_id: member.family_id,
          points: bonusPoints,
          reason: 'Birthday bonus',
        });

      if (historyError) {
        console.error(`Error logging points history for ${member.id}:`, historyError);
      }

      results.push({
        member_id: member.id,
        name: member.name,
        points_awarded: bonusPoints,
      });
    }

    return successResponse({
      success: true,
      message: `Birthday points awarded to ${results.length} member(s)`,
      awarded_count: results.length,
      details: results,
    }, corsHeaders);
  } catch (error) {
    console.error('Error:', error);
    return errorResponse('Internal server error', 500, corsHeaders);
  }
});
