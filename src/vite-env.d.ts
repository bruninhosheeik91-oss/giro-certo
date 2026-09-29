/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL do projeto Supabase (Supabase Dashboard → Settings → API) */
  readonly VITE_SUPABASE_URL?: string;
  /** Chave anônima (publishable) do projeto Supabase — nunca a service_role */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_AUTH_REDIRECT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
