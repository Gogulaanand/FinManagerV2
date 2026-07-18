/**
 * The browser Supabase client - the one allowed direct-network dependency in the
 * app (auth is the documented exception to offline-first). Everything else reads
 * and writes the local PowerSync database.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Needed so the Google OAuth redirect back to the app establishes a session.
    detectSessionInUrl: true,
  },
});
