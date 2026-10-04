import Stripe from 'npm:stripe@22.0.0';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!stripeKey || !supabaseUrl || !anonKey) {
    return json({ error: 'Cobrança temporariamente indisponível.' }, 503);
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'Autenticação necessária.' }, 401);

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;
  if (userError || !user) return json({ error: 'Sessão inválida ou expirada.' }, 401);

  let payload: { plan?: unknown };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Requisição inválida.' }, 400);
  }

  const plan = payload.plan === 'monthly' || payload.plan === 'annual' ? payload.plan : null;
  if (!plan) return json({ error: 'Plano inválido.' }, 400);

  const priceId = Deno.env.get(
    plan === 'monthly' ? 'STRIPE_MONTHLY_PRICE_ID' : 'STRIPE_ANNUAL_PRICE_ID',
  );
  if (!priceId) return json({ error: 'Preço do plano não configurado.' }, 503);

  const { data: current } = await supabase
    .from('subscriptions')
    .select('status,current_period_end,provider_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();

  const periodEnd = current?.current_period_end ? Date.parse(current.current_period_end) : 0;
  if (current?.status === 'active' && periodEnd > Date.now()) {
    return json({ error: 'Você já possui uma assinatura Pro ativa.' }, 409);
  }

  const stripe = new Stripe(stripeKey);
  const returnUrl = `${supabaseUrl}/functions/v1/stripe-return`;
  const customer =
    current?.provider_customer_id?.startsWith('cus_') ? current.provider_customer_id : undefined;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      customer,
      customer_email: customer ? undefined : user.email,
      locale: 'pt-BR',
      success_url: `${returnUrl}?status=success`,
      cancel_url: `${returnUrl}?status=cancel`,
      metadata: { user_id: user.id, plan },
      subscription_data: { metadata: { user_id: user.id, plan } },
    });

    if (!session.url) return json({ error: 'A Stripe não retornou o checkout.' }, 502);
    return json({ url: session.url });
  } catch (error) {
    console.error('stripe checkout error', error);
    return json({ error: 'Não foi possível abrir o pagamento.' }, 502);
  }
});
