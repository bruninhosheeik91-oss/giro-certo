-- Fundação multicanal. Nenhuma cobrança é ativada por esta migration.
-- Tokens de compra ficam separados dos dados que o próprio usuário pode consultar.
CREATE TABLE IF NOT EXISTS public.subscription_provider_secrets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google_play', 'mercado_pago', 'apple')),
  purchase_token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_provider_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.subscription_provider_secrets FROM anon, authenticated;

INSERT INTO public.subscription_provider_secrets (user_id, provider, purchase_token)
SELECT user_id, provider, purchase_token
FROM public.subscriptions
WHERE provider IS NOT NULL AND purchase_token IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET
  provider = EXCLUDED.provider,
  purchase_token = EXCLUDED.purchase_token,
  updated_at = now();

ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS purchase_token;
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_provider_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_provider_check
  CHECK (provider IS NULL OR provider IN ('google_play', 'mercado_pago', 'apple'));
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS provider_subscription_id text,
  ADD COLUMN IF NOT EXISTS provider_customer_id text,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_provider_reference_unique
  ON public.subscriptions (provider, provider_subscription_id)
  WHERE provider IS NOT NULL AND provider_subscription_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('google_play', 'mercado_pago', 'apple')),
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_error text,
  UNIQUE (provider, provider_event_id)
);

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_events FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_subscription_access()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  subscription_row public.subscriptions%ROWTYPE;
  owner_access boolean;
  remaining_days integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND role = 'owner'
  ) INTO owner_access;

  IF owner_access THEN
    RETURN jsonb_build_object(
      'tier', 'pro', 'reason', 'owner', 'hasProAccess', true,
      'daysRemaining', 0, 'expiresAt', null, 'plan', null,
      'provider', null, 'cancelAtPeriodEnd', false
    );
  END IF;

  SELECT * INTO subscription_row
  FROM public.subscriptions
  WHERE user_id = auth.uid();

  IF subscription_row.status = 'trialing' AND subscription_row.trial_ends_at > now() THEN
    remaining_days := greatest(1, ceil(extract(epoch FROM (subscription_row.trial_ends_at - now())) / 86400)::integer);
    RETURN jsonb_build_object(
      'tier', 'essential', 'reason', 'trial', 'hasProAccess', false,
      'daysRemaining', remaining_days, 'expiresAt', subscription_row.trial_ends_at,
      'plan', 'trial', 'provider', null, 'cancelAtPeriodEnd', false
    );
  END IF;

  IF subscription_row.status = 'active' AND subscription_row.current_period_end > now() THEN
    RETURN jsonb_build_object(
      'tier', 'pro', 'reason', 'subscription', 'hasProAccess', true,
      'daysRemaining', 0, 'expiresAt', subscription_row.current_period_end,
      'plan', subscription_row.plan, 'provider', subscription_row.provider,
      'cancelAtPeriodEnd', subscription_row.cancel_at_period_end
    );
  END IF;

  RETURN jsonb_build_object(
    'tier', 'essential', 'reason', 'essential', 'hasProAccess', false,
    'daysRemaining', 0, 'expiresAt', null, 'plan', subscription_row.plan,
    'provider', subscription_row.provider,
    'cancelAtPeriodEnd', subscription_row.cancel_at_period_end
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_subscription_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_subscription_access() TO authenticated;

