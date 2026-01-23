import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  getCorsHeaders,
  checkRateLimit,
  rateLimitedResponse,
  getClientId,
  RATE_LIMITS,
  validateUuid,
  validatePin,
  parseJsonBody,
  errorResponse,
  successResponse,
} from '../_shared/security.ts';

interface ResetPinRequest {
  member_id: string;
  new_pin: string;
}

/**
 * Hash a PIN using SHA-256
 */
async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Reset Child PIN Edge Function
 *
 * Admin-only operation to reset a child's PIN code.
 *
 * Security:
 * - Only admins can reset PINs
 * - Can only reset PINs for members in the admin's family
 * - PIN must be 4-6 digits
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
    const rateLimitKey = `reset-child-pin:${clientId}`;
    const rateLimit = checkRateLimit(rateLimitKey, RATE_LIMITS['reset-child-pin']);

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
      return errorResponse('Only admins can reset PINs', 403, corsHeaders);
    }

    // Parse and validate request body
    let body: ResetPinRequest;
    try {
      body = await parseJsonBody<ResetPinRequest>(req, 1000); // 1KB max
    } catch (error) {
      return errorResponse((error as Error).message, 400, corsHeaders);
    }

    const { member_id, new_pin } = body;

    // Validate inputs
    const memberIdError = validateUuid(member_id, 'member_id');
    if (memberIdError) {
      return errorResponse(memberIdError, 400, corsHeaders);
    }

    const pinError = validatePin(new_pin, 'PIN');
    if (pinError) {
      return errorResponse(pinError, 400, corsHeaders);
    }

    // Verify target member exists and is in admin's family
    const { data: targetMember, error: memberError } = await supabaseAdmin
      .from('family_members')
      .select('id, name, family_id, is_pin_user')
      .eq('id', member_id)
      .single();

    if (memberError || !targetMember) {
      return errorResponse('Member not found', 404, corsHeaders);
    }

    if (targetMember.family_id !== adminData.family_id) {
      return errorResponse('Cannot reset PIN for members outside your family', 403, corsHeaders);
    }

    if (!targetMember.is_pin_user) {
      return errorResponse('This member does not use PIN login', 400, corsHeaders);
    }

    // Hash the new PIN
    const pinHash = await hashPin(new_pin);

    // Update the member's PIN
    const { error: updateError } = await supabaseAdmin
      .from('family_members')
      .update({ pin_hash: pinHash })
      .eq('id', member_id);

    if (updateError) {
      console.error('Error updating PIN:', updateError);
      return errorResponse('Failed to update PIN', 500, corsHeaders);
    }

    return successResponse({
      success: true,
      member_id,
      member_name: targetMember.name,
      message: 'PIN has been reset successfully',
    }, corsHeaders);
  } catch (error) {
    console.error('Error:', error);
    return errorResponse('Internal server error', 500, corsHeaders);
  }
});
