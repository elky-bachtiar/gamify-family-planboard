/**
 * Database Trigger Protection Tests (Hacktest)
 *
 * Tests that verify database triggers correctly protect sensitive fields:
 * - protect_family_member_fields_trigger
 * - protect_task_fields_trigger
 * - enforce_child_task_defaults_trigger
 *
 * These tests verify server-side business logic enforcement.
 */

import { test, expect } from '@playwright/test';
import {
  createTestUser,
  createTestFamily,
  createAuthenticatedClient,
  createServiceClient,
  createPinUserClient,
  createTestChild,
  createTestNonAdminParent,
  cleanupTestData,
  randomString,
  TestUser,
  TestFamily,
  TestMember
} from './utils/test-helpers';

test.describe('protect_family_member_fields_trigger', () => {
  let adminUser: TestUser;
  let family: TestFamily;
  let adminMember: TestMember;
  let child: TestMember;

  test.beforeAll(async () => {
    adminUser = await createTestUser();
    const familyData = await createTestFamily(adminUser, 'Trigger Test Family');
    family = familyData.family;
    adminMember = familyData.member;
    child = await createTestChild(adminUser, family.id, 'Trigger Test Child', '1234');
  });

  test.afterAll(async () => {
    await cleanupTestData({
      familyIds: [family.id],
      userIds: [adminUser.id]
    });
  });

  test.describe('Protected fields for non-admins', () => {
    test('non-admin cannot change is_admin field', async () => {
      const { user: nonAdmin, member: nonAdminMember } = await createTestNonAdminParent(family.id);
      const client = await createAuthenticatedClient(nonAdmin.email, nonAdmin.password);
      const serviceClient = createServiceClient();

      // Attempt via RLS-allowed update (own record)
      await client
        .from('family_members')
        .update({ is_admin: true })
        .eq('id', nonAdminMember.id);

      // Verify unchanged
      const { data } = await serviceClient
        .from('family_members')
        .select('is_admin')
        .eq('id', nonAdminMember.id)
        .single();

      expect(data?.is_admin).toBe(false);

      await cleanupTestData({ userIds: [nonAdmin.id] });
    });

    test('non-admin cannot change role field', async () => {
      const childClient = createPinUserClient(child.id);
      const serviceClient = createServiceClient();

      await childClient
        .from('family_members')
        .update({ role: 'parent' })
        .eq('id', child.id);

      const { data } = await serviceClient
        .from('family_members')
        .select('role')
        .eq('id', child.id)
        .single();

      expect(data?.role).toBe('child');
    });

    test('non-admin cannot change user_id field', async () => {
      const { user: nonAdmin, member: nonAdminMember } = await createTestNonAdminParent(family.id);
      const client = await createAuthenticatedClient(nonAdmin.email, nonAdmin.password);
      const serviceClient = createServiceClient();

      // Try to change user_id to someone else's
      await client
        .from('family_members')
        .update({ user_id: adminUser.id })
        .eq('id', nonAdminMember.id);

      const { data } = await serviceClient
        .from('family_members')
        .select('user_id')
        .eq('id', nonAdminMember.id)
        .single();

      expect(data?.user_id).toBe(nonAdmin.id);

      await cleanupTestData({ userIds: [nonAdmin.id] });
    });

    test('non-admin cannot change pin_hash field', async () => {
      const childClient = createPinUserClient(child.id);
      const serviceClient = createServiceClient();

      const { data: before } = await serviceClient
        .from('family_members')
        .select('pin_hash')
        .eq('id', child.id)
        .single();

      await childClient
        .from('family_members')
        .update({ pin_hash: 'new_malicious_hash' })
        .eq('id', child.id);

      const { data: after } = await serviceClient
        .from('family_members')
        .select('pin_hash')
        .eq('id', child.id)
        .single();

      expect(after?.pin_hash).toBe(before?.pin_hash);
    });

    test('non-admin cannot change total_points field', async () => {
      const childClient = createPinUserClient(child.id);
      const serviceClient = createServiceClient();

      const { data: before } = await serviceClient
        .from('family_members')
        .select('total_points')
        .eq('id', child.id)
        .single();

      await childClient
        .from('family_members')
        .update({ total_points: 999999 })
        .eq('id', child.id);

      const { data: after } = await serviceClient
        .from('family_members')
        .select('total_points')
        .eq('id', child.id)
        .single();

      expect(after?.total_points).toBe(before?.total_points);
    });

    test('non-admin cannot change current_level field', async () => {
      const childClient = createPinUserClient(child.id);
      const serviceClient = createServiceClient();

      const { data: before } = await serviceClient
        .from('family_members')
        .select('current_level')
        .eq('id', child.id)
        .single();

      await childClient
        .from('family_members')
        .update({ current_level: 99 })
        .eq('id', child.id);

      const { data: after } = await serviceClient
        .from('family_members')
        .select('current_level')
        .eq('id', child.id)
        .single();

      expect(after?.current_level).toBe(before?.current_level);
    });

    test('non-admin cannot change family_id field', async () => {
      const otherUser = await createTestUser();
      const otherFamilyData = await createTestFamily(otherUser, 'Other Family');

      const childClient = createPinUserClient(child.id);
      const serviceClient = createServiceClient();

      await childClient
        .from('family_members')
        .update({ family_id: otherFamilyData.family.id })
        .eq('id', child.id);

      const { data } = await serviceClient
        .from('family_members')
        .select('family_id')
        .eq('id', child.id)
        .single();

      expect(data?.family_id).toBe(family.id);

      await cleanupTestData({
        familyIds: [otherFamilyData.family.id],
        userIds: [otherUser.id]
      });
    });
  });

  test.describe('Allowed fields for non-admins', () => {
    test('non-admin can change their own name', async () => {
      const { user: nonAdmin, member: nonAdminMember } = await createTestNonAdminParent(family.id);
      const client = await createAuthenticatedClient(nonAdmin.email, nonAdmin.password);
      const serviceClient = createServiceClient();

      const newName = `Updated Name ${randomString(4)}`;

      await client
        .from('family_members')
        .update({ name: newName })
        .eq('id', nonAdminMember.id);

      const { data } = await serviceClient
        .from('family_members')
        .select('name')
        .eq('id', nonAdminMember.id)
        .single();

      expect(data?.name).toBe(newName);

      await cleanupTestData({ userIds: [nonAdmin.id] });
    });

    test('non-admin can change their own avatar_url', async () => {
      const { user: nonAdmin, member: nonAdminMember } = await createTestNonAdminParent(family.id);
      const client = await createAuthenticatedClient(nonAdmin.email, nonAdmin.password);
      const serviceClient = createServiceClient();

      const newAvatar = 'https://example.com/avatar.jpg';

      await client
        .from('family_members')
        .update({ avatar_url: newAvatar })
        .eq('id', nonAdminMember.id);

      const { data } = await serviceClient
        .from('family_members')
        .select('avatar_url')
        .eq('id', nonAdminMember.id)
        .single();

      expect(data?.avatar_url).toBe(newAvatar);

      await cleanupTestData({ userIds: [nonAdmin.id] });
    });

    test('child (PIN user) can change their own name', async () => {
      const childClient = createPinUserClient(child.id);
      const serviceClient = createServiceClient();

      const newName = `Child Name ${randomString(4)}`;

      await childClient
        .from('family_members')
        .update({ name: newName })
        .eq('id', child.id);

      const { data } = await serviceClient
        .from('family_members')
        .select('name')
        .eq('id', child.id)
        .single();

      expect(data?.name).toBe(newName);
    });
  });

  test.describe('Admin privileges', () => {
    test('admin can update any family member fields', async () => {
      const adminClient = await createAuthenticatedClient(adminUser.email, adminUser.password);
      const serviceClient = createServiceClient();

      // Admin updates child's points
      await adminClient
        .from('family_members')
        .update({ total_points: 50 })
        .eq('id', child.id);

      const { data } = await serviceClient
        .from('family_members')
        .select('total_points')
        .eq('id', child.id)
        .single();

      expect(data?.total_points).toBe(50);

      // Reset
      await serviceClient
        .from('family_members')
        .update({ total_points: 0 })
        .eq('id', child.id);
    });

    test('admin can promote/demote other members', async () => {
      const { user: nonAdmin, member: nonAdminMember } = await createTestNonAdminParent(family.id);
      const adminClient = await createAuthenticatedClient(adminUser.email, adminUser.password);
      const serviceClient = createServiceClient();

      // Promote
      await adminClient
        .from('family_members')
        .update({ is_admin: true })
        .eq('id', nonAdminMember.id);

      let { data } = await serviceClient
        .from('family_members')
        .select('is_admin')
        .eq('id', nonAdminMember.id)
        .single();

      expect(data?.is_admin).toBe(true);

      // Demote
      await adminClient
        .from('family_members')
        .update({ is_admin: false })
        .eq('id', nonAdminMember.id);

      ({ data } = await serviceClient
        .from('family_members')
        .select('is_admin')
        .eq('id', nonAdminMember.id)
        .single());

      expect(data?.is_admin).toBe(false);

      await cleanupTestData({ userIds: [nonAdmin.id] });
    });
  });
});

