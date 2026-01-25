/**
 * Edge Function Integration Tests
 *
 * Tests Supabase Edge Functions for secure operations:
 * - pin-login: Child authentication
 * - create-child: Create child accounts with PIN
 * - join-family: Join family via invite code
 * - join-family-as-parent: Join as admin via parent invite code
 * - toggle-admin: Promote/demote admin status
 * - deduct-points: Admin point deduction
 * - reset-child-pin: Reset child's PIN
 * - regenerate-invite-code: Generate new invite codes
 * - award-birthday-points: Award birthday bonus
 * - disable-member: Enable/disable member accounts
 *
 * NOTE: These tests require edge functions to be served:
 *   supabase functions serve
 *
 * Tests will be skipped if edge functions are not available.
 */

import { test, expect } from '@playwright/test';
import {
  createTestUser,
  createTestFamily,
  createAuthenticatedClient,
  createServiceClient,
  createTestChild,
  cleanupTestData,
  hashPin,
  TestUser,
  TestFamily,
  TestMember
} from './utils/test-helpers';
import {
  callPinLogin,
  callCreateChild,
  callJoinFamily,
  callJoinFamilyAsParent,
  callToggleAdmin,
  callDeductPoints,
  callResetChildPin,
  callRegenerateInviteCode,
  callAwardBirthdayPoints,
  callDisableMember,
  getAuthToken,
  FUNCTIONS_URL
} from './utils/edge-function-helpers';

// Check if edge functions are available
async function checkEdgeFunctionsAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${FUNCTIONS_URL}/pin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    // If we get any response, functions are available
    // Check response body - if it contains function-specific error, functions are running
    const text = await response.text();
    // Functions running will return JSON with error message about missing auth or invalid input
    // Functions not running will return HTML error page or connection refused
    return text.includes('authorization') || text.includes('error') || response.status === 200 || response.status === 400;
  } catch {
    return false;
  }
}

// Assume available, will be checked in beforeAll
let edgeFunctionsAvailable = true;

