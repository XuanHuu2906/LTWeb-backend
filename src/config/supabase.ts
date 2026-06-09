import { createClient } from '@supabase/supabase-js';
import { env } from './env';

if (!env.supabase.url || !env.supabase.serviceRoleKey) {
  throw new Error('Supabase configuration URL and Service Role Key are required');
}

export const supabaseAdmin = createClient(
  env.supabase.url,
  env.supabase.serviceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