test.describe('protect_task_fields_trigger', () => {
  let adminUser: TestUser;
  let family: TestFamily;
  let adminMember: TestMember;
  let child: TestMember;

  test.beforeAll(async () => {
    adminUser = await createTestUser();
    const familyData = await createTestFamily(adminUser, 'Task Trigger Test');
    family = familyData.family;
    adminMember = familyData.member;
    child = await createTestChild(adminUser, family.id, 'Task Child', '1234');
  });

  test.afterAll(async () => {
    await cleanupTestData({
      familyIds: [family.id],
      userIds: [adminUser.id]
    });
  });

  test.describe('Protected task fields for non-admins', () => {
    test('non-admin cannot change creation_approved field', async () => {
      const serviceClient = createServiceClient();

      // Create a task needing approval
      const { data: task } = await serviceClient
        .from('tasks')
        .insert({
          title: 'Approval Test',
          family_id: family.id,
          created_by: child.id,
          creation_approved: false,
          due_date: new Date().toISOString().split('T')[0]
        })
        .select()
        .single();

      const childClient = createPinUserClient(child.id);

      await childClient
        .from('tasks')
        .update({ creation_approved: true })
        .eq('id', task?.id);

      const { data: verified } = await serviceClient
        .from('tasks')
        .select('creation_approved')
        .eq('id', task?.id)
        .single();

      expect(verified?.creation_approved).toBe(false);

      await serviceClient.from('tasks').delete().eq('id', task?.id);
    });

    test('non-admin cannot change approved_by field', async () => {
      const serviceClient = createServiceClient();

      const { data: task } = await serviceClient
        .from('tasks')
        .insert({
          title: 'Approval Test',
          family_id: family.id,
          status: 'pending_approval',
          completed_by: child.id,
          due_date: new Date().toISOString().split('T')[0]
        })
        .select()
        .single();

      const childClient = createPinUserClient(child.id);

      await childClient
        .from('tasks')
        .update({ approved_by: child.id })
        .eq('id', task?.id);

      const { data: verified } = await serviceClient
        .from('tasks')
        .select('approved_by')
        .eq('id', task?.id)
        .single();

      expect(verified?.approved_by).toBeNull();

      await serviceClient.from('tasks').delete().eq('id', task?.id);
    });

    test('non-admin cannot change point_value field', async () => {
      const serviceClient = createServiceClient();

      const { data: task } = await serviceClient
        .from('tasks')
        .insert({
          title: 'Points Test',
          family_id: family.id,
          assigned_to: child.id,
          point_value: 10,
          due_date: new Date().toISOString().split('T')[0]
        })
        .select()
        .single();

      const childClient = createPinUserClient(child.id);

      await childClient
        .from('tasks')
        .update({ point_value: 1000 })
        .eq('id', task?.id);

      const { data: verified } = await serviceClient
        .from('tasks')
        .select('point_value')
        .eq('id', task?.id)
        .single();

      expect(verified?.point_value).toBe(10);

      await serviceClient.from('tasks').delete().eq('id', task?.id);
    });

    test('non-admin cannot change priority field', async () => {
      const serviceClient = createServiceClient();

      const { data: task } = await serviceClient
        .from('tasks')
        .insert({
          title: 'Priority Test',
          family_id: family.id,
          assigned_to: child.id,
          priority: 'low',
          due_date: new Date().toISOString().split('T')[0]
        })
        .select()
        .single();

      const childClient = createPinUserClient(child.id);

      await childClient
        .from('tasks')
        .update({ priority: 'high' })
        .eq('id', task?.id);

      const { data: verified } = await serviceClient
        .from('tasks')
        .select('priority')
        .eq('id', task?.id)
        .single();

      expect(verified?.priority).toBe('low');

      await serviceClient.from('tasks').delete().eq('id', task?.id);
    });

    test('non-admin cannot reassign tasks to others', async () => {
      const { user: nonAdmin, member: nonAdminMember } = await createTestNonAdminParent(family.id);
      const serviceClient = createServiceClient();

      const { data: task } = await serviceClient
        .from('tasks')
        .insert({
          title: 'Assignment Test',
          family_id: family.id,
          assigned_to: child.id,
          due_date: new Date().toISOString().split('T')[0]
        })
        .select()
        .single();

      const childClient = createPinUserClient(child.id);

      // Try to reassign to someone else
      await childClient
        .from('tasks')
        .update({ assigned_to: nonAdminMember.id })
        .eq('id', task?.id);

      const { data: verified } = await serviceClient
        .from('tasks')
        .select('assigned_to')
        .eq('id', task?.id)
        .single();

      expect(verified?.assigned_to).toBe(child.id);

      await serviceClient.from('tasks').delete().eq('id', task?.id);
      await cleanupTestData({ userIds: [nonAdmin.id] });
    });

    test('non-admin can claim unassigned task for themselves', async () => {
      const serviceClient = createServiceClient();

      const { data: task } = await serviceClient
        .from('tasks')
        .insert({
          title: 'Claimable Task',
          family_id: family.id,
          assigned_to: null, // Unassigned
          due_date: new Date().toISOString().split('T')[0]
        })
        .select()
        .single();

      const childClient = createPinUserClient(child.id);

      // Claim for self
      await childClient
        .from('tasks')
        .update({ assigned_to: child.id })
        .eq('id', task?.id);

      const { data: verified } = await serviceClient
        .from('tasks')
        .select('assigned_to')
        .eq('id', task?.id)
        .single();

      expect(verified?.assigned_to).toBe(child.id);

      await serviceClient.from('tasks').delete().eq('id', task?.id);
    });
  });

  test.describe('Allowed task fields for non-admins', () => {
    test('non-admin can update task title on their own task', async () => {
      const serviceClient = createServiceClient();

      const { data: task } = await serviceClient
        .from('tasks')
        .insert({
          title: 'Original Title',
          family_id: family.id,
          assigned_to: child.id,
          created_by: child.id,
          due_date: new Date().toISOString().split('T')[0]
        })
        .select()
        .single();

      const childClient = createPinUserClient(child.id);

      await childClient
        .from('tasks')
        .update({ title: 'Updated Title' })
        .eq('id', task?.id);

      const { data: verified } = await serviceClient
        .from('tasks')
        .select('title')
        .eq('id', task?.id)
        .single();

      expect(verified?.title).toBe('Updated Title');

      await serviceClient.from('tasks').delete().eq('id', task?.id);
    });

    test('non-admin can update task status on their task', async () => {
      const serviceClient = createServiceClient();

      const { data: task } = await serviceClient
        .from('tasks')
        .insert({
          title: 'Status Test',
          family_id: family.id,
          assigned_to: child.id,
          status: 'pending',
          due_date: new Date().toISOString().split('T')[0]
        })
        .select()
        .single();

      const childClient = createPinUserClient(child.id);

      // Mark as in_progress
      await childClient
        .from('tasks')
        .update({ status: 'in_progress' })
        .eq('id', task?.id);

      let { data: verified } = await serviceClient
        .from('tasks')
        .select('status')
        .eq('id', task?.id)
        .single();

      expect(verified?.status).toBe('in_progress');

      // Mark as pending_approval (completing the task)
      await childClient
        .from('tasks')
        .update({ status: 'pending_approval', completed_by: child.id })
        .eq('id', task?.id);

      ({ data: verified } = await serviceClient
        .from('tasks')
        .select('status')
        .eq('id', task?.id)
        .single());

      expect(verified?.status).toBe('pending_approval');

      await serviceClient.from('tasks').delete().eq('id', task?.id);
    });
  });
});

