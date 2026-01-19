import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Default client for anonymous/regular auth users
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Store for the PIN-authenticated client
let pinAuthenticatedClient: SupabaseClient<Database> | null = null;

// Create a Supabase client with custom authorization header for PIN users
export function setPinAuthToken(token: string | null): void {
  if (token) {
    pinAuthenticatedClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });
    console.log('[Supabase] PIN authenticated client created');
  } else {
    pinAuthenticatedClient = null;
    console.log('[Supabase] PIN authenticated client cleared');
  }
}

// Get the appropriate Supabase client (PIN-authenticated if available, otherwise default)
export function getSupabaseClient(): SupabaseClient<Database> {
  return pinAuthenticatedClient || supabase;
}
