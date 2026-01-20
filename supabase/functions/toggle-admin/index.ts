import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ToggleAdminRequest {
  memberId: string;
  makeAdmin: boolean;
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
    const { memberId, makeAdmin }: ToggleAdminRequest = await req.json();

    if (!memberId) {
      return new Response(
        JSON.stringify({ error: 'Member ID is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get the caller's family member record
    const { data: callerMember, error: callerError } = await supabaseAdmin
      .from('family_members')
      .select('id, family_id, is_admin')
      .eq('user_id', user.id)
      .maybeSingle();

    if (callerError || !callerMember) {
      return new Response(
        JSON.stringify({ error: 'Caller is not a family member' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify caller is an admin
    if (!callerMember.is_admin) {
      return new Response(
        JSON.stringify({ error: 'Only admins can modify admin status' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get the target member
    const { data: targetMember, error: targetError } = await supabaseAdmin
      .from('family_members')
      .select('id, family_id, is_admin, name')
      .eq('id', memberId)
      .maybeSingle();

    if (targetError || !targetMember) {
      return new Response(
        JSON.stringify({ error: 'Target member not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify both are in the same family
    if (targetMember.family_id !== callerMember.family_id) {
      return new Response(
        JSON.stringify({ error: 'Cannot modify members from other families' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // If demoting (removing admin), check that we're not removing the last admin
    if (!makeAdmin && targetMember.is_admin) {
      const { count, error: countError } = await supabaseAdmin
        .from('family_members')
        .select('id', { count: 'exact', head: true })
        .eq('family_id', callerMember.family_id)
        .eq('is_admin', true);

      if (countError) {
        return new Response(
          JSON.stringify({ error: 'Failed to check admin count' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      if (count && count <= 1) {
        return new Response(
          JSON.stringify({ error: 'Cannot remove the last admin from the family' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
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
      return new Response(
        JSON.stringify({ error: 'Failed to update admin status' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        member: {
          id: memberId,
          name: targetMember.name,
          is_admin: makeAdmin,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Toggle admin error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
