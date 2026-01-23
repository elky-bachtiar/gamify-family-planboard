# E2E RLS and Authentication Tests

This directory contains comprehensive end-to-end tests for Row Level Security (RLS) policies and authentication flows using Playwright and the Supabase CLI.

## Prerequisites

- Node.js 18+
- Docker Desktop (required by Supabase CLI)
- Supabase CLI (`npm install -g supabase`)
- npm or yarn

## Quick Start

```bash
# Navigate to e2e directory
cd e2e

# Install dependencies
npm install

# Start Supabase (from parent directory)
npm run supabase:start

# Run all tests
npm test
```

## Architecture

### Supabase Local Development

The test environment uses the Supabase CLI to run a local Supabase instance:

| Service | Port | Description |
|---------|------|-------------|
| API Gateway | 54321 | Main entry point (REST, GraphQL, Auth, Functions) |
| PostgreSQL | 54322 | Database with Supabase extensions |
| Studio | 54323 | Database management UI |
| Mailpit | 54324 | Email testing interface |

### Test Structure

```
e2e/
├── playwright.config.ts     # Playwright configuration
├── global-setup.ts          # Playwright global setup
├── global-teardown.ts       # Playwright global teardown
└── tests/
    ├── utils/
    │   ├── test-helpers.ts           # Test utilities and factories
    │   └── edge-function-helpers.ts  # Edge function call utilities
    ├── families.rls.test.ts          # Families table RLS tests
    ├── family-members.rls.test.ts    # Family members RLS tests
    ├── tasks.rls.test.ts             # Tasks table RLS tests
    ├── auth-flow.auth.test.ts        # Authentication flow tests
    ├── edge-functions.integration.test.ts # Edge function tests
    ├── cross-family-isolation.rls.test.ts # Cross-family isolation tests
    ├── field-protection.trigger.test.ts   # Trigger tests
    │
    │   # Security Tests (Hacktests)
    ├── privilege-escalation.hacktest.ts   # Privilege escalation prevention
    ├── edge-functions.hacktest.ts         # Edge function security
    ├── trigger-protection.hacktest.ts     # Trigger bypass prevention
    ├── storage.hacktest.ts                # Storage bucket security
    └── messages-and-exports.hacktest.ts   # Message isolation & data export
```

## Test Categories

### RLS Tests (`*.rls.test.ts`)

Tests Row Level Security policies on database tables:

- **families.rls.test.ts**: SELECT, INSERT, UPDATE policies for families
- **family-members.rls.test.ts**: Member visibility, modification restrictions
- **tasks.rls.test.ts**: Task visibility (admin vs child), modification rules
- **cross-family-isolation.rls.test.ts**: Ensures data isolation between families

### Auth Tests (`*.auth.test.ts`)

Tests authentication mechanisms:

- **auth-flow.auth.test.ts**: Parent email/password auth, PIN-based child auth, session management

### Trigger Tests (`*.trigger.test.ts`)

Tests database triggers for field protection:

- **field-protection.trigger.test.ts**: `protect_family_member_fields`, `protect_task_fields`, `enforce_child_task_defaults`

### Integration Tests (`*.integration.test.ts`)

Tests Edge Functions and API integrations:

- **edge-functions.integration.test.ts**: `pin-login`, `create-child`, `join-family`, `toggle-admin`, etc.

### Security Tests / Hacktests (`*.hacktest.ts`)

Comprehensive security tests that attempt to exploit vulnerabilities:

- **privilege-escalation.hacktest.ts**: Self-promotion to admin, points manipulation, family switching, PIN manipulation, SQL injection
- **edge-functions.hacktest.ts**: Authentication bypass, authorization checks, cross-family attacks, input validation, JWT security
- **trigger-protection.hacktest.ts**: Trigger bypass via batch updates, upserts, protected field verification
- **storage.hacktest.ts**: Path traversal attacks, cross-user/family file access, malicious file uploads, content validation
- **messages-and-exports.hacktest.ts**: Message isolation, private message protection, data export authorization, audit log security

## Available Commands

```bash
# Run all tests (except integration tests)
npm test

# Run specific test categories
npm run test:rls           # RLS policy tests
npm run test:auth          # Authentication tests
npm run test:triggers      # Trigger tests

# Edge function tests require functions to be served:
# Terminal 1: supabase functions serve
# Terminal 2: npm run test:integration

# Security tests (hacktests)
npx playwright test --project=hacktest

# Debug and development
npm run test:headed        # Run with browser visible
npm run test:debug         # Run in debug mode
npm run report             # View HTML test report

# Supabase management
npm run supabase:start     # Start Supabase services
npm run supabase:stop      # Stop Supabase services
npm run supabase:status    # Check service status
npm run supabase:reset     # Reset database
```

### Running Edge Function Tests

Edge functions need to be served before running integration tests:

```bash
# Terminal 1 - Start edge function server
cd .. && supabase functions serve

# Terminal 2 - Run integration tests
npm run test:integration
```

## Test Utilities

### Creating Test Users

```typescript
import { createTestUser, createTestFamily, createTestChild } from './utils/test-helpers';

// Create a parent user with Supabase auth
const user = await createTestUser();

// Create a family with the user as admin
const { family, member } = await createTestFamily(user, 'Test Family');

// Create a child with PIN authentication
const child = await createTestChild(user, family.id, 'Child Name', '1234');
```

### Creating Authenticated Clients

```typescript
import {
  createAuthenticatedClient,
  createPinUserClient,
  createServiceClient
} from './utils/test-helpers';

// Parent client (standard auth)
const parentClient = await createAuthenticatedClient(user.email, user.password);

// Child client (PIN auth)
const childClient = createPinUserClient(child.id);

// Service role client (bypasses RLS)
const serviceClient = createServiceClient();
```

