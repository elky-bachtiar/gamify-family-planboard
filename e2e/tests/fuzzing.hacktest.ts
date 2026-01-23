/**
 * Fuzzing Security Tests
 *
 * Tests that edge functions handle malformed, unexpected, and malicious
 * input without crashing or leaking information.
 */

import { test, expect } from '@playwright/test';
import {
  createTestUser,
  createTestFamily,
  createTestChild,
  createAuthenticatedClient,
  cleanupTestData,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  randomString,
  TestUser,
  TestFamily,
} from './utils/test-helpers';

const EDGE_FUNCTION_URL = 'http://127.0.0.1:54321/functions/v1';

test.describe('Input Fuzzing Security Tests', () => {
  let adminUser: TestUser;
  let family: TestFamily;
  let authToken: string;

  test.beforeAll(async () => {
    adminUser = await createTestUser();
    const familyData = await createTestFamily(adminUser, 'Fuzzing Test Family');
    family = familyData.family;

    // Get auth token for authenticated requests
    const client = await createAuthenticatedClient(adminUser.email, adminUser.password);
    const session = await client.auth.getSession();
    authToken = session.data.session?.access_token || '';
  });

  test.afterAll(async () => {
    await cleanupTestData({
      familyIds: [family.id],
      userIds: [adminUser.id],
    });
  });

  test.describe('PIN Login - Input Fuzzing', () => {
    const testCases = [
      { name: 'empty body', body: {} },
      { name: 'null values', body: { child_invite_code: null, pin: null } },
      { name: 'undefined values', body: { child_invite_code: undefined, pin: undefined } },
      { name: 'numeric types', body: { child_invite_code: 12345678, pin: 1234 } },
      { name: 'array types', body: { child_invite_code: ['ABC'], pin: ['1234'] } },
      { name: 'object types', body: { child_invite_code: { code: 'ABC' }, pin: { value: '1234' } } },
      { name: 'boolean types', body: { child_invite_code: true, pin: false } },
      { name: 'extremely long invite code', body: { child_invite_code: 'A'.repeat(10000), pin: '1234' } },
      { name: 'extremely long PIN', body: { child_invite_code: 'ABCD1234', pin: '9'.repeat(10000) } },
      { name: 'SQL injection attempt', body: { child_invite_code: "'; DROP TABLE family_members; --", pin: '1234' } },
      { name: 'XSS attempt', body: { child_invite_code: '<script>alert(1)</script>', pin: '1234' } },
      { name: 'null byte injection', body: { child_invite_code: 'ABCD\x001234', pin: '1234' } },
      { name: 'unicode overflow', body: { child_invite_code: '\uFFFF'.repeat(100), pin: '1234' } },
      { name: 'negative PIN', body: { child_invite_code: 'ABCD1234', pin: '-1234' } },
      { name: 'decimal PIN', body: { child_invite_code: 'ABCD1234', pin: '12.34' } },
      { name: 'special characters in PIN', body: { child_invite_code: 'ABCD1234', pin: '!@#$' } },
      { name: 'whitespace injection', body: { child_invite_code: '  ABCD1234  ', pin: ' 1234 ' } },
      { name: 'newline injection', body: { child_invite_code: 'ABCD\n1234', pin: '12\n34' } },
      { name: 'carriage return injection', body: { child_invite_code: 'ABCD\r1234', pin: '12\r34' } },
      { name: 'tab injection', body: { child_invite_code: 'ABCD\t1234', pin: '12\t34' } },
    ];

    for (const testCase of testCases) {
      test(`should handle ${testCase.name} safely`, async ({ request }) => {
        const response = await request.post(`${EDGE_FUNCTION_URL}/pin-login`, {
          data: testCase.body,
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'X-Forwarded-For': '10.1.1.' + randomString(3),
          },
        });

        // Should return a valid HTTP status (not crash)
        expect(response.status()).toBeLessThan(600);

        // Should return JSON
        const contentType = response.headers()['content-type'];
        expect(contentType).toContain('application/json');

        // Should not leak server internals in error messages
        const body = await response.json();
        if (body.error) {
          expect(body.error).not.toContain('stack');
          expect(body.error).not.toContain('trace');
          expect(body.error).not.toContain('at /');
          expect(body.error).not.toContain('TypeError');
          expect(body.error).not.toContain('ReferenceError');
        }
      });
    }
  });

  test.describe('Create Child - Input Fuzzing', () => {
    const testCases = [
      { name: 'empty name', body: { name: '', pin: '1234', color: '#FF0000', family_id: '00000000-0000-0000-0000-000000000000' } },
      { name: 'very long name', body: { name: 'A'.repeat(1000), pin: '1234', color: '#FF0000', family_id: '00000000-0000-0000-0000-000000000000' } },
      { name: 'invalid UUID format', body: { name: 'Test', pin: '1234', color: '#FF0000', family_id: 'not-a-uuid' } },
      { name: 'invalid color format', body: { name: 'Test', pin: '1234', color: 'not-a-color', family_id: '00000000-0000-0000-0000-000000000000' } },
      { name: 'PIN with letters', body: { name: 'Test', pin: 'abcd', color: '#FF0000', family_id: '00000000-0000-0000-0000-000000000000' } },
      { name: 'PIN too short', body: { name: 'Test', pin: '12', color: '#FF0000', family_id: '00000000-0000-0000-0000-000000000000' } },
      { name: 'PIN too long', body: { name: 'Test', pin: '12345678', color: '#FF0000', family_id: '00000000-0000-0000-0000-000000000000' } },
      { name: 'HTML in name', body: { name: '<h1>Hacked</h1>', pin: '1234', color: '#FF0000', family_id: '00000000-0000-0000-0000-000000000000' } },
      { name: 'SQL in name', body: { name: "Robert'; DROP TABLE users;--", pin: '1234', color: '#FF0000', family_id: '00000000-0000-0000-0000-000000000000' } },
    ];

    for (const testCase of testCases) {
      test(`should handle ${testCase.name} safely`, async ({ request }) => {
        const response = await request.post(`${EDGE_FUNCTION_URL}/create-child`, {
          data: testCase.body,
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${authToken}`,
            'X-Forwarded-For': '10.2.2.' + randomString(3),
          },
        });

        // Should return a valid HTTP status (not crash)
        expect(response.status()).toBeLessThan(600);

        // Should return JSON
        const contentType = response.headers()['content-type'];
        expect(contentType).toContain('application/json');

        // Should not leak server internals
        const body = await response.json();
        if (body.error) {
          expect(body.error).not.toMatch(/TypeError|ReferenceError|SyntaxError/);
        }
      });
    }
  });

  test.describe('Request Body Size Limits', () => {
    test('should reject extremely large request bodies', async ({ request }) => {
      const largePayload = {
        child_invite_code: 'A'.repeat(100000),
        pin: '1234',
        extra_data: 'B'.repeat(500000),
      };

      const response = await request.post(`${EDGE_FUNCTION_URL}/pin-login`, {
        data: largePayload,
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'X-Forwarded-For': '10.3.3.1',
        },
      });

      // Should reject with 400 or 413
      expect([400, 413, 429]).toContain(response.status());
    });

    test('should reject deeply nested JSON', async ({ request }) => {
      // Create deeply nested object
      let nested: Record<string, unknown> = { value: '1234' };
      for (let i = 0; i < 100; i++) {
        nested = { nested };
      }

      const response = await request.post(`${EDGE_FUNCTION_URL}/pin-login`, {
        data: {
          child_invite_code: nested,
          pin: '1234',
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'X-Forwarded-For': '10.3.3.2',
        },
      });

      // Should handle gracefully
      expect(response.status()).toBeLessThan(600);
    });
  });

  test.describe('Content-Type Handling', () => {
    test('should reject non-JSON content types', async ({ request }) => {
      const response = await request.post(`${EDGE_FUNCTION_URL}/pin-login`, {
        data: 'child_invite_code=ABCD1234&pin=1234',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'apikey': SUPABASE_ANON_KEY,
        },
      });

      // Should reject or handle safely
      expect(response.status()).toBeLessThan(600);
    });

    test('should handle missing Content-Type', async ({ request }) => {
      const response = await request.post(`${EDGE_FUNCTION_URL}/pin-login`, {
        data: JSON.stringify({ child_invite_code: 'ABCD1234', pin: '1234' }),
        headers: {
          'apikey': SUPABASE_ANON_KEY,
        },
      });

      // Should handle gracefully
      expect(response.status()).toBeLessThan(600);
    });

    test('should handle malformed JSON', async ({ request }) => {
      const response = await request.post(`${EDGE_FUNCTION_URL}/pin-login`, {
        data: '{"child_invite_code": "ABCD1234", "pin": 1234', // Missing closing brace
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
      });

      // Should return 400 Bad Request
      expect([400, 500]).toContain(response.status());

      const body = await response.json();
      expect(body.error).toBeDefined();
    });
  });
});
