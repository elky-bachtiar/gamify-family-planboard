import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';

const E2E_DIR = path.dirname(new URL(import.meta.url).pathname);
const PROJECT_DIR = path.join(E2E_DIR, '..');

// Test configuration - uses Supabase CLI local instance
const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJFUzI1NiIsImtpZCI6ImI4MTI2OWYxLTIxZDgtNGYyZS1iNzE5LWMyMjQwYTg0MGQ5MCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjIwODQ1MjE5OTR9.93sojj1SFWzw8WJ_bN6znEhFe76RGKgE19ngt7TQOzWp8em71eHnNQbXLaJ3uYp8uGi5OhJu-bFaApOdiGoQJQ';

async function waitForSupabase(maxAttempts = 30): Promise<boolean> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });

  for (let i = 0; i < maxAttempts; i++) {
    try {
      // Try a simple query to check if the database is ready
      const { error } = await supabase.from('families').select('count').limit(0);
      if (!error || error.code === '42P01') {
        // Either success or table doesn't exist yet (migrations may not be applied)
        console.log('Supabase is ready');
        return true;
      }
      console.log(`Waiting for Supabase... attempt ${i + 1}/${maxAttempts}`);
    } catch (e) {
      console.log(`Supabase not ready yet... attempt ${i + 1}/${maxAttempts}`);
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  return false;
}

function isSupabaseRunning(): boolean {
  try {
    const output = execSync('supabase status --output json', {
      cwd: PROJECT_DIR,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const status = JSON.parse(output);
    return !!status.API_URL;
  } catch {
    return false;
  }
}

export default async function globalSetup(): Promise<void> {
  console.log('\n====== E2E Test Global Setup ======\n');

  // Check if Supabase CLI is running
  if (!isSupabaseRunning()) {
    console.log('Supabase is not running.');
    console.log('Please start Supabase with: supabase start');
    console.log('From the project root directory.');
    throw new Error('Supabase is not running. Please start it with "supabase start" from the project root.');
  }

  console.log('Supabase CLI is running');

  // Wait for Supabase to be ready
  console.log('\nWaiting for Supabase to be ready...');
  const isReady = await waitForSupabase();

  if (!isReady) {
    throw new Error('Supabase failed to respond within timeout');
  }

  console.log('\n====== Setup Complete ======\n');
}
