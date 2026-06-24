import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Do NOT auto-parse auth tokens from the URL. Email confirmation / magic
    // links are verified server-side by Supabase before redirecting here, so the
    // client never needs to process the URL hash. Letting it try caused the
    // mechanic-onboarding page to freeze on arrival from a link.
    detectSessionInUrl: false,
    persistSession: true,
    autoRefreshToken: true,
  },
});
