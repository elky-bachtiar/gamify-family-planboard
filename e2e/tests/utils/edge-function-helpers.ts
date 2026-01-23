/**
 * Edge Function Testing Helpers
 *
 * These utilities help test Supabase Edge Functions for authentication
 * and secure operations.
 */

import { createHash } from 'crypto';

// Edge functions URL - uses the Supabase CLI local instance
export const FUNCTIONS_URL = 'http://127.0.0.1:54321/functions/v1';

// Test configuration - uses Supabase CLI local instance
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJFUzI1NiIsImtpZCI6ImI4MTI2OWYxLTIxZDgtNGYyZS1iNzE5LWMyMjQwYTg0MGQ5MCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjIwODQ1MjE5OTR9.93sojj1SFWzw8WJ_bN6znEhFe76RGKgE19ngt7TQOzWp8em71eHnNQbXLaJ3uYp8uGi5OhJu-bFaApOdiGoQJQ';
export const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJFUzI1NiIsImtpZCI6ImI4MTI2OWYxLTIxZDgtNGYyZS1iNzE5LWMyMjQwYTg0MGQ5MCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MjA4NDUyMTk5NH0.CLLO7KRX5KjArtjcscpFTYekPMuvRYYH2pzkVXxOMWPpuxk3KgzdXiOsfxX8QU417lgyRr8P4HWoCK8D4GBweA';

/**
 * Response type for edge function calls
 */
export interface EdgeFunctionResponse<T = unknown> {
  status: number;
  data?: T;
  error?: string;
}

/**
 * Call an edge function
 */
