-- Exclusão autônoma e imediata da conta para conformidade com a Google Play.
ALTER TABLE public.admin_audit_logs ALTER COLUMN actor_id DROP NOT NULL;
ALTER TABLE public.admin_audit_logs DROP CONSTRAINT IF EXISTS admin_audit_logs_actor_id_fkey;
ALTER TABLE public.admin_audit_logs
  ADD CONSTRAINT admin_audit_logs_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.delete_my_account(p_confirmation text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, storage
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida' USING ERRCODE = '42501';
  END IF;
  IF p_confirmation <> 'EXCLUIR' THEN
    RAISE EXCEPTION 'Confirmação inválida' USING ERRCODE = '22023';
  END IF;

  DELETE FROM storage.objects
  WHERE bucket_id = 'profile-avatars' AND owner_id = current_user_id::text;

  DELETE FROM auth.users WHERE id = current_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta não encontrada' USING ERRCODE = 'P0002';
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_my_account(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account(text) TO authenticated;
