-- Fase de lançamento: todos os usuários têm acesso completo, exceto os bloqueados
-- pelo administrador. Os planos voltam quando o site de vendas existir.

CREATE TABLE IF NOT EXISTS public.user_access_blocks (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  reason     text,
  blocked_at timestamptz NOT NULL DEFAULT now(),
  blocked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
-- Sem políticas: só as funções SECURITY DEFINER abaixo leem/escrevem.
ALTER TABLE public.user_access_blocks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_my_subscription_access()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_owner boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação necessária' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_access_blocks WHERE user_id = auth.uid()) THEN
    RETURN jsonb_build_object('tier','essential','reason','blocked','hasProAccess',false,'daysRemaining',0,'expiresAt',null,'plan',null,'provider',null,'cancelAtPeriodEnd',false,'pendingPlan',null,'pendingChangeAt',null);
  END IF;
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND role = 'owner') INTO is_owner;
  RETURN jsonb_build_object('tier','pro','reason', CASE WHEN is_owner THEN 'owner' ELSE 'free' END,'hasProAccess',true,'daysRemaining',0,'expiresAt',null,'plan',null,'provider',null,'cancelAtPeriodEnd',false,'pendingPlan',null,'pendingChangeAt',null);
END;
$$;
REVOKE ALL ON FUNCTION public.get_my_subscription_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_subscription_access() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  IF NOT public.is_giro_certo_admin() THEN
    RAISE EXCEPTION 'Acesso administrativo negado' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'totalUsers', (SELECT count(*) FROM auth.users),
    'newUsers30d', (SELECT count(*) FROM auth.users WHERE created_at >= now() - interval '30 days'),
    'activeUsers7d', (SELECT count(*) FROM auth.users WHERE last_sign_in_at >= now() - interval '7 days'),
    'blockedUsers', (SELECT count(*) FROM public.user_access_blocks)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_users(p_search text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  IF NOT public.is_giro_certo_admin() THEN
    RAISE EXCEPTION 'Acesso administrativo negado' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(row_to_json(u) ORDER BY u.created_at DESC)
    FROM (
      SELECT
        au.id,
        au.email,
        p.name,
        p.city,
        au.created_at,
        au.last_sign_in_at,
        (b.user_id IS NOT NULL) AS blocked,
        b.reason AS blocked_reason,
        (SELECT count(*) FROM public.shifts s WHERE s.user_id = au.id) AS shifts_count,
        (SELECT max(t.updated_at) FROM public.transactions t WHERE t.user_id = au.id) AS last_activity,
        EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = au.id) AS is_admin
      FROM auth.users au
      LEFT JOIN public.profiles p ON p.id = au.id
      LEFT JOIN public.user_access_blocks b ON b.user_id = au.id
      WHERE p_search IS NULL OR p_search = ''
         OR au.email ILIKE '%' || p_search || '%'
         OR p.name ILIKE '%' || p_search || '%'
      ORDER BY au.created_at DESC
      LIMIT 500
    ) u
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_blocked(p_user_id uuid, p_blocked boolean, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND role IN ('owner','support')) THEN
    RAISE EXCEPTION 'Acesso administrativo negado' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'Não é possível bloquear um administrador' USING ERRCODE = '42501';
  END IF;
  IF p_blocked THEN
    INSERT INTO public.user_access_blocks (user_id, reason, blocked_by)
    VALUES (p_user_id, nullif(trim(p_reason), ''), auth.uid())
    ON CONFLICT (user_id) DO UPDATE SET reason = excluded.reason, blocked_at = now(), blocked_by = auth.uid();
  ELSE
    DELETE FROM public.user_access_blocks WHERE user_id = p_user_id;
  END IF;
  INSERT INTO public.admin_audit_logs (actor_id, action, target_type, target_id, details)
  VALUES (auth.uid(), CASE WHEN p_blocked THEN 'user_blocked' ELSE 'user_unblocked' END, 'user', p_user_id::text,
          jsonb_build_object('reason', p_reason));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_user_blocked(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_blocked(uuid, boolean, text) TO authenticated;
