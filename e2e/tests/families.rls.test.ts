/**
 * RLS Tests for families table
 *
 * Tests Row Level Security policies:
 * - SELECT: Users can view their own family (created_by or member)
 * - INSERT: Any authenticated user can create a family
 * - UPDATE: Only family admins can update family settings
 * - DELETE: Not allowed (cascades only)
 */

import { test, expect } from '@playwright/test';
import {
  createTestUser,
  createTestFamily,
  createAuthenticatedClient,
  createAnonClient,
  createServiceClient,
  createPinUserClient,
  createTestChild,
  cleanupTestData,
  randomString,
  TestUser,
  TestFamily,
  TestMember
} from './utils/test-helpers';

test.describe('families table RLS policies', () => {
  let adminUser: TestUser;
  let family: TestFamily;
  let adminMember: TestMember;
  let otherUser: TestUser;
  let otherFamily: TestFamily;

  test.beforeAll(async () => {
    // Create two families for isolation testing
    adminUser = await createTestUser();
    const familyData = await createTestFamily(adminUser, 'Test Family A');
    family = familyData.family;
    adminMember = familyData.member;

    otherUser = await createTestUser();
    const otherFamilyData = await createTestFamily(otherUser, 'Test Family B');
    otherFamily = otherFamilyData.family;
  });

  test.afterAll(async () => {
    await cleanupTestData({
      familyIds: [family.id, otherFamily.id],
      userIds: [adminUser.id, otherUser.id]
    });
  });

  test.describe('SELECT policy', () => {
    test('admin can view their own family', async () => {
      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);

      const { data, error } = await client
        .from('families')
        .select('*')
        .eq('id', family.id)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.name).toBe('Test Family A');
    });

    test('admin cannot view other families', async () => {
      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);

      const { data, error } = await client
        .from('families')
        .select('*')
        .eq('id', otherFamily.id)
        .single();

      // RLS should return null or error for unauthorized access
      expect(data).toBeNull();
    });

    test('PIN user (child) can view their family', async () => {
      // Create a child in the family
      const child = await createTestChild(adminUser, family.id);
      const childClient = createPinUserClient(child.id);

      const { data, error } = await childClient
        .from('families')
        .select('*')
        .eq('id', family.id)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.id).toBe(family.id);
    });

    test('unauthenticated user cannot view any families', async () => {
      const client = createAnonClient();

      const { data, error } = await client
        .from('families')
        .select('*');

      // Should return empty or error for unauthenticated
      expect(data?.length || 0).toBe(0);
    });
  });

  test.describe('INSERT policy', () => {
    test('authenticated user can create a family', async () => {
      const newUser = await createTestUser();
      const client = await createAuthenticatedClient(newUser.email, newUser.password);

      const { data, error } = await client
        .from('families')
        .insert({
          name: 'New Family',
          invite_code: randomString(8).toUpperCase(),
          created_by: newUser.id
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.name).toBe('New Family');

      // Cleanup
      if (data?.id) {
        await cleanupTestData({ familyIds: [data.id], userIds: [newUser.id] });
      }
    });

    test('unauthenticated user cannot create a family', async () => {
      const client = createAnonClient();

      const { data, error } = await client
        .from('families')
        .insert({
          name: 'Unauthorized Family',
          invite_code: randomString(8).toUpperCase()
        })
        .select()
        .single();

      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });
  });

  test.describe('UPDATE policy', () => {
    test('admin can update their family settings', async () => {
      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);

      const { data, error } = await client
        .from('families')
        .update({ weekly_target_points: 500 })
        .eq('id', family.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.weekly_target_points).toBe(500);
    });

    test('non-admin member cannot update family settings', async () => {
      // Create a non-admin member
      const nonAdminUser = await createTestUser();
      const serviceClient = createServiceClient();

      // Add as non-admin member to the family
      await serviceClient.from('family_members').insert({
        name: 'Non-Admin Member',
        email: nonAdminUser.email,
        family_id: family.id,
        user_id: nonAdminUser.id,
        is_admin: false,
        role: 'parent'
      });

      const client = await createAuthenticatedClient(nonAdminUser.email, nonAdminUser.password);

      const { data, error } = await client
        .from('families')
        .update({ name: 'Hacked Family Name' })
        .eq('id', family.id)
        .select()
        .single();

      // Should fail or return nothing
      expect(data).toBeNull();

      // Cleanup
      await cleanupTestData({ userIds: [nonAdminUser.id] });
    });

    test('admin cannot update other families', async () => {
      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);

      const { data, error } = await client
        .from('families')
        .update({ name: 'Hacked Other Family' })
        .eq('id', otherFamily.id)
        .select()
        .single();

      // Should fail or return nothing
      expect(data).toBeNull();
    });

    test('PIN user cannot update family settings', async () => {
      const child = await createTestChild(adminUser, family.id);
      const childClient = createPinUserClient(child.id);

      const { data, error } = await childClient
        .from('families')
        .update({ name: 'Child Hacked Name' })
        .eq('id', family.id)
        .select()
        .single();

      // Children are not admins, so should fail
      expect(data).toBeNull();
    });
  });

  test.describe('Cross-family isolation', () => {
    test('user can only see families they belong to', async () => {
      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);

      const { data, error } = await client
        .from('families')
        .select('*');

      expect(error).toBeNull();
      expect(data).toBeDefined();

      // Should only see their own family
      const familyIds = data?.map(f => f.id) || [];
      expect(familyIds).toContain(family.id);
      expect(familyIds).not.toContain(otherFamily.id);
    });

    test('service role can see all families', async () => {
      const serviceClient = createServiceClient();

      const { data, error } = await serviceClient
        .from('families')
        .select('*');

      expect(error).toBeNull();
      expect(data).toBeDefined();

      // Service role bypasses RLS
      const familyIds = data?.map(f => f.id) || [];
      expect(familyIds).toContain(family.id);
      expect(familyIds).toContain(otherFamily.id);
    });
  });
});
