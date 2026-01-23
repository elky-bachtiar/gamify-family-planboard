import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  getCorsHeaders,
  checkRateLimit,
  rateLimitedResponse,
  getClientId,
  RATE_LIMITS,
  parseJsonBody,
  errorResponse,
  successResponse,
} from '../_shared/security.ts';

interface RegenerateCodeRequest {
  code_type: 'member' | 'parent';
}

/**
 * Generate a random invite code
 */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars like 0, O, I, 1
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Regenerate Invite Code Edge Function
 *
 * Admin-only operation to regenerate family invite codes.
 * Can regenerate either the member invite code or the parent invite code.
 *
 * Security:
 * - Only admins can regenerate codes
 * - Ensures uniqueness of new codes
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
    const rateLimitKey = `regenerate-invite-code:${clientId}`;
    const rateLimit = checkRateLimit(rateLimitKey, RATE_LIMITS['regenerate-invite-code']);

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
      return errorResponse('Only admins can regenerate invite codes', 403, corsHeaders);
    }

    // Parse and validate request body
    let body: RegenerateCodeRequest;
    try {
      body = await parseJsonBody<RegenerateCodeRequest>(req, 1000); // 1KB max
    } catch (error) {
      return errorResponse((error as Error).message, 400, corsHeaders);
    }

    const { code_type } = body;

    if (code_type !== 'member' && code_type !== 'parent') {
      return errorResponse('code_type must be "member" or "parent"', 400, corsHeaders);
    }

    // Generate a unique new code
    let newCode: string;
    let isUnique = false;
    const columnName = code_type === 'member' ? 'invite_code' : 'parent_invite_code';

    // Try up to 10 times to generate a unique code
    for (let attempts = 0; attempts < 10 && !isUnique; attempts++) {
      newCode = generateInviteCode();

      // Check if code already exists
      const { data: existingFamily } = await supabaseAdmin
        .from('families')
        .select('id')
        .eq(columnName, newCode)
        .single();

      if (!existingFamily) {
        isUnique = true;
      }
    }

    if (!isUnique) {
      return errorResponse('Failed to generate unique code. Please try again.', 500, corsHeaders);
    }

    // Update the family with the new code
    const updateData: Record<string, string> = {};
    updateData[columnName] = newCode!;

    const { error: updateError } = await supabaseAdmin
      .from('families')
      .update(updateData)
      .eq('id', adminData.family_id);

    if (updateError) {
      console.error('Error updating invite code:', updateError);
      return errorResponse('Failed to update invite code', 500, corsHeaders);
    }

    return successResponse({
      success: true,
      code_type,
      new_code: newCode!,
    }, corsHeaders);
  } catch (error) {
    console.error('Error:', error);
    return errorResponse('Internal server error', 500, corsHeaders);
  }
});
