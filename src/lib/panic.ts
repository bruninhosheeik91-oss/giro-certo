import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient, SUPABASE_ANON_KEY, SUPABASE_URL } from './auth';
import { nativePanic, openExternal, type PanicStatus } from './securityCamera';

export interface PanicContact {
  id: string;
  name: string;
  phone: string;
}

export const MAX_PANIC_CONTACTS = 5;

/** Normaliza para o formato internacional usado pelo WhatsApp (55 + DDD + número). */
export function normalizeBrazilPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  return `55${digits.replace(/^0+/, '')}`;
}

export function isValidBrazilPhone(raw: string): boolean {
  return /^55\d{10,11}$/.test(normalizeBrazilPhone(raw));
}

export function formatPhone(phone: string): string {
  const d = phone.replace(/^55/, '');
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
}

function client(): SupabaseClient | null {
  return getSupabaseClient() as unknown as SupabaseClient | null;
}

export async function listPanicContacts(): Promise<PanicContact[]> {
  const db = client();
  if (!db) return [];
  const { data, error } = await db.from('panic_contacts').select('id, name, phone').order('created_at');
  if (error) throw new Error('Não foi possível carregar os contatos.');
  return (data ?? []) as PanicContact[];
}

export async function addPanicContact(name: string, phone: string): Promise<void> {
  const db = client();
  if (!db) throw new Error('Entre na sua conta para usar o pânico.');
  const { error } = await db.from('panic_contacts').insert({ name: name.trim() || 'Contato', phone: normalizeBrazilPhone(phone) });
  if (error) {
    throw new Error(
      error.message.includes('Limite') ? `Máximo de ${MAX_PANIC_CONTACTS} contatos.`
        : error.code === '23505' ? 'Esse número já está cadastrado.'
        : 'Não foi possível salvar o contato.',
    );
  }
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
