import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

/**
 * Webhook do bot do Giro Certo no Telegram.
 * Quando o contato abre t.me/<bot>?start=<link_code> e toca em Iniciar, o Telegram envia
 * "/start <link_code>". Gravamos o chat_id no contato e confirmamos.
 * Protegido pelo cabeçalho X-Telegram-Bot-Api-Secret-Token (TELEGRAM_WEBHOOK_SECRET).
 */

const env = (name: string) => Deno.env.get(name) ?? '';

async function reply(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${env('TELEGRAM_BOT_TOKEN')}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('ok');
  const secret = env('TELEGRAM_WEBHOOK_SECRET');
  if (!secret || request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== secret) {
    return new Response('forbidden', { status: 403 });
  }

  const update = await request.json().catch(() => null);
  const message = update?.message;
  const chatId: number | undefined = message?.chat?.id;
  const text: string = message?.text ?? '';
  if (!chatId) return new Response('ok');

  const code = text.match(/^\/start\s+([0-9a-f]{32})$/i)?.[1];
  if (!code) {
    await reply(
      chatId,
      'Olá! Este é o robô de segurança do Giro Certo. Para receber alertas de um motorista, abra o link de convite que ele te enviou.',
    );
    return new Response('ok');
  }

  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const { data: contact } = await admin
    .from('panic_contacts')
    .update({ telegram_chat_id: chatId, linked_at: new Date().toISOString() })
    .eq('link_code', code.toLowerCase())
    .select('user_id')
    .maybeSingle();

  if (!contact) {
    await reply(chatId, 'Este convite não é mais válido. Peça um novo link ao motorista.');
    return new Response('ok');
  }
  const { data: device } = await admin.from('panic_devices').select('driver_name').eq('user_id', contact.user_id).maybeSingle();
  const driver = device?.driver_name ?? 'o motorista';
  await reply(
    chatId,
    `✅ Pronto! Você agora é contato de emergência de ${driver} no Giro Certo.\nSe ${driver} acionar o botão de pânico, você recebe aqui a localização em tempo real. Mantenha as notificações do Telegram ligadas.`,
  );
  return new Response('ok');
});
