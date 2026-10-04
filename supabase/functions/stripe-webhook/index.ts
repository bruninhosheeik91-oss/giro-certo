import Stripe from 'npm:stripe@22.0.0';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const stripe = new Stripe(stripeKey);
const cryptoProvider = Stripe.createSubtleCryptoProvider();

type StoredStatus = 'active' | 'past_due' | 'canceled';

function storedStatus(status: Stripe.Subscription.Status): StoredStatus {
  if (status === 'active' || status === 'trialing') return 'active';
  if (status === 'canceled') return 'canceled';
  return 'past_due';
}

async function syncSubscription(
  subscription: Stripe.Subscription,
  supabase: ReturnType<typeof createClient>,
) {
  const item = subscription.items.data[0];
  const userId = subscription.metadata.user_id;
  if (!item || !userId) throw new Error('Assinatura Stripe sem user_id ou item.');

  const monthlyPrice = Deno.env.get('STRIPE_MONTHLY_PRICE_ID');
  const annualPrice = Deno.env.get('STRIPE_ANNUAL_PRICE_ID');
  const priceId = item.price.id;
  const plan = priceId === annualPrice ? 'annual' : priceId === monthlyPrice ? 'monthly' : null;
  if (!plan) throw new Error(`Preço Stripe não reconhecido: ${priceId}`);

  const periodEndSeconds = item.current_period_end;
  const currentPeriodEnd = new Date(periodEndSeconds * 1000).toISOString();
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

  const { error } = await supabase.from('subscriptions').upsert(
    {
      user_id: userId,
      status: storedStatus(subscription.status),
      plan,
      provider: 'stripe',
      product_id: priceId,
      provider_subscription_id: subscription.id,
      provider_customer_id: customerId,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: subscription.cancel_at_period_end,
      last_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
  return userId;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const signature = request.headers.get('Stripe-Signature');
  if (!signature || !stripeKey || !webhookSecret) {
    return new Response('Webhook not configured', { status: 503 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      await request.text(),
      signature,
      webhookSecret,
      undefined,
      cryptoProvider,
    );
  } catch (error) {
    console.error('invalid stripe signature', error);
    return new Response('Invalid signature', { status: 400 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRole) return new Response('Backend not configured', { status: 503 });
  const supabase = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

  const { error: insertError } = await supabase.from('billing_events').insert({
    provider: 'stripe',
    provider_event_id: event.id,
    event_type: event.type,
  });
  if (insertError?.code === '23505') return Response.json({ received: true, duplicate: true });
  if (insertError) return new Response('Could not persist event', { status: 500 });

  try {
    let userId: string | null = null;
    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      userId = await syncSubscription(event.data.object as Stripe.Subscription, supabase);
    } else if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const subscriptionId =
        typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
      if (subscriptionId) {
        userId = await syncSubscription(await stripe.subscriptions.retrieve(subscriptionId), supabase);
      }
    }

    await supabase
      .from('billing_events')
      .update({ processed_at: new Date().toISOString(), user_id: userId })
      .eq('provider', 'stripe')
      .eq('provider_event_id', event.id);
    return Response.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown processing error';
    console.error('stripe webhook processing error', error);
    await supabase
      .from('billing_events')
      .update({ processing_error: message })
      .eq('provider', 'stripe')
      .eq('provider_event_id', event.id);
    return new Response('Webhook processing failed', { status: 500 });
  }
});
