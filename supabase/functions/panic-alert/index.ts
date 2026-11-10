import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';

/**
 * Pânico silencioso do Giro Certo.
 *
 * Ações:
 * - register_device (JWT do usuário): cria a credencial do aparelho usada pelo disparo nativo.
 * - test (JWT): envia uma mensagem de teste aos contatos.
 * - start / update / end (credencial do aparelho): abre o alerta, atualiza a posição e encerra.
 *
 * - bot (JWT): nome de usuário do bot, para montar o link de convite dos contatos.
 *
 * O envio usa o bot do Telegram (TELEGRAM_BOT_TOKEN), gratuito. Cada contato precisa abrir
 * o convite t.me/<bot>?start=<link_code> e tocar em Iniciar uma vez (função telegram-webhook).
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-panic-device, x-panic-secret',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const env = (name: string, fallback = '') => Deno.env.get(name) ?? fallback;

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function validCoord(lat: unknown, lng: unknown): lat is number {
  return typeof lat === 'number' && typeof lng === 'number' && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function shareLink(token: string, lat?: number | null, lng?: number | null): string {
  const base = env('PANIC_LIVE_BASE_URL').replace(/\/+$/, '');
  const project = new URL(env('SUPABASE_URL')).hostname.split('.')[0];
  if (base) return `${base}/panico.html?t=${token}&p=${project}`;
  if (typeof lat === 'number' && typeof lng === 'number') return `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
  return 'localização indisponível no momento';
}

export async function sendTelegram(chatId: number, text: string) {
  const token = env('TELEGRAM_BOT_TOKEN');
  if (!token) return { ok: false, error: 'Telegram não configurado no servidor' };
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: false }),
  });
  if (response.ok) return { ok: true };
  const detail = await response.text();
  return { ok: false, error: `${response.status}: ${detail.slice(0, 200)}` };
}

function alertText(driverName: string, link: string, test = false): string {
  if (test) {
    return `✅ TESTE do botão de pânico do Giro Certo.\n${driverName} confirmou que você vai receber os alertas por aqui. Não precisa fazer nada.`;
  }
  return `🚨 ALERTA DE PÂNICO 🚨\n${driverName} acionou o botão de pânico do Giro Certo e pode estar em perigo.\n\n📍 Acompanhe a localização: ${link}\n\nSe não conseguir falar com ${driverName}, ligue 190.`;
}

async function notifyContacts(admin: SupabaseClient, userId: string, text: string) {
  const { data: contacts } = await admin
    .from('panic_contacts')
    .select('name, telegram_chat_id')
    .eq('user_id', userId)
    .not('telegram_chat_id', 'is', null);
  const results = await Promise.all((contacts ?? []).map((c) => sendTelegram(Number(c.telegram_chat_id), text)));
  const errors = results.filter((r) => !r.ok).map((r) => r.error);
  return { total: contacts?.length ?? 0, sent: results.filter((r) => r.ok).length, errors };
}

async function authDevice(admin: SupabaseClient, request: Request) {
  const userId = request.headers.get('x-panic-device') ?? '';
  const secret = request.headers.get('x-panic-secret') ?? '';
  if (!userId || !secret) return null;
  const { data } = await admin.from('panic_devices').select('user_id, secret_hash, driver_name').eq('user_id', userId).maybeSingle();
  if (!data || data.secret_hash !== (await sha256(secret))) return null;
  return data as { user_id: string; driver_name: string };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const url = env('SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = env('SUPABASE_ANON_KEY');
  if (!url || !serviceKey || !anonKey) return json({ error: 'Servidor indisponível.' }, 503);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON inválido.' }, 400);
  }
  const action = String(body.action ?? '');

  // Ações do usuário logado (feitas pelo app aberto)
  if (action === 'register_device' || action === 'test' || action === 'bot') {
    const authorization = request.headers.get('Authorization') ?? '';
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData.user;
    if (!user) return json({ error: 'Autenticação necessária.' }, 401);
    const driverName = String(body.driverName ?? '').trim().slice(0, 60) || 'Motorista';

    if (action === 'bot') {
      const username = env('TELEGRAM_BOT_USERNAME').replace(/^@/, '');
      return json({ username, configured: Boolean(username && env('TELEGRAM_BOT_TOKEN')) });
    }

    if (action === 'register_device') {
      const secret = randomSecret();
      const { error } = await admin.from('panic_devices').upsert({
        user_id: user.id,
        secret_hash: await sha256(secret),
        driver_name: driverName,
      });
      if (error) return json({ error: 'Não foi possível ativar o pânico.' }, 500);
      return json({ deviceId: user.id, secret });
    }

    const result = await notifyContacts(admin, user.id, alertText(driverName, '', true));
    return json(result);
  }

  // Ações do aparelho (disparo nativo, inclusive com o app fechado)
  const device = await authDevice(admin, request);
  if (!device) return json({ error: 'Aparelho não autorizado.' }, 401);
  const lat = body.lat;
  const lng = body.lng;
  const accuracy = typeof body.accuracy === 'number' ? body.accuracy : null;
  const hasPoint = validCoord(lat, lng);

  if (action === 'start') {
    const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: recent } = await admin
      .from('panic_alerts')
      .select('id, share_token')
      .eq('user_id', device.user_id)
      .is('ended_at', null)
      .gte('started_at', since)
      .maybeSingle();
    if (recent) return json({ alertId: recent.id, reused: true });

    const { data: alert, error } = await admin
      .from('panic_alerts')
      .insert({
        user_id: device.user_id,
        driver_name: device.driver_name,
        last_lat: hasPoint ? lat : null,
        last_lng: hasPoint ? (lng as number) : null,
        last_accuracy: accuracy,
        last_at: hasPoint ? new Date().toISOString() : null,
      })
      .select('id, share_token')
      .single();
    if (error || !alert) return json({ error: 'Não foi possível registrar o alerta.' }, 500);
    if (hasPoint) await admin.from('panic_locations').insert({ alert_id: alert.id, lat, lng, accuracy });

    const link = shareLink(alert.share_token, hasPoint ? lat : null, hasPoint ? (lng as number) : null);
    const result = await notifyContacts(admin, device.user_id, alertText(device.driver_name, link));
    await admin
      .from('panic_alerts')
      .update({ notified_count: result.sent, notify_errors: result.errors.join(' | ') || null })
      .eq('id', alert.id);
    return json({ alertId: alert.id, ...result });
  }

  const alertId = String(body.alertId ?? '');
  const { data: alert } = await admin
    .from('panic_alerts')
    .select('id, ended_at')
    .eq('id', alertId)
    .eq('user_id', device.user_id)
    .maybeSingle();
  if (!alert) return json({ error: 'Alerta não encontrado.' }, 404);

  if (action === 'update') {
    if (alert.ended_at) return json({ ended: true });
    if (!hasPoint) return json({ error: 'Posição inválida.' }, 400);
    await admin.from('panic_locations').insert({ alert_id: alert.id, lat, lng, accuracy });
    await admin
      .from('panic_alerts')
      .update({ last_lat: lat, last_lng: lng, last_accuracy: accuracy, last_at: new Date().toISOString() })
      .eq('id', alert.id);
    return json({ ok: true });
  }

  if (action === 'end') {
    const { data: closed } = await admin
      .from('panic_alerts')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', alert.id)
      .is('ended_at', null)
      .select('driver_name')
      .maybeSingle();
    if (closed) {
      await notifyContacts(admin, device.user_id, `✅ ${closed.driver_name} encerrou o alerta de pânico e informou que está bem.`);
    }
    return json({ ok: true });
  }

  return json({ error: 'Ação desconhecida.' }, 400);
});
