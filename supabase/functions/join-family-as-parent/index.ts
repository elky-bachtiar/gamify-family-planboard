import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface JoinFamilyAsParentRequest {
  parentInviteCode: string;
  memberName?: string;
  color?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
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
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body
    const { parentInviteCode, memberName, color }: JoinFamilyAsParentRequest = await req.json();

    if (!parentInviteCode) {
      return new Response(
        JSON.stringify({ error: 'Parent invite code is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Look up family by parent invite code using service role
    const { data: family, error: familyError } = await supabaseAdmin
      .from('families')
      .select('id, name')
      .eq('parent_invite_code', parentInviteCode)
      .maybeSingle();

    if (familyError) {
      console.error('Family lookup error:', familyError);
      return new Response(
        JSON.stringify({ error: 'Failed to lookup family', details: familyError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!family) {
      return new Response(
        JSON.stringify({ error: 'Invalid parent invite code', searchedCode: parentInviteCode }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if user is already a member
    const { data: existingMember } = await supabaseAdmin
      .from('family_members')
      .select('id')
      .eq('family_id', family.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingMember) {
      return new Response(
        JSON.stringify({ error: 'You are already a member of this family' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Add user to family as parent with admin rights
    const memberData: Record<string, unknown> = {
      family_id: family.id,
      user_id: user.id,
      role: 'parent',
      is_admin: true,
      email: user.email,
    };

    if (memberName) {
      memberData.name = memberName;
    }

    if (color) {
      memberData.color = color;
    }

    const { error: insertError } = await supabaseAdmin
      .from('family_members')
      .insert(memberData);

    if (insertError) {
      console.error('Insert member error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to join family as parent' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        family: {
          id: family.id,
          name: family.name,
        },
        isAdmin: true,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Join family as parent error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