### Testing Edge Functions

```typescript
import { callPinLogin, callCreateChild, getAuthToken } from './utils/edge-function-helpers';

// Test PIN login
const response = await callPinLogin(inviteCode, '1234');
expect(response.status).toBe(200);

// Test create child (requires admin auth)
const client = await createAuthenticatedClient(admin.email, admin.password);
const token = await getAuthToken(client);
const result = await callCreateChild(token, { name: 'New Child', pin: '5678' });
```

## What's Being Tested

### Authentication

| Scenario | Test Coverage |
|----------|---------------|
| Parent registration | Email/password signup |
| Parent login | Valid and invalid credentials |
| PIN login | Valid invite code + PIN |
| Invalid PIN | Wrong PIN rejection |
| JWT tokens | Token format, expiry |
| Session management | Multi-request sessions |

### RLS Policies

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| families | Own family only | Any authenticated | Admin only | N/A |
| family_members | Same family | Own family | Self (limited) / Admin (full) | Admin only |
| tasks | Admin: all; Child: own/unassigned | Own family | Role-based restrictions | Admin only |
| achievements | Global + own family | Admin only | N/A | N/A |
| points_history | Own family | Own family | N/A | N/A |
| weekly_goals | Own family | Own family | Own family | N/A |
| reward_redemptions | Own family | Own family | Admin only | N/A |

### Field Protection Triggers

| Trigger | Protected Fields |
|---------|-----------------|
| `protect_family_member_fields` | is_admin, role, user_id, pin_hash, total_points, current_level, family_id |
| `protect_task_fields` | point_value, priority, creation_approved, approved_by, assigned_to (reassignment) |
| `enforce_child_task_defaults` | Forces point_value=5, priority='medium', creation_approved=false for child-created tasks |

### Cross-Family Isolation

- Family A admin cannot see/modify Family B data
- PIN users cannot access other families
- Custom achievements isolated per family
- Points history, goals, redemptions isolated

### Edge Functions

| Function | Tests |
|----------|-------|
| `pin-login` | Valid/invalid credentials, token generation |
| `create-child` | Admin-only, PIN validation, child creation |
| `join-family` | Invite code validation, member creation |
| `join-family-as-parent` | Parent invite code, admin rights |
| `toggle-admin` | Promote/demote, last admin protection |
| `deduct-points` | Admin-only, point deduction |
| `reset-child-pin` | PIN reset, old PIN invalidation |
| `regenerate-invite-code` | Code regeneration |
| `award-birthday-points` | Birthday bonus awarding |
| `disable-member` | Account enable/disable |

## Environment Variables

Tests use these default values for Supabase CLI local instance:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<local-anon-key>
SUPABASE_SERVICE_KEY=<local-service-key>
JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long
DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

## Troubleshooting

### Supabase won't start

```bash
# Check for port conflicts
lsof -i :54321-54329

# Stop any existing Supabase instance
supabase stop

# Start fresh
supabase start
```

### Tests fail on first run

Ensure all migrations have been applied:

```bash
# Reset database and reapply migrations
npm run supabase:reset
```

### Connection refused errors

```bash
# Check Supabase status
npm run supabase:status

# View logs if needed
supabase logs
```

### RLS policy errors

If you see unexpected RLS errors:

1. Verify the user's family membership
2. Check if the user has admin rights
3. Use service client to inspect data directly

## Security Tests (Hacktests)

The `*.hacktest.ts` files contain comprehensive security tests that attempt to exploit potential vulnerabilities. These tests verify that security controls work correctly.

### Privilege Escalation Tests

| Attack Vector | Test Coverage |
|---------------|---------------|
| Self-promotion to admin | Direct UPDATE on is_admin field |
| Points manipulation | Fake points_history, direct UPDATE on total_points |
| Level manipulation | Direct UPDATE on current_level |
| Family switching | Changing family_id to join another family |
| User impersonation | Changing user_id to hijack another account |
| PIN manipulation | Changing own PIN hash without proper flow |
| Admin bypass | Non-admin attempting admin-only operations |
| SQL injection | Malicious strings in task titles, member names |

### Edge Function Security Tests

| Function | Security Tests |
|----------|----------------|
| `pin-login` | Invalid PIN, invalid invite code, disabled account, brute force |
| `create-child` | Non-admin caller, cross-family creation, invalid PIN format |
| `join-family` | Invalid invite code, wrong code type, already member |
| `toggle-admin` | Non-admin caller, cross-family, last admin protection |
| `deduct-points` | Non-admin caller, cross-family, negative points |
| `reset-child-pin` | Non-admin caller, cross-family |
| `disable-member` | Non-admin caller, login blocking verification |
| `regenerate-invite-code` | Non-admin caller, old code invalidation |
| JWT Security | Forged tokens, expired tokens, PIN user restrictions |

### Storage Security Tests

| Bucket | Security Tests |
|--------|----------------|
| `avatars-public` | Cross-user upload/delete, path traversal, public read |
| `family-objects` | Admin-only upload, cross-family access |
| Content validation | Malicious files, SVG XSS, null bytes, special characters |

### Running Security Tests

```bash
# Run all security tests
npx playwright test --project=hacktest

# Run specific hacktest file
npx playwright test privilege-escalation.hacktest.ts

# Run with verbose output
npx playwright test --project=hacktest --reporter=list
```

## Contributing

When adding new tests:

1. Use appropriate file naming: `*.rls.test.ts`, `*.auth.test.ts`, `*.trigger.test.ts`, `*.integration.test.ts`, `*.hacktest.ts`
2. Clean up test data in `afterAll` hooks
3. Use the provided test utilities for consistency
4. Document new test categories in this README
5. For security tests, document the attack vector being tested
