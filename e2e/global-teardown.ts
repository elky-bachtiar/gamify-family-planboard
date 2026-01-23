import { execSync } from 'child_process';
import * as path from 'path';

const E2E_DIR = path.dirname(new URL(import.meta.url).pathname);
const PROJECT_DIR = path.join(E2E_DIR, '..');

export default async function globalTeardown(): Promise<void> {
  console.log('\n====== E2E Test Global Teardown ======\n');

  // Only stop Supabase if explicitly requested
  if (process.env.E2E_STOP_SUPABASE === 'true') {
    console.log('Stopping Supabase services...');
    try {
      execSync('supabase stop', {
        cwd: PROJECT_DIR,
        stdio: 'inherit'
      });
      console.log('Supabase services stopped');
    } catch (error) {
      console.warn('Failed to stop Supabase services:', error);
    }
  } else {
    console.log('Leaving Supabase services running for inspection');
    console.log('Run "supabase stop" in the project root to stop manually');
    console.log('Or set E2E_STOP_SUPABASE=true to stop automatically');
  }

  console.log('\n====== Teardown Complete ======\n');
}
