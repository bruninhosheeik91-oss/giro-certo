-- ============================================================================
-- Giro Certo — Fase 4B (parte 2): integridade referencial, unicidade e RLS
--
-- Idempotente: pode ser aplicada quantas vezes for necessário. Todo objeto é
-- criado com `IF NOT EXISTS` ou precededido de `DROP ... IF EXISTS`, portanto
-- reexecutar o arquivo não falha.
--
-- Dependências: 20240101000000_init.sql e 20260925000100_phase4b_integrity.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. updated_at: recriar todos os triggers de forma idempotente
--    O init e a migration 4B criam triggers sem guarda; aqui normalizamos.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  target text;
  trigger_name text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'profiles', 'vehicles', 'shifts', 'shift_pauses', 'transactions',
    'commitments', 'installments', 'fuel_records', 'maintenance_records',
    'maintenance_reserve_entries', 'registered_apps', 'user_settings'
  ]
  LOOP
    trigger_name := target || '_set_updated_at';
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', trigger_name, target);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      trigger_name,
      target
    );
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Normalização prévia dos dados (idempotente) antes das restrições
-- ---------------------------------------------------------------------------

-- Registros de abastecimento/manutenção órfãos (linha sem transação-mãe).
DELETE FROM public.fuel_records f
WHERE NOT EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = f.id);

DELETE FROM public.maintenance_records m
WHERE NOT EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = m.id);

-- Manter apenas a jornada aberta mais recente por usuário.
UPDATE public.shifts s
SET end_at = s.start_at,
    status = 'encerrada',
    km_end = COALESCE(s.km_end, s.km_start)
WHERE s.end_at IS NULL
  AND s.id <> (
    SELECT newer.id
    FROM public.shifts newer
    WHERE newer.user_id = s.user_id
      AND newer.end_at IS NULL
      AND newer.status IN ('ativa', 'pausada')
    ORDER BY newer.start_at DESC, newer.id DESC
    LIMIT 1
  );

-- Manter apenas o veículo ativo mais recente por usuário.
UPDATE public.vehicles v
SET is_active = false
WHERE v.is_active
  AND v.id <> (
    SELECT preferred.id
    FROM public.vehicles preferred
    WHERE preferred.user_id = v.user_id
      AND preferred.is_active
    ORDER BY preferred.updated_at DESC, preferred.id DESC
    LIMIT 1
  );

-- Manter apenas a pausa aberta mais recente por jornada (o índice único parcial
-- de `shift_pauses_single_open_per_shift_idx` falha se sobrar mais de uma).
UPDATE public.shift_pauses p
SET end_at = p.start_at
WHERE p.end_at IS NULL
  AND p.id <> (
    SELECT newer.id
    FROM public.shift_pauses newer
    WHERE newer.shift_id = p.shift_id
      AND newer.end_at IS NULL
    ORDER BY newer.start_at DESC, newer.id DESC
    LIMIT 1
  );

-- entry_type fora do domínio vira depósito (valor preservado).
UPDATE public.maintenance_reserve_entries
SET entry_type = 'deposito'
WHERE entry_type NOT IN ('deposito', 'resgate', 'ajuste');

-- Pausas com término anterior ao início.
UPDATE public.shift_pauses
SET end_at = start_at
WHERE end_at IS NOT NULL AND end_at < start_at;

-- reference_month / selected_month sempre no primeiro dia do mês.
UPDATE public.installments
SET reference_month = date_trunc('month', due_date)
WHERE reference_month IS NOT NULL
  AND reference_month <> date_trunc('month', reference_month);

UPDATE public.user_settings
SET selected_month = date_trunc('month', selected_month)
WHERE selected_month IS NOT NULL
  AND selected_month <> date_trunc('month', selected_month);

-- ---------------------------------------------------------------------------
-- 3. CHECK constraints
-- ---------------------------------------------------------------------------

ALTER TABLE public.maintenance_reserve_entries
  DROP CONSTRAINT IF EXISTS maintenance_reserve_entries_entry_type_check;
ALTER TABLE public.maintenance_reserve_entries
  ADD CONSTRAINT maintenance_reserve_entries_entry_type_check
  CHECK (entry_type IN ('deposito', 'resgate', 'ajuste'));

ALTER TABLE public.installments
  DROP CONSTRAINT IF EXISTS installments_reference_month_check;
ALTER TABLE public.installments
  ADD CONSTRAINT installments_reference_month_check
  CHECK (reference_month IS NULL OR reference_month = date_trunc('month', reference_month));

ALTER TABLE public.user_settings
  DROP CONSTRAINT IF EXISTS user_settings_selected_month_check;
ALTER TABLE public.user_settings
  ADD CONSTRAINT user_settings_selected_month_check
  CHECK (selected_month IS NULL OR selected_month = date_trunc('month', selected_month));

ALTER TABLE public.shift_pauses
  DROP CONSTRAINT IF EXISTS shift_pauses_end_at_check;
ALTER TABLE public.shift_pauses
  ADD CONSTRAINT shift_pauses_end_at_check
  CHECK (end_at IS NULL OR end_at >= start_at);

ALTER TABLE public.shifts
  DROP CONSTRAINT IF EXISTS shifts_km_start_check;
