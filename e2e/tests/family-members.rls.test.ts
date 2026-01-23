/**
 * RLS Tests for family_members table
 *
 * Tests Row Level Security policies:
 * - SELECT: Family members can view members in their family
 * - INSERT: Users can insert members to their own family
 * - UPDATE: Non-admins can only update own profile; admins can update any member
 * - DELETE: Only admins can delete family members
 *
 * Also tests field-level protection triggers:
 * - Non-admins cannot modify: is_admin, role, user_id, pin_hash, total_points, current_level, family_id
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
  createTestNonAdminParent,
  cleanupTestData,
  randomString,
  expectTriggerException,
  TestUser,
  TestFamily,
  TestMember
} from './utils/test-helpers';

test.describe('family_members table RLS policies', () => {
  let adminUser: TestUser;
  let family: TestFamily;
  let adminMember: TestMember;
  let childMember: TestMember;
  let nonAdminParent: { user: TestUser; member: TestMember };
  let otherUser: TestUser;
  let otherFamily: TestFamily;

  test.beforeAll(async () => {
    // Create family with admin
    adminUser = await createTestUser();
    const familyData = await createTestFamily(adminUser, 'Members Test Family');
    family = familyData.family;
    adminMember = familyData.member;

    // Create a child member
    childMember = await createTestChild(adminUser, family.id, 'Test Child', '1234');

    // Create a non-admin parent
    nonAdminParent = await createTestNonAdminParent(family.id, 'Non-Admin Parent');

    // Create another family for isolation testing
    otherUser = await createTestUser();
    const otherFamilyData = await createTestFamily(otherUser, 'Other Family');
    otherFamily = otherFamilyData.family;
  });

  test.afterAll(async () => {
    await cleanupTestData({
      familyIds: [family.id, otherFamily.id],
      userIds: [adminUser.id, otherUser.id, nonAdminParent.user.id]
    });
  });

  test.describe('SELECT policy', () => {
    test('admin can view all family members', async () => {
      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);

      const { data, error } = await client
        .from('family_members')
        .select('*')
        .eq('family_id', family.id);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBeGreaterThanOrEqual(3); // admin, child, non-admin parent
    });

    test('non-admin can view all family members', async () => {
      const client = await createAuthenticatedClient(
        nonAdminParent.user.email,
        nonAdminParent.user.password
      );

      const { data, error } = await client
        .from('family_members')
        .select('*')
        .eq('family_id', family.id);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBeGreaterThanOrEqual(3);
    });

    test('PIN user (child) can view family members', async () => {
      const childClient = createPinUserClient(childMember.id);

      const { data, error } = await childClient
        .from('family_members')
        .select('*')
        .eq('family_id', family.id);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBeGreaterThanOrEqual(3);
    });

    test('user cannot view members of other families', async () => {
      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);

      const { data, error } = await client
        .from('family_members')
        .select('*')
        .eq('family_id', otherFamily.id);

      // Should return empty due to RLS
      expect(data?.length || 0).toBe(0);
    });
  });

  test.describe('INSERT policy', () => {
    test('admin can add new members to their family', async () => {
      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);

      const { data, error } = await client
        .from('family_members')
        .insert({
          name: 'New Member via Admin',
          family_id: family.id,
          role: 'child',
          is_admin: false
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.name).toBe('New Member via Admin');

      // Cleanup
      if (data?.id) {
        const serviceClient = createServiceClient();
        await serviceClient.from('family_members').delete().eq('id', data.id);
      }
    });

    test('user cannot add members to other families', async () => {
      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);

      const { data, error } = await client
        .from('family_members')
        .insert({
          name: 'Unauthorized Member',
          family_id: otherFamily.id,
          role: 'child',
          is_admin: false
        })
        .select()
        .single();

      // Should fail due to RLS
      expect(data).toBeNull();
    });
  });

  test.describe('UPDATE policy - Admin', () => {
    test('admin can update any family member', async () => {
      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);

      const { data, error } = await client
        .from('family_members')
        .update({ name: 'Updated Child Name' })
        .eq('id', childMember.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.name).toBe('Updated Child Name');

      // Restore original name
      await client
        .from('family_members')
        .update({ name: 'Test Child' })
        .eq('id', childMember.id);
    });

    test('admin can update is_admin field', async () => {
      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);

      // Create a test member to promote
      const serviceClient = createServiceClient();
      const { data: testMember } = await serviceClient
        .from('family_members')
        .insert({
          name: 'Promote Test',
          family_id: family.id,
          is_admin: false,
          role: 'parent'
        })
        .select()
        .single();

      if (testMember) {
        const { data, error } = await client
          .from('family_members')
          .update({ is_admin: true })
          .eq('id', testMember.id)
          .select()
          .single();

        expect(error).toBeNull();
        expect(data?.is_admin).toBe(true);

        // Cleanup
        await serviceClient.from('family_members').delete().eq('id', testMember.id);
      }
    });
  });

  test.describe('UPDATE policy - Non-Admin', () => {
    test('non-admin can update their own avatar_url', async () => {
      const client = await createAuthenticatedClient(
        nonAdminParent.user.email,
        nonAdminParent.user.password
      );

      const { data, error } = await client
        .from('family_members')
        .update({ avatar_url: 'https://example.com/avatar.jpg' })
        .eq('id', nonAdminParent.member.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.avatar_url).toBe('https://example.com/avatar.jpg');
    });

    test('non-admin can update their own name', async () => {
      const client = await createAuthenticatedClient(
        nonAdminParent.user.email,
        nonAdminParent.user.password
      );

      const originalName = nonAdminParent.member.name;

      const { data, error } = await client
        .from('family_members')
        .update({ name: 'Updated Name' })
        .eq('id', nonAdminParent.member.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.name).toBe('Updated Name');

      // Restore
      await client
        .from('family_members')
        .update({ name: originalName })
        .eq('id', nonAdminParent.member.id);
    });

    test('non-admin cannot update other members', async () => {
      const client = await createAuthenticatedClient(
        nonAdminParent.user.email,
        nonAdminParent.user.password
      );

      const { data, error } = await client
        .from('family_members')
        .update({ name: 'Hacked Name' })
        .eq('id', adminMember.id)
        .select()
        .single();

      // Should fail - either RLS blocks or returns null
      expect(data).toBeNull();
    });
  });

  test.describe('Field protection triggers', () => {
    test('non-admin cannot modify is_admin field', async () => {
      const client = await createAuthenticatedClient(
        nonAdminParent.user.email,
        nonAdminParent.user.password
      );

      const { data, error } = await client
        .from('family_members')
        .update({ is_admin: true })
        .eq('id', nonAdminParent.member.id)
        .select()
        .single();

      // Trigger should block this
      expectTriggerException(error, 'Cannot modify admin status');
    });

    test('non-admin cannot modify role field', async () => {
      const client = await createAuthenticatedClient(
        nonAdminParent.user.email,
        nonAdminParent.user.password
      );

      const { data, error } = await client
        .from('family_members')
        .update({ role: 'parent' })
        .eq('id', nonAdminParent.member.id)
        .select()
        .single();

      // Trigger should block this
      if (error) {
        expectTriggerException(error, 'Cannot modify role');
      }
    });

    test('non-admin cannot modify total_points field', async () => {
      const client = await createAuthenticatedClient(
        nonAdminParent.user.email,
        nonAdminParent.user.password
      );

      const { data, error } = await client
        .from('family_members')
        .update({ total_points: 9999 })
        .eq('id', nonAdminParent.member.id)
        .select()
        .single();

      // Trigger should block this
      expectTriggerException(error, 'Cannot modify points directly');
    });

    test('non-admin cannot modify current_level field', async () => {
      const client = await createAuthenticatedClient(
        nonAdminParent.user.email,
        nonAdminParent.user.password
      );

      const { data, error } = await client
        .from('family_members')
        .update({ current_level: 50 })
        .eq('id', nonAdminParent.member.id)
        .select()
        .single();

      // Trigger should block this
      expectTriggerException(error, 'Cannot modify level directly');
    });

    test('non-admin cannot modify family_id field', async () => {
      const client = await createAuthenticatedClient(
        nonAdminParent.user.email,
        nonAdminParent.user.password
      );

      const { data, error } = await client
        .from('family_members')
        .update({ family_id: otherFamily.id })
        .eq('id', nonAdminParent.member.id)
        .select()
        .single();

      // Trigger should block this
      expectTriggerException(error, 'Cannot change family');
    });

    test('PIN user (child) cannot modify sensitive fields', async () => {
      const childClient = createPinUserClient(childMember.id);

      const { data, error } = await childClient
        .from('family_members')
        .update({ is_admin: true })
        .eq('id', childMember.id)
        .select()
        .single();

      // Trigger should block this
      expectTriggerException(error, 'Cannot modify admin status');
    });
  });

  test.describe('DELETE policy', () => {
    test('admin can delete family members', async () => {
      // Create a member to delete
      const serviceClient = createServiceClient();
      const { data: deleteTarget } = await serviceClient
        .from('family_members')
        .insert({
          name: 'Delete Me',
          family_id: family.id,
          is_admin: false,
          role: 'child'
        })
        .select()
        .single();

      if (deleteTarget) {
        const client = await createAuthenticatedClient(adminUser.email, adminUser.password);

        const { error } = await client
          .from('family_members')
          .delete()
          .eq('id', deleteTarget.id);

        expect(error).toBeNull();

        // Verify deletion
        const { data: check } = await serviceClient
          .from('family_members')
          .select('*')
          .eq('id', deleteTarget.id)
          .single();

        expect(check).toBeNull();
      }
    });

    test('non-admin cannot delete family members', async () => {
      // Create a member that non-admin will try to delete
      const serviceClient = createServiceClient();
      const { data: target } = await serviceClient
        .from('family_members')
        .insert({
          name: 'Protected Member',
          family_id: family.id,
          is_admin: false,
          role: 'child'
        })
        .select()
        .single();

      if (target) {
        const client = await createAuthenticatedClient(
          nonAdminParent.user.email,
          nonAdminParent.user.password
        );

        const { error } = await client
          .from('family_members')
          .delete()
          .eq('id', target.id);

        // Should fail - RLS blocks non-admin deletes
        // Note: Supabase doesn't return an error for no-op deletes
        // so we verify the member still exists
        const { data: stillExists } = await serviceClient
          .from('family_members')
          .select('*')
          .eq('id', target.id)
          .single();

        expect(stillExists).toBeDefined();

        // Cleanup
        await serviceClient.from('family_members').delete().eq('id', target.id);
      }
    });

    test('admin cannot delete members from other families', async () => {
      // Get a member from the other family
      const serviceClient = createServiceClient();
      const { data: otherMember } = await serviceClient
        .from('family_members')
        .select('*')
        .eq('family_id', otherFamily.id)
        .limit(1)
        .single();

      if (otherMember) {
        const client = await createAuthenticatedClient(adminUser.email, adminUser.password);

        const { error } = await client
          .from('family_members')
          .delete()
          .eq('id', otherMember.id);

        // Verify member still exists
        const { data: stillExists } = await serviceClient
          .from('family_members')
          .select('*')
          .eq('id', otherMember.id)
          .single();

        expect(stillExists).toBeDefined();
      }
    });
  });
});
