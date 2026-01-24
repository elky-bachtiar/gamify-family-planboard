import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  getCorsHeaders,
  checkRateLimit,
  getClientId,
  RATE_LIMITS,
  rateLimitedResponse,
  validatePositiveInt,
  errorResponse,
  parseJsonBody,
} from '../_shared/security.ts';

interface RequestRedemptionRequest {
  points_redeemed: number;
}

interface RequestRedemptionResponse {
  success: true;
  redemption_id: string;
  points_redeemed: number;
  money_amount: number;
  available_after: number;
}

interface RequestRedemptionError {
  error: string;
  available?: number;
  requested?: number;
}

Deno.serve(async (req: Request) => {
  // Get dynamic CORS headers based on origin
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: cors });
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405, cors);
  }

  try {
    // Rate limiting - prevent redemption spam
    const clientId = getClientId(req);
    const rateLimitKey = `request-redemption:${clientId}`;
    const rateLimit = checkRateLimit(rateLimitKey, RATE_LIMITS['request-redemption']);

    if (!rateLimit.allowed) {
      return rateLimitedResponse(cors, rateLimit.resetIn);
    }

    // Parse and validate request body
    let body: RequestRedemptionRequest;
    try {
      body = await parseJsonBody<RequestRedemptionRequest>(req);
    } catch (e) {
      return errorResponse((e as Error).message, 400, cors);
    }

    const { points_redeemed } = body;

    // Validate points_redeemed
    const pointsError = validatePositiveInt(points_redeemed, 'points_redeemed', 100000);
    if (pointsError) {
      return errorResponse(pointsError, 400, cors);
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse('Missing or invalid authorization header', 401, cors);
    }
    const token = authHeader.replace('Bearer ', '');

    // Create Supabase client with user token to identify the user
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Verify user with their token
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser(token);

    // For PIN users, the token is a custom JWT where sub = member_id
    // We need to decode it manually or query by member ID
    let memberId: string | null = null;

    if (user) {
      // Regular Supabase user - find their member record
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      const { data: member, error: memberError } = await supabaseAdmin
        .from('family_members')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (memberError || !member) {
        return errorResponse('User is not a family member', 403, cors);
      }
      memberId = member.id;
    } else {
      // Could be a PIN user - try to decode the JWT to get the member ID
      // The PIN login creates a JWT with sub = member_id
      try {
        const [, payloadBase64] = token.split('.');
        const payload = JSON.parse(atob(payloadBase64));
        if (payload.is_pin_user && payload.sub) {
          memberId = payload.sub;
        }
      } catch {
        // Invalid token format
      }
    }

    if (!memberId) {
      return errorResponse('Invalid or expired authentication', 401, cors);
    }

    // Create admin client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get member data with total_points
    const { data: member, error: memberError } = await supabaseAdmin
      .from('family_members')
      .select('id, family_id, total_points, is_disabled')
      .eq('id', memberId)
      .single();

    if (memberError || !member) {
      console.error('Member lookup error:', memberError);
      return errorResponse('Member not found', 404, cors);
    }

    // Check if account is disabled
    if (member.is_disabled) {
      return errorResponse('Account is disabled', 403, cors);
    }

    // 2. Get pending + approved redemptions (atomically in same request)
    const { data: pendingRedemptions, error: pendingError } = await supabaseAdmin
      .from('reward_redemptions')
      .select('points_redeemed')
      .eq('member_id', memberId)
      .in('status', ['pending', 'approved']);

    if (pendingError) {
      console.error('Pending redemptions lookup error:', pendingError);
      return errorResponse('Failed to check pending redemptions', 500, cors);
    }

    // 3. Calculate available points
    const pendingTotal = (pendingRedemptions || []).reduce((sum, r) => sum + r.points_redeemed, 0);
    const availablePoints = (member.total_points ?? 0) - pendingTotal;

    // 4. Validate requested amount against available
    if (points_redeemed > availablePoints) {
      const response: RequestRedemptionError = {
        error: 'Insufficient available points',
        available: availablePoints,
        requested: points_redeemed,
      };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // 5. Get family settings for rate calculation and minimum validation
    const { data: family, error: familyError } = await supabaseAdmin
      .from('families')
      .select('point_to_money_rate, minimum_redemption')
      .eq('id', member.family_id)
      .single();

    if (familyError || !family) {
      console.error('Family lookup error:', familyError);
      return errorResponse('Family not found', 404, cors);
    }

    // 6. Validate minimum redemption
    const minimumRedemption = family.minimum_redemption ?? 0;
    if (points_redeemed < minimumRedemption) {
      return errorResponse(`Minimum redemption is ${minimumRedemption} points`, 400, cors);
    }

    // Check if rewards are enabled
    const pointToMoneyRate = family.point_to_money_rate ?? 0;
    if (pointToMoneyRate <= 0) {
      return errorResponse('Reward redemptions are not enabled for this family', 400, cors);
    }

    // 7. Create redemption record
    const moneyAmount = points_redeemed * pointToMoneyRate;
    const { data: redemption, error: insertError } = await supabaseAdmin
      .from('reward_redemptions')
      .insert({
        family_id: member.family_id,
        member_id: memberId,
        points_redeemed: points_redeemed,
        money_amount: moneyAmount,
        status: 'pending',
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Redemption insert error:', insertError);
      return errorResponse('Failed to create redemption request', 500, cors);
    }

    // 8. Return success response
    const response: RequestRedemptionResponse = {
      success: true,
      redemption_id: redemption.id,
      points_redeemed: points_redeemed,
      money_amount: moneyAmount,
      available_after: availablePoints - points_redeemed,
    };

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return errorResponse('Internal server error', 500, cors);
  }
});
