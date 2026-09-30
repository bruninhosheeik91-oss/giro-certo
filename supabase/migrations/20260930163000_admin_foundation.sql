-- Administração segura do Giro Certo. Nenhuma senha ou service_role vive no app.
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','support','finance')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_users_select_self ON public.admin_users;
CREATE POLICY admin_users_select_self ON public.admin_users
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action text NOT NULL,
  target_type text,
  target_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

INSERT INTO public.admin_users (user_id, role)
VALUES ('30c9421a-48ff-488d-a311-89ccaf59c1db'::uuid, 'owner')
ON CONFLICT (user_id) DO UPDATE SET role = 'owner';

CREATE OR REPLACE FUNCTION public.is_giro_certo_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.get_admin_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  IF NOT public.is_giro_certo_admin() THEN
    RAISE EXCEPTION 'Acesso administrativo negado' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'totalUsers', (SELECT count(*) FROM auth.users),
    'newUsers30d', (SELECT count(*) FROM auth.users WHERE created_at >= now() - interval '30 days'),
    'activeSubscriptions', (SELECT count(*) FROM public.subscriptions WHERE status = 'active'),
    'trialUsers', (SELECT count(*) FROM public.subscriptions WHERE status = 'trialing' AND trial_ends_at > now()),
    'expiredUsers', (SELECT count(*) FROM public.subscriptions WHERE status IN ('expired','canceled') OR (status = 'trialing' AND trial_ends_at <= now()))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_giro_certo_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_giro_certo_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_overview() TO authenticated;
