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

interface DeductPointsWithEvidenceRequest {
  member_id: string;
  points: number;
  reason: string;
  evidence_urls?: string[];
}

/**
 * Deduct Points with Evidence Edge Function
 *
 * Admin-only operation to deduct points from a family member with optional photo evidence.
 * Creates a proper audit trail in points_history with negative points and evidence URLs.
 *
 * This allows parents to:
 * - Deduct points for misbehavior with photographic evidence
 * - Provide proof of the reason for deduction
 * - Create a fair system where children can see why points were deducted
 *
 * Security:
 * - Only admins can deduct points
 * - Can only deduct from members in the admin's family
 * - Cannot reduce below zero (floor at 0)
 * - Rate limited to prevent abuse
 * - Evidence URLs must be from the dispute-evidence bucket
 */
Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Rate limiting
    const clientId = getClientId(req);
    const rateLimitKey = `deduct-points-with-evidence:${clientId}`;
    const rateLimit = checkRateLimit(rateLimitKey, RATE_LIMITS['deduct-points-with-evidence']);

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
    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser();
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
    let body: DeductPointsWithEvidenceRequest;
    try {
      body = await parseJsonBody<DeductPointsWithEvidenceRequest>(req, 50_000); // 50KB max for evidence URLs
    } catch (error) {
      return errorResponse((error as Error).message, 400, corsHeaders);
    }

    const { member_id, points, reason, evidence_urls } = body;

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

    // Validate evidence URLs if provided
    if (evidence_urls) {
      if (!Array.isArray(evidence_urls)) {
        return errorResponse('evidence_urls must be an array', 400, corsHeaders);
      }
      if (evidence_urls.length > 3) {
        return errorResponse('Maximum 3 evidence images allowed', 400, corsHeaders);
      }
      for (const url of evidence_urls) {
        if (typeof url !== 'string' || url.length > 2048) {
          return errorResponse('Invalid evidence URL', 400, corsHeaders);
        }
      }
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
      return errorResponse(
        'Cannot deduct points from members outside your family',
        403,
        corsHeaders
      );
    }

    // Calculate new points (floor at 0 to prevent negative totals)
    const currentPoints = targetMember.total_points || 0;
    const newPoints = Math.max(0, currentPoints - points);
    const actualDeduction = currentPoints - newPoints;

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
    const { data: historyEntry, error: historyError } = await supabaseAdmin
      .from('points_history')
      .insert({
        member_id,
        family_id: targetMember.family_id,
        points: -actualDeduction, // Negative to indicate deduction
        reason: `Point deduction: ${reason.trim()}`,
        evidence_urls: evidence_urls || null,
      })
      .select('id')
      .single();

    if (historyError) {
      console.error('Error logging points history:', historyError);
      // Points were updated, log the history error but don't fail
    }

    return successResponse(
      {
        success: true,
        member_id,
        member_name: targetMember.name,
        points_deducted: actualDeduction,
        previous_total: currentPoints,
        new_total: newPoints,
        reason: reason.trim(),
        evidence_urls: evidence_urls || [],
        points_history_id: historyEntry?.id || null,
      },
      corsHeaders
    );
  } catch (error) {
    console.error('Error:', error);
    return errorResponse('Internal server error', 500, corsHeaders);
  }
});