ALTER TABLE public.shifts
  ADD CONSTRAINT shifts_km_start_check
  CHECK (km_start IS NULL OR km_start >= 0);

ALTER TABLE public.shifts
  DROP CONSTRAINT IF EXISTS shifts_km_end_check;
ALTER TABLE public.shifts
  ADD CONSTRAINT shifts_km_end_check
  CHECK (km_end IS NULL OR km_start IS NULL OR km_end >= km_start);

-- ---------------------------------------------------------------------------
-- 4. Foreign keys
--
-- `transactions.installment_id` NÃO recebe FK de propósito: ela forma um ciclo
-- com `installments.transaction_id`. Como cada tabela é gravada em uma
-- requisição independente, a FK transformaria toda primeira sincronização em
-- erro 23503. A integridade desse vínculo é garantida por
-- `reconcileFinancialState` (app) e pela preservação das parcelas pagas.
-- ---------------------------------------------------------------------------

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_commitment_id_fkey;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_commitment_id_fkey
  FOREIGN KEY (commitment_id) REFERENCES public.commitments(id) ON DELETE SET NULL;

ALTER TABLE public.fuel_records
  DROP CONSTRAINT IF EXISTS fuel_records_transaction_fkey;
ALTER TABLE public.fuel_records
  ADD CONSTRAINT fuel_records_transaction_fkey
  FOREIGN KEY (id) REFERENCES public.transactions(id) ON DELETE CASCADE;

ALTER TABLE public.maintenance_records
  DROP CONSTRAINT IF EXISTS maintenance_records_transaction_fkey;
ALTER TABLE public.maintenance_records
  ADD CONSTRAINT maintenance_records_transaction_fkey
  FOREIGN KEY (id) REFERENCES public.transactions(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- 5. Índices de leitura e de unicidade
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS transactions_installment_idx
  ON public.transactions (installment_id) WHERE installment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS transactions_commitment_idx
  ON public.transactions (commitment_id) WHERE commitment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS shift_pauses_user_start_idx
  ON public.shift_pauses (user_id, start_at);
CREATE INDEX IF NOT EXISTS registered_apps_user_active_idx
  ON public.registered_apps (user_id, is_active);
CREATE INDEX IF NOT EXISTS installments_user_reference_idx
  ON public.installments (user_id, reference_month);
CREATE INDEX IF NOT EXISTS maintenance_reserve_user_date_idx
  ON public.maintenance_reserve_entries (user_id, date DESC);
CREATE INDEX IF NOT EXISTS user_settings_user_idx
  ON public.user_settings (user_id);

-- Uma única jornada aberta por usuário.
CREATE UNIQUE INDEX IF NOT EXISTS shifts_single_open_per_user_idx
  ON public.shifts (user_id)
  WHERE end_at IS NULL AND status IN ('ativa', 'pausada');

-- Um único veículo ativo por usuário.
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_single_active_per_user_idx
  ON public.vehicles (user_id) WHERE is_active = true;

-- Uma única pausa aberta por jornada.
CREATE UNIQUE INDEX IF NOT EXISTS shift_pauses_single_open_per_shift_idx
  ON public.shift_pauses (shift_id) WHERE end_at IS NULL;

-- ---------------------------------------------------------------------------
-- 6. RLS completa: ENABLE + 4 políticas por tabela, recriadas idempotentemente
--    profiles usa `id` como coluna de dono; todas as outras usam `user_id`.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  target text;
  owner_column text;
  policy_name text;
  policy_action text;
  policy_predicate text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'profiles', 'vehicles', 'shifts', 'shift_pauses', 'transactions',
    'commitments', 'installments', 'fuel_records', 'maintenance_records',
    'maintenance_reserve_entries', 'registered_apps', 'user_settings'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target);
    owner_column := CASE WHEN target = 'profiles' THEN 'id' ELSE 'user_id' END;

    FOREACH policy_action IN ARRAY ARRAY['select', 'insert', 'update', 'delete']
    LOOP
      -- Remove também o nome legado usado no init para a reserva de manutenção.
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
                     'maintenance_reserve_' || policy_action || '_own', 'maintenance_reserve_entries');
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
                     'maintenance_records_' || policy_action || '_own', 'maintenance_records');

      policy_name := target || '_' || policy_action || '_own';
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, target);

      policy_predicate := CASE policy_action
        WHEN 'select' THEN 'USING (auth.uid() = ' || owner_column || ')'
        WHEN 'insert' THEN 'WITH CHECK (auth.uid() = ' || owner_column || ')'
        WHEN 'update' THEN 'USING (auth.uid() = ' || owner_column || ') WITH CHECK (auth.uid() = ' || owner_column || ')'
        ELSE 'USING (auth.uid() = ' || owner_column || ')'
      END;

      -- O comando da policy (`SELECT`, `INSERT`, ...) é SQL, não identificador:
      -- precisa entrar via %s. Com %I viraria FOR "SELECT" (SQLSTATE 42601).
      EXECUTE format('CREATE POLICY %I ON public.%I FOR %s %s',
                     policy_name, target, upper(policy_action), policy_predicate);
    END LOOP;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Grants
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.delete_cloud_entity(text, uuid) TO authenticated;
