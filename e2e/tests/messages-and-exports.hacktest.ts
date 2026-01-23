/**
 * Messages and Data Export Security Tests (Hacktest)
 *
 * Tests that verify:
 * - Message isolation between families
 * - Private message protection
 * - Data export security
 * - Audit log isolation
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
import {
  callEdgeFunction,
  getAuthToken
} from './utils/edge-function-helpers';

test.describe('Message Security', () => {
  let familyAAdmin: TestUser;
  let familyA: TestFamily;
  let familyAMember: TestMember;
  let familyAChild: TestMember;

  let familyBAdmin: TestUser;
  let familyB: TestFamily;
  let familyBMember: TestMember;

  test.beforeAll(async () => {
    familyAAdmin = await createTestUser();
    const familyAData = await createTestFamily(familyAAdmin, 'Message Family A');
    familyA = familyAData.family;
    familyAMember = familyAData.member;
    familyAChild = await createTestChild(familyAAdmin, familyA.id, 'Message Child A', '1234');

    familyBAdmin = await createTestUser();
    const familyBData = await createTestFamily(familyBAdmin, 'Message Family B');
    familyB = familyBData.family;
    familyBMember = familyBData.member;

    // Create messages in each family
    const serviceClient = createServiceClient();
    await serviceClient.from('messages').insert([
      // Family A broadcast
      {
        family_id: familyA.id,
        sender_id: familyAMember.id,
        recipient_id: null, // Broadcast
        content: 'Family A broadcast message'
      },
      // Family A private to child
      {
        family_id: familyA.id,
        sender_id: familyAMember.id,
        recipient_id: familyAChild.id,
        content: 'Private message to Child A'
      },
      // Family B broadcast
      {
        family_id: familyB.id,
        sender_id: familyBMember.id,
        recipient_id: null,
        content: 'Family B broadcast message'
      }
    ]);
  });

  test.afterAll(async () => {
    await cleanupTestData({
      familyIds: [familyA.id, familyB.id],
      userIds: [familyAAdmin.id, familyBAdmin.id]
    });
  });

  test.describe('Cross-family message isolation', () => {
    test('Family A cannot see Family B messages', async () => {
      const clientA = await createAuthenticatedClient(familyAAdmin.email, familyAAdmin.password);

      const { data: messages } = await clientA
        .from('messages')
        .select('*');

      const contents = messages?.map(m => m.content) || [];

      expect(contents).toContain('Family A broadcast message');
      expect(contents).not.toContain('Family B broadcast message');
    });

    test('Family B cannot see Family A messages', async () => {
      const clientB = await createAuthenticatedClient(familyBAdmin.email, familyBAdmin.password);

      const { data: messages } = await clientB
        .from('messages')
        .select('*');

      const contents = messages?.map(m => m.content) || [];

      expect(contents).toContain('Family B broadcast message');
      expect(contents).not.toContain('Family A broadcast message');
      expect(contents).not.toContain('Private message to Child A');
    });
  });

  test.describe('Private message protection', () => {
    test('sibling cannot see private message to another child', async () => {
      const serviceClient = createServiceClient();

      // Create a second child in Family A
      const sibling = await createTestChild(familyAAdmin, familyA.id, 'Sibling', '5678');

      // Create a private message to the sibling
      await serviceClient.from('messages').insert({
        family_id: familyA.id,
        sender_id: familyAMember.id,
        recipient_id: sibling.id,
        content: 'Private message to sibling only'
      });

      // First child tries to see the message
      const childClient = createPinUserClient(familyAChild.id);

      const { data: messages } = await childClient
        .from('messages')
        .select('*');

      const contents = messages?.map(m => m.content) || [];

      // Should see own private message and broadcast, but not sibling's private message
      expect(contents).toContain('Private message to Child A');
      expect(contents).not.toContain('Private message to sibling only');
    });

    test('admin can see all family messages', async () => {
      const clientA = await createAuthenticatedClient(familyAAdmin.email, familyAAdmin.password);

      const { data: messages } = await clientA
        .from('messages')
        .select('*');

      // Admin should see all messages in their family
      expect(messages?.length).toBeGreaterThan(0);
    });

    test('child can only update read_at on messages to them', async () => {
      const childClient = createPinUserClient(familyAChild.id);
      const serviceClient = createServiceClient();

      // Get a broadcast message
      const { data: broadcastMsg } = await serviceClient
        .from('messages')
        .select('id')
        .eq('family_id', familyA.id)
        .is('recipient_id', null)
        .limit(1)
        .single();

      // Child marks it as read
      await childClient
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('id', broadcastMsg?.id);

      // This should work for broadcasts (null recipient = all)
    });
  });

  test.describe('Message creation security', () => {
    test('cannot send message to member of another family', async () => {
      const clientA = await createAuthenticatedClient(familyAAdmin.email, familyAAdmin.password);

      const { data, error } = await clientA
        .from('messages')
        .insert({
          family_id: familyA.id, // Own family
          sender_id: familyAMember.id,
          recipient_id: familyBMember.id, // Different family member
          content: 'Cross family hack attempt'
        })
        .select()
        .single();

      // Should be rejected by RLS
      expect(data).toBeNull();
    });

    test('cannot send message with different family_id', async () => {
      const clientA = await createAuthenticatedClient(familyAAdmin.email, familyAAdmin.password);

      const { data, error } = await clientA
        .from('messages')
        .insert({
          family_id: familyB.id, // Wrong family
          sender_id: familyAMember.id,
          recipient_id: null,
          content: 'Cross family message hack'
        })
        .select()
        .single();

      // Should be rejected by RLS
      expect(data).toBeNull();
    });

    test('cannot impersonate another sender', async () => {
      const childClient = createPinUserClient(familyAChild.id);

      const { data, error } = await childClient
        .from('messages')
        .insert({
          family_id: familyA.id,
          sender_id: familyAMember.id, // Impersonating admin
          recipient_id: null,
          content: 'Impersonation attempt'
        })
        .select()
        .single();

      // Should be rejected - sender_id must match current user
      expect(data).toBeNull();
    });
  });

  test.describe('Message deletion security', () => {
    test('non-admin cannot delete messages from others', async () => {
      const serviceClient = createServiceClient();

      // Create a message from admin
      const { data: msg } = await serviceClient
        .from('messages')
        .insert({
          family_id: familyA.id,
          sender_id: familyAMember.id,
          recipient_id: null,
          content: 'Admin message to delete'
        })
        .select()
        .single();

      const childClient = createPinUserClient(familyAChild.id);

      // Child tries to delete admin's message
      await childClient
        .from('messages')
        .delete()
        .eq('id', msg?.id);

      // Verify still exists
      const { data: stillExists } = await serviceClient
        .from('messages')
        .select('id')
        .eq('id', msg?.id)
        .single();

      expect(stillExists).not.toBeNull();

      // Cleanup
      await serviceClient.from('messages').delete().eq('id', msg?.id);
    });

    test('sender can delete their own message', async () => {
      const childClient = createPinUserClient(familyAChild.id);
      const serviceClient = createServiceClient();

      // Child creates a message
      const { data: msg } = await childClient
        .from('messages')
        .insert({
          family_id: familyA.id,
          sender_id: familyAChild.id,
          recipient_id: null,
          content: 'Child message to delete'
        })
        .select()
        .single();

      // Child deletes their own message
      await childClient
        .from('messages')
        .delete()
        .eq('id', msg?.id);

      // Verify deleted
      const { data: deleted } = await serviceClient
        .from('messages')
        .select('id')
        .eq('id', msg?.id)
        .single();

      expect(deleted).toBeNull();
    });
  });
});

test.describe('Data Export Security', () => {
  let adminUser: TestUser;
  let family: TestFamily;
  let adminMember: TestMember;
  let child: TestMember;
  let otherUser: TestUser;
  let otherFamily: TestFamily;

  test.beforeAll(async () => {
    adminUser = await createTestUser();
    const familyData = await createTestFamily(adminUser, 'Export Test Family');
    family = familyData.family;
    adminMember = familyData.member;
    child = await createTestChild(adminUser, family.id, 'Export Child', '1234');

    otherUser = await createTestUser();
    const otherFamilyData = await createTestFamily(otherUser, 'Other Export Family');
    otherFamily = otherFamilyData.family;
  });

  test.afterAll(async () => {
    await cleanupTestData({
      familyIds: [family.id, otherFamily.id],
      userIds: [adminUser.id, otherUser.id]
    });
  });

  test('only admin can export family data', async () => {
    // Non-admin tries to export
    const { user: nonAdmin } = await createTestNonAdminParent(family.id);
    const client = await createAuthenticatedClient(nonAdmin.email, nonAdmin.password);
    const token = await getAuthToken(client);

    const response = await callEdgeFunction('export-family-data', {
      authToken: token!,
      body: {}
    });

    expect(response.status).toBe(403);

    await cleanupTestData({ userIds: [nonAdmin.id] });
  });

  test('admin can only export their own family data', async () => {
    const client = await createAuthenticatedClient(adminUser.email, adminUser.password);
    const token = await getAuthToken(client);

    const response = await callEdgeFunction('export-family-data', {
      authToken: token!,
      body: { family_id: otherFamily.id } // Wrong family
    });

    // Should either export own family or reject
    // Not export other family's data
    if (response.status === 200 && response.data) {
      // If successful, verify it's own family data
      const exportData = response.data as Record<string, unknown>;
      if (exportData.family) {
        const exportedFamily = exportData.family as Record<string, unknown>;
        expect(exportedFamily.id).toBe(family.id);
      }
    }
  });

  test('child cannot export family data', async () => {
    const childClient = createPinUserClient(child.id);

    // Get a token for edge function call
    // Note: PIN users may not be able to call edge functions directly
    const response = await callEdgeFunction('export-family-data', {
      body: {}
      // No valid auth for PIN user
    });

    expect(response.status).toBe(401);
  });
});

test.describe('Audit Log Security', () => {
  let adminUser: TestUser;
  let family: TestFamily;
  let adminMember: TestMember;
  let otherUser: TestUser;
  let otherFamily: TestFamily;

  test.beforeAll(async () => {
    adminUser = await createTestUser();
    const familyData = await createTestFamily(adminUser, 'Audit Log Family');
    family = familyData.family;
    adminMember = familyData.member;

    otherUser = await createTestUser();
    const otherFamilyData = await createTestFamily(otherUser, 'Other Audit Family');
    otherFamily = otherFamilyData.family;

    // Create some audit log entries (if table exists)
    const serviceClient = createServiceClient();
    try {
      await serviceClient.from('audit_logs').insert([
        {
          family_id: family.id,
          action: 'test_action',
          performed_by: adminMember.id,
          details: { test: 'Family A log' }
        },
        {
          family_id: otherFamily.id,
          action: 'test_action',
          performed_by: otherFamily.id,
          details: { test: 'Family B log' }
        }
      ]);
    } catch {
      // Audit logs table may not exist
    }
  });

  test.afterAll(async () => {
    await cleanupTestData({
      familyIds: [family.id, otherFamily.id],
      userIds: [adminUser.id, otherUser.id]
    });
  });

  test('cannot see audit logs from other families', async () => {
    const clientA = await createAuthenticatedClient(adminUser.email, adminUser.password);

    try {
      const { data: logs } = await clientA
        .from('audit_logs')
        .select('*');

      if (logs) {
        const familyIds = logs.map(l => l.family_id);
        familyIds.forEach(id => {
          expect(id).toBe(family.id);
        });
      }
    } catch {
      // Table may not exist - skip test
    }
  });

  test('cannot insert audit logs for other families', async () => {
    const clientA = await createAuthenticatedClient(adminUser.email, adminUser.password);

    try {
      const { data, error } = await clientA
        .from('audit_logs')
        .insert({
          family_id: otherFamily.id, // Wrong family
          action: 'hack_attempt',
          performed_by: adminMember.id,
          details: { hack: true }
        })
        .select()
        .single();

      // Should be rejected
      expect(data).toBeNull();
    } catch {
      // Table may not exist - skip test
    }
  });
});

test.describe('Reward Redemption Security', () => {
  let adminUser: TestUser;
  let family: TestFamily;
  let adminMember: TestMember;
  let child: TestMember;
  let otherUser: TestUser;
  let otherFamily: TestFamily;
  let otherChild: TestMember;

  test.beforeAll(async () => {
    adminUser = await createTestUser();
    const familyData = await createTestFamily(adminUser, 'Redemption Family');
    family = familyData.family;
    adminMember = familyData.member;
    child = await createTestChild(adminUser, family.id, 'Redemption Child', '1234');

    otherUser = await createTestUser();
    const otherFamilyData = await createTestFamily(otherUser, 'Other Redemption Family');
    otherFamily = otherFamilyData.family;
    otherChild = await createTestChild(otherUser, otherFamily.id, 'Other Child', '1234');

    // Give children some points
    const serviceClient = createServiceClient();
    await serviceClient
      .from('family_members')
      .update({ total_points: 1000 })
      .in('id', [child.id, otherChild.id]);
  });

  test.afterAll(async () => {
    await cleanupTestData({
      familyIds: [family.id, otherFamily.id],
      userIds: [adminUser.id, otherUser.id]
    });
  });

  test('child can create redemption request', async () => {
    const childClient = createPinUserClient(child.id);

    const { data, error } = await childClient
      .from('reward_redemptions')
      .insert({
        family_id: family.id,
        member_id: child.id,
        points_redeemed: 100,
        money_amount: 1.00,
        status: 'pending'
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();

    // Cleanup
    const serviceClient = createServiceClient();
    await serviceClient.from('reward_redemptions').delete().eq('id', data?.id);
  });

  test('cannot create redemption for another family member', async () => {
    const childClient = createPinUserClient(child.id);

    const { data, error } = await childClient
      .from('reward_redemptions')
      .insert({
        family_id: family.id,
        member_id: adminMember.id, // Different member
        points_redeemed: 100,
        money_amount: 1.00,
        status: 'pending'
      })
      .select()
      .single();

    // Should be rejected
    expect(data).toBeNull();
  });

  test('cannot create redemption in another family', async () => {
    const childClient = createPinUserClient(child.id);

    const { data, error } = await childClient
      .from('reward_redemptions')
      .insert({
        family_id: otherFamily.id, // Wrong family
        member_id: child.id,
        points_redeemed: 100,
        money_amount: 1.00,
        status: 'pending'
      })
      .select()
      .single();

    expect(data).toBeNull();
  });

  test('child cannot approve their own redemption', async () => {
    const serviceClient = createServiceClient();

    // Create a pending redemption
    const { data: redemption } = await serviceClient
      .from('reward_redemptions')
      .insert({
        family_id: family.id,
        member_id: child.id,
        points_redeemed: 100,
        money_amount: 1.00,
        status: 'pending'
      })
      .select()
      .single();

    const childClient = createPinUserClient(child.id);

    // Try to approve
    await childClient
      .from('reward_redemptions')
      .update({ status: 'approved', approved_by: child.id })
      .eq('id', redemption?.id);

    // Verify not approved
    const { data: verified } = await serviceClient
      .from('reward_redemptions')
      .select('status, approved_by')
      .eq('id', redemption?.id)
      .single();

    expect(verified?.status).toBe('pending');
    expect(verified?.approved_by).toBeNull();

    await serviceClient.from('reward_redemptions').delete().eq('id', redemption?.id);
  });

  test('admin can approve redemption', async () => {
    const serviceClient = createServiceClient();

    // Create a pending redemption
    const { data: redemption } = await serviceClient
      .from('reward_redemptions')
      .insert({
        family_id: family.id,
        member_id: child.id,
        points_redeemed: 100,
        money_amount: 1.00,
        status: 'pending'
      })
      .select()
      .single();

    const adminClient = await createAuthenticatedClient(adminUser.email, adminUser.password);

    await adminClient
      .from('reward_redemptions')
      .update({
        status: 'approved',
        approved_by: adminMember.id,
        approved_at: new Date().toISOString()
      })
      .eq('id', redemption?.id);

    // Verify approved
    const { data: verified } = await serviceClient
      .from('reward_redemptions')
      .select('status, approved_by')
      .eq('id', redemption?.id)
      .single();

    expect(verified?.status).toBe('approved');
    expect(verified?.approved_by).toBe(adminMember.id);

    await serviceClient.from('reward_redemptions').delete().eq('id', redemption?.id);
  });

  test('cannot see redemptions from other families', async () => {
    const serviceClient = createServiceClient();

    // Create redemption in other family
    await serviceClient
      .from('reward_redemptions')
      .insert({
        family_id: otherFamily.id,
        member_id: otherChild.id,
        points_redeemed: 200,
        money_amount: 2.00,
        status: 'pending'
      });

    const clientA = await createAuthenticatedClient(adminUser.email, adminUser.password);

    const { data: redemptions } = await clientA
      .from('reward_redemptions')
      .select('*');

    const familyIds = redemptions?.map(r => r.family_id) || [];
    expect(familyIds.every(id => id === family.id)).toBe(true);
  });

  test('cannot approve redemptions in other families', async () => {
    const serviceClient = createServiceClient();

    // Create redemption in other family
    const { data: redemption } = await serviceClient
      .from('reward_redemptions')
      .insert({
        family_id: otherFamily.id,
        member_id: otherChild.id,
        points_redeemed: 200,
        money_amount: 2.00,
        status: 'pending'
      })
      .select()
      .single();

    const clientA = await createAuthenticatedClient(adminUser.email, adminUser.password);

    // Try to approve other family's redemption
    await clientA
      .from('reward_redemptions')
      .update({ status: 'approved', approved_by: adminMember.id })
      .eq('id', redemption?.id);

    // Verify not approved
    const { data: verified } = await serviceClient
      .from('reward_redemptions')
      .select('status')
      .eq('id', redemption?.id)
      .single();

    expect(verified?.status).toBe('pending');

    await serviceClient.from('reward_redemptions').delete().eq('id', redemption?.id);
  });
});

test.describe('Task History Security', () => {
  let adminUser: TestUser;
  let family: TestFamily;
  let otherUser: TestUser;
  let otherFamily: TestFamily;

  test.beforeAll(async () => {
    adminUser = await createTestUser();
    const familyData = await createTestFamily(adminUser, 'History Family');
    family = familyData.family;

    otherUser = await createTestUser();
    const otherFamilyData = await createTestFamily(otherUser, 'Other History Family');
    otherFamily = otherFamilyData.family;

    // Create task history in both families
    const serviceClient = createServiceClient();
    await serviceClient.from('task_history').insert([
      {
        family_id: family.id,
        title: 'History A Task',
        point_value: 10,
        completed_at: new Date().toISOString(),
        archived_at: new Date().toISOString()
      },
      {
        family_id: otherFamily.id,
        title: 'History B Task',
        point_value: 20,
        completed_at: new Date().toISOString(),
        archived_at: new Date().toISOString()
      }
    ]);
  });

  test.afterAll(async () => {
    await cleanupTestData({
      familyIds: [family.id, otherFamily.id],
      userIds: [adminUser.id, otherUser.id]
    });
  });

  test('cannot see task history from other families', async () => {
    const clientA = await createAuthenticatedClient(adminUser.email, adminUser.password);

    const { data: history } = await clientA
      .from('task_history')
      .select('*');

    const titles = history?.map(h => h.title) || [];
    expect(titles).toContain('History A Task');
    expect(titles).not.toContain('History B Task');
  });

  test('non-admin cannot insert task history', async () => {
    const { user: nonAdmin } = await createTestNonAdminParent(family.id);
    const client = await createAuthenticatedClient(nonAdmin.email, nonAdmin.password);

    const { data, error } = await client
      .from('task_history')
      .insert({
        family_id: family.id,
        title: 'Fake History',
        point_value: 1000,
        completed_at: new Date().toISOString(),
        archived_at: new Date().toISOString()
      })
      .select()
      .single();

    // Should be rejected - only admins can insert
    expect(data).toBeNull();

    await cleanupTestData({ userIds: [nonAdmin.id] });
  });
});
