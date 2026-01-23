import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  getCorsHeaders,
  checkRateLimit,
  rateLimitedResponse,
  getClientId,
  RATE_LIMITS,
  validateUuid,
  validateInput,
  validatePositiveInt,
  MAX_INPUT_LENGTHS,
  parseJsonBody,
  errorResponse,
  successResponse,
} from '../_shared/security.ts';

interface DeductPointsRequest {
  member_id: string;
  points: number;
  reason: string;
}

/**
 * Deduct Points Edge Function
 *
 * Admin-only operation to deduct points from a family member.
 * Creates a proper audit trail in points_history with negative points.
 *
 * This allows parents to:
 * - Deduct points for misbehavior
 * - Correct point errors
 * - Implement point penalties for broken rules
 *
 * Security:
 * - Only admins can deduct points
 * - Can only deduct from members in the admin's family
 * - Cannot reduce below zero (optional floor)
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
    const rateLimitKey = `deduct-points:${clientId}`;
    const rateLimit = checkRateLimit(rateLimitKey, RATE_LIMITS['deduct-points']);

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

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return errorResponse('Unauthorized', 401, corsHeaders);
    }

    // Verify user is admin of a family
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('family_members')
      .select('id, family_id, is_admin')
      .eq('user_id', user.id)
      .single();

    if (adminError || !adminData) {
      return errorResponse('User is not a family member', 403, corsHeaders);
    }

    if (!adminData.is_admin) {
      return errorResponse('Only admins can deduct points', 403, corsHeaders);
    }

    // Parse and validate request body
    let body: DeductPointsRequest;
    try {
      body = await parseJsonBody<DeductPointsRequest>(req, 10_000); // 10KB max
    } catch (error) {
      return errorResponse((error as Error).message, 400, corsHeaders);
    }

    const { member_id, points, reason } = body;

    // Validate inputs
    const memberIdError = validateUuid(member_id, 'member_id');
    if (memberIdError) {
      return errorResponse(memberIdError, 400, corsHeaders);
    }

    const pointsError = validatePositiveInt(points, 'points', 100000);
    if (pointsError) {
      return errorResponse(pointsError, 400, corsHeaders);
    }

    const reasonError = validateInput(reason, 'reason', MAX_INPUT_LENGTHS.reason, true);
    if (reasonError) {
      return errorResponse(reasonError, 400, corsHeaders);
    }

    // Verify target member is in admin's family
    const { data: targetMember, error: memberError } = await supabaseAdmin
      .from('family_members')
      .select('id, name, family_id, total_points')
      .eq('id', member_id)
      .single();

    if (memberError || !targetMember) {
      return errorResponse('Member not found', 404, corsHeaders);
    }

    if (targetMember.family_id !== adminData.family_id) {
      return errorResponse('Cannot deduct points from members outside your family', 403, corsHeaders);
    }

    // Calculate new points (floor at 0 to prevent negative totals)
    const newPoints = Math.max(0, targetMember.total_points - points);
    const actualDeduction = targetMember.total_points - newPoints;

    // Update member's total points
    const { error: updateError } = await supabaseAdmin
      .from('family_members')
      .update({ total_points: newPoints })
      .eq('id', member_id);

    if (updateError) {
      console.error('Error updating points:', updateError);
      return errorResponse('Failed to update points', 500, corsHeaders);
    }

    // Log to points history with negative points for audit trail
    const { error: historyError } = await supabaseAdmin
      .from('points_history')
      .insert({
        member_id,
        family_id: targetMember.family_id,
        points: -actualDeduction, // Negative to indicate deduction
        reason: `Point deduction: ${reason.trim()}`,
      });

    if (historyError) {
      console.error('Error logging points history:', historyError);
      // Points were updated, log the history error but don't fail
    }

    return successResponse({
      success: true,
      member_id,
      member_name: targetMember.name,
      points_deducted: actualDeduction,
      previous_total: targetMember.total_points,
      new_total: newPoints,
      reason: reason.trim(),
    }, corsHeaders);
  } catch (error) {
    console.error('Error:', error);
    return errorResponse('Internal server error', 500, corsHeaders);
  }
});
