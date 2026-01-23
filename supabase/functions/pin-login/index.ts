import { createClient } from 'npm:@supabase/supabase-js@2';
import { create } from 'https://deno.land/x/djwt@v2.8/mod.ts';
import {
  getCorsHeaders,
  checkRateLimit,
  getClientId,
  RATE_LIMITS,
  rateLimitedResponse,
  validateInput,
  validatePin,
  MAX_INPUT_LENGTHS,
  errorResponse,
  successResponse,
  parseJsonBody,
  JWT_EXPIRY,
} from '../_shared/security.ts';

interface PinLoginRequest {
  child_invite_code: string;
  pin: string;
}

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Create a Supabase-compatible JWT that will be accepted by RLS policies
async function createSupabaseJwt(
  memberId: string,
  familyId: string,
  jwtSecret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(jwtSecret);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );

  // Create a JWT with claims that Supabase expects
  // Using member_id as 'sub' so auth.uid() returns the member_id
  const now = Math.floor(Date.now() / 1000);
  const token = await create(
    { alg: 'HS256', typ: 'JWT' },
    {
      aud: 'authenticated',
      exp: now + JWT_EXPIRY.PIN_USER, // 24 hours (reduced from 7 days)
      iat: now,
      iss: Deno.env.get('SUPABASE_URL') + '/auth/v1',
      sub: memberId, // This becomes auth.uid()
      role: 'authenticated',
      // Custom claims for PIN user identification
      is_pin_user: true,
      family_id: familyId,
    },
    key
  );

  return token;
}

Deno.serve(async (req: Request) => {
  // Get dynamic CORS headers based on origin
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: cors });
  }

  try {
    // Rate limiting - CRITICAL for PIN brute force protection
    const clientId = getClientId(req);
    const rateLimitKey = `pin-login:${clientId}`;
    const rateLimit = checkRateLimit(rateLimitKey, RATE_LIMITS['pin-login']);

    if (!rateLimit.allowed) {
      return rateLimitedResponse(cors, rateLimit.resetIn);
    }

    // Parse and validate request body with size limit
    let body: PinLoginRequest;
    try {
      body = await parseJsonBody<PinLoginRequest>(req);
    } catch (e) {
      return errorResponse((e as Error).message, 400, cors);
    }

    const { child_invite_code, pin } = body;

    // Input validation
    const inviteCodeError = validateInput(
      child_invite_code,
      'Invite code',
      MAX_INPUT_LENGTHS.invite_code
    );
    if (inviteCodeError) {
      return errorResponse(inviteCodeError, 400, cors);
    }

    const pinError = validatePin(pin);
    if (pinError) {
      return errorResponse(pinError, 400, cors);
    }

    // Create Supabase client with service role for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Look up family member by invite code
    const { data: member, error: memberError } = await supabaseAdmin
      .from('family_members')
      .select('*, families(*)')
      .eq('child_invite_code', child_invite_code)
      .eq('is_pin_user', true)
      .maybeSingle();

    if (memberError) {
      console.error('Member lookup error:', memberError);
      return errorResponse('Failed to lookup user', 500, cors);
    }

    // Use generic error message to prevent user enumeration
    if (!member) {
      return errorResponse('Invalid credentials', 401, cors);
    }

    if (!member.pin_hash) {
      return errorResponse('Invalid credentials', 401, cors);
    }

    // Check if account is disabled
    if (member.is_disabled) {
      return errorResponse('Account is disabled', 403, cors);
    }

    // Verify PIN
    const pinHash = await hashPin(pin);
    const pinValid = pinHash === member.pin_hash;
    if (!pinValid) {
      // Use same generic error for security
      return errorResponse('Invalid credentials', 401, cors);
    }

    // Get JWT secret from Supabase secrets
    const jwtSecret = Deno.env.get('JWT_SECRET');
    if (!jwtSecret) {
      console.error(
        'JWT_SECRET not configured - set it via: supabase secrets set JWT_SECRET=your-secret'
      );
      return errorResponse('Server configuration error', 500, cors);
    }

    // Create a Supabase-compatible JWT token with reduced expiry
    const token = await createSupabaseJwt(member.id, member.family_id, jwtSecret);

    // Return member data and token
    return successResponse(
      {
        success: true,
        token,
        member: {
          id: member.id,
          name: member.name,
          color: member.color,
          total_points: member.total_points,
          current_level: member.current_level,
          current_streak: member.current_streak,
          family_id: member.family_id,
          role: member.role,
          is_admin: member.is_admin,
          is_pin_user: member.is_pin_user,
        },
        family: member.families
          ? {
              id: member.families.id,
              name: member.families.name,
              point_to_money_rate: member.families.point_to_money_rate,
              minimum_redemption: member.families.minimum_redemption,
              weekly_target_points: member.families.weekly_target_points,
              weekly_target_bonus: member.families.weekly_target_bonus,
            }
          : null,
      },
      cors
    );
  } catch (error) {
    console.error('Error:', error);
    return errorResponse('Internal server error', 500, cors);
  }
});
