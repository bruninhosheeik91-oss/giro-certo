/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL do projeto Supabase (Supabase Dashboard → Settings → API) */
  readonly VITE_SUPABASE_URL?: string;
  /** Chave anônima (publishable) do projeto Supabase — nunca a service_role */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_AUTH_REDIRECT_URL?: string;
  /** Ativa o bloqueio após o período gratuito somente quando a cobrança estiver pronta. */
  readonly VITE_SUBSCRIPTION_ENFORCEMENT?: string;
  /** Canal desta compilação: google_play ou direct (APK). */
  readonly VITE_DISTRIBUTION_CHANNEL?: string;
  readonly VITE_GOOGLE_PLAY_BILLING_ENABLED?: string;
  readonly VITE_STRIPE_BILLING_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
