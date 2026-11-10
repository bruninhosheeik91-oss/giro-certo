import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient, SUPABASE_ANON_KEY, SUPABASE_URL } from './auth';
import { nativePanic, openExternal, shareText, type PanicStatus } from './securityCamera';

export interface PanicContact {
  id: string;
  name: string;
  linkCode: string;
  linked: boolean;
}

export const MAX_PANIC_CONTACTS = 5;

function client(): SupabaseClient | null {
  return getSupabaseClient() as unknown as SupabaseClient | null;
}

export async function listPanicContacts(): Promise<PanicContact[]> {
  const db = client();
  if (!db) return [];
  const { data, error } = await db
    .from('panic_contacts')
    .select('id, name, link_code, telegram_chat_id')
    .order('created_at');
  if (error) throw new Error('Não foi possível carregar os contatos.');
  return (data ?? []).map((row: { id: string; name: string; link_code: string; telegram_chat_id: number | null }) => ({
    id: row.id,
    name: row.name,
    linkCode: row.link_code,
    linked: row.telegram_chat_id != null,
  }));
}

export async function addPanicContact(name: string): Promise<void> {
  const db = client();
  if (!db) throw new Error('Entre na sua conta para usar o pânico.');
  const clean = name.trim();
  if (!clean) throw new Error('Digite o nome do contato.');
  const { error } = await db.from('panic_contacts').insert({ name: clean });
  if (error) {
    throw new Error(error.message.includes('Limite') ? `Máximo de ${MAX_PANIC_CONTACTS} contatos.` : 'Não foi possível salvar o contato.');
  }
}

export function inviteLink(botUsername: string, linkCode: string): string {
  return `https://t.me/${botUsername}?start=${linkCode}`;
}

export function inviteMessage(driverName: string, contactName: string, link: string): string {
  return (
    `Oi, ${contactName}! Sou ${driverName} e trabalho com o app Giro Certo. ` +
    `Quero te cadastrar como meu contato de emergência: se eu acionar o botão de pânico, ` +
    `você recebe minha localização em tempo real pelo Telegram.\n\n` +
    `Toque no link e depois em "Iniciar" (precisa ter o Telegram): ${link}`
  );
}

export async function shareInvite(driverName: string, contact: PanicContact, botUsername: string): Promise<void> {
  const link = inviteLink(botUsername, contact.linkCode);
  await shareText('Convite de contato de emergência', inviteMessage(driverName, contact.name, link));
}

export async function getBotUsername(): Promise<string> {
  const result = await callFunction<{ username: string; configured: boolean }>({ action: 'bot' });
  if (!result.configured || !result.username) throw new Error('O robô do Telegram ainda não foi configurado no servidor.');
  return result.username;
}

export async function removePanicContact(id: string): Promise<void> {
  const db = client();
  if (!db) return;
  await db.from('panic_contacts').delete().eq('id', id);
}

async function callFunction<T>(body: Record<string, unknown>): Promise<T> {
  const db = client();
  if (!db) throw new Error('Entre na sua conta para usar o pânico.');
  const { data, error } = await db.functions.invoke('panic-alert', { body });
  if (error) throw new Error('Servidor do pânico indisponível. Verifique a internet.');
  return data as T;
}

/** Cria a credencial do aparelho e entrega ao Android, que dispara mesmo com o app fechado. */
export async function activateSilentPanic(driverName: string): Promise<PanicStatus> {
  const { deviceId, secret } = await callFunction<{ deviceId: string; secret: string }>({
    action: 'register_device',
    driverName,
  });
  await nativePanic.requestLocation();
  return nativePanic.configure({
    endpoint: `${SUPABASE_URL}/functions/v1/panic-alert`,
    anonKey: SUPABASE_ANON_KEY,
    deviceId,
    secret,
  });
}

export async function sendPanicTest(driverName: string): Promise<{ total: number; sent: number; errors: string[] }> {
  return callFunction({ action: 'test', driverName });
}

export const callPolice = () => openExternal('tel:190');
