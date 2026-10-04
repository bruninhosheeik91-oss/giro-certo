export type BillingPlanId = 'monthly' | 'annual';
export type BillingProvider = 'google_play' | 'stripe';
export type DistributionChannel = 'google_play' | 'direct';

export interface BillingPlan {
  id: BillingPlanId;
  title: string;
  price: number;
  periodLabel: string;
  savingsLabel?: string;
  googlePlayProductId: string;
  googlePlayBasePlanId: BillingPlanId;
}

export const BILLING_PLANS: readonly BillingPlan[] = [
  {
    id: 'monthly',
    title: 'Pro Mensal',
    price: 19.9,
    periodLabel: 'por mês',
    googlePlayProductId: 'giro_certo_pro',
    googlePlayBasePlanId: 'monthly',
  },
  {
    id: 'annual',
    title: 'Pro Anual',
    price: 159.9,
    periodLabel: 'por ano',
    savingsLabel: 'Economize R$ 78,90 por ano',
    googlePlayProductId: 'giro_certo_pro',
    googlePlayBasePlanId: 'annual',
  },
] as const;

export function formatBillingPrice(price: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(price);
}

export function getDistributionChannel(
  configuredChannel = import.meta.env.VITE_DISTRIBUTION_CHANNEL,
): DistributionChannel {
  return configuredChannel === 'google_play' ? 'google_play' : 'direct';
}

export function getBillingProvider(channel: DistributionChannel): BillingProvider {
  return channel === 'google_play' ? 'google_play' : 'stripe';
}

export function isBillingEnabled(
  channel: DistributionChannel,
  googlePlayEnabled = import.meta.env.VITE_GOOGLE_PLAY_BILLING_ENABLED,
  stripeEnabled = import.meta.env.VITE_STRIPE_BILLING_ENABLED,
): boolean {
  return channel === 'google_play' ? googlePlayEnabled === 'true' : stripeEnabled === 'true';
}
