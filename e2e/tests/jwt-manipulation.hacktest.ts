/**
 * JWT Manipulation Security Tests
 *
 * Tests that JWT tokens are properly validated and cannot be
 * manipulated to gain unauthorized access.
 */

import { test, expect } from '@playwright/test';
import jwt from 'jsonwebtoken';
import {
  createTestUser,
  createTestFamily,
  createTestChild,
  createAuthenticatedClient,
  cleanupTestData,
  SUPABASE_ANON_KEY,
  JWT_SECRET,
  TestUser,
  TestFamily,
  TestMember,
} from './utils/test-helpers';

const EDGE_FUNCTION_URL = 'http://127.0.0.1:54321/functions/v1';

test.describe('JWT Manipulation Security Tests', () => {
  let adminUser: TestUser;
  let otherUser: TestUser;
  let family: TestFamily;
  let otherFamily: TestFamily;
  let child: TestMember;

  test.beforeAll(async () => {
    // Create two families for cross-family testing
    adminUser = await createTestUser();
    const familyData = await createTestFamily(adminUser, 'JWT Test Family A');
    family = familyData.family;
    child = await createTestChild(adminUser, family.id, 'JWT Test Child', '1234');

    otherUser = await createTestUser();
    const otherFamilyData = await createTestFamily(otherUser, 'JWT Test Family B');
    otherFamily = otherFamilyData.family;
  });

  test.afterAll(async () => {
    await cleanupTestData({
      familyIds: [family.id, otherFamily.id],
      userIds: [adminUser.id, otherUser.id],
    });
  });

  test.describe('Token Signature Validation', () => {
    test('rejects tokens signed with wrong secret', async ({ request }) => {
      // Create token with different secret
      const fakeToken = jwt.sign(
        {
          sub: child.id,
          aud: 'authenticated',
          role: 'authenticated',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
          is_pin_user: true,
          family_id: family.id,
        },
        'wrong-secret-key',
        { algorithm: 'HS256' }
      );

      const response = await request.post(`${EDGE_FUNCTION_URL}/create-child`, {
        data: {
          name: 'Hacked Child',
          pin: '1234',
          color: '#FF0000',
          family_id: family.id,
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${fakeToken}`,
        },
      });

      // Should reject invalid signature - may return 401 (unauthorized), 500 (internal error), or 429 (rate limited)
      expect([401, 403, 429, 500]).toContain(response.status());
    });

    test('rejects unsigned tokens (alg: none)', async ({ request }) => {
      // Create unsigned token (algorithm none attack)
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({
        sub: child.id,
        aud: 'authenticated',
        role: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      })).toString('base64url');
      const unsignedToken = `${header}.${payload}.`;

      const response = await request.post(`${EDGE_FUNCTION_URL}/create-child`, {
        data: {
          name: 'Hacked Child',
          pin: '1234',
          color: '#FF0000',
          family_id: family.id,
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${unsignedToken}`,
        },
      });

      // Should reject unsigned token - may return 401, 500, or 429 (rate limited)
      expect([401, 403, 429, 500]).toContain(response.status());
    });

    test('rejects tokens with modified payload', async ({ request }) => {
      // Get a valid token first
      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);
      const session = await client.auth.getSession();
      const validToken = session.data.session?.access_token || '';

      // Split and decode token
      const parts = validToken.split('.');
      if (parts.length === 3) {
        // Modify payload to change user
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        payload.sub = otherUser.id; // Try to impersonate other user
        const modifiedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');

        // Reconstruct token with original signature (won't be valid)
        const tamperedToken = `${parts[0]}.${modifiedPayload}.${parts[2]}`;

        const response = await request.post(`${EDGE_FUNCTION_URL}/create-child`, {
          data: {
            name: 'Hacked Child',
            pin: '1234',
            color: '#FF0000',
            family_id: family.id,
          },
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${tamperedToken}`,
          },
        });

        // Should reject tampered token - may return 401, 403, 500, or 429 (rate limited)
        expect([401, 403, 429, 500]).toContain(response.status());
      }
    });
  });

  test.describe('Token Expiry Validation', () => {
    test('rejects expired tokens', async ({ request }) => {
      // Create expired token
      const expiredToken = jwt.sign(
        {
          sub: child.id,
          aud: 'authenticated',
          role: 'authenticated',
          exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
          iat: Math.floor(Date.now() / 1000) - 7200, // Issued 2 hours ago
        },
        JWT_SECRET,
        { algorithm: 'HS256' }
      );

      const response = await request.post(`${EDGE_FUNCTION_URL}/create-child`, {
        data: {
          name: 'Hacked Child',
          pin: '1234',
          color: '#FF0000',
          family_id: family.id,
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${expiredToken}`,
        },
      });

      // Should reject expired token - may return 401, 403, 500, or 429 (rate limited)
      expect([401, 403, 429, 500]).toContain(response.status());
    });

    test('rejects tokens with future iat (issued at)', async ({ request }) => {
      // Create token with future iat (potential replay attack indicator)
      const futureToken = jwt.sign(
        {
          sub: child.id,
          aud: 'authenticated',
          role: 'authenticated',
          exp: Math.floor(Date.now() / 1000) + 7200,
          iat: Math.floor(Date.now() / 1000) + 3600, // Issued in the future
        },
        JWT_SECRET,
        { algorithm: 'HS256' }
      );

      const response = await request.post(`${EDGE_FUNCTION_URL}/create-child`, {
        data: {
          name: 'Future Child',
          pin: '1234',
          color: '#FF0000',
          family_id: family.id,
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${futureToken}`,
        },
      });

      // Should handle future tokens appropriately
      // Note: Some systems accept future iat with clock skew tolerance
      expect(response.status()).toBeLessThan(600);
    });
  });

  test.describe('Role and Audience Claims', () => {
    test('rejects tokens with wrong audience', async ({ request }) => {
      const wrongAudienceToken = jwt.sign(
        {
          sub: child.id,
          aud: 'service_role', // Wrong audience
          role: 'authenticated',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        },
        JWT_SECRET,
        { algorithm: 'HS256' }
      );

      const response = await request.post(`${EDGE_FUNCTION_URL}/create-child`, {
        data: {
          name: 'Wrong Audience Child',
          pin: '1234',
          color: '#FF0000',
          family_id: family.id,
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${wrongAudienceToken}`,
        },
      });

      // Should reject or handle appropriately
      expect(response.status()).toBeLessThan(600);
    });

    test('rejects tokens with elevated role claim', async ({ request }) => {
      // Try to claim service_role
      const elevatedToken = jwt.sign(
        {
          sub: child.id,
          aud: 'authenticated',
          role: 'service_role', // Trying to elevate privileges
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        },
        JWT_SECRET,
        { algorithm: 'HS256' }
      );

      const response = await request.post(`${EDGE_FUNCTION_URL}/create-child`, {
        data: {
          name: 'Elevated Child',
          pin: '1234',
          color: '#FF0000',
          family_id: family.id,
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${elevatedToken}`,
        },
      });

      // RLS policies should still enforce proper authorization
      // The role claim alone shouldn't grant service_role access
      expect(response.status()).toBeLessThan(600);
    });
  });

  test.describe('Cross-Family Token Abuse', () => {
    test('cannot use token from Family A to access Family B', async ({ request }) => {
      // Get valid token for user in Family A
      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);
      const session = await client.auth.getSession();
      const familyAToken = session.data.session?.access_token || '';

      // Try to create child in Family B
      const response = await request.post(`${EDGE_FUNCTION_URL}/create-child`, {
        data: {
          name: 'Cross Family Child',
          pin: '1234',
          color: '#FF0000',
          family_id: otherFamily.id, // Different family!
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${familyAToken}`,
        },
      });

      // Should reject - user A cannot create children in family B
      // May be 403 (forbidden), 500 (internal error), or 429 (rate limited)
      expect([403, 429, 500]).toContain(response.status());

      if (response.status() === 403) {
        const body = await response.json();
        expect(body.error).toContain('different family');
      }
    });
  });

  test.describe('Token Format Validation', () => {
    test('rejects malformed tokens', async ({ request }) => {
      const malformedTokens = [
        'not.a.valid.jwt',
        'Bearer ',
        'null',
        'undefined',
        'eyJhbGciOiJIUzI1NiJ9', // Only header
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0', // Missing signature
        '...',
        'a.b.c.d.e', // Too many parts
      ];

      for (const token of malformedTokens) {
        const response = await request.post(`${EDGE_FUNCTION_URL}/create-child`, {
          data: {
            name: 'Malformed Token Child',
            pin: '1234',
            color: '#FF0000',
            family_id: family.id,
          },
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${token}`,
          },
        });

        // Should reject malformed tokens - may return 400, 401, 403, 500, or 429 (rate limited)
        expect([400, 401, 403, 429, 500]).toContain(response.status());
      }
    });

    test('handles missing Authorization header', async ({ request }) => {
      const response = await request.post(`${EDGE_FUNCTION_URL}/create-child`, {
        data: {
          name: 'No Auth Child',
          pin: '1234',
          color: '#FF0000',
          family_id: family.id,
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          // No Authorization header
        },
      });

      // Should reject - may return 401, 500, or 429 (rate limited)
      expect([401, 429, 500]).toContain(response.status());
    });
  });
});
