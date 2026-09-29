ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS notification_shift_reminders boolean NOT NULL DEFAULT false;

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS odometer_baseline_km numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.commitments
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS creditor text;

ALTER TABLE public.installments
  ADD COLUMN IF NOT EXISTS reference_month date;

ALTER TABLE public.maintenance_reserve_entries
  ADD COLUMN IF NOT EXISTS entry_type text NOT NULL DEFAULT 'deposito',
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS selected_month date,
  ADD COLUMN IF NOT EXISTS local_import_completed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.registered_apps (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL,
  icon text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS registered_apps_user_id_idx
  ON public.registered_apps (user_id);

DROP TRIGGER IF EXISTS registered_apps_set_updated_at ON public.registered_apps;
CREATE TRIGGER registered_apps_set_updated_at
  BEFORE UPDATE ON public.registered_apps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.shift_pauses (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shift_pauses_shift_id_idx
  ON public.shift_pauses (shift_id);
CREATE INDEX IF NOT EXISTS shift_pauses_user_id_idx
  ON public.shift_pauses (user_id);

DROP TRIGGER IF EXISTS shift_pauses_set_updated_at ON public.shift_pauses;
CREATE TRIGGER shift_pauses_set_updated_at
  BEFORE UPDATE ON public.shift_pauses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.registered_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_pauses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS registered_apps_select_own ON public.registered_apps;
CREATE POLICY registered_apps_select_own
  ON public.registered_apps FOR SELECT USING (uid() = user_id);
DROP POLICY IF EXISTS registered_apps_insert_own ON public.registered_apps;
CREATE POLICY registered_apps_insert_own
  ON public.registered_apps FOR INSERT WITH CHECK (uid() = user_id);
DROP POLICY IF EXISTS registered_apps_update_own ON public.registered_apps;
CREATE POLICY registered_apps_update_own
  ON public.registered_apps FOR UPDATE USING (uid() = user_id) WITH CHECK (uid() = user_id);
DROP POLICY IF EXISTS registered_apps_delete_own ON public.registered_apps;
CREATE POLICY registered_apps_delete_own
  ON public.registered_apps FOR DELETE USING (uid() = user_id);

DROP POLICY IF EXISTS shift_pauses_select_own ON public.shift_pauses;
CREATE POLICY shift_pauses_select_own
  ON public.shift_pauses FOR SELECT USING (uid() = user_id);
DROP POLICY IF EXISTS shift_pauses_insert_own ON public.shift_pauses;
CREATE POLICY shift_pauses_insert_own
  ON public.shift_pauses FOR INSERT WITH CHECK (uid() = user_id);
DROP POLICY IF EXISTS shift_pauses_update_own ON public.shift_pauses;
CREATE POLICY shift_pauses_update_own
  ON public.shift_pauses FOR UPDATE USING (uid() = user_id) WITH CHECK (uid() = user_id);
DROP POLICY IF EXISTS shift_pauses_delete_own ON public.shift_pauses;
CREATE POLICY shift_pauses_delete_own
  ON public.shift_pauses FOR DELETE USING (uid() = user_id);

CREATE OR REPLACE FUNCTION public.delete_cloud_entity(p_table text, p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  IF p_table = 'profiles' THEN
    DELETE FROM public.profiles WHERE id = p_id;
  ELSIF p_table = 'vehicles' THEN
    DELETE FROM public.vehicles WHERE id = p_id;
  ELSIF p_table = 'shifts' THEN
    DELETE FROM public.shifts WHERE id = p_id;
  ELSIF p_table = 'shift_pauses' THEN
    DELETE FROM public.shift_pauses WHERE id = p_id;
  ELSIF p_table = 'transactions' THEN
    DELETE FROM public.transactions WHERE id = p_id;
  ELSIF p_table = 'commitments' THEN
    DELETE FROM public.commitments WHERE id = p_id;
  ELSIF p_table = 'installments' THEN
    DELETE FROM public.installments WHERE id = p_id;
  ELSIF p_table = 'fuel_records' THEN
    DELETE FROM public.fuel_records WHERE id = p_id;
  ELSIF p_table = 'maintenance_records' THEN
    DELETE FROM public.maintenance_records WHERE id = p_id;
  ELSIF p_table = 'maintenance_reserve_entries' THEN
    DELETE FROM public.maintenance_reserve_entries WHERE id = p_id;
  ELSIF p_table = 'registered_apps' THEN
    DELETE FROM public.registered_apps WHERE id = p_id;
  ELSIF p_table = 'user_settings' THEN
    DELETE FROM public.user_settings WHERE user_id = p_id;
  ELSE
    RAISE EXCEPTION 'Tabela não permitida: %', p_table;
  END IF;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_cloud_entity(text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, city, start_date)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'name', ''), split_part(COALESCE(NEW.email, ''), '@', 1), 'Usuário'),
    NEW.raw_user_meta_data ->> 'city',
    (now() AT TIME ZONE 'America/Sao_Paulo')::date
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_settings (user_id, selected_month)
  VALUES (NEW.id, (now() AT TIME ZONE 'America/Sao_Paulo')::date)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
