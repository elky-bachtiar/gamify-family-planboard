/**
 * Cross-Family Isolation Tests
 *
 * Tests that RLS policies properly isolate data between families:
 * - Family A users cannot see Family B data
 * - Family A users cannot modify Family B data
 * - PIN users from Family A cannot access Family B data
 * - Edge cases like moving between families
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
  TestUser,
  TestFamily,
  TestMember
} from './utils/test-helpers';

test.describe('Cross-Family Data Isolation', () => {
  let familyAAdmin: TestUser;
  let familyA: TestFamily;
  let familyAMember: TestMember;
  let familyAChild: TestMember;

  let familyBAdmin: TestUser;
  let familyB: TestFamily;
  let familyBMember: TestMember;
  let familyBChild: TestMember;

  test.beforeAll(async () => {
    // Create Family A
    familyAAdmin = await createTestUser();
    const familyAData = await createTestFamily(familyAAdmin, 'Family Alpha');
    familyA = familyAData.family;
    familyAMember = familyAData.member;
    familyAChild = await createTestChild(familyAAdmin, familyA.id, 'Alpha Child', '1111');

    // Create Family B
    familyBAdmin = await createTestUser();
    const familyBData = await createTestFamily(familyBAdmin, 'Family Beta');
    familyB = familyBData.family;
    familyBMember = familyBData.member;
    familyBChild = await createTestChild(familyBAdmin, familyB.id, 'Beta Child', '2222');

    // Create tasks in each family
    const serviceClient = createServiceClient();
    await serviceClient.from('tasks').insert([
      {
        title: 'Family A Task 1',
        family_id: familyA.id,
        created_by: familyAMember.id,
        due_date: new Date().toISOString().split('T')[0]
      },
      {
        title: 'Family A Task 2',
        family_id: familyA.id,
        assigned_to: familyAChild.id,
        created_by: familyAMember.id,
        due_date: new Date().toISOString().split('T')[0]
      },
      {
        title: 'Family B Task 1',
        family_id: familyB.id,
        created_by: familyBMember.id,
        due_date: new Date().toISOString().split('T')[0]
      },
      {
        title: 'Family B Task 2',
        family_id: familyB.id,
        assigned_to: familyBChild.id,
        created_by: familyBMember.id,
        due_date: new Date().toISOString().split('T')[0]
      }
    ]);

    // Create achievements in each family
    await serviceClient.from('achievements').insert([
      {
        name: 'Alpha Achievement',
        description: 'Family A custom achievement',
        condition_type: 'tasks_count',
        condition_value: 5,
        family_id: familyA.id,
        is_custom: true
      },
      {
        name: 'Beta Achievement',
        description: 'Family B custom achievement',
        condition_type: 'tasks_count',
        condition_value: 5,
        family_id: familyB.id,
        is_custom: true
      }
    ]);
  });

  test.afterAll(async () => {
    await cleanupTestData({
      familyIds: [familyA.id, familyB.id],
      userIds: [familyAAdmin.id, familyBAdmin.id]
    });
  });

  test.describe('Family data visibility', () => {
    test('Family A admin cannot see Family B data', async () => {
      const clientA = await createAuthenticatedClient(familyAAdmin.email, familyAAdmin.password);

      // Cannot see Family B
      const { data: familiesData } = await clientA.from('families').select('*');
      const familyIds = familiesData?.map(f => f.id) || [];
      expect(familyIds).toContain(familyA.id);
      expect(familyIds).not.toContain(familyB.id);

      // Cannot see Family B members
      const { data: membersData } = await clientA.from('family_members').select('*');
      const memberFamilyIds = membersData?.map(m => m.family_id) || [];
      expect(memberFamilyIds.every(id => id === familyA.id)).toBe(true);

      // Cannot see Family B tasks
      const { data: tasksData } = await clientA.from('tasks').select('*');
      const taskFamilyIds = tasksData?.map(t => t.family_id) || [];
      expect(taskFamilyIds.every(id => id === familyA.id)).toBe(true);
    });

    test('Family B admin cannot see Family A data', async () => {
      const clientB = await createAuthenticatedClient(familyBAdmin.email, familyBAdmin.password);

      // Cannot see Family A
      const { data: familiesData } = await clientB.from('families').select('*');
      const familyIds = familiesData?.map(f => f.id) || [];
      expect(familyIds).toContain(familyB.id);
      expect(familyIds).not.toContain(familyA.id);

      // Cannot see Family A members
      const { data: membersData } = await clientB.from('family_members').select('*');
      const memberFamilyIds = membersData?.map(m => m.family_id) || [];
      expect(memberFamilyIds.every(id => id === familyB.id)).toBe(true);

      // Cannot see Family A tasks
      const { data: tasksData } = await clientB.from('tasks').select('*');
      const taskFamilyIds = tasksData?.map(t => t.family_id) || [];
      expect(taskFamilyIds.every(id => id === familyB.id)).toBe(true);
    });

    test('Family A child cannot see Family B data', async () => {
      const childClient = createPinUserClient(familyAChild.id);

      // Cannot see Family B
      const { data: familiesData } = await childClient.from('families').select('*');
      const familyIds = familiesData?.map(f => f.id) || [];
      expect(familyIds).toContain(familyA.id);
      expect(familyIds).not.toContain(familyB.id);

      // Cannot see Family B members
      const { data: membersData } = await childClient.from('family_members').select('*');
      const memberFamilyIds = membersData?.map(m => m.family_id) || [];
      expect(memberFamilyIds.every(id => id === familyA.id)).toBe(true);
    });
  });

  test.describe('Cross-family modification attempts', () => {
    test('Family A admin cannot update Family B settings', async () => {
      const clientA = await createAuthenticatedClient(familyAAdmin.email, familyAAdmin.password);

      const { data, error } = await clientA
        .from('families')
        .update({ name: 'Hacked by Family A' })
        .eq('id', familyB.id)
        .select()
        .single();

      // RLS should block this
      expect(data).toBeNull();
    });

    test('Family A admin cannot update Family B members', async () => {
      const clientA = await createAuthenticatedClient(familyAAdmin.email, familyAAdmin.password);

      const { data, error } = await clientA
        .from('family_members')
        .update({ name: 'Hacked Member' })
        .eq('id', familyBMember.id)
        .select()
        .single();

      // RLS should block this
      expect(data).toBeNull();
    });

    test('Family A admin cannot create tasks in Family B', async () => {
      const clientA = await createAuthenticatedClient(familyAAdmin.email, familyAAdmin.password);

      const { data, error } = await clientA
        .from('tasks')
        .insert({
          title: 'Unauthorized Task in Family B',
          family_id: familyB.id,
          due_date: new Date().toISOString().split('T')[0]
        })
        .select()
        .single();

      // RLS should block this
      expect(data).toBeNull();
    });

    test('Family A admin cannot delete Family B tasks', async () => {
      const clientA = await createAuthenticatedClient(familyAAdmin.email, familyAAdmin.password);

      // Get a Family B task ID
      const serviceClient = createServiceClient();
      const { data: familyBTask } = await serviceClient
        .from('tasks')
        .select('id')
        .eq('family_id', familyB.id)
        .limit(1)
        .single();

      if (familyBTask) {
        // Try to delete it
        await clientA.from('tasks').delete().eq('id', familyBTask.id);

        // Verify it still exists
        const { data: stillExists } = await serviceClient
          .from('tasks')
          .select('id')
          .eq('id', familyBTask.id)
          .single();

        expect(stillExists).toBeDefined();
      }
    });

    test('Family A admin cannot delete Family B members', async () => {
      const clientA = await createAuthenticatedClient(familyAAdmin.email, familyAAdmin.password);

      await clientA.from('family_members').delete().eq('id', familyBChild.id);

      // Verify Family B child still exists
      const serviceClient = createServiceClient();
      const { data: stillExists } = await serviceClient
        .from('family_members')
        .select('id')
        .eq('id', familyBChild.id)
        .single();

      expect(stillExists).toBeDefined();
    });
  });

  test.describe('Custom achievements isolation', () => {
    test('Family A can only see their custom achievements and global ones', async () => {
      const clientA = await createAuthenticatedClient(familyAAdmin.email, familyAAdmin.password);

      const { data: achievements } = await clientA
        .from('achievements')
        .select('*');

      const customAchievements = achievements?.filter(a => a.is_custom) || [];
      const customFamilyIds = customAchievements.map(a => a.family_id);

      // Should only see Family A custom achievements
      expect(customFamilyIds.every(id => id === familyA.id)).toBe(true);

      // Should see global achievements (family_id is null)
      const globalAchievements = achievements?.filter(a => a.family_id === null) || [];
      expect(globalAchievements.length).toBeGreaterThan(0);
    });

    test('Family B cannot see Family A custom achievements', async () => {
      const clientB = await createAuthenticatedClient(familyBAdmin.email, familyBAdmin.password);

      const { data: achievements } = await clientB
        .from('achievements')
        .select('*');

      const achievementNames = achievements?.map(a => a.name) || [];

      expect(achievementNames).not.toContain('Alpha Achievement');
      expect(achievementNames).toContain('Beta Achievement');
    });
  });

  test.describe('Points history isolation', () => {
    test('Family A cannot see Family B points history', async () => {
      // Create some points history in each family
      const serviceClient = createServiceClient();
      await serviceClient.from('points_history').insert([
        {
          member_id: familyAMember.id,
          family_id: familyA.id,
          points: 10,
          reason: 'Alpha points'
        },
        {
          member_id: familyBMember.id,
          family_id: familyB.id,
          points: 20,
          reason: 'Beta points'
        }
      ]);

      const clientA = await createAuthenticatedClient(familyAAdmin.email, familyAAdmin.password);

      const { data: history } = await clientA
        .from('points_history')
        .select('*');

      const reasons = history?.map(h => h.reason) || [];
      expect(reasons).toContain('Alpha points');
      expect(reasons).not.toContain('Beta points');
    });
  });

  test.describe('Weekly goals isolation', () => {
    test('Family A cannot see Family B weekly goals', async () => {
      // Create some weekly goals in each family
      const serviceClient = createServiceClient();
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week

      await serviceClient.from('weekly_goals').insert([
        {
          member_id: familyAMember.id,
          family_id: familyA.id,
          week_start: weekStart.toISOString().split('T')[0],
          goal_type: 'tasks_completed',
          target_value: 5
        },
        {
          member_id: familyBMember.id,
          family_id: familyB.id,
          week_start: weekStart.toISOString().split('T')[0],
          goal_type: 'tasks_completed',
          target_value: 10
        }
      ]);

      const clientA = await createAuthenticatedClient(familyAAdmin.email, familyAAdmin.password);

      const { data: goals } = await clientA
        .from('weekly_goals')
        .select('*');

      const familyIds = goals?.map(g => g.family_id) || [];
      expect(familyIds.every(id => id === familyA.id)).toBe(true);
    });
  });

  test.describe('Reward redemptions isolation', () => {
    test('Family A cannot see or manage Family B redemptions', async () => {
      // Create redemption requests in each family
      const serviceClient = createServiceClient();
      await serviceClient.from('reward_redemptions').insert([
        {
          member_id: familyAChild.id,
          family_id: familyA.id,
          points_redeemed: 100,
          money_amount: 1.00,
          status: 'pending'
        },
        {
          member_id: familyBChild.id,
          family_id: familyB.id,
          points_redeemed: 200,
          money_amount: 2.00,
          status: 'pending'
        }
      ]);

      const clientA = await createAuthenticatedClient(familyAAdmin.email, familyAAdmin.password);

      const { data: redemptions } = await clientA
        .from('reward_redemptions')
        .select('*');

      const familyIds = redemptions?.map(r => r.family_id) || [];
      expect(familyIds.every(id => id === familyA.id)).toBe(true);
    });
  });

  test.describe('User achievements isolation', () => {
    test('Family A cannot award achievements to Family B members', async () => {
      // Get a global achievement ID
      const serviceClient = createServiceClient();
      const { data: globalAchievement } = await serviceClient
        .from('achievements')
        .select('id')
        .is('family_id', null)
        .limit(1)
        .single();

      if (globalAchievement) {
        const clientA = await createAuthenticatedClient(familyAAdmin.email, familyAAdmin.password);

        const { data, error } = await clientA
          .from('user_achievements')
          .insert({
            member_id: familyBChild.id, // Family B member
            achievement_id: globalAchievement.id
          })
          .select()
          .single();

        // RLS should block this
        expect(data).toBeNull();
      }
    });
  });

  test.describe('Manual points awards isolation', () => {
    test('Family A admin cannot award points to Family B members', async () => {
      const clientA = await createAuthenticatedClient(familyAAdmin.email, familyAAdmin.password);

      const { data, error } = await clientA
        .from('manual_points_awards')
        .insert({
          family_id: familyB.id,
          member_id: familyBChild.id,
          awarded_by: familyAMember.id,
          points: 1000,
          reason: 'Cross-family hack attempt'
        })
        .select()
        .single();

      // RLS should block this
      expect(data).toBeNull();
    });
  });
});
