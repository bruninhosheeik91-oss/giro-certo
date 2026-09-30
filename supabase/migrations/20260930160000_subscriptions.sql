-- Base comercial do Giro Certo: teste gratuito e assinaturas validadas pelo backend.
CREATE TABLE IF NOT EXISTS public.subscriptions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'trialing'
    CHECK (status IN ('trialing','active','past_due','expired','canceled')),
  plan text NOT NULL DEFAULT 'trial'
    CHECK (plan IN ('trial','monthly','annual')),
  trial_started_at timestamptz NOT NULL DEFAULT now(),
  trial_ends_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  current_period_end timestamptz,
  provider text CHECK (provider IS NULL OR provider IN ('google_play','apple')),
  product_id text,
  purchase_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subscriptions_select_own ON public.subscriptions;
CREATE POLICY subscriptions_select_own ON public.subscriptions
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.create_trial_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auth_user_create_trial_subscription ON auth.users;
CREATE TRIGGER auth_user_create_trial_subscription
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_trial_subscription();

INSERT INTO public.subscriptions (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.has_subscription_access()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = auth.uid()
      AND (
        (status = 'trialing' AND trial_ends_at > now()) OR
        (status = 'active' AND current_period_end > now())
      )
  );
$$;

REVOKE ALL ON FUNCTION public.has_subscription_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_subscription_access() TO authenticated;

CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON public.subscriptions (status, trial_ends_at);
