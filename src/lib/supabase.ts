import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Somente a URL e a chave publicavel (publica por desenho; o acesso e limitado por RLS).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!url || !key) return null;
  client ??= createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return client;
}

/** Garante uma sessao anonima (sem tela de login). Retorna false se indisponivel. */
export async function ensureAnonymous(): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { data } = await sb.auth.getSession();
  if (data.session) return true;
  const { error } = await sb.auth.signInAnonymously();
  return !error;
}
