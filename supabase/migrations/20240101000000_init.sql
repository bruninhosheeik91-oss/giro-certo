-- ============================================================================
-- Giro Certo — Schema inicial (Supabase / PostgreSQL 15+)
-- Convenções:
--   * user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
--   * money    NUMERIC(14,2)  — nunca float
--   * odômetro NUMERIC(12,2)
--   * volumes  NUMERIC(12,2)
--   * datas de vencimento                  => DATE
--   * datas/horas de eventos              => TIMESTAMPTZ
--   * auditoria timestamps created_at/updated_at em todas as tabelas de usuário
-- Row Level Security ativo em TODAS as tabelas (ver seção "RLS" no final).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensão de UUID (gerada no cliente para operações idempotentes offline)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. Função de updated_at (reutilizável)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 2. profiles — dados de perfil + configurações por usuário
-- ---------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id                          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name                        text NOT NULL,
  city                        text,
  monthly_goal                numeric(14,2) NOT NULL DEFAULT 12000,
  maintenance_reserve_per_km  numeric(12,4) NOT NULL DEFAULT 0.1200,
  ride_criteria_min_per_km    numeric(12,4) NOT NULL DEFAULT 0.80,
  ride_criteria_min_per_hour  numeric(12,4) NOT NULL DEFAULT 25.00,
  ride_criteria_min_value     numeric(14,2) NOT NULL DEFAULT 8.00,
  ride_criteria_consider_return boolean NOT NULL DEFAULT true,
  notification_daily_goal     boolean NOT NULL DEFAULT true,
  notification_maintenance    boolean NOT NULL DEFAULT true,
  notification_fuel_reminder  boolean NOT NULL DEFAULT true,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. vehicles — veículos do usuário
-- ---------------------------------------------------------------------------
CREATE TABLE public.vehicles (
  id                uuid PRIMARY KEY,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname          text NOT NULL,
  type              text NOT NULL CHECK (type IN ('moto', 'carro', 'bicicleta')),
  brand             text,
  model             text,
  year              text,
  plate             text,
  current_km        numeric(12,2) NOT NULL DEFAULT 0,
  fuel_type         text,
  fuel_avg_km_liter numeric(12,4),
  ref_price_liter   numeric(12,4),
  acquisition_value numeric(14,2),
  acquisition_date  date,
  notes             text,
  is_active         boolean NOT NULL DEFAULT false,
  is_archived       boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vehicles_user_id_idx ON public.vehicles (user_id);
CREATE INDEX vehicles_active_idx  ON public.vehicles (user_id, is_active) WHERE is_active = true;

CREATE TRIGGER vehicles_set_updated_at
  BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. shifts — jornadas de trabalho
-- ---------------------------------------------------------------------------
CREATE TABLE public.shifts (
  id             uuid PRIMARY KEY,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id     uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  start_at       timestamptz NOT NULL,
  end_at         timestamptz,
  status         text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'encerrada', 'pausada', 'cancelada')),
  km_start       numeric(12,2),
  km_end         numeric(12,2),
  earnings_cents bigint NOT NULL DEFAULT 0,
  expenses_cents bigint NOT NULL DEFAULT 0,
  paused_seconds integer NOT NULL DEFAULT 0,
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shifts_user_id_idx   ON public.shifts (user_id);
CREATE INDEX shifts_vehicle_idx   ON public.shifts (vehicle_id);
CREATE INDEX shifts_start_idx     ON public.shifts (user_id, start_at DESC);

CREATE TRIGGER shifts_set_updated_at
  BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. transactions — ganhos, abastecimentos, manutenções e outras despesas
--    O id UUID é gerado no cliente => operações idempotentes (offline)
-- ---------------------------------------------------------------------------
CREATE TYPE public.transaction_type AS ENUM ('ganho', 'abastecimento', 'manutencao', 'outra_despesa');
CREATE TYPE public.transaction_origin AS ENUM ('manual', 'opening_balance');

CREATE TABLE public.transactions (
  id            uuid PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          public.transaction_type NOT NULL,
  category      text,
  amount        numeric(14,2) NOT NULL CHECK (amount >= 0),
  occurred_at   timestamptz NOT NULL,
  description   text,
  vehicle_id    uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  shift_id      uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
  installment_id uuid,
  commitment_id uuid,
  origin        public.transaction_origin NOT NULL DEFAULT 'manual',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (amount > 0 OR origin = 'opening_balance')
);
CREATE INDEX transactions_user_id_idx   ON public.transactions (user_id);
CREATE INDEX transactions_type_idx      ON public.transactions (user_id, type);
CREATE INDEX transactions_occurred_idx  ON public.transactions (user_id, occurred_at DESC);
CREATE INDEX transactions_vehicle_idx   ON public.transactions (vehicle_id);
CREATE INDEX transactions_shift_idx     ON public.transactions (shift_id);

CREATE TRIGGER transactions_set_updated_at
  BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. commitments (contas) + installments (parcelas) — vínculo com transações
