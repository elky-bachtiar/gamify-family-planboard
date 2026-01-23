import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for E2E RLS and Auth testing
 *
 * These tests run against a local Supabase instance via Docker
 * and test Row Level Security policies at the database level.
 */
export default defineConfig({
  testDir: './tests',

  // Run tests in sequence since they share database state
  fullyParallel: false,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Use 1 worker since tests modify shared database state
  workers: 1,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
    ...(process.env.CI ? [['github'] as const] : [])
  ],

  // Global timeout for each test
  timeout: 60000,

  // Global setup to start Docker and seed database
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',

  use: {
    // Base URL for Supabase API
    baseURL: 'http://localhost:54320',

    // Collect trace on failure
    trace: 'on-first-retry',

    // Extra HTTP headers
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
    },
  },

  projects: [
    {
      name: 'rls-tests',
      testMatch: /.*\.rls\.test\.ts/,
    },
    {
      name: 'auth-tests',
      testMatch: /.*\.auth\.test\.ts/,
    },
    {
      name: 'trigger-tests',
      testMatch: /.*\.trigger\.test\.ts/,
    },
    {
      name: 'integration-tests',
      testMatch: /.*\.integration\.test\.ts/,
    },
    {
      name: 'hacktest',
      testMatch: /.*\.hacktest\.ts/,
    },
  ],
});
