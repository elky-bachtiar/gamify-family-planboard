import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import jwt from 'jsonwebtoken';

// Test configuration constants - loaded from environment variables (.env.local)
export const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
export const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
export const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-token-with-at-least-32-characters-long';

// Database connection for direct queries
export const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

/**
 * Test user data interface
 */
export interface TestUser {
  id: string;
  email: string;
  password: string;
}

/**
 * Test family data interface
 */
export interface TestFamily {
  id: string;
  name: string;
  invite_code: string;
  parent_invite_code?: string;
}

/**
 * Test family member interface
 */
export interface TestMember {
  id: string;
  name: string;
  family_id: string;
  user_id?: string;
  is_admin: boolean;
  is_pin_user: boolean;
  pin_hash?: string;
  child_invite_code?: string;
  role: 'parent' | 'child';
  total_points: number;
  current_level: number;
}

/**
 * Test task interface
 */
export interface TestTask {
  id: string;
  title: string;
  family_id: string;
  assigned_to?: string;
  created_by?: string;
  status: 'pending' | 'in_progress' | 'pending_approval' | 'completed';
  point_value: number;
  priority: 'low' | 'medium' | 'high';
}

/**
 * Create a Supabase client with the anon key (unauthenticated)
 */
export function createAnonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });
}

/**
 * Create a Supabase client with the service role key (bypasses RLS)
 */
export function createServiceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  });
}

/**
 * Create an authenticated Supabase client for a specific user
 */
export async function createAuthenticatedClient(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });

  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`Failed to sign in as ${email}: ${error.message}`);
  }

  return client;
}

/**
 * Create a custom JWT for PIN user authentication
 */
export function createPinUserJwt(memberId: string): string {
  const payload = {
    sub: memberId,
    aud: 'authenticated',
    role: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiry
    iat: Math.floor(Date.now() / 1000),
    iss: 'supabase-demo'
  };

  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });
}

/**
 * Create a Supabase client authenticated as a PIN user
 */
export function createPinUserClient(memberId: string): SupabaseClient {
  const token = createPinUserJwt(memberId);

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });
}

/**
 * Hash a PIN using SHA-256
 */
export function hashPin(pin: string): string {
  return createHash('sha256').update(pin).digest('hex');
}

/**
 * Generate a random string for unique test data
 */
export function randomString(length: number = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a unique test email
 */
export function testEmail(prefix: string = 'test'): string {
  return `${prefix}_${randomString()}@test.local`;
}

/**
 * Create a test user via Supabase Auth
 */
export async function createTestUser(
  email?: string,
  password?: string
): Promise<TestUser> {
  const client = createAnonClient();
  const testEmail = email || `test_${randomString()}@test.local`;
  const testPassword = password || `Password${randomString()}!`;

  const { data, error } = await client.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: {
      data: { role: 'parent' }
    }
  });

  if (error) {
    throw new Error(`Failed to create test user: ${error.message}`);
  }

  if (!data.user) {
    throw new Error('No user returned from signUp');
  }

  return {
    id: data.user.id,
    email: testEmail,
    password: testPassword
  };
}

/**
 * Create a test family with an admin member
 * Uses service client to bypass RLS for initial setup (chicken-and-egg problem)
 */
export async function createTestFamily(
  user: TestUser,
  familyName?: string
): Promise<{ family: TestFamily; member: TestMember }> {
  // Use service client to bypass RLS for initial family/member setup
  // This is necessary because the user can't create a member record
  // until they're already a member (RLS policy requires family membership)
  const serviceClient = createServiceClient();
  const name = familyName || `Test Family ${randomString()}`;
  const invite_code = randomString(8).toUpperCase();
  const parent_invite_code = randomString(8).toUpperCase();

  // Create family using service client
  const { data: family, error: familyError } = await serviceClient
    .from('families')
    .insert({
      name,
      invite_code,
      parent_invite_code,
      created_by: user.id
    })
    .select()
    .single();

  if (familyError) {
    throw new Error(`Failed to create family: ${familyError.message}`);
  }

  // Create admin member using service client
  const { data: member, error: memberError } = await serviceClient
    .from('family_members')
    .insert({
      name: 'Admin Parent',
      email: user.email,
      family_id: family.id,
      user_id: user.id,
      is_admin: true,
      role: 'parent',
      total_points: 0,
      current_level: 1
    })
    .select()
    .single();

  if (memberError) {
    throw new Error(`Failed to create member: ${memberError.message}`);
  }

  return {
    family: {
      id: family.id,
      name: family.name,
      invite_code: family.invite_code,
      parent_invite_code: family.parent_invite_code
    },
    member: {
      id: member.id,
      name: member.name,
      family_id: member.family_id,
      user_id: member.user_id,
      is_admin: member.is_admin,
      is_pin_user: member.is_pin_user || false,
      role: member.role,
      total_points: member.total_points,
      current_level: member.current_level
    }
  };
}

/**
 * Create a child member with PIN authentication
 */
