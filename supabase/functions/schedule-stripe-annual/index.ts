import Stripe from 'npm:stripe@22.0.0';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const headers = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Content-Type':'application/json'};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const annualPrice = Deno.env.get('STRIPE_ANNUAL_PRICE_ID');
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');
  if (!stripeKey || !annualPrice || !url || !anon || !service) return json({ error: 'Configuração indisponível.' }, 503);
  if (!authorization) return json({ error: 'Autenticação necessária.' }, 401);
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData.user) return json({ error: 'Sessão inválida.' }, 401);
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: current } = await admin.from('subscriptions').select('status,plan,provider,provider_subscription_id,pending_plan').eq('user_id', userData.user.id).maybeSingle();
  if (!current || current.status !== 'active' || current.plan !== 'monthly' || current.provider !== 'stripe' || !current.provider_subscription_id) return json({ error: 'Assinatura mensal ativa não encontrada.' }, 409);
  if (current.pending_plan === 'annual') return json({ scheduled: true });
  try {
    const stripe = new Stripe(stripeKey);
    const subscription = await stripe.subscriptions.retrieve(current.provider_subscription_id);
    const item = subscription.items.data[0];
    if (!item) return json({ error: 'Item da assinatura não encontrado.' }, 409);
    const schedule = await stripe.subscriptionSchedules.create({ from_subscription: subscription.id });
    await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: 'release',
      phases: [
        { start_date: item.current_period_start, end_date: item.current_period_end, items: [{ price: item.price.id, quantity: item.quantity ?? 1 }], proration_behavior: 'none' },
        { start_date: item.current_period_end, items: [{ price: annualPrice, quantity: item.quantity ?? 1 }], iterations: 1, proration_behavior: 'none' },
      ],
    });
    const changeAt = new Date(item.current_period_end * 1000).toISOString();
    const { error } = await admin.from('subscriptions').update({ pending_plan: 'annual', pending_change_at: changeAt, updated_at: new Date().toISOString() }).eq('user_id', userData.user.id);
    if (error) throw error;
    return json({ scheduled: true, changeAt });
  } catch (error) {
    console.error('schedule annual error', error);
    return json({ error: 'Não foi possível agendar a mudança para o anual.' }, 502);
  }
});
