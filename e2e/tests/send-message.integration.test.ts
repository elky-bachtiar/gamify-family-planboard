/**
 * Send Message Edge Function Integration Tests
 *
 * Tests the send-message edge function for secure encrypted messaging:
 * - Authentication (regular Supabase auth and PIN-based JWT)
 * - Input validation
 * - Authorization (family membership, cross-family protection)
 * - Recipient validation
 * - Message encryption
 *
 * NOTE: These tests require edge functions to be served:
 *   supabase functions serve
 */

import { test, expect } from '@playwright/test';
import {
  createTestUser,
  createTestFamily,
  createAuthenticatedClient,
  createServiceClient,
  createTestChild,
  createPinUserJwt,
  cleanupTestData,
  TestUser,
  TestFamily,
  TestMember
} from './utils/test-helpers';
import {
  callSendMessage,
  callEdgeFunction,
  getAuthToken,
  FUNCTIONS_URL
} from './utils/edge-function-helpers';

// Check if edge functions are available
let edgeFunctionsAvailable = true; // Assume available, will be checked in beforeAll

async function checkEdgeFunctionsAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${FUNCTIONS_URL}/send-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const text = await response.text();
    // Functions running will return JSON with error message
    return text.includes('authorization') ||
           text.includes('Authorization') ||
           text.includes('error') ||
           text.includes('msg') ||
           text.includes('JWT') ||
           response.status === 401 ||
           response.status === 400;
  } catch {
    return false;
  }
}

