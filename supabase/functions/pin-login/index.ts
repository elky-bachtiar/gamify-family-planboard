import { createClient } from 'npm:@supabase/supabase-js@2';
import { create, getNumericDate } from 'https://deno.land/x/djwt@v2.8/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface PinLoginRequest {
  child_invite_code: string;
  pin: string;
}

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Create a Supabase-compatible JWT that will be accepted by RLS policies
async function createSupabaseJwt(memberId: string, familyId: string, jwtSecret: string): Promise<string> {
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
      exp: now + 60 * 60 * 24 * 7, // 7 days
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
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Create Supabase client with service role for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request body
    const { child_invite_code, pin }: PinLoginRequest = await req.json();

    if (!child_invite_code) {
      return new Response(
        JSON.stringify({ error: 'Invite code is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!pin) {
      return new Response(
        JSON.stringify({ error: 'PIN is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Look up family member by invite code
    const { data: member, error: memberError } = await supabaseAdmin
      .from('family_members')
      .select('*, families(*)')
      .eq('child_invite_code', child_invite_code)
      .eq('is_pin_user', true)
      .maybeSingle();

    if (memberError) {
      console.error('Member lookup error:', memberError);
      return new Response(
        JSON.stringify({ error: 'Failed to lookup user' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!member) {
      return new Response(
        JSON.stringify({ error: 'Invalid invite code' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!member.pin_hash) {
      return new Response(
        JSON.stringify({ error: 'PIN not configured for this account' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify PIN
    const pinHash = await hashPin(pin);
    const pinValid = pinHash === member.pin_hash;
    if (!pinValid) {
      return new Response(
        JSON.stringify({ error: 'Invalid PIN' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get JWT secret from Supabase secrets (set via `supabase secrets set JWT_SECRET=...`)
    // This must match your Supabase project's JWT secret for tokens to be valid
    const jwtSecret = Deno.env.get('JWT_SECRET');
    if (!jwtSecret) {
      console.error('JWT_SECRET not configured - set it via: supabase secrets set JWT_SECRET=your-secret');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create a Supabase-compatible JWT token
    // This token will be accepted by Supabase and auth.uid() will return the member_id
    const token = await createSupabaseJwt(member.id, member.family_id, jwtSecret);

    // Return member data and token
    return new Response(
      JSON.stringify({
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
        family: member.families ? {
          id: member.families.id,
          name: member.families.name,
          point_to_money_rate: member.families.point_to_money_rate,
          minimum_redemption: member.families.minimum_redemption,
          weekly_target_points: member.families.weekly_target_points,
          weekly_target_bonus: member.families.weekly_target_bonus,
        } : null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
