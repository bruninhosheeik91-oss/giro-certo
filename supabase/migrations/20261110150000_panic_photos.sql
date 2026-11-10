-- Pânico: fotos da câmera a cada ~10 s durante o alerta.
-- Arquivos no bucket privado "panic-photos" (acesso só por URL assinada gerada
-- pela função panic-live para quem tem o link do alerta). Apagadas após 7 dias
-- pela própria função panic-alert.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('panic-photos', 'panic-photos', false, 524288, ARRAY['image/jpeg'])
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.panic_photos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alert_id uuid NOT NULL REFERENCES public.panic_alerts (id) ON DELETE CASCADE,
  path text NOT NULL UNIQUE,
  taken_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS panic_photos_alert_idx ON public.panic_photos (alert_id, taken_at DESC);

ALTER TABLE public.panic_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS panic_photos_select ON public.panic_photos;
CREATE POLICY panic_photos_select ON public.panic_photos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.panic_alerts a WHERE a.id = alert_id AND a.user_id = auth.uid()));
REVOKE INSERT, UPDATE, DELETE ON public.panic_photos FROM anon, authenticated;