test.describe('Send Message Edge Function Tests', () => {
  test.beforeAll(async () => {
    edgeFunctionsAvailable = await checkEdgeFunctionsAvailable();
    if (!edgeFunctionsAvailable) {
      console.log('\n⚠️  Edge functions are not available.');
      console.log('   Run "supabase functions serve" to enable edge function tests.\n');
    }
  });

  test.describe('Authentication', () => {
    test.beforeEach(async ({}, testInfo) => {
      if (!edgeFunctionsAvailable) {
        testInfo.skip();
      }
    });

    test('missing authorization header returns 401', async () => {
      const response = await callEdgeFunction('send-message', {
        noAuth: true, // Don't send any Authorization header
        body: {
          family_id: '00000000-0000-0000-0000-000000000000',
          recipient_id: null,
          content: 'test'
        }
      });

      expect(response.status).toBe(401);
      // Function returns "Unauthorized" when auth header is missing
      expect(response.error?.toLowerCase()).toMatch(/unauthorized|authorization/);
    });

    test('invalid token returns 401', async () => {
      const response = await callEdgeFunction('send-message', {
        authToken: 'invalid-token',
        body: {
          family_id: '00000000-0000-0000-0000-000000000000',
          recipient_id: null,
          content: 'test'
        }
      });

      expect(response.status).toBe(401);
    });
  });

  test.describe('Input Validation', () => {
    let adminUser: TestUser;
    let family: TestFamily;
    let authToken: string;

    test.beforeAll(async () => {
      if (!edgeFunctionsAvailable) return;
      adminUser = await createTestUser();
      const familyData = await createTestFamily(adminUser);
      family = familyData.family;
      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);
      authToken = (await getAuthToken(client))!;
    });

    test.afterAll(async () => {
      if (!edgeFunctionsAvailable || !family) return;
      await cleanupTestData({
        familyIds: [family.id],
        userIds: [adminUser.id]
      });
    });

    test.beforeEach(async ({}, testInfo) => {
      if (!edgeFunctionsAvailable || !authToken) {
        testInfo.skip();
      }
    });

    test('missing family_id returns 400', async () => {
      const response = await callSendMessage(authToken, {
        family_id: '',
        recipient_id: null,
        content: 'test message'
      });

      expect(response.status).toBe(400);
      expect(response.error).toContain('Family ID');
    });

    test('invalid family_id (not UUID) returns 400', async () => {
      const response = await callSendMessage(authToken, {
        family_id: 'not-a-uuid',
        recipient_id: null,
        content: 'test message'
      });

      expect(response.status).toBe(400);
      expect(response.error).toContain('Family ID');
    });

    test('invalid recipient_id (not UUID) returns 400', async () => {
      const response = await callSendMessage(authToken, {
        family_id: family.id,
        recipient_id: 'not-a-uuid',
        content: 'test message'
      });

      expect(response.status).toBe(400);
      expect(response.error).toContain('Recipient ID');
    });

    test('empty content returns 400', async () => {
      const response = await callSendMessage(authToken, {
        family_id: family.id,
        recipient_id: null,
        content: ''
      });

      expect(response.status).toBe(400);
      expect(response.error).toContain('Content');
    });

    test('whitespace-only content returns 400', async () => {
      const response = await callSendMessage(authToken, {
        family_id: family.id,
        recipient_id: null,
        content: '   '
      });

      expect(response.status).toBe(400);
      expect(response.error).toContain('Content');
    });
  });

  test.describe('Authorization', () => {
    let adminUser: TestUser;
    let family: TestFamily;
    let adminMember: TestMember;
    let childMember: TestMember;
    let otherUser: TestUser;
    let otherFamily: TestFamily;

    test.beforeAll(async () => {
      if (!edgeFunctionsAvailable) return;

      // Create first family with admin and child
      adminUser = await createTestUser();
      const familyData = await createTestFamily(adminUser, 'Message Test Family');
      family = familyData.family;
      adminMember = familyData.member;
      childMember = await createTestChild(adminUser, family.id, 'Message Child', '1234');

      // Create second family for cross-family tests
      otherUser = await createTestUser();
      const otherFamilyData = await createTestFamily(otherUser, 'Other Family');
      otherFamily = otherFamilyData.family;
    });

    test.afterAll(async () => {
      if (!edgeFunctionsAvailable || !family) return;
      await cleanupTestData({
        familyIds: [family.id, otherFamily.id],
        userIds: [adminUser.id, otherUser.id]
      });
    });

    test('user cannot send message to different family', async () => {
      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);
      const authToken = (await getAuthToken(client))!;

      // Try to send message to other family
      const response = await callSendMessage(authToken, {
        family_id: otherFamily.id,
        recipient_id: null,
        content: 'Cross-family attack'
      });

      expect(response.status).toBe(403);
      expect(response.error).toContain('different family');
    });

    test('non-existent recipient returns 404', async () => {
      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);
      const authToken = (await getAuthToken(client))!;

      // Use a valid UUID format that doesn't exist in the database
      // Format: xxxxxxxx-xxxx-Mxxx-Nxxx-xxxxxxxxxxxx where M is 1-5 and N is 8, 9, a, or b
      const response = await callSendMessage(authToken, {
        family_id: family.id,
        recipient_id: '12345678-1234-1234-8234-123456789012',
        content: 'Message to nobody'
      });

      expect(response.status).toBe(404);
      expect(response.error).toContain('not found');
    });

    test('recipient in different family returns 403', async () => {
      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);
      const authToken = (await getAuthToken(client))!;

      // Get a member from the other family
      const serviceClient = createServiceClient();
      const { data: otherMember } = await serviceClient
        .from('family_members')
        .select('id')
        .eq('family_id', otherFamily.id)
        .single();

      const response = await callSendMessage(authToken, {
        family_id: family.id,
        recipient_id: otherMember!.id,
        content: 'Cross-family message'
      });

      expect(response.status).toBe(403);
      expect(response.error).toContain('not in this family');
    });

    test('disabled user cannot send messages', async () => {
      // Disable the child
      const serviceClient = createServiceClient();
      await serviceClient
        .from('family_members')
        .update({ is_disabled: true })
        .eq('id', childMember.id);

      // Try to send message as disabled child
      const childToken = createPinUserJwt(childMember.id);
      const response = await callSendMessage(childToken, {
        family_id: family.id,
        recipient_id: adminMember.id,
        content: 'Message from disabled user'
      });

      expect(response.status).toBe(403);
      expect(response.error).toContain('disabled');

      // Re-enable the child for other tests
      await serviceClient
        .from('family_members')
        .update({ is_disabled: false })
        .eq('id', childMember.id);
    });
  });

  test.describe('Successful Message Sending', () => {
    let adminUser: TestUser;
    let family: TestFamily;
    let adminMember: TestMember;
    let childMember: TestMember;

    test.beforeAll(async () => {
      if (!edgeFunctionsAvailable) return;
      adminUser = await createTestUser();
      const familyData = await createTestFamily(adminUser, 'Success Test Family');
      family = familyData.family;
      adminMember = familyData.member;
      childMember = await createTestChild(adminUser, family.id, 'Success Child', '5678');
    });

    test.afterAll(async () => {
      if (!edgeFunctionsAvailable || !family) return;
      await cleanupTestData({
        familyIds: [family.id],
        userIds: [adminUser.id]
      });
    });

    test('admin can send direct message to child', async () => {
      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);
      const authToken = (await getAuthToken(client))!;

      const response = await callSendMessage(authToken, {
        family_id: family.id,
        recipient_id: childMember.id,
        content: 'Hello from admin!'
      });

      expect(response.status).toBe(200);
      expect(response.data?.success).toBe(true);
      expect(response.data?.message_id).toBeDefined();
      expect(typeof response.data?.message_id).toBe('string');
    });

    test('admin can send broadcast message (recipient_id = null)', async () => {
      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);
      const authToken = (await getAuthToken(client))!;

      const response = await callSendMessage(authToken, {
        family_id: family.id,
        recipient_id: null,
        content: 'Broadcast announcement!'
      });

      expect(response.status).toBe(200);
      expect(response.data?.success).toBe(true);
      expect(response.data?.message_id).toBeDefined();
    });

    test('child (PIN user) can send direct message', async () => {
      const childToken = createPinUserJwt(childMember.id);

      const response = await callSendMessage(childToken, {
        family_id: family.id,
        recipient_id: adminMember.id,
        content: 'Hello from child!'
      });

      expect(response.status).toBe(200);
      expect(response.data?.success).toBe(true);
      expect(response.data?.message_id).toBeDefined();
    });

    test('child can send broadcast message', async () => {
      const childToken = createPinUserJwt(childMember.id);

      const response = await callSendMessage(childToken, {
        family_id: family.id,
        recipient_id: null,
        content: 'Broadcast from child!'
      });

      expect(response.status).toBe(200);
      expect(response.data?.success).toBe(true);
      expect(response.data?.message_id).toBeDefined();
    });
  });

  test.describe('Message Encryption Verification', () => {
    let adminUser: TestUser;
    let family: TestFamily;
    let adminMember: TestMember;

    test.beforeAll(async () => {
      if (!edgeFunctionsAvailable) return;
      adminUser = await createTestUser();
      const familyData = await createTestFamily(adminUser, 'Encryption Test Family');
      family = familyData.family;
      adminMember = familyData.member;
    });

    test.afterAll(async () => {
      if (!edgeFunctionsAvailable || !family) return;
      await cleanupTestData({
        familyIds: [family.id],
        userIds: [adminUser.id]
      });
    });

    test('message is stored encrypted in database', async () => {
      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);
      const authToken = (await getAuthToken(client))!;
      const originalContent = 'This is a secret message that should be encrypted!';

      // Send the message
      const response = await callSendMessage(authToken, {
        family_id: family.id,
        recipient_id: null,
        content: originalContent
      });

      expect(response.status).toBe(200);
      const messageId = response.data?.message_id;

      // Verify in database that content is encrypted
      const serviceClient = createServiceClient();
      const { data: message } = await serviceClient
        .from('messages')
        .select('content, content_encrypted, encryption_iv, is_encrypted')
        .eq('id', messageId)
        .single();

      expect(message).toBeDefined();
      expect(message!.is_encrypted).toBe(true);
      expect(message!.content).toBe('[encrypted]'); // Placeholder
      expect(message!.content_encrypted).toBeDefined();
      expect(message!.content_encrypted).not.toBe(originalContent);
      expect(message!.encryption_iv).toBeDefined();
    });

    test('message can be decrypted via view', async () => {
      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);
      const authToken = (await getAuthToken(client))!;
      const originalContent = 'This message should be readable via the decrypted view';

      // Send the message
      const response = await callSendMessage(authToken, {
        family_id: family.id,
        recipient_id: null,
        content: originalContent
      });

      expect(response.status).toBe(200);
      const messageId = response.data?.message_id;

      // Read via decrypted view
      const serviceClient = createServiceClient();
      const { data: decryptedMessage } = await serviceClient
        .from('messages_decrypted')
        .select('content, is_encrypted')
        .eq('id', messageId)
        .single();

      expect(decryptedMessage).toBeDefined();
      expect(decryptedMessage!.content).toBe(originalContent);
      expect(decryptedMessage!.is_encrypted).toBe(true);
    });

    test('content is trimmed before encryption', async () => {
      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);
      const authToken = (await getAuthToken(client))!;
      const contentWithWhitespace = '  Message with extra whitespace  ';
      const trimmedContent = contentWithWhitespace.trim();

      // Send the message
      const response = await callSendMessage(authToken, {
        family_id: family.id,
        recipient_id: null,
        content: contentWithWhitespace
      });

      expect(response.status).toBe(200);
      const messageId = response.data?.message_id;

      // Read via decrypted view
      const serviceClient = createServiceClient();
      const { data: decryptedMessage } = await serviceClient
        .from('messages_decrypted')
        .select('content')
        .eq('id', messageId)
        .single();

      expect(decryptedMessage!.content).toBe(trimmedContent);
    });
  });
});
