import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  getCorsHeaders,
  checkRateLimit,
  getClientId,
  RATE_LIMITS,
  rateLimitedResponse,
  validateInput,
  validateUuid,
  validatePin,
  MAX_INPUT_LENGTHS,
  errorResponse,
  successResponse,
  parseJsonBody,
} from '../_shared/security.ts';

interface CreateChildRequest {
  name: string;
  pin: string;
  color: string;
  family_id: string;
}

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

Deno.serve(async (req: Request) => {
  // Get dynamic CORS headers based on origin
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: cors });
  }

  try {
    // Rate limiting - prevent abuse of child account creation
    const clientId = getClientId(req);
    const rateLimitKey = `create-child:${clientId}`;
    const rateLimit = checkRateLimit(rateLimitKey, RATE_LIMITS['create-child']);

    if (!rateLimit.allowed) {
      return rateLimitedResponse(cors, rateLimit.resetIn);
    }

    // Get the authorization header
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

    // Verify user is admin of the family
    const { data: memberData, error: memberError } = await supabaseAdmin
      .from('family_members')
      .select('id, family_id, is_admin')
      .eq('user_id', user.id)
      .single();

    if (memberError || !memberData) {
      return errorResponse('User is not a family member', 403, cors);
    }

    if (!memberData.is_admin) {
      return errorResponse('Only admins can create child accounts', 403, cors);
    }

    // Parse and validate request body with size limit
    let body: CreateChildRequest;
    try {
      body = await parseJsonBody<CreateChildRequest>(req);
    } catch (e) {
      return errorResponse((e as Error).message, 400, cors);
    }

    const { name, pin, color, family_id } = body;

    // Input validation
    const nameError = validateInput(name, 'Name', MAX_INPUT_LENGTHS.name);
    if (nameError) {
      return errorResponse(nameError, 400, cors);
    }

    const pinError = validatePin(pin);
    if (pinError) {
      return errorResponse(pinError, 400, cors);
    }

    const familyIdError = validateUuid(family_id, 'Family ID');
    if (familyIdError) {
      return errorResponse(familyIdError, 400, cors);
    }

    // Validate color if provided (optional)
    if (color) {
      const colorError = validateInput(color, 'Color', 50, false);
      if (colorError) {
        return errorResponse(colorError, 400, cors);
      }
    }

    // Verify the family_id matches the admin's family
    if (family_id !== memberData.family_id) {
      return errorResponse('Cannot create child in a different family', 403, cors);
    }

    // Hash the PIN
    const pinHash = await hashPin(pin);

    // Generate unique invite code
    let childInviteCode = generateInviteCode();
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const { data: existing } = await supabaseAdmin
        .from('family_members')
        .select('id')
        .eq('child_invite_code', childInviteCode)
        .maybeSingle();

      if (!existing) break;

      childInviteCode = generateInviteCode();
      attempts++;
    }

    if (attempts >= maxAttempts) {
      return errorResponse('Failed to generate unique invite code', 500, cors);
    }

    // Create the child member
    const { data: newMember, error: insertError } = await supabaseAdmin
      .from('family_members')
      .insert({
        name: name.trim(),
        family_id,
        color: color || '#3B82F6',
        role: 'child',
        is_admin: false,
        is_pin_user: true,
        pin_hash: pinHash,
        child_invite_code: childInviteCode,
        user_id: null, // PIN users don't have a Supabase auth user
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      // Don't leak database error details to client
      return errorResponse('Failed to create child account', 500, cors);
    }

    return successResponse(
      {
        success: true,
        child_invite_code: childInviteCode,
        member: {
          id: newMember.id,
          name: newMember.name,
          color: newMember.color,
        },
      },
      cors
    );
  } catch (error) {
    console.error('Error:', error);
    return errorResponse('Internal server error', 500, cors);
  }
});
