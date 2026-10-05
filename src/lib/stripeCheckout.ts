import { getSupabaseClient } from './auth';
import type { BillingPlanId } from './billingCatalog';

type CheckoutResponse = { url?: unknown; error?: unknown };

export async function startStripeCheckout(plan: BillingPlanId): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Entre na sua conta para assinar o Pro.');

  const { data, error } = await client.functions.invoke<CheckoutResponse>(
    'create-stripe-checkout',
    {
      body: { plan },
    },
  );
  if (error) throw new Error('Não foi possível abrir o pagamento. Tente novamente.');
  if (data?.error && typeof data.error === 'string') throw new Error(data.error);
  if (!data?.url || typeof data.url !== 'string') {
    throw new Error('O endereço de pagamento não foi recebido.');
  }

  window.location.assign(data.url);
}

export async function scheduleStripeAnnual(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Entre na sua conta para alterar o plano.');
  const { data, error } = await client.functions.invoke<{ scheduled?: boolean; error?: string }>('schedule-stripe-annual', { body: {} });
  if (error) throw new Error('Não foi possível agendar a mudança.');
  if (data?.error) throw new Error(data.error);
}
