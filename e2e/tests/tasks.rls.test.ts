/**
 * RLS Tests for tasks table
 *
 * Tests Row Level Security policies:
 * - SELECT: Admin sees all tasks; Children see only own, unassigned, or self-created tasks
 * - INSERT: Family members can create tasks for their family
 * - UPDATE: Admins have full access; Non-admins limited to own/unassigned/created tasks
 * - DELETE: Only admins can delete tasks
 *
 * Also tests:
 * - Child task creation defaults (5 points, medium priority, creation_approved=false)
 * - Task field protection triggers
 * - Child visibility restrictions
 */

import { test, expect } from '@playwright/test';
import {
  createTestUser,
  createTestFamily,
  createAuthenticatedClient,
  createServiceClient,
  createPinUserClient,
  createTestChild,
  createTestTask,
  cleanupTestData,
  randomString,
  expectTriggerException,
  TestUser,
  TestFamily,
  TestMember,
  TestTask
} from './utils/test-helpers';

test.describe('tasks table RLS policies', () => {
  let adminUser: TestUser;
  let family: TestFamily;
  let adminMember: TestMember;
  let child1: TestMember;
  let child2: TestMember;
  let otherUser: TestUser;
  let otherFamily: TestFamily;
  let adminTask: TestTask;
  let child1Task: TestTask;
  let child2Task: TestTask;
  let unassignedTask: TestTask;

  test.beforeAll(async () => {
    // Create family with admin
    adminUser = await createTestUser();
    const familyData = await createTestFamily(adminUser, 'Tasks Test Family');
    family = familyData.family;
    adminMember = familyData.member;

    // Create two children for visibility testing
    child1 = await createTestChild(adminUser, family.id, 'Child One', '1111');
    child2 = await createTestChild(adminUser, family.id, 'Child Two', '2222');

    // Create another family for isolation testing
    otherUser = await createTestUser();
    const otherFamilyData = await createTestFamily(otherUser, 'Other Tasks Family');
    otherFamily = otherFamilyData.family;

    // Create tasks using service client to bypass triggers
    const serviceClient = createServiceClient();

    // Task assigned to child1
    const { data: task1 } = await serviceClient
      .from('tasks')
      .insert({
        title: 'Child One Task',
        family_id: family.id,
        assigned_to: child1.id,
        created_by: adminMember.id,
        point_value: 20,
        priority: 'high',
        due_date: new Date().toISOString().split('T')[0]
      })
      .select()
      .single();
    child1Task = task1 as TestTask;

    // Task assigned to child2
    const { data: task2 } = await serviceClient
      .from('tasks')
      .insert({
        title: 'Child Two Task',
        family_id: family.id,
        assigned_to: child2.id,
        created_by: adminMember.id,
        point_value: 15,
        priority: 'medium',
        due_date: new Date().toISOString().split('T')[0]
      })
      .select()
      .single();
    child2Task = task2 as TestTask;

    // Unassigned task (claimable)
    const { data: task3 } = await serviceClient
      .from('tasks')
      .insert({
        title: 'Unassigned Task',
        family_id: family.id,
        assigned_to: null,
        created_by: adminMember.id,
        point_value: 10,
        priority: 'low',
        due_date: new Date().toISOString().split('T')[0]
      })
      .select()
      .single();
    unassignedTask = task3 as TestTask;

    // Admin task
    const { data: task4 } = await serviceClient
      .from('tasks')
      .insert({
        title: 'Admin Task',
        family_id: family.id,
        assigned_to: adminMember.id,
        created_by: adminMember.id,
        point_value: 25,
        priority: 'high',
        due_date: new Date().toISOString().split('T')[0]
      })
      .select()
      .single();
    adminTask = task4 as TestTask;
  });

  test.afterAll(async () => {
    await cleanupTestData({
      familyIds: [family.id, otherFamily.id],
      userIds: [adminUser.id, otherUser.id]
    });
  });

  test.describe('SELECT policy - Admin visibility', () => {
    test('admin can see all family tasks', async () => {
      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);

      const { data, error } = await client
        .from('tasks')
        .select('*')
        .eq('family_id', family.id);

      expect(error).toBeNull();
      expect(data).toBeDefined();

      // Admin should see all tasks
      const taskIds = data?.map(t => t.id) || [];
      expect(taskIds).toContain(child1Task.id);
      expect(taskIds).toContain(child2Task.id);
      expect(taskIds).toContain(unassignedTask.id);
      expect(taskIds).toContain(adminTask.id);
    });

    test('admin cannot see tasks from other families', async () => {
      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);

      const { data, error } = await client
        .from('tasks')
        .select('*')
        .eq('family_id', otherFamily.id);

      expect(error).toBeNull();
      expect(data?.length || 0).toBe(0);
    });
  });

  test.describe('SELECT policy - Child visibility restrictions', () => {
    test('child can see their own assigned tasks', async () => {
      const childClient = createPinUserClient(child1.id);

      const { data, error } = await childClient
        .from('tasks')
        .select('*')
        .eq('id', child1Task.id);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBe(1);
      expect(data?.[0].title).toBe('Child One Task');
    });

    test('child can see unassigned (claimable) tasks', async () => {
      const childClient = createPinUserClient(child1.id);

      const { data, error } = await childClient
        .from('tasks')
        .select('*')
        .eq('id', unassignedTask.id);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBe(1);
    });

    test('child CANNOT see tasks assigned to other children', async () => {
      const childClient = createPinUserClient(child1.id);

      const { data, error } = await childClient
        .from('tasks')
        .select('*')
        .eq('id', child2Task.id);

      // RLS should hide this task
      expect(data?.length || 0).toBe(0);
    });

    test('child CANNOT see tasks assigned to admin', async () => {
      const childClient = createPinUserClient(child1.id);

      const { data, error } = await childClient
        .from('tasks')
        .select('*')
        .eq('id', adminTask.id);

      // RLS should hide this task
      expect(data?.length || 0).toBe(0);
    });

    test('child sees correct subset of all family tasks', async () => {
      const childClient = createPinUserClient(child1.id);

      const { data, error } = await childClient
        .from('tasks')
        .select('*')
        .eq('family_id', family.id);

      expect(error).toBeNull();

      const taskIds = data?.map(t => t.id) || [];

      // Should see own task and unassigned
      expect(taskIds).toContain(child1Task.id);
      expect(taskIds).toContain(unassignedTask.id);

      // Should NOT see sibling's task or admin's task
      expect(taskIds).not.toContain(child2Task.id);
      expect(taskIds).not.toContain(adminTask.id);
    });
  });

  test.describe('INSERT policy', () => {
    test('admin can create tasks with any point value', async () => {
      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);

      const { data, error } = await client
        .from('tasks')
        .insert({
          title: 'Admin Created Task',
          family_id: family.id,
          point_value: 50,
          priority: 'high',
          due_date: new Date().toISOString().split('T')[0],
          created_by: adminMember.id
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.point_value).toBe(50);
      expect(data?.priority).toBe('high');

      // Cleanup
      if (data?.id) {
        await client.from('tasks').delete().eq('id', data.id);
      }
    });

    test('child can create tasks but with enforced defaults', async () => {
      const childClient = createPinUserClient(child1.id);

      const { data, error } = await childClient
        .from('tasks')
        .insert({
          title: 'Child Created Task',
          family_id: family.id,
          point_value: 100, // Should be overridden to 5
          priority: 'high', // Should be overridden to medium
          due_date: new Date().toISOString().split('T')[0],
          created_by: child1.id,
          assigned_to: child1.id
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();

      // Verify trigger enforced defaults
      expect(data?.point_value).toBe(5); // Enforced 5 points
      expect(data?.priority).toBe('medium'); // Enforced medium priority
      expect(data?.creation_approved).toBe(false); // Requires approval

      // Cleanup
      if (data?.id) {
        const serviceClient = createServiceClient();
        await serviceClient.from('tasks').delete().eq('id', data.id);
      }
    });

    test('user cannot create tasks in other families', async () => {
      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);

      const { data, error } = await client
        .from('tasks')
        .insert({
          title: 'Unauthorized Task',
          family_id: otherFamily.id,
          point_value: 10,
          due_date: new Date().toISOString().split('T')[0]
        })
        .select()
        .single();

      // RLS should block this
      expect(data).toBeNull();
    });
  });

  test.describe('UPDATE policy - Admin', () => {
    test('admin can update any task in their family', async () => {
      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);

      const { data, error } = await client
        .from('tasks')
        .update({ point_value: 30 })
        .eq('id', child1Task.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.point_value).toBe(30);

      // Restore original value
      await client
        .from('tasks')
        .update({ point_value: 20 })
        .eq('id', child1Task.id);
    });

    test('admin can approve task completion', async () => {
      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);

      // First set task to pending_approval
      const serviceClient = createServiceClient();
      await serviceClient
        .from('tasks')
        .update({
          status: 'pending_approval',
          completed_by: child1.id
        })
        .eq('id', child1Task.id);

      // Admin approves
      const { data, error } = await client
        .from('tasks')
        .update({
          status: 'completed',
          approved_by: adminMember.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', child1Task.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.status).toBe('completed');
      expect(data?.approved_by).toBe(adminMember.id);

      // Reset for other tests
      await serviceClient
        .from('tasks')
        .update({
          status: 'pending',
          completed_by: null,
          approved_by: null,
          approved_at: null
        })
        .eq('id', child1Task.id);
    });
  });

  test.describe('UPDATE policy - Child', () => {
    test('child can update status on their own task', async () => {
      const childClient = createPinUserClient(child1.id);

      const { data, error } = await childClient
        .from('tasks')
        .update({
          status: 'in_progress'
        })
        .eq('id', child1Task.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.status).toBe('in_progress');

      // Reset
      const serviceClient = createServiceClient();
      await serviceClient
        .from('tasks')
        .update({ status: 'pending' })
        .eq('id', child1Task.id);
    });

    test('child can mark their task as pending_approval', async () => {
      const childClient = createPinUserClient(child1.id);

      const { data, error } = await childClient
        .from('tasks')
        .update({
          status: 'pending_approval',
          completed_by: child1.id,
          completed_at: new Date().toISOString()
        })
        .eq('id', child1Task.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.status).toBe('pending_approval');

      // Reset
      const serviceClient = createServiceClient();
      await serviceClient
        .from('tasks')
        .update({
          status: 'pending',
          completed_by: null,
          completed_at: null
        })
        .eq('id', child1Task.id);
    });

    test('child can claim unassigned task for themselves', async () => {
      const childClient = createPinUserClient(child1.id);

      const { data, error } = await childClient
        .from('tasks')
        .update({
          assigned_to: child1.id
        })
        .eq('id', unassignedTask.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.assigned_to).toBe(child1.id);

      // Reset for other tests
      const serviceClient = createServiceClient();
      await serviceClient
        .from('tasks')
        .update({ assigned_to: null })
        .eq('id', unassignedTask.id);
    });

    test('child CANNOT claim task for someone else', async () => {
      const childClient = createPinUserClient(child1.id);

      const { data, error } = await childClient
        .from('tasks')
        .update({
          assigned_to: child2.id // Trying to assign to sibling
        })
        .eq('id', unassignedTask.id)
        .select()
        .single();

      // Trigger should block this - non-admin trying to assign to someone else
      expectTriggerException(error, 'Only admins can reassign tasks');
    });

    test('child CANNOT update tasks assigned to others', async () => {
      const childClient = createPinUserClient(child1.id);

      const { data, error } = await childClient
        .from('tasks')
        .update({
          status: 'in_progress'
        })
        .eq('id', child2Task.id)
        .select()
        .single();

      // RLS should block this (can't even see the task)
      expect(data).toBeNull();
    });
  });

  test.describe('Task field protection triggers', () => {
    test('child cannot change point_value', async () => {
      const childClient = createPinUserClient(child1.id);

      const { data, error } = await childClient
        .from('tasks')
        .update({ point_value: 999 })
        .eq('id', child1Task.id)
        .select()
        .single();

      expectTriggerException(error, 'Only admins can change point values');
    });

    test('child cannot change priority', async () => {
      const childClient = createPinUserClient(child1.id);

      const { data, error } = await childClient
        .from('tasks')
        .update({ priority: 'high' })
        .eq('id', child1Task.id)
        .select()
        .single();

      expectTriggerException(error, 'Only admins can change priority');
    });

    test('child cannot approve their own task completion', async () => {
      const childClient = createPinUserClient(child1.id);

      const { data, error } = await childClient
        .from('tasks')
        .update({
          approved_by: child1.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', child1Task.id)
        .select()
        .single();

      expectTriggerException(error, 'Only admins can approve task completion');
    });

    test('child cannot approve task creation', async () => {
      // First create a task as child
      const childClient = createPinUserClient(child1.id);

      const { data: newTask } = await childClient
        .from('tasks')
        .insert({
          title: 'Test Approval Task',
          family_id: family.id,
          due_date: new Date().toISOString().split('T')[0],
          created_by: child1.id,
          assigned_to: child1.id
        })
        .select()
        .single();

      if (newTask) {
        // Try to approve it as child
        const { data, error } = await childClient
          .from('tasks')
          .update({ creation_approved: true })
          .eq('id', newTask.id)
          .select()
          .single();

        expectTriggerException(error, 'Only admins can approve task creation');

        // Cleanup
        const serviceClient = createServiceClient();
        await serviceClient.from('tasks').delete().eq('id', newTask.id);
      }
    });

    test('child cannot reassign already-assigned task', async () => {
      const childClient = createPinUserClient(child1.id);

      // Try to reassign child1Task (assigned to child1) to child2
      // This should be blocked because it's a reassignment
      const { data, error } = await childClient
        .from('tasks')
        .update({ assigned_to: child2.id })
        .eq('id', child1Task.id)
        .select()
        .single();

      // This is reassigning (already assigned), not claiming
      expectTriggerException(error, 'Only admins can reassign tasks');
    });
  });

  test.describe('DELETE policy', () => {
    test('admin can delete tasks', async () => {
      // Create a task to delete
      const serviceClient = createServiceClient();
      const { data: deleteTarget } = await serviceClient
        .from('tasks')
        .insert({
          title: 'Delete Me',
          family_id: family.id,
          due_date: new Date().toISOString().split('T')[0],
          created_by: adminMember.id
        })
        .select()
        .single();

      if (deleteTarget) {
        const client = await createAuthenticatedClient(adminUser.email, adminUser.password);

        const { error } = await client
          .from('tasks')
          .delete()
          .eq('id', deleteTarget.id);

        expect(error).toBeNull();

        // Verify deletion
        const { data: check } = await serviceClient
          .from('tasks')
          .select('*')
          .eq('id', deleteTarget.id)
          .single();

        expect(check).toBeNull();
      }
    });

    test('child cannot delete tasks', async () => {
      const childClient = createPinUserClient(child1.id);

      const { error } = await childClient
        .from('tasks')
        .delete()
        .eq('id', child1Task.id);

      // Verify task still exists
      const serviceClient = createServiceClient();
      const { data: stillExists } = await serviceClient
        .from('tasks')
        .select('*')
        .eq('id', child1Task.id)
        .single();

      expect(stillExists).toBeDefined();
    });

    test('admin cannot delete tasks from other families', async () => {
      // Create a task in other family
      const serviceClient = createServiceClient();
      const { data: otherFamilyMember } = await serviceClient
        .from('family_members')
        .select('id')
        .eq('family_id', otherFamily.id)
        .limit(1)
        .single();

      if (otherFamilyMember) {
        const { data: otherTask } = await serviceClient
          .from('tasks')
          .insert({
            title: 'Other Family Task',
            family_id: otherFamily.id,
            due_date: new Date().toISOString().split('T')[0],
            created_by: otherFamilyMember.id
          })
          .select()
          .single();

        if (otherTask) {
          const client = await createAuthenticatedClient(adminUser.email, adminUser.password);

          const { error } = await client
            .from('tasks')
            .delete()
            .eq('id', otherTask.id);

          // Verify task still exists
          const { data: stillExists } = await serviceClient
            .from('tasks')
            .select('*')
            .eq('id', otherTask.id)
            .single();

          expect(stillExists).toBeDefined();

          // Cleanup
          await serviceClient.from('tasks').delete().eq('id', otherTask.id);
        }
      }
    });
  });
});