test.describe('enforce_child_task_defaults_trigger', () => {
  let adminUser: TestUser;
  let family: TestFamily;
  let child: TestMember;

  test.beforeAll(async () => {
    adminUser = await createTestUser();
    const familyData = await createTestFamily(adminUser, 'Child Defaults Test');
    family = familyData.family;
    child = await createTestChild(adminUser, family.id, 'Defaults Child', '1234');
  });

  test.afterAll(async () => {
    await cleanupTestData({
      familyIds: [family.id],
      userIds: [adminUser.id]
    });
  });

  test('child-created task gets default point_value of 5', async () => {
    const childClient = createPinUserClient(child.id);

    const { data: task } = await childClient
      .from('tasks')
      .insert({
        title: 'Child Task',
        family_id: family.id,
        point_value: 100, // Tries to set 100
        due_date: new Date().toISOString().split('T')[0]
      })
      .select()
      .single();

    expect(task?.point_value).toBe(5); // Forced to 5

    const serviceClient = createServiceClient();
    await serviceClient.from('tasks').delete().eq('id', task?.id);
  });

  test('child-created task gets default priority of medium', async () => {
    const childClient = createPinUserClient(child.id);

    const { data: task } = await childClient
      .from('tasks')
      .insert({
        title: 'Child Task',
        family_id: family.id,
        priority: 'high', // Tries to set high
        due_date: new Date().toISOString().split('T')[0]
      })
      .select()
      .single();

    expect(task?.priority).toBe('medium'); // Forced to medium

    const serviceClient = createServiceClient();
    await serviceClient.from('tasks').delete().eq('id', task?.id);
  });

  test('child-created task gets creation_approved = false', async () => {
    const childClient = createPinUserClient(child.id);

    const { data: task } = await childClient
      .from('tasks')
      .insert({
        title: 'Child Task',
        family_id: family.id,
        creation_approved: true, // Tries to set true
        due_date: new Date().toISOString().split('T')[0]
      })
      .select()
      .single();

    expect(task?.creation_approved).toBe(false); // Forced to false

    const serviceClient = createServiceClient();
    await serviceClient.from('tasks').delete().eq('id', task?.id);
  });

  test('admin-created task preserves point_value', async () => {
    const adminClient = await createAuthenticatedClient(adminUser.email, adminUser.password);

    const { data: task } = await adminClient
      .from('tasks')
      .insert({
        title: 'Admin Task',
        family_id: family.id,
        point_value: 100, // Admin sets 100
        due_date: new Date().toISOString().split('T')[0]
      })
      .select()
      .single();

    expect(task?.point_value).toBe(100); // Preserved

    const serviceClient = createServiceClient();
    await serviceClient.from('tasks').delete().eq('id', task?.id);
  });

  test('admin-created task preserves priority', async () => {
    const adminClient = await createAuthenticatedClient(adminUser.email, adminUser.password);

    const { data: task } = await adminClient
      .from('tasks')
      .insert({
        title: 'Admin Task',
        family_id: family.id,
        priority: 'high', // Admin sets high
        due_date: new Date().toISOString().split('T')[0]
      })
      .select()
      .single();

    expect(task?.priority).toBe('high'); // Preserved

    const serviceClient = createServiceClient();
    await serviceClient.from('tasks').delete().eq('id', task?.id);
  });

  test('multiple protected fields are all enforced simultaneously', async () => {
    const childClient = createPinUserClient(child.id);

    const { data: task } = await childClient
      .from('tasks')
      .insert({
        title: 'Multi-field Test',
        family_id: family.id,
        point_value: 999,
        priority: 'high',
        creation_approved: true,
        due_date: new Date().toISOString().split('T')[0]
      })
      .select()
      .single();

    // All fields should be enforced
    expect(task?.point_value).toBe(5);
    expect(task?.priority).toBe('medium');
    expect(task?.creation_approved).toBe(false);

    const serviceClient = createServiceClient();
    await serviceClient.from('tasks').delete().eq('id', task?.id);
  });
});

