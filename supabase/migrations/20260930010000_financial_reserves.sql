-- Evolui o antigo cofrinho de manutenção para reservas financeiras por objetivo.
ALTER TABLE public.maintenance_reserve_entries
  ADD COLUMN IF NOT EXISTS reserve_id uuid,
  ADD COLUMN IF NOT EXISTS reserve_name text,
  ADD COLUMN IF NOT EXISTS reserve_category text,
  ADD COLUMN IF NOT EXISTS institution text,
  ADD COLUMN IF NOT EXISTS goal_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;

ALTER TABLE public.maintenance_reserve_entries
  DROP CONSTRAINT IF EXISTS maintenance_reserve_goal_amount_check;
ALTER TABLE public.maintenance_reserve_entries
  ADD CONSTRAINT maintenance_reserve_goal_amount_check
  CHECK (goal_amount IS NULL OR goal_amount >= 0);

ALTER TABLE public.maintenance_reserve_entries
  DROP CONSTRAINT IF EXISTS maintenance_reserve_category_check;
ALTER TABLE public.maintenance_reserve_entries
  ADD CONSTRAINT maintenance_reserve_category_check
  CHECK (reserve_category IS NULL OR reserve_category IN ('manutencao','emergencia','impostos','veiculo','outro'));

CREATE INDEX IF NOT EXISTS maintenance_reserve_group_idx
  ON public.maintenance_reserve_entries (user_id, reserve_id, date DESC);

COMMENT ON COLUMN public.maintenance_reserve_entries.institution IS
  'Banco ou carteira informado pelo usuário; não representa integração bancária.';
