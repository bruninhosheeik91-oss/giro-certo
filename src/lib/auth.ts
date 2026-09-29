import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export type AuthSession = Session | null;
export type EmailError = { message: string };

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';

export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_ANON_KEY = supabaseAnonKey;
export const SUPABASE_CONFIGURED = Boolean(supabaseUrl && supabaseAnonKey);

let cachedClient: SupabaseClient<Database> | null | undefined;

export function isSupabaseConfigured(): boolean {
  return SUPABASE_CONFIGURED;
}

/**
 * Cliente único compartilhado por auth, sync e repositório.
 *
 * Precisa ser o mesmo para todos: o refresh automático de token do
 * `supabase-js` só notifica assinantes do cliente que o criou, então um segundo
 * `createClient` deixaria a fila sync presa a um token expirado.
 */
export function getSupabaseClient(): SupabaseClient<Database> | null {
  if (!SUPABASE_CONFIGURED) return null;
  if (cachedClient) return cachedClient;

  cachedClient = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  });
  return cachedClient;
}