-- ---------------------------------------------------------------------------
CREATE TYPE public.commitment_type AS ENUM (
  'conta_unica', 'compra_parcelada', 'financiamento_veiculo',
  'emprestimo', 'consorcio', 'conta_recorrente'
);
CREATE TYPE public.commitment_status AS ENUM ('ativo', 'pausado', 'cancelado', 'concluido');

CREATE TABLE public.commitments (
  id                  uuid PRIMARY KEY,
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type                public.commitment_type NOT NULL,
  title               text NOT NULL,
  installment_amount  numeric(14,2) NOT NULL CHECK (installment_amount >= 0),
  first_due_date      date NOT NULL,
  total_installments  integer,
  due_day             integer NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  end_date            date,
  notes               text,
  status              public.commitment_status NOT NULL DEFAULT 'ativo',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  -- Parcela deve respeitar a duração real; date final >= primeiro vencimento
  CHECK (end_date IS NULL OR end_date >= first_due_date)
);
CREATE INDEX commitments_user_id_idx ON public.commitments (user_id);

CREATE TRIGGER commitments_set_updated_at
  BEFORE UPDATE ON public.commitments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.installments (
  id              uuid PRIMARY KEY,
  commitment_id   uuid NOT NULL REFERENCES public.commitments(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  number          integer NOT NULL CHECK (number >= 1),
  due_date        date NOT NULL,
  expected_amount numeric(14,2) NOT NULL CHECK (expected_amount >= 0),
  status          text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'paga', 'reaberta')),
  paid_at         timestamptz,
  paid_amount     numeric(14,2),
  payment_origin  text,
  transaction_id  uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (commitment_id, number)
);
CREATE INDEX installments_commitment_idx ON public.installments (commitment_id);
CREATE INDEX installments_due_idx        ON public.installments (user_id, due_date);
CREATE INDEX installments_status_idx     ON public.installments (user_id, status);

CREATE TRIGGER installments_set_updated_at
  BEFORE UPDATE ON public.installments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. fuel_records — abastecimentos detalhados