test.describe('Trigger bypass attempts', () => {
  let adminUser: TestUser;
  let family: TestFamily;
  let child: TestMember;

  test.beforeAll(async () => {
    adminUser = await createTestUser();
    const familyData = await createTestFamily(adminUser, 'Bypass Test');
    family = familyData.family;
    child = await createTestChild(adminUser, family.id, 'Bypass Child', '1234');
  });

  test.afterAll(async () => {
    await cleanupTestData({
      familyIds: [family.id],
      userIds: [adminUser.id]
    });
  });

  test('cannot bypass triggers via batch update', async () => {
    const serviceClient = createServiceClient();

    // Create multiple tasks
    const { data: tasks } = await serviceClient
      .from('tasks')
      .insert([
        { title: 'Batch 1', family_id: family.id, point_value: 10, assigned_to: child.id, due_date: new Date().toISOString().split('T')[0] },
        { title: 'Batch 2', family_id: family.id, point_value: 10, assigned_to: child.id, due_date: new Date().toISOString().split('T')[0] },
        { title: 'Batch 3', family_id: family.id, point_value: 10, assigned_to: child.id, due_date: new Date().toISOString().split('T')[0] }
      ])
      .select();

    const childClient = createPinUserClient(child.id);

    // Try batch update to change point values
    const taskIds = tasks?.map(t => t.id) || [];
    await childClient
      .from('tasks')
      .update({ point_value: 1000 })
      .in('id', taskIds);

    // Verify all still have original values
    const { data: verified } = await serviceClient
      .from('tasks')
      .select('point_value')
      .in('id', taskIds);

    verified?.forEach(task => {
      expect(task.point_value).toBe(10);
    });

    await serviceClient.from('tasks').delete().in('id', taskIds);
  });

  test('cannot bypass triggers via upsert', async () => {
    const serviceClient = createServiceClient();

    // Create a task
    const { data: task } = await serviceClient
      .from('tasks')
      .insert({
        title: 'Upsert Test',
        family_id: family.id,
        point_value: 10,
        assigned_to: child.id,
        due_date: new Date().toISOString().split('T')[0]
      })
      .select()
      .single();

    const childClient = createPinUserClient(child.id);

    // Try to upsert with higher point value
    // Note: This depends on upsert permissions - may need to be insert + select
    const { data: upserted } = await childClient
      .from('tasks')
      .upsert({
        id: task?.id,
        title: 'Upsert Test',
        family_id: family.id,
        point_value: 1000,
        assigned_to: child.id,
        due_date: new Date().toISOString().split('T')[0]
      })
      .select()
      .single();

    // Verify point value unchanged
    const { data: verified } = await serviceClient
      .from('tasks')
      .select('point_value')
      .eq('id', task?.id)
      .single();

    expect(verified?.point_value).toBe(10);

    await serviceClient.from('tasks').delete().eq('id', task?.id);
  });
});
