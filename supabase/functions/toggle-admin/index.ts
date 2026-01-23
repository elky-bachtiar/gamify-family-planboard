import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  getCorsHeaders,
  checkRateLimit,
  getClientId,
  RATE_LIMITS,
  rateLimitedResponse,
  validateUuid,
  errorResponse,
  successResponse,
  parseJsonBody,
} from '../_shared/security.ts';

interface ToggleAdminRequest {
  memberId: string;
  makeAdmin: boolean;
}

Deno.serve(async (req: Request) => {
  // Get dynamic CORS headers based on origin
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: cors });
  }

  try {
    // Rate limiting - prevent abuse
    const clientId = getClientId(req);
    const rateLimitKey = `toggle-admin:${clientId}`;
    const rateLimit = checkRateLimit(rateLimitKey, RATE_LIMITS['toggle-admin']);

    if (!rateLimit.allowed) {
      return rateLimitedResponse(cors, rateLimit.resetIn);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse('Missing authorization header', 401, cors);
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
      return errorResponse('Unauthorized', 401, cors);
    }

    // Parse and validate request body with size limit
    let body: ToggleAdminRequest;
    try {
      body = await parseJsonBody<ToggleAdminRequest>(req);
    } catch (e) {
      return errorResponse((e as Error).message, 400, cors);
    }

    const { memberId, makeAdmin } = body;

    // Input validation
    const memberIdError = validateUuid(memberId, 'Member ID');
    if (memberIdError) {
      return errorResponse(memberIdError, 400, cors);
    }

    if (typeof makeAdmin !== 'boolean') {
      return errorResponse('makeAdmin must be a boolean', 400, cors);
    }

    // Get the caller's family member record
    const { data: callerMember, error: callerError } = await supabaseAdmin
      .from('family_members')
      .select('id, family_id, is_admin')
      .eq('user_id', user.id)
      .maybeSingle();

    if (callerError || !callerMember) {
      return errorResponse('Caller is not a family member', 403, cors);
    }

    // Verify caller is an admin
    if (!callerMember.is_admin) {
      return errorResponse('Only admins can modify admin status', 403, cors);
    }

    // Get the target member
    const { data: targetMember, error: targetError } = await supabaseAdmin
      .from('family_members')
      .select('id, family_id, is_admin, name')
      .eq('id', memberId)
      .maybeSingle();

    if (targetError || !targetMember) {
      return errorResponse('Target member not found', 404, cors);
    }

    // Verify both are in the same family
    if (targetMember.family_id !== callerMember.family_id) {
      return errorResponse('Cannot modify members from other families', 403, cors);
    }

    // If demoting (removing admin), check that we're not removing the last admin
    if (!makeAdmin && targetMember.is_admin) {
      const { count, error: countError } = await supabaseAdmin
        .from('family_members')
        .select('id', { count: 'exact', head: true })
        .eq('family_id', callerMember.family_id)
        .eq('is_admin', true);

      if (countError) {
        return errorResponse('Failed to check admin count', 500, cors);
      }

      if (count && count <= 1) {
        return errorResponse('Cannot remove the last admin from the family', 400, cors);
      }
    }

    // Update the member's admin status
    const updateData: Record<string, unknown> = {
      is_admin: makeAdmin,
    };

    // When promoting to admin, also set role to 'parent'
    if (makeAdmin) {
      updateData.role = 'parent';
    }

    const { error: updateError } = await supabaseAdmin
      .from('family_members')
      .update(updateData)
      .eq('id', memberId);

    if (updateError) {
      console.error('Update error:', updateError);
      return errorResponse('Failed to update admin status', 500, cors);
    }

    return successResponse(
      {
        success: true,
        member: {
          id: memberId,
          name: targetMember.name,
          is_admin: makeAdmin,
        },
      },
      cors
    );
  } catch (error) {
    console.error('Toggle admin error:', error);
    return errorResponse('Internal server error', 500, cors);
  }
});
