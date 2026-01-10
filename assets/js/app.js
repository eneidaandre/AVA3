// assets/js/supabaseClient.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '⚠️ SUPABASE_URL ou SUPABASE_ANON_KEY não definidos em config.js'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Health check que não depende de tabela/RLS
export async function supabaseHealthCheck() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return { ok: false, error: error.message };
  return { ok: true, hasSession: !!data?.session };
}
