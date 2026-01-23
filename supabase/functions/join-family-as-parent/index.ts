import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  getCorsHeaders,
  checkRateLimit,
  getClientId,
  RATE_LIMITS,
  rateLimitedResponse,
  validateInput,
  MAX_INPUT_LENGTHS,
  errorResponse,
  successResponse,
  parseJsonBody,
} from '../_shared/security.ts';

interface JoinFamilyAsParentRequest {
  parentInviteCode: string;
  memberName?: string;
  color?: string;
}

Deno.serve(async (req: Request) => {
  // Get dynamic CORS headers based on origin
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: cors });
  }

  try {
    // Rate limiting - prevent parent invite code enumeration attacks
    const clientId = getClientId(req);
    const rateLimitKey = `join-family-as-parent:${clientId}`;
    const rateLimit = checkRateLimit(rateLimitKey, RATE_LIMITS['join-family-as-parent']);

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
    let body: JoinFamilyAsParentRequest;
    try {
      body = await parseJsonBody<JoinFamilyAsParentRequest>(req);
    } catch (e) {
      return errorResponse((e as Error).message, 400, cors);
    }

    const { parentInviteCode, memberName, color } = body;

    // Input validation
    const inviteCodeError = validateInput(
      parentInviteCode,
      'Parent invite code',
      MAX_INPUT_LENGTHS.invite_code
    );
    if (inviteCodeError) {
      return errorResponse(inviteCodeError, 400, cors);
    }

    // Validate optional fields
    if (memberName) {
      const nameError = validateInput(memberName, 'Member name', MAX_INPUT_LENGTHS.name, false);
      if (nameError) {
        return errorResponse(nameError, 400, cors);
      }
    }

    if (color) {
      const colorError = validateInput(color, 'Color', 50, false);
      if (colorError) {
        return errorResponse(colorError, 400, cors);
      }
    }

    // Look up family by parent invite code using service role
    const { data: family, error: familyError } = await supabaseAdmin
      .from('families')
      .select('id, name')
      .eq('parent_invite_code', parentInviteCode)
      .maybeSingle();

    if (familyError) {
      console.error('Family lookup error:', familyError);
      return errorResponse('Failed to lookup family', 500, cors);
    }

    // Use generic error to prevent code enumeration
    if (!family) {
      return errorResponse('Invalid parent invite code', 404, cors);
    }

    // Check if user is already a member
    const { data: existingMember } = await supabaseAdmin
      .from('family_members')
      .select('id')
      .eq('family_id', family.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingMember) {
      return errorResponse('You are already a member of this family', 400, cors);
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
      memberData.name = memberName.trim();
    }

    if (color) {
      memberData.color = color;
    }

    const { error: insertError } = await supabaseAdmin.from('family_members').insert(memberData);

    if (insertError) {
      console.error('Insert member error:', insertError);
      return errorResponse('Failed to join family as parent', 500, cors);
    }

    return successResponse(
      {
        success: true,
        family: {
          id: family.id,
          name: family.name,
        },
        isAdmin: true,
      },
      cors
    );
  } catch (error) {
    console.error('Join family as parent error:', error);
    return errorResponse('Internal server error', 500, cors);
  }
});
