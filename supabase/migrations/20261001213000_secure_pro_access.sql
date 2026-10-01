-- O Essencial permanece disponível. Somente recursos Pro consultam estas funções.
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
      'daysRemaining', 0, 'expiresAt', null
    );
  END IF;

  SELECT * INTO subscription_row
  FROM public.subscriptions
  WHERE user_id = auth.uid();

  IF subscription_row.status = 'trialing' AND subscription_row.trial_ends_at > now() THEN
    remaining_days := greatest(1, ceil(extract(epoch FROM (subscription_row.trial_ends_at - now())) / 86400)::integer);
    RETURN jsonb_build_object(
      'tier', 'essential', 'reason', 'trial', 'hasProAccess', false,
      'daysRemaining', remaining_days, 'expiresAt', subscription_row.trial_ends_at
    );
  END IF;

  IF subscription_row.status = 'active' AND subscription_row.current_period_end > now() THEN
    RETURN jsonb_build_object(
      'tier', 'pro', 'reason', 'subscription', 'hasProAccess', true,
      'daysRemaining', 0, 'expiresAt', subscription_row.current_period_end
    );
  END IF;

  RETURN jsonb_build_object(
    'tier', 'essential', 'reason', 'essential', 'hasProAccess', false,
    'daysRemaining', 0, 'expiresAt', null
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.has_pro_feature_access()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((public.get_my_subscription_access()->>'hasProAccess')::boolean, false);
$$;

REVOKE ALL ON FUNCTION public.get_my_subscription_access() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_pro_feature_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_subscription_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_pro_feature_access() TO authenticated;
