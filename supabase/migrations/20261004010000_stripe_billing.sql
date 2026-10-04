-- Habilita a Stripe como provedor do APK direto sem remover os provedores legados.
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_provider_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_provider_check
  CHECK (provider IS NULL OR provider IN ('google_play', 'stripe', 'mercado_pago', 'apple'));

ALTER TABLE public.subscription_provider_secrets
  DROP CONSTRAINT IF EXISTS subscription_provider_secrets_provider_check;
ALTER TABLE public.subscription_provider_secrets
  ADD CONSTRAINT subscription_provider_secrets_provider_check
  CHECK (provider IN ('google_play', 'stripe', 'mercado_pago', 'apple'));

ALTER TABLE public.billing_events DROP CONSTRAINT IF EXISTS billing_events_provider_check;
ALTER TABLE public.billing_events
  ADD CONSTRAINT billing_events_provider_check
  CHECK (provider IN ('google_play', 'stripe', 'mercado_pago', 'apple'));