-- ---------------------------------------------------------------------------
CREATE TABLE public.fuel_records (
  id               uuid PRIMARY KEY,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id       uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  shift_id         uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
  odometer_km      numeric(12,2),
  liters           numeric(12,2) NOT NULL CHECK (liters > 0),
  price_per_liter  numeric(14,4) NOT NULL CHECK (price_per_liter >= 0),
  total            numeric(14,2) NOT NULL CHECK (total >= 0),
  occurred_at      timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fuel_records_user_id_idx ON public.fuel_records (user_id);
CREATE INDEX fuel_records_vehicle_idx ON public.fuel_records (vehicle_id);

CREATE TRIGGER fuel_records_set_updated_at
  BEFORE UPDATE ON public.fuel_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 8. maintenance_records + maintenance_reserve_entries
-- ---------------------------------------------------------------------------
CREATE TYPE public.maintenance_category AS ENUM (
  'troca_oleo', 'pneu_dianteiro', 'pneu_traseiro', 'relacao', 'freios',
  'filtro', 'revisao', 'eletrica', 'motor', 'suspensao', 'lavagem',
  'acessorio', 'outra'
);

CREATE TABLE public.maintenance_records (
  id              uuid PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id      uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  date            date NOT NULL,
  category        public.maintenance_category NOT NULL,
  description     text,
  cost            numeric(14,2) NOT NULL CHECK (cost >= 0),
  odometer_km     numeric(12,2),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX maintenance_records_user_id_idx   ON public.maintenance_records (user_id);
CREATE INDEX maintenance_records_vehicle_idx   ON public.maintenance_records (vehicle_id);

CREATE TRIGGER maintenance_records_set_updated_at
  BEFORE UPDATE ON public.maintenance_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.maintenance_reserve_entries (
  id          uuid PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id  uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  date        date NOT NULL,
  amount      numeric(14,2) NOT NULL CHECK (amount >= 0),
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX maintenance_reserve_user_idx ON public.maintenance_reserve_entries (user_id);
CREATE INDEX maintenance_reserve_vehicle_idx ON public.maintenance_reserve_entries (vehicle_id);

CREATE TRIGGER maintenance_reserve_entries_set_updated_at
  BEFORE UPDATE ON public.maintenance_reserve_entries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 9. user_settings — preferências (a maioria mora em profiles)
-- ---------------------------------------------------------------------------
CREATE TABLE public.user_settings (
  user_id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  currency     text NOT NULL DEFAULT 'BRL',
  locale       text NOT NULL DEFAULT 'pt-BR',
  theme        text NOT NULL DEFAULT 'dark',
  backup_auto  boolean NOT NULL DEFAULT true,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER user_settings_set_updated_at
  BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 10. ROW LEVEL SECURITY — isolamento total por usuário
-- ============================================================================
ALTER TABLE public.profiles                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commitments                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_records                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_records         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_reserve_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings               ENABLE ROW LEVEL SECURITY;

-- helper para forçar user_id = auth.uid() em toda operação
CREATE OR REPLACE FUNCTION public.uid()
RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT auth.uid() $$;

-- --- profiles -------------------------------------------------------------
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (uid() = id) WITH CHECK (uid() = id);
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE USING (uid() = id);

-- --- vehicles -------------------------------------------------------------
CREATE POLICY "vehicles_select_own" ON public.vehicles FOR SELECT USING (uid() = user_id);
CREATE POLICY "vehicles_insert_own" ON public.vehicles FOR INSERT WITH CHECK (uid() = user_id);
CREATE POLICY "vehicles_update_own" ON public.vehicles FOR UPDATE USING (uid() = user_id) WITH CHECK (uid() = user_id);
CREATE POLICY "vehicles_delete_own" ON public.vehicles FOR DELETE USING (uid() = user_id);

-- --- shifts ---------------------------------------------------------------
CREATE POLICY "shifts_select_own" ON public.shifts FOR SELECT USING (uid() = user_id);
CREATE POLICY "shifts_insert_own" ON public.shifts FOR INSERT WITH CHECK (uid() = user_id);
CREATE POLICY "shifts_update_own" ON public.shifts FOR UPDATE USING (uid() = user_id) WITH CHECK (uid() = user_id);
CREATE POLICY "shifts_delete_own" ON public.shifts FOR DELETE USING (uid() = user_id);

-- --- transactions ---------------------------------------------------------
CREATE POLICY "transactions_select_own" ON public.transactions FOR SELECT USING (uid() = user_id);
CREATE POLICY "transactions_insert_own" ON public.transactions FOR INSERT WITH CHECK (uid() = user_id);
CREATE POLICY "transactions_update_own" ON public.transactions FOR UPDATE USING (uid() = user_id) WITH CHECK (uid() = user_id);
CREATE POLICY "transactions_delete_own" ON public.transactions FOR DELETE USING (uid() = user_id);

-- --- commitments + installments ------------------------------------------
CREATE POLICY "commitments_select_own" ON public.commitments FOR SELECT USING (uid() = user_id);
CREATE POLICY "commitments_insert_own" ON public.commitments FOR INSERT WITH CHECK (uid() = user_id);
CREATE POLICY "commitments_update_own" ON public.commitments FOR UPDATE USING (uid() = user_id) WITH CHECK (uid() = user_id);
CREATE POLICY "commitments_delete_own" ON public.commitments FOR DELETE USING (uid() = user_id);

CREATE POLICY "installments_select_own" ON public.installments FOR SELECT USING (uid() = user_id);
CREATE POLICY "installments_insert_own" ON public.installments FOR INSERT WITH CHECK (uid() = user_id);
CREATE POLICY "installments_update_own" ON public.installments FOR UPDATE USING (uid() = user_id) WITH CHECK (uid() = user_id);
CREATE POLICY "installments_delete_own" ON public.installments FOR DELETE USING (uid() = user_id);

-- --- fuel_records ---------------------------------------------------------
CREATE POLICY "fuel_records_select_own" ON public.fuel_records FOR SELECT USING (uid() = user_id);
CREATE POLICY "fuel_records_insert_own" ON public.fuel_records FOR INSERT WITH CHECK (uid() = user_id);
CREATE POLICY "fuel_records_update_own" ON public.fuel_records FOR UPDATE USING (uid() = user_id) WITH CHECK (uid() = user_id);
CREATE POLICY "fuel_records_delete_own" ON public.fuel_records FOR DELETE USING (uid() = user_id);

-- --- maintenance ----------------------------------------------------------
CREATE POLICY "maintenance_records_select_own" ON public.maintenance_records FOR SELECT USING (uid() = user_id);
CREATE POLICY "maintenance_records_insert_own" ON public.maintenance_records FOR INSERT WITH CHECK (uid() = user_id);
CREATE POLICY "maintenance_records_update_own" ON public.maintenance_records FOR UPDATE USING (uid() = user_id) WITH CHECK (uid() = user_id);
CREATE POLICY "maintenance_records_delete_own" ON public.maintenance_records FOR DELETE USING (uid() = user_id);

CREATE POLICY "maintenance_reserve_select_own" ON public.maintenance_reserve_entries FOR SELECT USING (uid() = user_id);
CREATE POLICY "maintenance_reserve_insert_own" ON public.maintenance_reserve_entries FOR INSERT WITH CHECK (uid() = user_id);
CREATE POLICY "maintenance_reserve_update_own" ON public.maintenance_reserve_entries FOR UPDATE USING (uid() = user_id) WITH CHECK (uid() = user_id);
CREATE POLICY "maintenance_reserve_delete_own" ON public.maintenance_reserve_entries FOR DELETE USING (uid() = user_id);

-- --- user_settings --------------------------------------------------------
CREATE POLICY "user_settings_select_own" ON public.user_settings FOR SELECT USING (uid() = user_id);
CREATE POLICY "user_settings_insert_own" ON public.user_settings FOR INSERT WITH CHECK (uid() = user_id);
CREATE POLICY "user_settings_update_own" ON public.user_settings FOR UPDATE USING (uid() = user_id) WITH CHECK (uid() = user_id);
CREATE POLICY "user_settings_delete_own" ON public.user_settings FOR DELETE USING (uid() = user_id);

-- ============================================================================
-- 11. Trigger de perfil — cria profile automaticamente no primeiro cadastro
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, city)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data ->> 'city'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
