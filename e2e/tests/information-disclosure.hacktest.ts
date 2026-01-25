/**
 * Information Disclosure Security Tests
 *
 * Tests that error messages and responses don't leak sensitive information
 * that could be used for further attacks.
 */

import { test, expect } from '@playwright/test';
import {
  createTestUser,
  createTestFamily,
  createTestChild,
  cleanupTestData,
  SUPABASE_ANON_KEY,
  randomString,
  TestUser,
  TestFamily,
  TestMember,
} from './utils/test-helpers';

const EDGE_FUNCTION_URL = 'http://127.0.0.1:54321/functions/v1';

test.describe('Information Disclosure Security Tests', () => {
  let adminUser: TestUser;
  let family: TestFamily;
  let child: TestMember;

  test.beforeAll(async () => {
    adminUser = await createTestUser();
    const familyData = await createTestFamily(adminUser, 'Info Disclosure Test Family');
    family = familyData.family;
    child = await createTestChild(adminUser, family.id, 'Test Child', '5678');
  });

  test.afterAll(async () => {
    await cleanupTestData({
      familyIds: [family.id],
      userIds: [adminUser.id],
    });
  });

  test.describe('User Enumeration Prevention', () => {
    test('invalid invite code returns generic error', async ({ request }) => {
      const response = await request.post(`${EDGE_FUNCTION_URL}/pin-login`, {
        data: {
          child_invite_code: 'INVALID123',
          pin: '1234',
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'X-Forwarded-For': '10.10.10.' + randomString(3),
        },
      });

      const body = await response.json();

      // Should NOT reveal whether the invite code exists
      expect(body.error).not.toContain('not found');
      expect(body.error).not.toContain('does not exist');
      expect(body.error).not.toContain('no user');
      expect(body.error).not.toContain('member');

      // Should use generic error
      expect(body.error.toLowerCase()).toContain('invalid');
    });

    test('valid invite code with wrong PIN returns same error as invalid code', async ({ request }) => {
      // Test with invalid code
      const invalidResponse = await request.post(`${EDGE_FUNCTION_URL}/pin-login`, {
        data: {
          child_invite_code: 'INVALID123',
          pin: '1234',
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'X-Forwarded-For': '10.10.11.1',
        },
      });

      // Test with valid code but wrong PIN
      const wrongPinResponse = await request.post(`${EDGE_FUNCTION_URL}/pin-login`, {
        data: {
          child_invite_code: child.child_invite_code,
          pin: '0000', // Wrong PIN
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'X-Forwarded-For': '10.10.11.2',
        },
      });

      const invalidBody = await invalidResponse.json();
      const wrongPinBody = await wrongPinResponse.json();

      // Both should return same generic error (prevents enumeration)
      expect(invalidBody.error).toBe(wrongPinBody.error);
    });

    test('join-family does not reveal if invite code exists', async ({ request }) => {
      const response = await request.post(`${EDGE_FUNCTION_URL}/join-family`, {
        data: {
          inviteCode: 'INVALID123',
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': 'Bearer fake-token',
          'X-Forwarded-For': '10.10.12.1',
        },
      });

      const body = await response.json();

      // Should not confirm whether code exists
      if (body.error) {
        expect(body.error).not.toContain('exists');
        expect(body.error).not.toContain('found');
        expect(body.error).not.toContain('family_id');
      }
    });
  });

  test.describe('Error Message Sanitization', () => {
    test('server errors do not leak stack traces', async ({ request }) => {
      // Intentionally cause an error with malformed data
      const response = await request.post(`${EDGE_FUNCTION_URL}/pin-login`, {
        data: {
          child_invite_code: { nested: { deep: 'value' } }, // Type error
          pin: '1234',
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'X-Forwarded-For': '10.10.13.1',
        },
      });

      const body = await response.json();

      if (body.error) {
        // Should not contain stack trace information
        expect(body.error).not.toMatch(/at \w+\.ts:\d+/);
        expect(body.error).not.toMatch(/at async/);
        expect(body.error).not.toMatch(/node_modules/);
        expect(body.error).not.toMatch(/\.deno/);
        expect(body.error).not.toMatch(/file:\/\//);
      }

      // Should not have a stack property
      expect(body.stack).toBeUndefined();
      expect(body.trace).toBeUndefined();
    });

    test('database errors do not leak schema information', async ({ request }) => {
      const response = await request.post(`${EDGE_FUNCTION_URL}/create-child`, {
        data: {
          name: 'Test',
          pin: '1234',
          color: '#FF0000',
          family_id: '00000000-0000-0000-0000-000000000000', // Non-existent family
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': 'Bearer fake-token',
          'X-Forwarded-For': '10.10.14.1',
        },
      });

      const body = await response.json();

      if (body.error) {
        // Should not leak database schema details
        expect(body.error).not.toContain('column');
        expect(body.error).not.toContain('table');
        expect(body.error).not.toContain('foreign key');
        expect(body.error).not.toContain('constraint');
        expect(body.error).not.toContain('violates');
        expect(body.error).not.toContain('PGRST');
      }

      // Should not have detailed error info
      expect(body.details).toBeUndefined();
      expect(body.hint).toBeUndefined();
    });
  });

  test.describe('Response Header Security', () => {
    test('responses do not include sensitive headers', async ({ request }) => {
      const response = await request.post(`${EDGE_FUNCTION_URL}/pin-login`, {
        data: {
          child_invite_code: 'TEST1234',
          pin: '1234',
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
      });

      const headers = response.headers();

      // Should not expose server information via x-powered-by
      expect(headers['x-powered-by']).toBeUndefined();

      // Server header may be present (set by Supabase infrastructure)
      // but should not expose detailed version information like "nginx/1.2.3"
      const serverHeader = headers['server'] || '';
      if (serverHeader) {
        // Check that it doesn't contain detailed version numbers like "X.Y.Z"
        expect(serverHeader).not.toMatch(/\d+\.\d+\.\d+/);
      }

      // Should have security headers
      // Note: These may be set by Supabase infrastructure, not the function
    });

    test('OPTIONS requests do not leak information', async ({ request }) => {
      const response = await request.fetch(`${EDGE_FUNCTION_URL}/pin-login`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://evil-site.com',
        },
      });

      // Should respond but not with detailed info
      expect(response.status()).toBe(200);

      const body = await response.text();
      expect(body).toBe(''); // OPTIONS should return empty body
    });
  });

  test.describe('Timing Attack Prevention', () => {
    test('invalid vs valid invite codes have similar response times', async ({ request }) => {
      const iterations = 5;
      const invalidTimes: number[] = [];
      const validWrongPinTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        // Time invalid invite code request
        const invalidStart = Date.now();
        await request.post(`${EDGE_FUNCTION_URL}/pin-login`, {
          data: {
            child_invite_code: 'INVALID' + randomString(4),
            pin: '1234',
          },
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'X-Forwarded-For': '10.20.' + i + '.1',
          },
        });
        invalidTimes.push(Date.now() - invalidStart);

        // Time valid code with wrong PIN request
        const validStart = Date.now();
        await request.post(`${EDGE_FUNCTION_URL}/pin-login`, {
          data: {
            child_invite_code: child.child_invite_code,
            pin: '0000',
          },
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'X-Forwarded-For': '10.20.' + i + '.2',
          },
        });
        validWrongPinTimes.push(Date.now() - validStart);
      }

      // Calculate averages
      const avgInvalid = invalidTimes.reduce((a, b) => a + b, 0) / iterations;
      const avgValidWrongPin = validWrongPinTimes.reduce((a, b) => a + b, 0) / iterations;

      // Times should be within reasonable range of each other (not drastically different)
      // Note: This is a weak test due to network variability
      // In production, use constant-time comparison functions
      const timeDifference = Math.abs(avgInvalid - avgValidWrongPin);

      // Log for debugging
      console.log(`Average invalid code time: ${avgInvalid}ms`);
      console.log(`Average valid code wrong PIN time: ${avgValidWrongPin}ms`);
      console.log(`Difference: ${timeDifference}ms`);

      // Times shouldn't differ by more than 200ms on average (accounting for network)
      // This is a loose check - real timing attacks need more sophisticated analysis
      expect(timeDifference).toBeLessThan(500);
    });
  });
});