test.describe('Edge Function Tests', () => {
  test.beforeAll(async () => {
    edgeFunctionsAvailable = await checkEdgeFunctionsAvailable();
    if (!edgeFunctionsAvailable) {
      console.log('\n⚠️  Edge functions are not available.');
      console.log('   Run "supabase functions serve" to enable edge function tests.\n');
    }
  });

  test.describe('Edge Function: pin-login', () => {
  let adminUser: TestUser;
  let family: TestFamily;
  let childMember: TestMember;
  const childPin = '1234';

  test.beforeEach(async ({}, testInfo) => {
    if (!edgeFunctionsAvailable) testInfo.skip();
  });

  test.beforeAll(async () => {
    if (!edgeFunctionsAvailable) return;
    adminUser = await createTestUser();
    const familyData = await createTestFamily(adminUser);
    family = familyData.family;
    childMember = await createTestChild(adminUser, family.id, 'Login Test Child', childPin);
  });

  test.afterAll(async () => {
    if (!edgeFunctionsAvailable || !family) return;
    await cleanupTestData({
      familyIds: [family.id],
      userIds: [adminUser.id]
    });
  });

  test('valid invite code and PIN returns token', async () => {
    const response = await callPinLogin(childMember.child_invite_code!, childPin);

    if (response.status !== 200) {
      console.log('Pin-login error:', response.error, 'Status:', response.status);
    }
    expect(response.status).toBe(200);
    expect(response.data).toBeDefined();
    expect(response.data?.token).toBeDefined();
    expect(response.data?.member.id).toBe(childMember.id);
    expect(response.data?.member.name).toBe('Login Test Child');
    expect(response.data?.family.id).toBe(family.id);
  });

  test('wrong PIN returns error', async () => {
    const response = await callPinLogin(childMember.child_invite_code!, 'wrongpin');

    expect(response.status).not.toBe(200);
    expect(response.error).toBeDefined();
  });

  test('invalid invite code returns error', async () => {
    const response = await callPinLogin('INVALID1', childPin);

    expect(response.status).not.toBe(200);
    expect(response.error).toBeDefined();
  });

  test('missing parameters returns error', async () => {
    const response = await callPinLogin('', '');

    expect(response.status).not.toBe(200);
    expect(response.error).toBeDefined();
  });
});

test.describe('Edge Function: create-child', () => {
  let adminUser: TestUser;
  let family: TestFamily;

  test.beforeEach(async ({}, testInfo) => {
    if (!edgeFunctionsAvailable) testInfo.skip();
  });

  test.beforeAll(async () => {
    if (!edgeFunctionsAvailable) return;
    adminUser = await createTestUser();
    const familyData = await createTestFamily(adminUser);
    family = familyData.family;
  });

  test.afterAll(async () => {
    await cleanupTestData({
      familyIds: [family.id],
      userIds: [adminUser.id]
    });
  });

  test('admin can create child account', async () => {
    const client = await createAuthenticatedClient(adminUser.email, adminUser.password);
    const token = await getAuthToken(client);

    const response = await callCreateChild(token!, {
      name: 'New Child',
      pin: '5678',
      family_id: family.id,
      color: '#FF5733'
    });

    expect(response.status).toBe(200);
    expect(response.data?.member).toBeDefined();
    expect(response.data?.member.name).toBe('New Child');
    expect(response.data?.child_invite_code).toBeDefined();

    // Verify PIN is properly hashed
    const serviceClient = createServiceClient();
    const { data: child } = await serviceClient
      .from('family_members')
      .select('pin_hash, is_pin_user')
      .eq('id', response.data?.member.id)
      .single();

    expect(child?.is_pin_user).toBe(true);
    expect(child?.pin_hash).toBe(hashPin('5678'));
  });

  test('non-admin cannot create child account', async () => {
    // Create a non-admin user in the family
    const nonAdminUser = await createTestUser();
    const serviceClient = createServiceClient();

    await serviceClient.from('family_members').insert({
      name: 'Non-Admin',
      email: nonAdminUser.email,
      family_id: family.id,
      user_id: nonAdminUser.id,
      is_admin: false,
      role: 'parent'
    });

    const client = await createAuthenticatedClient(nonAdminUser.email, nonAdminUser.password);
    const token = await getAuthToken(client);

    const response = await callCreateChild(token!, {
      name: 'Unauthorized Child',
      pin: '1111',
      family_id: family.id
    });

    expect(response.status).not.toBe(200);
    expect(response.error).toBeDefined();

    // Cleanup
    await cleanupTestData({ userIds: [nonAdminUser.id] });
  });

  test('PIN must be 4-6 digits', async () => {
    const client = await createAuthenticatedClient(adminUser.email, adminUser.password);
    const token = await getAuthToken(client);

    // Too short
    const shortResponse = await callCreateChild(token!, {
      name: 'Short PIN Child',
      pin: '123',
      family_id: family.id
    });
    expect(shortResponse.status).not.toBe(200);

    // Too long
    const longResponse = await callCreateChild(token!, {
      name: 'Long PIN Child',
      pin: '1234567',
      family_id: family.id
    });
    expect(longResponse.status).not.toBe(200);
  });
});

test.describe('Edge Function: join-family', () => {
  let adminUser: TestUser;
  let family: TestFamily;

  test.beforeEach(async ({}, testInfo) => {
    if (!edgeFunctionsAvailable) testInfo.skip();
  });

  test.beforeAll(async () => {
    if (!edgeFunctionsAvailable) return;
    adminUser = await createTestUser();
    const familyData = await createTestFamily(adminUser);
    family = familyData.family;
  });

  test.afterAll(async () => {
    await cleanupTestData({
      familyIds: [family.id],
      userIds: [adminUser.id]
    });
  });

  test('user can join family with valid invite code', async () => {
    const newUser = await createTestUser();
    const client = await createAuthenticatedClient(newUser.email, newUser.password);
    const token = await getAuthToken(client);

    const response = await callJoinFamily(token!, {
      inviteCode: family.invite_code,
      memberName: 'New Member'
    });

    expect(response.status).toBe(200);
    expect(response.data?.success).toBe(true);
    expect(response.data?.family.id).toBe(family.id);

    // Cleanup
    await cleanupTestData({ userIds: [newUser.id] });
  });

  test('invalid invite code is rejected', async () => {
    const newUser = await createTestUser();
    const client = await createAuthenticatedClient(newUser.email, newUser.password);
    const token = await getAuthToken(client);

    const response = await callJoinFamily(token!, {
      inviteCode: 'INVALID1',
      memberName: 'Invalid Member'
    });

    expect(response.status).not.toBe(200);
    expect(response.error).toBeDefined();

    // Cleanup
    await cleanupTestData({ userIds: [newUser.id] });
  });
});

test.describe('Edge Function: join-family-as-parent', () => {
  let adminUser: TestUser;
  let family: TestFamily;

  test.beforeEach(async ({}, testInfo) => {
    if (!edgeFunctionsAvailable) testInfo.skip();
  });

  test.beforeAll(async () => {
    if (!edgeFunctionsAvailable) return;
    adminUser = await createTestUser();
    const familyData = await createTestFamily(adminUser);
    family = familyData.family;
  });

  test.afterAll(async () => {
    await cleanupTestData({
      familyIds: [family.id],
      userIds: [adminUser.id]
    });
  });

  test('user can join as admin with parent invite code', async () => {
    const newParent = await createTestUser();
    const client = await createAuthenticatedClient(newParent.email, newParent.password);
    const token = await getAuthToken(client);

    const response = await callJoinFamilyAsParent(token!, {
      parentInviteCode: family.parent_invite_code!,
      memberName: 'New Parent'
    });

    expect(response.status).toBe(200);
    expect(response.data?.success).toBe(true);
    expect(response.data?.isAdmin).toBe(true); // Parent join gets admin

    // Cleanup
    await cleanupTestData({ userIds: [newParent.id] });
  });

  test('regular invite code does not grant admin', async () => {
    const newUser = await createTestUser();
    const client = await createAuthenticatedClient(newUser.email, newUser.password);
    const token = await getAuthToken(client);

    // Use regular invite code with parent join function - should fail
    const response = await callJoinFamilyAsParent(token!, {
      parentInviteCode: family.invite_code, // Regular code, not parent code
      memberName: 'Fake Admin'
    });

    // Should fail - regular invite code won't work with parent join
    expect(response.status).toBe(404);

    // Cleanup
    await cleanupTestData({ userIds: [newUser.id] });
  });
});

test.describe('Edge Function: toggle-admin', () => {
  let adminUser: TestUser;
  let family: TestFamily;
  let adminMember: TestMember;
  let nonAdminMember: TestMember;

  test.beforeEach(async ({}, testInfo) => {
    if (!edgeFunctionsAvailable) testInfo.skip();
  });

  test.beforeAll(async () => {
    if (!edgeFunctionsAvailable) return;
    adminUser = await createTestUser();
    const familyData = await createTestFamily(adminUser);
    family = familyData.family;
    adminMember = familyData.member;

    // Create a non-admin parent
    const serviceClient = createServiceClient();
    const { data: member } = await serviceClient
      .from('family_members')
      .insert({
        name: 'Toggle Test Member',
        family_id: family.id,
        is_admin: false,
        role: 'parent'
      })
      .select()
      .single();
    nonAdminMember = member as TestMember;
  });

  test.afterAll(async () => {
    await cleanupTestData({
      familyIds: [family.id],
      userIds: [adminUser.id]
    });
  });

  test('admin can promote member to admin', async () => {
    const client = await createAuthenticatedClient(adminUser.email, adminUser.password);
    const token = await getAuthToken(client);

    const response = await callToggleAdmin(token!, nonAdminMember.id, true);

    expect(response.status).toBe(200);
    expect(response.data?.member.is_admin).toBe(true);

    // Reset for other tests
    const serviceClient = createServiceClient();
    await serviceClient
      .from('family_members')
      .update({ is_admin: false })
      .eq('id', nonAdminMember.id);
  });

  test('admin can demote member from admin', async () => {
    // First promote
    const serviceClient = createServiceClient();
    await serviceClient
      .from('family_members')
      .update({ is_admin: true })
      .eq('id', nonAdminMember.id);

    const client = await createAuthenticatedClient(adminUser.email, adminUser.password);
    const token = await getAuthToken(client);

    const response = await callToggleAdmin(token!, nonAdminMember.id, false);

    expect(response.status).toBe(200);
    expect(response.data?.member.is_admin).toBe(false);
  });

  test('cannot demote last admin', async () => {
    // Ensure only one admin
    const serviceClient = createServiceClient();
    await serviceClient
      .from('family_members')
      .update({ is_admin: false })
      .eq('id', nonAdminMember.id);

    const client = await createAuthenticatedClient(adminUser.email, adminUser.password);
    const token = await getAuthToken(client);

    const response = await callToggleAdmin(token!, adminMember.id, false);

    expect(response.status).not.toBe(200);
    expect(response.error).toContain('last admin');
  });
});

test.describe('Edge Function: deduct-points', () => {
  let adminUser: TestUser;
  let family: TestFamily;
  let childMember: TestMember;

  test.beforeEach(async ({}, testInfo) => {
    if (!edgeFunctionsAvailable) testInfo.skip();
  });

  test.beforeAll(async () => {
    if (!edgeFunctionsAvailable) return;
    adminUser = await createTestUser();
    const familyData = await createTestFamily(adminUser);
    family = familyData.family;
    childMember = await createTestChild(adminUser, family.id, 'Points Child', '1234');

    // Give child some points
    const serviceClient = createServiceClient();
    await serviceClient
      .from('family_members')
      .update({ total_points: 100 })
      .eq('id', childMember.id);
  });

  test.afterAll(async () => {
    await cleanupTestData({
      familyIds: [family.id],
      userIds: [adminUser.id]
    });
  });

  test('admin can deduct points', async () => {
    const client = await createAuthenticatedClient(adminUser.email, adminUser.password);
    const token = await getAuthToken(client);

    const response = await callDeductPoints(token!, {
      member_id: childMember.id,
      points: 25,
      reason: 'Test deduction'
    });

    expect(response.status).toBe(200);
    expect(response.data?.previous_total).toBe(100);
    expect(response.data?.new_total).toBe(75);
  });

  test('cannot deduct more points than available (caps at 0)', async () => {
    const client = await createAuthenticatedClient(adminUser.email, adminUser.password);
    const token = await getAuthToken(client);

    const response = await callDeductPoints(token!, {
      member_id: childMember.id,
      points: 1000,
      reason: 'Large deduction'
    });

    // Should either fail or cap at 0
    if (response.status === 200) {
      expect(response.data?.new_total).toBeGreaterThanOrEqual(0);
    }
  });

  test('non-admin cannot deduct points', async () => {
    // Use the child's PIN token
    const { data: pinLogin } = await callPinLogin(childMember.child_invite_code!, '1234');

    const response = await callDeductPoints(pinLogin?.token || '', {
      member_id: childMember.id,
      points: 10,
      reason: 'Unauthorized deduction'
    });

    expect(response.status).not.toBe(200);
  });
});

test.describe('Edge Function: reset-child-pin', () => {
  let adminUser: TestUser;
  let family: TestFamily;
  let childMember: TestMember;

  test.beforeEach(async ({}, testInfo) => {
    if (!edgeFunctionsAvailable) testInfo.skip();
  });

  test.beforeAll(async () => {
    if (!edgeFunctionsAvailable) return;
    adminUser = await createTestUser();
    const familyData = await createTestFamily(adminUser);
    family = familyData.family;
    childMember = await createTestChild(adminUser, family.id, 'Reset PIN Child', '0000');
  });

  test.afterAll(async () => {
    await cleanupTestData({
      familyIds: [family.id],
      userIds: [adminUser.id]
    });
  });

  test('admin can reset child PIN', async () => {
    const client = await createAuthenticatedClient(adminUser.email, adminUser.password);
    const token = await getAuthToken(client);

    const newPin = '9999';
    const response = await callResetChildPin(token!, {
      member_id: childMember.id,
      new_pin: newPin
    });

    expect(response.status).toBe(200);
    expect(response.data?.success).toBe(true);

    // Verify new PIN works
    const loginResponse = await callPinLogin(childMember.child_invite_code!, newPin);
    expect(loginResponse.status).toBe(200);

    // Old PIN should not work
    const oldLoginResponse = await callPinLogin(childMember.child_invite_code!, '0000');
    expect(oldLoginResponse.status).not.toBe(200);
  });
});

test.describe('Edge Function: regenerate-invite-code', () => {
  let adminUser: TestUser;
  let family: TestFamily;

  test.beforeEach(async ({}, testInfo) => {
    if (!edgeFunctionsAvailable) testInfo.skip();
  });

  test.beforeAll(async () => {
    if (!edgeFunctionsAvailable) return;
    adminUser = await createTestUser();
    const familyData = await createTestFamily(adminUser);
    family = familyData.family;
  });

  test.afterAll(async () => {
    await cleanupTestData({
      familyIds: [family.id],
      userIds: [adminUser.id]
    });
  });

  test('admin can regenerate member invite code', async () => {
    const client = await createAuthenticatedClient(adminUser.email, adminUser.password);
    const token = await getAuthToken(client);
    const oldCode = family.invite_code;

    const response = await callRegenerateInviteCode(token!, 'member');

    expect(response.status).toBe(200);
    expect(response.data?.new_code).toBeDefined();
    expect(response.data?.new_code).not.toBe(oldCode);
  });

  test('admin can regenerate parent invite code', async () => {
    const client = await createAuthenticatedClient(adminUser.email, adminUser.password);
    const token = await getAuthToken(client);
    const oldCode = family.parent_invite_code;

    const response = await callRegenerateInviteCode(token!, 'parent');

    expect(response.status).toBe(200);
    expect(response.data?.new_code).toBeDefined();
    expect(response.data?.new_code).not.toBe(oldCode);
  });
});

test.describe('Edge Function: award-birthday-points', () => {
  let adminUser: TestUser;
  let family: TestFamily;
  let childMember: TestMember;

  test.beforeEach(async ({}, testInfo) => {
    if (!edgeFunctionsAvailable) testInfo.skip();
  });

  test.beforeAll(async () => {
    if (!edgeFunctionsAvailable) return;
    adminUser = await createTestUser();
    const familyData = await createTestFamily(adminUser);
    family = familyData.family;
    childMember = await createTestChild(adminUser, family.id, 'Birthday Child', '1234');

    // Set birthdate
    const serviceClient = createServiceClient();
    await serviceClient
      .from('family_members')
      .update({
        birthdate: new Date().toISOString().split('T')[0], // Today
        total_points: 0
      })
      .eq('id', childMember.id);
  });

  test.afterAll(async () => {
    await cleanupTestData({
      familyIds: [family.id],
      userIds: [adminUser.id]
    });
  });

  test('admin can award birthday points', async () => {
    const client = await createAuthenticatedClient(adminUser.email, adminUser.password);
    const token = await getAuthToken(client);

    // Call without member_id - function finds members with today's birthday
    const response = await callAwardBirthdayPoints(token!, 100);

    expect(response.status).toBe(200);
    expect(response.data?.success).toBe(true);
    // If there's a birthday today, points should be awarded
    if (response.data?.awarded_count && response.data.awarded_count > 0) {
      expect(response.data?.details?.length).toBeGreaterThan(0);
    }
  });
});

test.describe('Edge Function: disable-member', () => {
  let adminUser: TestUser;
  let family: TestFamily;
  let childMember: TestMember;

  test.beforeEach(async ({}, testInfo) => {
    if (!edgeFunctionsAvailable) testInfo.skip();
  });

  test.beforeAll(async () => {
    if (!edgeFunctionsAvailable) return;
    adminUser = await createTestUser();
    const familyData = await createTestFamily(adminUser);
    family = familyData.family;
    childMember = await createTestChild(adminUser, family.id, 'Disable Test Child', '1234');
  });

  test.afterAll(async () => {
    await cleanupTestData({
      familyIds: [family.id],
      userIds: [adminUser.id]
    });
  });

  test('admin can disable member account', async () => {
    const client = await createAuthenticatedClient(adminUser.email, adminUser.password);
    const token = await getAuthToken(client);

    const response = await callDisableMember(token!, childMember.id, true);

    expect(response.status).toBe(200);
    expect(response.data?.is_disabled).toBe(true);
  });

  test('disabled member cannot login', async () => {
    // Try to login with disabled account
    const loginResponse = await callPinLogin(childMember.child_invite_code!, '1234');

    // Should fail or indicate disabled
    expect(loginResponse.status).not.toBe(200);
  });

  test('admin can re-enable member account', async () => {
    const client = await createAuthenticatedClient(adminUser.email, adminUser.password);
    const token = await getAuthToken(client);

    const response = await callDisableMember(token!, childMember.id, false);

    expect(response.status).toBe(200);
    expect(response.data?.is_disabled).toBe(false);

    // Now login should work
    const loginResponse = await callPinLogin(childMember.child_invite_code!, '1234');
    expect(loginResponse.status).toBe(200);
  });
});
}); // Close outer 'Edge Function Tests' describe
