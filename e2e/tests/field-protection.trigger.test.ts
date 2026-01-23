/**
 * Field Protection Trigger Tests
 *
 * Tests database triggers that protect sensitive fields:
 * - protect_family_member_fields: Prevents non-admins from modifying sensitive member fields
 * - protect_task_fields: Prevents non-admins from modifying sensitive task fields
 * - enforce_child_task_defaults: Enforces defaults for child-created tasks
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
  expectTriggerException,
  TestUser,
  TestFamily,
  TestMember
} from './utils/test-helpers';

test.describe('protect_family_member_fields trigger', () => {
  let adminUser: TestUser;
  let family: TestFamily;
  let childMember: TestMember;
  let nonAdminParent: { user: TestUser; member: TestMember };

  test.beforeAll(async () => {
    adminUser = await createTestUser();
    const familyData = await createTestFamily(adminUser, 'Trigger Test Family');
    family = familyData.family;
    childMember = await createTestChild(adminUser, family.id, 'Trigger Test Child', '1234');
    nonAdminParent = await createTestNonAdminParent(family.id, 'Non-Admin Parent');
  });

  test.afterAll(async () => {
    await cleanupTestData({
      familyIds: [family.id],
      userIds: [adminUser.id, nonAdminParent.user.id]
    });
  });

  test.describe('Non-admin via standard auth', () => {
    test('cannot modify is_admin field', async () => {
      const client = await createAuthenticatedClient(
        nonAdminParent.user.email,
        nonAdminParent.user.password
      );

      const { error } = await client
        .from('family_members')
        .update({ is_admin: true })
        .eq('id', nonAdminParent.member.id);

      expectTriggerException(error, 'Cannot modify admin status');
    });

    test('cannot modify role field', async () => {
      const client = await createAuthenticatedClient(
        nonAdminParent.user.email,
        nonAdminParent.user.password
      );

      const { error } = await client
        .from('family_members')
        .update({ role: 'admin' })
        .eq('id', nonAdminParent.member.id);

      expectTriggerException(error, 'Cannot modify role');
    });

    test('cannot modify total_points field', async () => {
      const client = await createAuthenticatedClient(
        nonAdminParent.user.email,
        nonAdminParent.user.password
      );

      const { error } = await client
        .from('family_members')
        .update({ total_points: 99999 })
        .eq('id', nonAdminParent.member.id);

      expectTriggerException(error, 'Cannot modify points directly');
    });

    test('cannot modify current_level field', async () => {
      const client = await createAuthenticatedClient(
        nonAdminParent.user.email,
        nonAdminParent.user.password
      );

      const { error } = await client
        .from('family_members')
        .update({ current_level: 100 })
        .eq('id', nonAdminParent.member.id);

      expectTriggerException(error, 'Cannot modify level directly');
    });

    test('cannot modify family_id field', async () => {
      const client = await createAuthenticatedClient(
        nonAdminParent.user.email,
        nonAdminParent.user.password
      );

      const { error } = await client
        .from('family_members')
        .update({ family_id: '00000000-0000-0000-0000-000000000000' })
        .eq('id', nonAdminParent.member.id);

      expectTriggerException(error, 'Cannot change family');
    });

    test('cannot modify user_id field', async () => {
      const client = await createAuthenticatedClient(
        nonAdminParent.user.email,
        nonAdminParent.user.password
      );

      const { error } = await client
        .from('family_members')
        .update({ user_id: '00000000-0000-0000-0000-000000000000' })
        .eq('id', nonAdminParent.member.id);

      expectTriggerException(error, 'Cannot modify user_id');
    });

    test('CAN modify allowed fields (name, avatar_url)', async () => {
      const client = await createAuthenticatedClient(
        nonAdminParent.user.email,
        nonAdminParent.user.password
      );

      const { data, error } = await client
        .from('family_members')
        .update({
          name: 'Updated Name',
          avatar_url: 'https://example.com/new-avatar.jpg'
        })
        .eq('id', nonAdminParent.member.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.name).toBe('Updated Name');
      expect(data?.avatar_url).toBe('https://example.com/new-avatar.jpg');
    });
  });

  test.describe('Non-admin via PIN auth (child)', () => {
    test('cannot modify is_admin field', async () => {
      const childClient = createPinUserClient(childMember.id);

      const { error } = await childClient
        .from('family_members')
        .update({ is_admin: true })
        .eq('id', childMember.id);

      expectTriggerException(error, 'Cannot modify admin status');
    });

    test('cannot modify pin_hash field', async () => {
      const childClient = createPinUserClient(childMember.id);

      const { error } = await childClient
        .from('family_members')
        .update({ pin_hash: 'newhash123' })
        .eq('id', childMember.id);

      expectTriggerException(error, 'Cannot modify PIN');
    });

    test('cannot modify total_points field', async () => {
      const childClient = createPinUserClient(childMember.id);

      const { error } = await childClient
        .from('family_members')
        .update({ total_points: 9999 })
        .eq('id', childMember.id);

      expectTriggerException(error, 'Cannot modify points directly');
    });

    test('CAN modify allowed fields (name, avatar_url)', async () => {
      const childClient = createPinUserClient(childMember.id);

      const { data, error } = await childClient
        .from('family_members')
        .update({
          name: 'Cool Kid',
          avatar_url: 'https://example.com/kid-avatar.jpg'
        })
        .eq('id', childMember.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.name).toBe('Cool Kid');
    });
  });

  test.describe('Admin can modify all fields', () => {
    test('admin can modify is_admin field', async () => {
      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);

      // Create a test member
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

    test('admin can modify total_points field', async () => {
      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);

      const { data, error } = await client
        .from('family_members')
        .update({ total_points: 500 })
        .eq('id', childMember.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.total_points).toBe(500);

      // Reset
      await client
        .from('family_members')
        .update({ total_points: 0 })
        .eq('id', childMember.id);
    });
  });
});

test.describe('protect_task_fields trigger', () => {
  let adminUser: TestUser;
  let family: TestFamily;
  let adminMember: TestMember;
  let childMember: TestMember;
  let testTask: { id: string };

  test.beforeAll(async () => {
    adminUser = await createTestUser();
    const familyData = await createTestFamily(adminUser, 'Task Trigger Test');
    family = familyData.family;
    adminMember = familyData.member;
    childMember = await createTestChild(adminUser, family.id, 'Task Trigger Child', '5555');

    // Create a task assigned to child
    const serviceClient = createServiceClient();
    const { data: task } = await serviceClient
      .from('tasks')
      .insert({
        title: 'Protected Task',
        family_id: family.id,
        assigned_to: childMember.id,
        created_by: adminMember.id,
        point_value: 10,
        priority: 'medium',
        due_date: new Date().toISOString().split('T')[0]
      })
      .select()
      .single();

    testTask = task!;
  });

  test.afterAll(async () => {
    await cleanupTestData({
      familyIds: [family.id],
      userIds: [adminUser.id]
    });
  });

  test.describe('Non-admin task field protection', () => {
    test('cannot modify point_value', async () => {
      const childClient = createPinUserClient(childMember.id);

      const { error } = await childClient
        .from('tasks')
        .update({ point_value: 1000 })
        .eq('id', testTask.id);

      expectTriggerException(error, 'Only admins can change point values');
    });

    test('cannot modify priority', async () => {
      const childClient = createPinUserClient(childMember.id);

      const { error } = await childClient
        .from('tasks')
        .update({ priority: 'high' })
        .eq('id', testTask.id);

      expectTriggerException(error, 'Only admins can change priority');
    });

    test('cannot modify creation_approved', async () => {
      const childClient = createPinUserClient(childMember.id);

      const { error } = await childClient
        .from('tasks')
        .update({ creation_approved: true })
        .eq('id', testTask.id);

      expectTriggerException(error, 'Only admins can approve task creation');
    });

    test('cannot modify approved_by', async () => {
      const childClient = createPinUserClient(childMember.id);

      const { error } = await childClient
        .from('tasks')
        .update({
          approved_by: childMember.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', testTask.id);

      expectTriggerException(error, 'Only admins can approve task completion');
    });

    test('cannot reassign already-assigned task', async () => {
      const childClient = createPinUserClient(childMember.id);

      const { error } = await childClient
        .from('tasks')
        .update({ assigned_to: adminMember.id })
        .eq('id', testTask.id);

      expectTriggerException(error, 'Only admins can reassign tasks');
    });

    test('CAN modify allowed fields (status, completed_at, completed_by)', async () => {
      const childClient = createPinUserClient(childMember.id);

      const { data, error } = await childClient
        .from('tasks')
        .update({
          status: 'pending_approval',
          completed_by: childMember.id,
          completed_at: new Date().toISOString()
        })
        .eq('id', testTask.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.status).toBe('pending_approval');
      expect(data?.completed_by).toBe(childMember.id);

      // Reset for other tests
      const serviceClient = createServiceClient();
      await serviceClient
        .from('tasks')
        .update({
          status: 'pending',
          completed_by: null,
          completed_at: null
        })
        .eq('id', testTask.id);
    });
  });

  test.describe('Unassigned task claiming', () => {
    let unassignedTask: { id: string };

    test.beforeAll(async () => {
      const serviceClient = createServiceClient();
      const { data: task } = await serviceClient
        .from('tasks')
        .insert({
          title: 'Claimable Task',
          family_id: family.id,
          assigned_to: null,
          created_by: adminMember.id,
          point_value: 5,
          priority: 'low',
          due_date: new Date().toISOString().split('T')[0]
        })
        .select()
        .single();

      unassignedTask = task!;
    });

    test('child CAN claim unassigned task for themselves', async () => {
      const childClient = createPinUserClient(childMember.id);

      const { data, error } = await childClient
        .from('tasks')
        .update({ assigned_to: childMember.id })
        .eq('id', unassignedTask.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.assigned_to).toBe(childMember.id);
    });

    test('child CANNOT claim unassigned task for someone else', async () => {
      // Reset task to unassigned
      const serviceClient = createServiceClient();
      await serviceClient
        .from('tasks')
        .update({ assigned_to: null })
        .eq('id', unassignedTask.id);

      const childClient = createPinUserClient(childMember.id);

      const { error } = await childClient
        .from('tasks')
        .update({ assigned_to: adminMember.id }) // Trying to assign to admin
        .eq('id', unassignedTask.id);

      // Trigger blocks non-admin from assigning tasks to others
      expectTriggerException(error, 'Only admins can reassign tasks');
    });
  });

  test.describe('Admin can modify all task fields', () => {
    test('admin can modify point_value', async () => {
      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);

      const { data, error } = await client
        .from('tasks')
        .update({ point_value: 50 })
        .eq('id', testTask.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.point_value).toBe(50);

      // Reset
      await client.from('tasks').update({ point_value: 10 }).eq('id', testTask.id);
    });

    test('admin can modify priority', async () => {
      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);

      const { data, error } = await client
        .from('tasks')
        .update({ priority: 'high' })
        .eq('id', testTask.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.priority).toBe('high');

      // Reset
      await client.from('tasks').update({ priority: 'medium' }).eq('id', testTask.id);
    });

    test('admin can approve task completion', async () => {
      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);

      // Set to pending_approval first
      const serviceClient = createServiceClient();
      await serviceClient
        .from('tasks')
        .update({
          status: 'pending_approval',
          completed_by: childMember.id
        })
        .eq('id', testTask.id);

      const { data, error } = await client
        .from('tasks')
        .update({
          status: 'completed',
          approved_by: adminMember.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', testTask.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.status).toBe('completed');
      expect(data?.approved_by).toBe(adminMember.id);
    });
  });
});

test.describe('enforce_child_task_defaults trigger', () => {
  let adminUser: TestUser;
  let family: TestFamily;
  let adminMember: TestMember;
  let childMember: TestMember;

  test.beforeAll(async () => {
    adminUser = await createTestUser();
    const familyData = await createTestFamily(adminUser, 'Task Defaults Test');
    family = familyData.family;
    adminMember = familyData.member;
    childMember = await createTestChild(adminUser, family.id, 'Defaults Child', '7777');
  });

  test.afterAll(async () => {
    await cleanupTestData({
      familyIds: [family.id],
      userIds: [adminUser.id]
    });
  });

  test('child-created task gets enforced defaults', async () => {
    const childClient = createPinUserClient(childMember.id);

    const { data, error } = await childClient
      .from('tasks')
      .insert({
        title: 'Child Suggested Task',
        family_id: family.id,
        point_value: 100, // Should be overridden to 5
        priority: 'high', // Should be overridden to medium
        creation_approved: true, // Should be overridden to false
        due_date: new Date().toISOString().split('T')[0],
        created_by: childMember.id,
        assigned_to: childMember.id
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();

    // Verify enforced defaults
    expect(data?.point_value).toBe(5); // Enforced 5 points for children
    expect(data?.priority).toBe('medium'); // Enforced medium priority
    expect(data?.creation_approved).toBe(false); // Always requires approval

    // Cleanup
    if (data?.id) {
      const serviceClient = createServiceClient();
      await serviceClient.from('tasks').delete().eq('id', data.id);
    }
  });

  test('admin-created task keeps specified values', async () => {
    const client = await createAuthenticatedClient(adminUser.email, adminUser.password);

    const { data, error } = await client
      .from('tasks')
      .insert({
        title: 'Admin Created Task',
        family_id: family.id,
        point_value: 100,
        priority: 'high',
        due_date: new Date().toISOString().split('T')[0],
        created_by: adminMember.id
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();

    // Admin values should NOT be overridden
    expect(data?.point_value).toBe(100);
    expect(data?.priority).toBe('high');

    // Cleanup
    if (data?.id) {
      await client.from('tasks').delete().eq('id', data.id);
    }
  });

  test('admin task creation does not require approval', async () => {
    const client = await createAuthenticatedClient(adminUser.email, adminUser.password);

    const { data, error } = await client
      .from('tasks')
      .insert({
        title: 'Admin No Approval Needed',
        family_id: family.id,
        due_date: new Date().toISOString().split('T')[0],
        created_by: adminMember.id
      })
      .select()
      .single();

    expect(error).toBeNull();

    // Admin tasks don't need approval (null or true)
    // The trigger doesn't force creation_approved to false for admins
    expect(data?.creation_approved).not.toBe(false);

    // Cleanup
    if (data?.id) {
      await client.from('tasks').delete().eq('id', data.id);
    }
  });
});
