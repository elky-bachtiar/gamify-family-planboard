/**
 * Business Logic Security Tests
 *
 * Tests that business logic rules cannot be bypassed to perform
 * unauthorized operations.
 */

import { test, expect } from '@playwright/test';
import {
  createTestUser,
  createTestFamily,
  createTestChild,
  createTestNonAdminParent,
  createAuthenticatedClient,
  createServiceClient,
  cleanupTestData,
  SUPABASE_ANON_KEY,
  TestUser,
  TestFamily,
  TestMember,
} from './utils/test-helpers';

import {
  callPinLogin,
  callRequestRedemption,
} from './utils/edge-function-helpers';

const EDGE_FUNCTION_URL = 'http://127.0.0.1:54321/functions/v1';

test.describe('Business Logic Security Tests', () => {
  let adminUser: TestUser;
  let nonAdminUser: TestUser;
  let nonAdminMember: TestMember;
  let family: TestFamily;
  let child: TestMember;

  test.beforeAll(async () => {
    adminUser = await createTestUser();
    const familyData = await createTestFamily(adminUser, 'Business Logic Test Family');
    family = familyData.family;
    child = await createTestChild(adminUser, family.id, 'Test Child', '1234');

    // Create non-admin parent
    const nonAdmin = await createTestNonAdminParent(family.id, 'Non-Admin Parent');
    nonAdminUser = nonAdmin.user;
    nonAdminMember = nonAdmin.member;
  });

  test.afterAll(async () => {
    await cleanupTestData({
      familyIds: [family.id],
      userIds: [adminUser.id, nonAdminUser.id],
    });
  });

  test.describe('Admin Permission Enforcement', () => {
    test('non-admin cannot create child accounts', async ({ request }) => {
      const client = await createAuthenticatedClient(nonAdminUser.email, nonAdminUser.password);
      const session = await client.auth.getSession();
      const token = session.data.session?.access_token || '';

      const response = await request.post(`${EDGE_FUNCTION_URL}/create-child`, {
        data: {
          name: 'Unauthorized Child',
          pin: '1234',
          color: '#FF0000',
          family_id: family.id,
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error).toContain('admin');
    });

    test('non-admin cannot toggle admin status', async ({ request }) => {
      const client = await createAuthenticatedClient(nonAdminUser.email, nonAdminUser.password);
      const session = await client.auth.getSession();
      const token = session.data.session?.access_token || '';

      const response = await request.post(`${EDGE_FUNCTION_URL}/toggle-admin`, {
        data: {
          memberId: nonAdminMember.id,
          makeAdmin: true, // Trying to make themselves admin
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.status()).toBe(403);
    });

    test('non-admin cannot deduct points', async ({ request }) => {
      const client = await createAuthenticatedClient(nonAdminUser.email, nonAdminUser.password);
      const session = await client.auth.getSession();
      const token = session.data.session?.access_token || '';

      const response = await request.post(`${EDGE_FUNCTION_URL}/deduct-points`, {
        data: {
          member_id: child.id,
          points: 100,
          reason: 'Unauthorized deduction',
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.status()).toBe(403);
    });

    test('non-admin cannot reset child PIN', async ({ request }) => {
      const client = await createAuthenticatedClient(nonAdminUser.email, nonAdminUser.password);
      const session = await client.auth.getSession();
      const token = session.data.session?.access_token || '';

      const response = await request.post(`${EDGE_FUNCTION_URL}/reset-child-pin`, {
        data: {
          member_id: child.id,
          new_pin: '9999',
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.status()).toBe(403);
    });

    test('non-admin cannot disable members', async ({ request }) => {
      const client = await createAuthenticatedClient(nonAdminUser.email, nonAdminUser.password);
      const session = await client.auth.getSession();
      const token = session.data.session?.access_token || '';

      const response = await request.post(`${EDGE_FUNCTION_URL}/disable-member`, {
        data: {
          member_id: child.id,
          disable: true,
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.status()).toBe(403);
    });

    test('non-admin cannot export family data', async ({ request }) => {
      const client = await createAuthenticatedClient(nonAdminUser.email, nonAdminUser.password);
      const session = await client.auth.getSession();
      const token = session.data.session?.access_token || '';

      const response = await request.post(`${EDGE_FUNCTION_URL}/export-family-data`, {
        data: {},
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.status()).toBe(403);
    });

    test('non-admin cannot regenerate invite codes', async ({ request }) => {
      const client = await createAuthenticatedClient(nonAdminUser.email, nonAdminUser.password);
      const session = await client.auth.getSession();
      const token = session.data.session?.access_token || '';

      const response = await request.post(`${EDGE_FUNCTION_URL}/regenerate-invite-code`, {
        data: {
          code_type: 'member',
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.status()).toBe(403);
    });
  });

  test.describe('Self-Protection Rules', () => {
    test('admin cannot disable themselves', async ({ request }) => {
      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);
      const session = await client.auth.getSession();
      const token = session.data.session?.access_token || '';

      // Get admin's member ID
      const serviceClient = createServiceClient();
      const { data: adminMember } = await serviceClient
        .from('family_members')
        .select('id')
        .eq('user_id', adminUser.id)
        .single();

      const response = await request.post(`${EDGE_FUNCTION_URL}/disable-member`, {
        data: {
          member_id: adminMember?.id,
          disable: true,
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('own account');
    });

    test('cannot disable another admin', async ({ request }) => {
      // Create another admin in the family
      const anotherAdmin = await createTestUser();
      const serviceClient = createServiceClient();

      await serviceClient.from('family_members').insert({
        name: 'Another Admin',
        email: anotherAdmin.email,
        family_id: family.id,
        user_id: anotherAdmin.id,
        is_admin: true,
        role: 'parent',
      });

      const { data: anotherAdminMember } = await serviceClient
        .from('family_members')
        .select('id')
        .eq('user_id', anotherAdmin.id)
        .single();

      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);
      const session = await client.auth.getSession();
      const token = session.data.session?.access_token || '';

      const response = await request.post(`${EDGE_FUNCTION_URL}/disable-member`, {
        data: {
          member_id: anotherAdminMember?.id,
          disable: true,
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('admin');

      // Cleanup
      await serviceClient.from('family_members').delete().eq('id', anotherAdminMember?.id);
      await cleanupTestData({ userIds: [anotherAdmin.id] });
    });
  });

  test.describe('Last Admin Protection', () => {
    test('cannot remove admin status from the last admin', async ({ request }) => {
      // Create a new family with only one admin
      const singleAdminUser = await createTestUser();
      const singleAdminFamily = await createTestFamily(singleAdminUser, 'Single Admin Family');

      const client = await createAuthenticatedClient(singleAdminUser.email, singleAdminUser.password);
      const session = await client.auth.getSession();
      const token = session.data.session?.access_token || '';

      // Get the admin's member ID
      const serviceClient = createServiceClient();
      const { data: adminMember } = await serviceClient
        .from('family_members')
        .select('id')
        .eq('user_id', singleAdminUser.id)
        .single();

      const response = await request.post(`${EDGE_FUNCTION_URL}/toggle-admin`, {
        data: {
          memberId: adminMember?.id,
          makeAdmin: false, // Trying to remove last admin
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('last admin');

      // Cleanup
      await cleanupTestData({
        familyIds: [singleAdminFamily.family.id],
        userIds: [singleAdminUser.id],
      });
    });
  });

  test.describe('Cross-Family Protection', () => {
    test('admin cannot modify members in other families', async ({ request }) => {
      // Create another family
      const otherFamilyUser = await createTestUser();
      const otherFamilyData = await createTestFamily(otherFamilyUser, 'Other Family');
      const otherChild = await createTestChild(otherFamilyUser, otherFamilyData.family.id, 'Other Child', '5678');

      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);
      const session = await client.auth.getSession();
      const token = session.data.session?.access_token || '';

      // Try to deduct points from child in other family
      const response = await request.post(`${EDGE_FUNCTION_URL}/deduct-points`, {
        data: {
          member_id: otherChild.id,
          points: 100,
          reason: 'Cross-family attack',
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error).toContain('outside your family');

      // Cleanup
      await cleanupTestData({
        familyIds: [otherFamilyData.family.id],
        userIds: [otherFamilyUser.id],
      });
    });
  });

  test.describe('Disabled Account Protection', () => {
    test('disabled child cannot login', async ({ request }) => {
      // Create and disable a child
      const testChild = await createTestChild(adminUser, family.id, 'Disabled Child', '4321');

      const serviceClient = createServiceClient();
      await serviceClient
        .from('family_members')
        .update({
          is_disabled: true,
          disabled_at: new Date().toISOString(),
        })
        .eq('id', testChild.id);

      // Try to login
      const response = await request.post(`${EDGE_FUNCTION_URL}/pin-login`, {
        data: {
          child_invite_code: testChild.child_invite_code,
          pin: '4321',
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
      });

      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error).toContain('disabled');

      // Cleanup
      await serviceClient.from('family_members').delete().eq('id', testChild.id);
    });
  });

  test.describe('Reward Redemption Protection', () => {
    test('edge function enforces over-redemption protection', async () => {
      const serviceClient = createServiceClient();

      // Give child some points
      await serviceClient
        .from('family_members')
        .update({ total_points: 1000 })
        .eq('id', child.id);

      // Enable rewards in family
      await serviceClient
        .from('families')
        .update({
          point_to_money_rate: 0.01,
          minimum_redemption: 100,
        })
        .eq('id', family.id);

      // Clean up any existing redemptions
      await serviceClient.from('reward_redemptions').delete().eq('member_id', child.id);

      // Login as child
      const loginResponse = await callPinLogin(child.child_invite_code!, '1234');
      expect(loginResponse.status).toBe(200);
      const childToken = loginResponse.data?.token;

      // Create first redemption for 600 points via edge function
      const firstRedemption = await callRequestRedemption(childToken!, 600);
      expect(firstRedemption.status).toBe(201);
      expect(firstRedemption.data?.available_after).toBe(400); // 1000 - 600

      // Try to create second redemption for 500 points (exceeds available 400)
      const secondRedemption = await callRequestRedemption(childToken!, 500);
      expect(secondRedemption.status).toBe(400);
      expect(secondRedemption.error).toContain('Insufficient');

      // Third redemption for 400 should work
      const thirdRedemption = await callRequestRedemption(childToken!, 400);
      expect(thirdRedemption.status).toBe(201);
      expect(thirdRedemption.data?.available_after).toBe(0);

      // Now nothing more should be allowed
      const fourthRedemption = await callRequestRedemption(childToken!, 100);
      expect(fourthRedemption.status).toBe(400);

      // Cleanup
      await serviceClient.from('reward_redemptions').delete().eq('member_id', child.id);
      await serviceClient.from('family_members').update({ total_points: 0 }).eq('id', child.id);
    });

    test('cannot request redemption exceeding available points via edge function', async () => {
      const serviceClient = createServiceClient();

      // Give child some points
      await serviceClient
        .from('family_members')
        .update({ total_points: 500 })
        .eq('id', child.id);

      // Enable rewards
      await serviceClient
        .from('families')
        .update({
          point_to_money_rate: 0.01,
          minimum_redemption: 100,
        })
        .eq('id', family.id);

      // Clean up any existing redemptions
      await serviceClient.from('reward_redemptions').delete().eq('member_id', child.id);

      // Create pending redemption for 400 points via direct DB insert (simulating existing pending)
      await serviceClient.from('reward_redemptions').insert({
        family_id: family.id,
        member_id: child.id,
        points_redeemed: 400,
        money_amount: 4.0,
        status: 'pending',
      });

      // Available should be 100 (500 - 400)
      // Try to request 200 via edge function
      const loginResponse = await callPinLogin(child.child_invite_code!, '1234');
      const childToken = loginResponse.data?.token;

      const response = await callRequestRedemption(childToken!, 200);

      expect(response.status).toBe(400);
      expect(response.error).toContain('Insufficient');

      // Cleanup
      await serviceClient.from('reward_redemptions').delete().eq('member_id', child.id);
      await serviceClient.from('family_members').update({ total_points: 0 }).eq('id', child.id);
    });

    test('approved redemptions also reduce available points', async () => {
      const serviceClient = createServiceClient();

      // Give child points
      await serviceClient
        .from('family_members')
        .update({ total_points: 1000 })
        .eq('id', child.id);

      // Enable rewards
      await serviceClient
        .from('families')
        .update({
          point_to_money_rate: 0.01,
          minimum_redemption: 100,
        })
        .eq('id', family.id);

      // Clean up any existing redemptions
      await serviceClient.from('reward_redemptions').delete().eq('member_id', child.id);

      // Create approved redemption (simulating already approved but not yet paid out)
      await serviceClient.from('reward_redemptions').insert({
        family_id: family.id,
        member_id: child.id,
        points_redeemed: 800,
        money_amount: 8.0,
        status: 'approved',
        approved_at: new Date().toISOString(),
      });

      // Try to request more via edge function - should only have 200 available
      const loginResponse = await callPinLogin(child.child_invite_code!, '1234');
      const childToken = loginResponse.data?.token;

      const response = await callRequestRedemption(childToken!, 300);
      expect(response.status).toBe(400);
      expect(response.error).toContain('Insufficient');

      // Request 200 should work
      const response2 = await callRequestRedemption(childToken!, 200);
      expect(response2.status).toBe(201);
      expect(response2.data?.available_after).toBe(0);

      // Cleanup
      await serviceClient.from('reward_redemptions').delete().eq('member_id', child.id);
      await serviceClient.from('family_members').update({ total_points: 0 }).eq('id', child.id);
    });
  });

  test.describe('Points Manipulation Prevention', () => {
    test('cannot deduct negative points (double negative attack)', async ({ request }) => {
      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);
      const session = await client.auth.getSession();
      const token = session.data.session?.access_token || '';

      const response = await request.post(`${EDGE_FUNCTION_URL}/deduct-points`, {
        data: {
          member_id: child.id,
          points: -100, // Negative deduction = adding points
          reason: 'Negative deduction attack',
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('positive');
    });

    test('cannot deduct more than maximum allowed', async ({ request }) => {
      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);
      const session = await client.auth.getSession();
      const token = session.data.session?.access_token || '';

      const response = await request.post(`${EDGE_FUNCTION_URL}/deduct-points`, {
        data: {
          member_id: child.id,
          points: 999999999, // Extremely large number
          reason: 'Overflow attack',
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}`,
        },
      });

      expect([400, 200]).toContain(response.status());

      // If successful, points should be capped at current balance (not go negative)
      if (response.status() === 200) {
        const body = await response.json();
        expect(body.new_total).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
