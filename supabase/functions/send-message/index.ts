import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  getCorsHeaders,
  checkRateLimit,
  getClientId,
  RATE_LIMITS,
  rateLimitedResponse,
  validateInput,
  validateUuid,
  MAX_INPUT_LENGTHS,
  errorResponse,
  successResponse,
  parseJsonBody,
} from '../_shared/security.ts';

interface SendMessageRequest {
  family_id: string;
  recipient_id: string | null; // null = broadcast to family
  content: string;
}

/**
 * Send Message Edge Function
 *
 * This function handles secure message sending with encryption:
 * 1. Authenticates the user (regular Supabase auth or PIN-based JWT)
 * 2. Validates input and family membership
 * 3. Calls insert_encrypted_message() RPC to encrypt and store the message
 *
 * The encryption happens server-side using pgsodium, ensuring:
 * - Plaintext never reaches the database unencrypted
 * - Each family has its own encryption key
 * - Messages are authenticated with AEAD (message ID as additional data)
 */
Deno.serve(async (req: Request) => {
  // Get dynamic CORS headers based on origin
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: cors });
  }

  try {
    // Rate limiting - prevent message spam
    const clientId = getClientId(req);
    const rateLimitKey = `send-message:${clientId}`;
    const rateLimit = checkRateLimit(rateLimitKey, RATE_LIMITS['send-message']);

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

    // Extract and decode the JWT token
    const token = authHeader.replace('Bearer ', '');
    let userId: string | null = null;
    let isPinUser = false;

    try {
      // Decode the JWT payload (works for both HS256 and ES256)
      const [, payloadBase64] = token.split('.');
      const payload = JSON.parse(atob(payloadBase64));

      // Check token expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        return errorResponse('Token expired', 401, cors);
      }

      // Check if this is a PIN user token
      if (payload.is_pin_user === true && payload.sub) {
        userId = payload.sub;
        isPinUser = true;
      } else if (payload.sub) {
        // Regular Supabase user - sub is the user_id
        userId = payload.sub;
        isPinUser = false;
      }
    } catch {
      return errorResponse('Invalid JWT', 401, cors);
    }

    if (!userId) {
      return errorResponse('Unauthorized', 401, cors);
    }

    // Look up the family member
    let memberQuery = supabaseAdmin.from('family_members').select('id, family_id, is_disabled');

    if (isPinUser) {
      // For PIN users, the JWT 'sub' claim IS the member_id
      memberQuery = memberQuery.eq('id', userId);
    } else {
      // For regular users, look up by user_id
      memberQuery = memberQuery.eq('user_id', userId);
    }

    const { data: memberData, error: memberError } = await memberQuery.single();

    if (memberError || !memberData) {
      return errorResponse('User is not a family member', 403, cors);
    }

    // Check if account is disabled
    if (memberData.is_disabled) {
      return errorResponse('Account is disabled', 403, cors);
    }

    // Parse and validate request body
    let body: SendMessageRequest;
    try {
      body = await parseJsonBody<SendMessageRequest>(req);
    } catch (e) {
      return errorResponse((e as Error).message, 400, cors);
    }

    const { family_id, recipient_id, content } = body;

    // Input validation
    const familyIdError = validateUuid(family_id, 'Family ID');
    if (familyIdError) {
      return errorResponse(familyIdError, 400, cors);
    }

    // Recipient is optional (null = broadcast)
    if (recipient_id !== null) {
      const recipientIdError = validateUuid(recipient_id, 'Recipient ID');
      if (recipientIdError) {
        return errorResponse(recipientIdError, 400, cors);
      }
    }

    // Content validation
    const contentError = validateInput(content, 'Content', MAX_INPUT_LENGTHS.description);
    if (contentError) {
      return errorResponse(contentError, 400, cors);
    }

    // Verify the sender belongs to the specified family
    if (family_id !== memberData.family_id) {
      return errorResponse('Cannot send message to a different family', 403, cors);
    }

    // If recipient specified, verify they're in the same family
    if (recipient_id !== null) {
      const { data: recipientData, error: recipientError } = await supabaseAdmin
        .from('family_members')
        .select('id, family_id, is_disabled')
        .eq('id', recipient_id)
        .single();

      if (recipientError || !recipientData) {
        return errorResponse('Recipient not found', 404, cors);
      }

      if (recipientData.family_id !== family_id) {
        return errorResponse('Recipient is not in this family', 403, cors);
      }

      // Optional: warn if sending to disabled account (message still allowed)
      // if (recipientData.is_disabled) {
      //   console.warn(`Sending message to disabled account ${recipient_id}`);
      // }
    }

    // Insert the encrypted message using the RPC function
    const { data: messageId, error: insertError } = await supabaseAdmin.rpc(
      'insert_encrypted_message',
      {
        p_family_id: family_id,
        p_sender_id: memberData.id,
        p_recipient_id: recipient_id,
        p_content: content.trim(),
      }
    );

    if (insertError) {
      console.error('Insert error:', insertError);
      // Don't leak database error details to client
      return errorResponse('Failed to send message', 500, cors);
    }

    return successResponse(
      {
        success: true,
        message_id: messageId,
      },
      cors
    );
  } catch (error) {
    console.error('Error:', error);
    return errorResponse('Internal server error', 500, cors);
  }
});
