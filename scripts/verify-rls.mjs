import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const required = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'RLS_USER_A_EMAIL',
  'RLS_USER_A_PASSWORD',
  'RLS_USER_B_EMAIL',
  'RLS_USER_B_PASSWORD',
];

const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error(`Variáveis ausentes: ${missing.join(', ')}`);
  process.exit(1);
}

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

function client() {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function authenticated(email, password) {
  const supabase = client();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`Falha no login: ${error?.message ?? 'sem usuário'}`);
  return { supabase, userId: data.user.id };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const created = [];

try {
  const accountA = await authenticated(process.env.RLS_USER_A_EMAIL, process.env.RLS_USER_A_PASSWORD);
  const accountB = await authenticated(process.env.RLS_USER_B_EMAIL, process.env.RLS_USER_B_PASSWORD);
  assert(accountA.userId !== accountB.userId, 'As credenciais devem pertencer a usuários diferentes.');

  for (const [label, account] of [['A', accountA], ['B', accountB]]) {
    const id = randomUUID();
    const { error } = await account.supabase.from('vehicles').insert({
      id,
      user_id: account.userId,
      nickname: `RLS ${label} ${id.slice(0, 8)}`,
      type: 'moto',
      current_km: 0,
      is_active: false,
      is_archived: false,
    });
    if (error) throw new Error(`Conta ${label}: falha ao criar registro próprio: ${error.message}`);
    created.push({ account, id });
  }

  const [{ id: idA }, { id: idB }] = created;

  for (const [label, account, ownId, otherId] of [
    ['A', accountA, idA, idB],
    ['B', accountB, idB, idA],
  ]) {
    const own = await account.supabase.from('vehicles').select('id').eq('id', ownId);
    if (own.error) throw new Error(`Conta ${label}: falha na leitura própria: ${own.error.message}`);
    assert(own.data?.length === 1, `Conta ${label} não conseguiu ler o próprio registro.`);

    const foreign = await account.supabase.from('vehicles').select('id').eq('id', otherId);
    if (foreign.error) throw new Error(`Conta ${label}: falha inesperada na leitura cruzada: ${foreign.error.message}`);
    assert(foreign.data?.length === 0, `RLS falhou: conta ${label} leu registro da outra conta.`);

    const update = await account.supabase
      .from('vehicles')
      .update({ nickname: 'ALTERAÇÃO INDEVIDA' })
      .eq('id', otherId)
      .select('id');
    if (update.error) throw new Error(`Conta ${label}: erro inesperado no update cruzado: ${update.error.message}`);
    assert(update.data?.length === 0, `RLS falhou: conta ${label} alterou registro da outra conta.`);

    const forbiddenId = randomUUID();
    const forbidden = await account.supabase.from('vehicles').insert({
      id: forbiddenId,
      user_id: label === 'A' ? accountB.userId : accountA.userId,
      nickname: 'INSERÇÃO INDEVIDA',
      type: 'moto',
    });
    assert(Boolean(forbidden.error), `RLS falhou: conta ${label} inseriu registro para a outra conta.`);
  }

  console.log('RLS OK: leitura própria permitida; leitura, alteração e inserção cruzadas bloqueadas.');
} catch (error) {
  console.error(`RLS FALHOU: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  for (const { account, id } of created) {
    const { error } = await account.supabase.from('vehicles').delete().eq('id', id);
    if (error) {
      console.error(`Aviso: não foi possível remover o registro temporário ${id.slice(0, 8)}.`);
      process.exitCode = 1;
    }
    await account.supabase.auth.signOut();
  }
}