export async function createTestChild(
  adminUser: TestUser,
  familyId: string,
  childName?: string,
  pin?: string
): Promise<TestMember> {
  const serviceClient = createServiceClient();
  const name = childName || `Child ${randomString()}`;
  const pinCode = pin || '1234';
  const pinHash = hashPin(pinCode);
  const childInviteCode = randomString(8).toUpperCase();

  const { data: member, error } = await serviceClient
    .from('family_members')
    .insert({
      name,
      family_id: familyId,
      is_admin: false,
      is_pin_user: true,
      pin_hash: pinHash,
      child_invite_code: childInviteCode,
      role: 'child',
      total_points: 0,
      current_level: 1
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create child: ${error.message}`);
  }

  return {
    id: member.id,
    name: member.name,
    family_id: member.family_id,
    user_id: member.user_id,
    is_admin: member.is_admin,
    is_pin_user: member.is_pin_user,
    pin_hash: member.pin_hash,
    child_invite_code: member.child_invite_code,
    role: member.role,
    total_points: member.total_points,
    current_level: member.current_level
  };
}

/**
 * Create a non-admin parent member
 */
export async function createTestNonAdminParent(
  familyId: string,
  parentName?: string
): Promise<{ user: TestUser; member: TestMember }> {
  const user = await createTestUser();
  const serviceClient = createServiceClient();
  const name = parentName || `Parent ${randomString()}`;

  const { data: member, error } = await serviceClient
    .from('family_members')
    .insert({
      name,
      email: user.email,
      family_id: familyId,
      user_id: user.id,
      is_admin: false,
      is_pin_user: false,
      role: 'parent',
      total_points: 0,
      current_level: 1
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create non-admin parent: ${error.message}`);
  }

  return {
    user,
    member: {
      id: member.id,
      name: member.name,
      family_id: member.family_id,
      user_id: member.user_id,
      is_admin: member.is_admin,
      is_pin_user: member.is_pin_user,
      role: member.role,
      total_points: member.total_points,
      current_level: member.current_level
    }
  };
}

/**
 * Create a test task
 */
export async function createTestTask(
  client: SupabaseClient,
  familyId: string,
  options: Partial<TestTask> = {}
): Promise<TestTask> {
  const { data, error } = await client
    .from('tasks')
    .insert({
      title: options.title || `Test Task ${randomString()}`,
      family_id: familyId,
      assigned_to: options.assigned_to,
      created_by: options.created_by,
      status: options.status || 'pending',
      point_value: options.point_value ?? 10,
      priority: options.priority || 'medium',
      due_date: new Date().toISOString().split('T')[0]
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create task: ${error.message}`);
  }

  return {
    id: data.id,
    title: data.title,
    family_id: data.family_id,
    assigned_to: data.assigned_to,
    created_by: data.created_by,
    status: data.status,
    point_value: data.point_value,
    priority: data.priority
  };
}

/**
 * Clean up test data after tests
 */
export async function cleanupTestData(options: {
  familyIds?: string[];
  userIds?: string[];
}): Promise<void> {
  const serviceClient = createServiceClient();

  // Delete families (cascades to members, tasks, etc.)
  if (options.familyIds?.length) {
    const { error: familyError } = await serviceClient
      .from('families')
      .delete()
      .in('id', options.familyIds);

    if (familyError) {
      console.warn('Failed to delete families:', familyError.message);
    }
  }

  // Delete auth users
  if (options.userIds?.length) {
    for (const userId of options.userIds) {
      try {
        const { error } = await serviceClient.auth.admin.deleteUser(userId);
        if (error) {
          console.warn(`Failed to delete user ${userId}:`, error.message);
        }
      } catch (e) {
        console.warn(`Failed to delete user ${userId}:`, e);
      }
    }
  }
}

/**
 * Reset database to clean state
 */
export async function resetDatabase(): Promise<void> {
  const serviceClient = createServiceClient();

  // Delete all families (cascades to most other data)
  const { error: familyError } = await serviceClient
    .from('families')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (familyError) {
    console.warn('Failed to reset families:', familyError.message);
  }

  // Delete orphaned family_members
  const { error: memberError } = await serviceClient
    .from('family_members')
    .delete()
    .is('family_id', null);

  if (memberError) {
    console.warn('Failed to reset orphaned members:', memberError.message);
  }
}

/**
 * Expect a Supabase error with specific code
 */
export function expectSupabaseError(
  error: { code: string; message: string } | null,
  expectedCode?: string
): void {
  if (!error) {
    throw new Error('Expected an error but got none');
  }
  if (expectedCode && error.code !== expectedCode) {
    throw new Error(`Expected error code ${expectedCode} but got ${error.code}: ${error.message}`);
  }
}

/**
 * Expect an RLS policy violation (row-level security)
 */
export function expectRlsViolation(error: { code: string; message: string } | null): void {
  if (!error) {
    throw new Error('Expected RLS violation but operation succeeded');
  }

  // RLS violations typically return PGRST116 (row not found due to policy)
  // or 42501 (permission denied)
  const rlsCodes = ['PGRST116', '42501', 'PGRST301'];
  if (!rlsCodes.includes(error.code)) {
    console.log('Received error:', error);
  }
}

/**
 * Expect a trigger exception
 */
export function expectTriggerException(
  error: { code: string; message: string } | null,
  expectedMessage?: string
): void {
  if (!error) {
    throw new Error('Expected a trigger exception but operation succeeded');
  }

  // Trigger exceptions return P0001 (RAISE EXCEPTION)
  if (error.code !== 'P0001' && error.code !== '23514') {
    console.log('Unexpected error code:', error.code, error.message);
  }

  if (expectedMessage && !error.message.includes(expectedMessage)) {
    throw new Error(`Expected error message to contain "${expectedMessage}" but got: ${error.message}`);
  }
}
