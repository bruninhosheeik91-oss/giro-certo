-- Pânico: canal Telegram (bot gratuito). O contato abre o link de convite
-- (t.me/<bot>?start=<link_code>) e toca em Iniciar; a função telegram-webhook
-- grava o chat_id. O telefone passa a ser opcional.

ALTER TABLE public.panic_contacts
  ADD COLUMN IF NOT EXISTS link_code text,
  ADD COLUMN IF NOT EXISTS telegram_chat_id bigint,
  ADD COLUMN IF NOT EXISTS linked_at timestamptz;

UPDATE public.panic_contacts SET link_code = replace(gen_random_uuid()::text, '-', '') WHERE link_code IS NULL;
ALTER TABLE public.panic_contacts
  ALTER COLUMN link_code SET DEFAULT replace(gen_random_uuid()::text, '-', ''),
  ALTER COLUMN link_code SET NOT NULL,
  ALTER COLUMN phone DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS panic_contacts_link_code_idx ON public.panic_contacts (link_code);

-- O app nunca grava o vínculo do Telegram; só a função (service_role).
DROP POLICY IF EXISTS panic_contacts_insert ON public.panic_contacts;
CREATE POLICY panic_contacts_insert ON public.panic_contacts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND telegram_chat_id IS NULL AND linked_at IS NULL);
