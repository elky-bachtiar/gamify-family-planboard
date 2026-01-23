import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  getCorsHeaders,
  checkRateLimit,
  rateLimitedResponse,
  getClientId,
  RATE_LIMITS,
  validateUuid,
  validateInput,
  MAX_INPUT_LENGTHS,
  parseJsonBody,
  errorResponse,
  successResponse,
} from '../_shared/security.ts';

interface CreateDisputeRequest {
  points_history_id: string;
  reason: string;
  evidence_urls?: string[];
}

/**
 * Create Dispute Edge Function
 *
 * Allows children to dispute a point deduction.
 * Creates a dispute record that admins can review.
 *
 * Validation:
 * - User must own the deduction (it was deducted from them)
 * - No existing dispute for this deduction
 * - Deduction must be within 7 days
 * - Deduction must be negative points
 *
 * Security:
 * - Rate limited to prevent abuse
 * - Only the affected member can create a dispute
 */
Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Rate limiting
    const clientId = getClientId(req);
    const rateLimitKey = `create-dispute:${clientId}`;
    const rateLimit = checkRateLimit(rateLimitKey, RATE_LIMITS['create-dispute']);

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
    let familyId: string | null = null;

    if (user) {
      // Regular user - get member from user_id
      const { data: memberData, error: memberError } = await supabaseAdmin
        .from('family_members')
        .select('id, family_id')
        .eq('user_id', user.id)
        .single();

      if (memberError || !memberData) {
        return errorResponse('User is not a family member', 403, corsHeaders);
      }

      memberId = memberData.id;
      familyId = memberData.family_id;
    } else {
      // Check for PIN user JWT claims
      try {
        const token = authHeader.replace('Bearer ', '');
        const payload = JSON.parse(atob(token.split('.')[1]));

        if (payload.family_member_id) {
          // Verify the member exists and get family_id
          const { data: pinMember, error: pinError } = await supabaseAdmin
            .from('family_members')
            .select('id, family_id')
            .eq('id', payload.family_member_id)
            .single();

          if (pinError || !pinMember) {
            return errorResponse('Invalid PIN user', 401, corsHeaders);
          }

          memberId = pinMember.id;
          familyId = pinMember.family_id;
        }
      } catch {
        // Token parsing failed
      }
    }

    if (!memberId || !familyId) {
      return errorResponse('Unauthorized', 401, corsHeaders);
    }

    // Parse and validate request body
    let body: CreateDisputeRequest;
    try {
      body = await parseJsonBody<CreateDisputeRequest>(req, 50_000); // 50KB max for evidence URLs
    } catch (error) {
      return errorResponse((error as Error).message, 400, corsHeaders);
    }

    const { points_history_id, reason, evidence_urls } = body;

    // Validate inputs
    const historyIdError = validateUuid(points_history_id, 'points_history_id');
    if (historyIdError) {
      return errorResponse(historyIdError, 400, corsHeaders);
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

    // Get the points history entry
    const { data: pointsHistory, error: historyError } = await supabaseAdmin
      .from('points_history')
      .select('id, member_id, family_id, points, reason, created_at')
      .eq('id', points_history_id)
      .single();

    if (historyError || !pointsHistory) {
      return errorResponse('Points history entry not found', 404, corsHeaders);
    }

    // Verify the deduction belongs to this member
    if (pointsHistory.member_id !== memberId) {
      return errorResponse('You can only dispute your own deductions', 403, corsHeaders);
    }

    // Verify it's a deduction (negative points)
    if (pointsHistory.points >= 0) {
      return errorResponse('Can only dispute point deductions', 400, corsHeaders);
    }

    // Verify within 7 day window
    const deductionDate = new Date(pointsHistory.created_at);
    const now = new Date();
    const daysSinceDeduction = (now.getTime() - deductionDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceDeduction > 7) {
      return errorResponse(
        'Disputes must be filed within 7 days of the deduction',
        400,
        corsHeaders
      );
    }

    // Check for existing dispute
    const { data: existingDispute, error: existingError } = await supabaseAdmin
      .from('deduction_disputes')
      .select('id')
      .eq('points_history_id', points_history_id)
      .maybeSingle();

    if (existingError) {
      console.error('Error checking existing dispute:', existingError);
      return errorResponse('Failed to check existing disputes', 500, corsHeaders);
    }

    if (existingDispute) {
      return errorResponse('A dispute already exists for this deduction', 400, corsHeaders);
    }

    // Create the dispute
    const { data: dispute, error: createError } = await supabaseAdmin
      .from('deduction_disputes')
      .insert({
        family_id: familyId,
        points_history_id,
        created_by: memberId,
        reason: reason.trim(),
        evidence_urls: evidence_urls || null,
        status: 'pending',
      })
      .select('id, status, created_at')
      .single();

    if (createError) {
      console.error('Error creating dispute:', createError);
      return errorResponse('Failed to create dispute', 500, corsHeaders);
    }

    return successResponse(
      {
        success: true,
        dispute_id: dispute.id,
        status: dispute.status,
        created_at: dispute.created_at,
        points_disputed: Math.abs(pointsHistory.points),
      },
      corsHeaders
    );
  } catch (error) {
    console.error('Error:', error);
    return errorResponse('Internal server error', 500, corsHeaders);
  }
});
