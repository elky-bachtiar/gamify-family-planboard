import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  getCorsHeaders,
  checkRateLimit,
  rateLimitedResponse,
  getClientId,
  RATE_LIMITS,
  validateUuid,
  parseJsonBody,
  errorResponse,
  successResponse,
} from '../_shared/security.ts';

interface DisableMemberRequest {
  member_id: string;
  disable: boolean; // true to disable, false to re-enable
}

/**
 * Disable/Enable Member Edge Function
 *
 * Admin-only operation to disable or re-enable a family member account.
 * Disabled accounts cannot log in.
 *
 * Security:
 * - Only admins can disable/enable members
 * - Can only manage members in the admin's family
 * - Cannot disable self or other admins
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
    const rateLimitKey = `disable-member:${clientId}`;
    const rateLimit = checkRateLimit(rateLimitKey, RATE_LIMITS['disable-member']);

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
      return errorResponse('Only admins can disable/enable members', 403, corsHeaders);
    }

    // Parse and validate request body
    let body: DisableMemberRequest;
    try {
      body = await parseJsonBody<DisableMemberRequest>(req, 1000); // 1KB max
    } catch (error) {
      return errorResponse((error as Error).message, 400, corsHeaders);
    }

    const { member_id, disable } = body;

    // Validate inputs
    const memberIdError = validateUuid(member_id, 'member_id');
    if (memberIdError) {
      return errorResponse(memberIdError, 400, corsHeaders);
    }

    if (typeof disable !== 'boolean') {
      return errorResponse('disable must be a boolean', 400, corsHeaders);
    }

    // Cannot disable self
    if (member_id === adminData.id) {
      return errorResponse('Cannot disable your own account', 400, corsHeaders);
    }

    // Verify target member exists and is in admin's family
    const { data: targetMember, error: memberError } = await supabaseAdmin
      .from('family_members')
      .select('id, name, family_id, is_admin, is_disabled')
      .eq('id', member_id)
      .single();

    if (memberError || !targetMember) {
      return errorResponse('Member not found', 404, corsHeaders);
    }

    if (targetMember.family_id !== adminData.family_id) {
      return errorResponse('Cannot manage members outside your family', 403, corsHeaders);
    }

    // Cannot disable other admins
    if (targetMember.is_admin && disable) {
      return errorResponse('Cannot disable an admin account. Remove admin rights first.', 400, corsHeaders);
    }

    // Update the member's disabled status
    const updateData: Record<string, unknown> = {
      is_disabled: disable,
    };

    if (disable) {
      updateData.disabled_at = new Date().toISOString();
      updateData.disabled_by = adminData.id;
    } else {
      updateData.disabled_at = null;
      updateData.disabled_by = null;
    }

    const { error: updateError } = await supabaseAdmin
      .from('family_members')
      .update(updateData)
      .eq('id', member_id);

    if (updateError) {
      console.error('Error updating member:', updateError);
      return errorResponse('Failed to update member status', 500, corsHeaders);
    }

    return successResponse({
      success: true,
      member_id,
      member_name: targetMember.name,
      is_disabled: disable,
      message: disable
        ? `${targetMember.name} has been disabled`
        : `${targetMember.name} has been re-enabled`,
    }, corsHeaders);
  } catch (error) {
    console.error('Error:', error);
    return errorResponse('Internal server error', 500, corsHeaders);
  }
});
