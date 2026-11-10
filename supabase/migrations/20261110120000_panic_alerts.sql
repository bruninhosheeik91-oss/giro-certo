-- Pânico silencioso: contatos (WhatsApp), alertas e acompanhamento ao vivo.
-- Alertas e localizações são gravados só pelas Edge Functions (service_role),
-- que também enviam o WhatsApp pela API oficial da Meta.

CREATE TABLE IF NOT EXISTS public.panic_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  phone text NOT NULL CHECK (phone ~ '^[1-9][0-9]{9,14}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS panic_contacts_user_phone_idx ON public.panic_contacts (user_id, phone);

CREATE OR REPLACE FUNCTION public.panic_contacts_limit()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.panic_contacts WHERE user_id = NEW.user_id) >= 5 THEN
    RAISE EXCEPTION 'Limite de 5 contatos de emergência' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS panic_contacts_limit ON public.panic_contacts;
CREATE TRIGGER panic_contacts_limit BEFORE INSERT ON public.panic_contacts
  FOR EACH ROW EXECUTE FUNCTION public.panic_contacts_limit();

ALTER TABLE public.panic_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS panic_contacts_select ON public.panic_contacts;
CREATE POLICY panic_contacts_select ON public.panic_contacts FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS panic_contacts_insert ON public.panic_contacts;
CREATE POLICY panic_contacts_insert ON public.panic_contacts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS panic_contacts_delete ON public.panic_contacts;
CREATE POLICY panic_contacts_delete ON public.panic_contacts FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Credencial do aparelho para o disparo nativo (funciona com o app fechado).
CREATE TABLE IF NOT EXISTS public.panic_devices (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  secret_hash text NOT NULL,
  driver_name text NOT NULL DEFAULT 'Motorista',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.panic_devices ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.panic_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  share_token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  driver_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  last_lat double precision,
  last_lng double precision,
  last_accuracy real,
  last_at timestamptz,
  notified_count integer NOT NULL DEFAULT 0,
  notify_errors text
);
CREATE INDEX IF NOT EXISTS panic_alerts_user_idx ON public.panic_alerts (user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.panic_locations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alert_id uuid NOT NULL REFERENCES public.panic_alerts (id) ON DELETE CASCADE,
  lat double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
  accuracy real,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS panic_locations_alert_idx ON public.panic_locations (alert_id, recorded_at);

ALTER TABLE public.panic_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS panic_alerts_select ON public.panic_alerts;
CREATE POLICY panic_alerts_select ON public.panic_alerts FOR SELECT TO authenticated USING (user_id = auth.uid());

ALTER TABLE public.panic_locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS panic_locations_select ON public.panic_locations;
CREATE POLICY panic_locations_select ON public.panic_locations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.panic_alerts a WHERE a.id = alert_id AND a.user_id = auth.uid()));

REVOKE ALL ON public.panic_devices FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.panic_alerts FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.panic_locations FROM anon, authenticated;
REVOKE UPDATE ON public.panic_contacts FROM anon, authenticated;
