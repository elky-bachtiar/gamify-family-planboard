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

interface ResolveDisputeRequest {
  dispute_id: string;
  decision: 'approved' | 'rejected';
  resolution_note?: string;
}

/**
 * Resolve Dispute Edge Function
 *
 * Admin-only operation to resolve a pending dispute.
 * - If approved: restores the deducted points to the member
 * - If rejected: marks the dispute as rejected with optional note
 *
 * Security:
 * - Only admins can resolve disputes
 * - Can only resolve disputes in the admin's family
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
    const rateLimitKey = `resolve-dispute:${clientId}`;
    const rateLimit = checkRateLimit(rateLimitKey, RATE_LIMITS['resolve-dispute']);

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
      return errorResponse('Only admins can resolve disputes', 403, corsHeaders);
    }

    // Parse and validate request body
    let body: ResolveDisputeRequest;
    try {
      body = await parseJsonBody<ResolveDisputeRequest>(req, 10_000);
    } catch (error) {
      return errorResponse((error as Error).message, 400, corsHeaders);
    }

    const { dispute_id, decision, resolution_note } = body;

    // Validate inputs
    const disputeIdError = validateUuid(dispute_id, 'dispute_id');
    if (disputeIdError) {
      return errorResponse(disputeIdError, 400, corsHeaders);
    }

    if (decision !== 'approved' && decision !== 'rejected') {
      return errorResponse('decision must be either "approved" or "rejected"', 400, corsHeaders);
    }

    if (resolution_note) {
      const noteError = validateInput(
        resolution_note,
        'resolution_note',
        MAX_INPUT_LENGTHS.reason,
        false
      );
      if (noteError) {
        return errorResponse(noteError, 400, corsHeaders);
      }
    }

    // Get the dispute
    const { data: dispute, error: disputeError } = await supabaseAdmin
      .from('deduction_disputes')
      .select('id, family_id, points_history_id, created_by, status')
      .eq('id', dispute_id)
      .single();

    if (disputeError || !dispute) {
      return errorResponse('Dispute not found', 404, corsHeaders);
    }

    // Verify dispute is in admin's family
    if (dispute.family_id !== adminData.family_id) {
      return errorResponse('Cannot resolve disputes outside your family', 403, corsHeaders);
    }

    // Verify dispute is still pending
    if (dispute.status !== 'pending') {
      return errorResponse('This dispute has already been resolved', 400, corsHeaders);
    }

    // Get the original points history entry
    const { data: pointsHistory, error: historyError } = await supabaseAdmin
      .from('points_history')
      .select('id, member_id, points, reason')
      .eq('id', dispute.points_history_id)
      .single();

    if (historyError || !pointsHistory) {
      return errorResponse('Original deduction not found', 404, corsHeaders);
    }

    const pointsToRestore = Math.abs(pointsHistory.points);
    let newMemberPoints: number | null = null;

    // If approved, restore points
    if (decision === 'approved') {
      // Get current member points
      const { data: member, error: memberError } = await supabaseAdmin
        .from('family_members')
        .select('id, total_points')
        .eq('id', pointsHistory.member_id)
        .single();

      if (memberError || !member) {
        return errorResponse('Member not found', 404, corsHeaders);
      }

      const currentPoints = member.total_points || 0;
      newMemberPoints = currentPoints + pointsToRestore;

      // Update member points
      const { error: updateError } = await supabaseAdmin
        .from('family_members')
        .update({ total_points: newMemberPoints })
        .eq('id', member.id);

      if (updateError) {
        console.error('Error updating member points:', updateError);
        return errorResponse('Failed to restore points', 500, corsHeaders);
      }

      // Log to points history
      const { error: logError } = await supabaseAdmin.from('points_history').insert({
        member_id: member.id,
        family_id: dispute.family_id,
        points: pointsToRestore,
        reason: `Points restored: Dispute approved by admin`,
      });

      if (logError) {
        console.error('Error logging points restoration:', logError);
        // Points were restored, don't fail
      }
    }

    // Update the dispute
    const { data: updatedDispute, error: updateError } = await supabaseAdmin
      .from('deduction_disputes')
      .update({
        status: decision,
        resolved_by: adminData.id,
        resolved_at: new Date().toISOString(),
        resolution_note: resolution_note?.trim() || null,
        points_restored: decision === 'approved' ? pointsToRestore : null,
      })
      .eq('id', dispute_id)
      .select('id, status, resolved_at, resolution_note, points_restored')
      .single();

    if (updateError) {
      console.error('Error updating dispute:', updateError);
      return errorResponse('Failed to resolve dispute', 500, corsHeaders);
    }

    return successResponse(
      {
        success: true,
        dispute_id: updatedDispute.id,
        status: updatedDispute.status,
        resolved_at: updatedDispute.resolved_at,
        resolution_note: updatedDispute.resolution_note,
        points_restored: updatedDispute.points_restored,
        new_member_total: newMemberPoints,
      },
      corsHeaders
    );
  } catch (error) {
    console.error('Error:', error);
    return errorResponse('Internal server error', 500, corsHeaders);
  }
});