export async function callEdgeFunction<T = unknown>(
  functionName: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: Record<string, unknown>;
    authToken?: string;
    useServiceRole?: boolean;
  } = {}
): Promise<EdgeFunctionResponse<T>> {
  const {
    method = 'POST',
    body,
    authToken,
    useServiceRole = false
  } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY
  };

  if (useServiceRole) {
    headers['Authorization'] = `Bearer ${SUPABASE_SERVICE_KEY}`;
  } else if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  } else {
    // Default to anon key for unauthenticated requests
    headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
  }

  try {
    const response = await fetch(`${FUNCTIONS_URL}/${functionName}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    const text = await response.text();
    let data: T | undefined;
    let error: string | undefined;

    try {
      const json = JSON.parse(text);
      if (response.ok) {
        data = json;
      } else {
        error = json.error || json.message || text;
      }
    } catch {
      if (!response.ok) {
        error = text;
      }
    }

    return { status: response.status, data, error };
  } catch (e) {
    const err = e as Error;
    return { status: 0, error: err.message };
  }
}

/**
 * PIN Login Response
 */
export interface PinLoginResponse {
  token: string;
  member: {
    id: string;
    name: string;
    family_id: string;
    role: string;
    is_admin: boolean;
  };
  family: {
    id: string;
    name: string;
  };
}

/**
 * Call pin-login edge function
 */
export async function callPinLogin(
  inviteCode: string,
  pin: string
): Promise<EdgeFunctionResponse<PinLoginResponse>> {
  return callEdgeFunction<PinLoginResponse>('pin-login', {
    body: { child_invite_code: inviteCode, pin }
  });
}

/**
 * Create Child Response
 */
export interface CreateChildResponse {
  success: boolean;
  child_invite_code: string;
  member: {
    id: string;
    name: string;
    color: string;
  };
}

/**
 * Call create-child edge function
 */
export async function callCreateChild(
  authToken: string,
  data: {
    name: string;
    pin: string;
    family_id: string;
    color?: string;
    birthdate?: string;
  }
): Promise<EdgeFunctionResponse<CreateChildResponse>> {
  return callEdgeFunction<CreateChildResponse>('create-child', {
    authToken,
    body: data
  });
}

/**
 * Join Family Response
 */
export interface JoinFamilyResponse {
  success: boolean;
  family: {
    id: string;
    name: string;
  };
  isAdmin?: boolean;
}

/**
 * Call join-family edge function
 */
export async function callJoinFamily(
  authToken: string,
  data: {
    inviteCode: string;
    memberName?: string;
    color?: string;
  }
): Promise<EdgeFunctionResponse<JoinFamilyResponse>> {
  return callEdgeFunction<JoinFamilyResponse>('join-family', {
    authToken,
    body: data
  });
}

/**
 * Call join-family-as-parent edge function
 */
export async function callJoinFamilyAsParent(
  authToken: string,
  data: {
    parentInviteCode: string;
    memberName?: string;
    color?: string;
  }
): Promise<EdgeFunctionResponse<JoinFamilyResponse>> {
  return callEdgeFunction<JoinFamilyResponse>('join-family-as-parent', {
    authToken,
    body: data
  });
}

/**
 * Toggle Admin Response
 */
export interface ToggleAdminResponse {
  success: boolean;
  member: {
    id: string;
    is_admin: boolean;
  };
}

/**
 * Call toggle-admin edge function
 */
export async function callToggleAdmin(
  authToken: string,
  memberId: string,
  makeAdmin: boolean
): Promise<EdgeFunctionResponse<ToggleAdminResponse>> {
  return callEdgeFunction<ToggleAdminResponse>('toggle-admin', {
    authToken,
    body: { memberId, makeAdmin }
  });
}

/**
 * Deduct Points Response
 */
export interface DeductPointsResponse {
  success: boolean;
  member: {
    id: string;
    total_points: number;
    previous_points: number;
  };
}

/**
 * Call deduct-points edge function
 */
export async function callDeductPoints(
  authToken: string,
  data: {
    member_id: string;
    points: number;
    reason: string;
  }
): Promise<EdgeFunctionResponse<DeductPointsResponse>> {
  return callEdgeFunction<DeductPointsResponse>('deduct-points', {
    authToken,
    body: data
  });
}

/**
 * Reset Child PIN Response
 */
export interface ResetChildPinResponse {
  success: boolean;
}

/**
 * Call reset-child-pin edge function
 */
export async function callResetChildPin(
  authToken: string,
  data: {
    member_id: string;
    new_pin: string;
  }
): Promise<EdgeFunctionResponse<ResetChildPinResponse>> {
  return callEdgeFunction<ResetChildPinResponse>('reset-child-pin', {
    authToken,
    body: data
  });
}

/**
 * Regenerate Invite Code Response
 */
export interface RegenerateInviteCodeResponse {
  invite_code?: string;
  parent_invite_code?: string;
}

/**
 * Call regenerate-invite-code edge function
 */
export async function callRegenerateInviteCode(
  authToken: string,
  codeType: 'member' | 'parent'
): Promise<EdgeFunctionResponse<RegenerateInviteCodeResponse>> {
  return callEdgeFunction<RegenerateInviteCodeResponse>('regenerate-invite-code', {
    authToken,
    body: { code_type: codeType }
  });
}

/**
 * Award Birthday Points Response
 */
export interface AwardBirthdayPointsResponse {
  success: boolean;
  message: string;
  awarded_count: number;
  details?: Array<{
    member_id: string;
    name: string;
    points_awarded: number;
  }>;
}

/**
 * Call award-birthday-points edge function
 *
 * Note: This function finds members with birthdays matching today's date
 * and awards them bonus points. It doesn't take a specific member_id.
 */
export async function callAwardBirthdayPoints(
  authToken: string,
  bonusPoints?: number
): Promise<EdgeFunctionResponse<AwardBirthdayPointsResponse>> {
  return callEdgeFunction<AwardBirthdayPointsResponse>('award-birthday-points', {
    authToken,
    body: bonusPoints ? { bonus_points: bonusPoints } : {}
  });
}

/**
 * Disable Member Response
 */
export interface DisableMemberResponse {
  success: boolean;
  member: {
    id: string;
    is_disabled: boolean;
  };
}

/**
 * Call disable-member edge function
 */
export async function callDisableMember(
  authToken: string,
  memberId: string,
  disable: boolean
): Promise<EdgeFunctionResponse<DisableMemberResponse>> {
  return callEdgeFunction<DisableMemberResponse>('disable-member', {
    authToken,
    body: { member_id: memberId, disable }
  });
}

/**
 * Verify a PIN matches the stored hash
 */
export function verifyPinHash(pin: string, hash: string): boolean {
  const computed = createHash('sha256').update(pin).digest('hex');
  return computed === hash;
}

/**
 * Get auth token from a Supabase client session
 */
export async function getAuthToken(
  supabaseClient: { auth: { getSession: () => Promise<{ data: { session: { access_token: string } | null } }> } }
): Promise<string | null> {
  const { data } = await supabaseClient.auth.getSession();
  return data.session?.access_token || null;
}
