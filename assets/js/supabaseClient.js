// assets/js/supabaseClient.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export async function getSessionSafe() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return { session: null, error: error.message };
  return { session: data?.session || null, error: null };
}

export function getUserDisplayName(session) {
  if (!session?.user) return '';
  const u = session.user;

  // tenta nome primeiro (mais interessante)
  const meta = u.user_metadata || {};
  const name =
    meta.full_name || meta.name || meta.nome || meta.display_name || '';

  return name && String(name).trim() ? String(name).trim() : u.email || '';
}
