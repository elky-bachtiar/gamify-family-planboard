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

/**
 * Create Bridge Command Edge Function
 *
 * Creates a new command for a router bridge agent to execute.
 * Only family admins can create commands for their family's bridges.
 */

interface CreateBridgeCommandRequest {
  bridgeId: string;
  commandType: 'block' | 'unblock' | 'schedule';
  targetMemberId?: string;
  targetDeviceMac?: string;
  triggeredBy?: 'manual' | 'reward' | 'consequence' | 'schedule';
}

// Add rate limit config for this function
const BRIDGE_COMMAND_RATE_LIMIT = { maxRequests: 30, windowMs: 60_000 }; // 30 per minute

Deno.serve(async (req: Request) => {
  // Get dynamic CORS headers based on origin
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: cors });
  }

  try {
    // Rate limiting - prevent abuse
    const clientId = getClientId(req);
    const rateLimitKey = `create-bridge-command:${clientId}`;
    const rateLimit = checkRateLimit(rateLimitKey, BRIDGE_COMMAND_RATE_LIMIT);

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

    // Parse and validate request body
    let body: CreateBridgeCommandRequest;
    try {
      body = await parseJsonBody<CreateBridgeCommandRequest>(req);
    } catch (e) {
      return errorResponse((e as Error).message, 400, cors);
    }

    const { bridgeId, commandType, targetMemberId, targetDeviceMac, triggeredBy = 'manual' } = body;

    // Input validation
    const bridgeIdError = validateUuid(bridgeId, 'Bridge ID');
    if (bridgeIdError) {
      return errorResponse(bridgeIdError, 400, cors);
    }

    if (!['block', 'unblock', 'schedule'].includes(commandType)) {
      return errorResponse('Command type must be one of: block, unblock, schedule', 400, cors);
    }

    if (!targetMemberId && !targetDeviceMac) {
      return errorResponse('Either targetMemberId or targetDeviceMac is required', 400, cors);
    }

    if (targetMemberId) {
      const memberIdError = validateUuid(targetMemberId, 'Target Member ID');
      if (memberIdError) {
        return errorResponse(memberIdError, 400, cors);
      }
    }

    if (targetDeviceMac) {
      // Basic MAC address format validation
      const macRegex = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
      if (!macRegex.test(targetDeviceMac)) {
        return errorResponse('Target device MAC must be in format XX:XX:XX:XX:XX:XX', 400, cors);
      }
    }

    if (!['manual', 'reward', 'consequence', 'schedule'].includes(triggeredBy)) {
      return errorResponse(
        'triggeredBy must be one of: manual, reward, consequence, schedule',
        400,
        cors
      );
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
      return errorResponse('Only admins can create bridge commands', 403, cors);
    }

    // Get the bridge and verify it belongs to the caller's family
    const { data: bridge, error: bridgeError } = await supabaseAdmin
      .from('router_bridges')
      .select('id, family_id, status')
      .eq('id', bridgeId)
      .maybeSingle();

    if (bridgeError || !bridge) {
      return errorResponse('Bridge not found', 404, cors);
    }

    if (bridge.family_id !== callerMember.family_id) {
      return errorResponse('Bridge does not belong to your family', 403, cors);
    }

    if (bridge.status !== 'active') {
      return errorResponse(
        `Bridge is ${bridge.status}. Commands can only be sent to active bridges.`,
        400,
        cors
      );
    }

    // If targeting a member, verify they belong to the same family
    if (targetMemberId) {
      const { data: targetMember, error: targetError } = await supabaseAdmin
        .from('family_members')
        .select('id, family_id, name')
        .eq('id', targetMemberId)
        .maybeSingle();

      if (targetError || !targetMember) {
        return errorResponse('Target member not found', 404, cors);
      }

      if (targetMember.family_id !== callerMember.family_id) {
        return errorResponse('Target member is not in your family', 403, cors);
      }
    }

    // Create the command
    const { data: command, error: insertError } = await supabaseAdmin
      .from('bridge_commands')
      .insert({
        bridge_id: bridgeId,
        family_id: callerMember.family_id,
        command_type: commandType,
        target_member_id: targetMemberId || null,
        target_device_mac: targetDeviceMac || null,
        triggered_by: triggeredBy,
        created_by: callerMember.id,
        status: 'pending',
      })
      .select('id, command_type, status, created_at')
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return errorResponse('Failed to create command', 500, cors);
    }

    return successResponse(
      {
        success: true,
        command: {
          id: command.id,
          commandType: command.command_type,
          status: command.status,
          createdAt: command.created_at,
        },
      },
      cors
    );
  } catch (error) {
    console.error('Create bridge command error:', error);
    return errorResponse('Internal server error', 500, cors);
  }
});
