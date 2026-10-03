export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'expired' | 'canceled';

export type SubscriptionAccessReason = 'owner' | 'trial' | 'subscription' | 'essential';

export interface SubscriptionAccess {
  tier: 'essential' | 'pro';
  reason: SubscriptionAccessReason;
  hasProAccess: boolean;
  daysRemaining: number;
  expiresAt: string | null;
  plan: 'trial' | 'monthly' | 'annual' | null;
  provider: 'google_play' | 'mercado_pago' | 'apple' | null;
  cancelAtPeriodEnd: boolean;
}

interface SubscriptionAccessInput {
  status?: SubscriptionStatus | null;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
  isOwner?: boolean;
  now?: number;
}

export function deriveSubscriptionAccess({
  status,
  trialEndsAt,
  currentPeriodEnd,
  isOwner = false,
  now = Date.now(),
}: SubscriptionAccessInput): SubscriptionAccess {
  if (isOwner) {
    return {
      tier: 'pro',
      reason: 'owner',
      hasProAccess: true,
      daysRemaining: 0,
      expiresAt: null,
      plan: null,
      provider: null,
      cancelAtPeriodEnd: false,
    };
  }

  const trialEnd = trialEndsAt ? Date.parse(trialEndsAt) : 0;
  if (status === 'trialing' && trialEnd > now) {
    return {
      tier: 'essential',
      reason: 'trial',
      hasProAccess: false,
      daysRemaining: Math.max(1, Math.ceil((trialEnd - now) / 86_400_000)),
      expiresAt: trialEndsAt ?? null,
      plan: 'trial',
      provider: null,
      cancelAtPeriodEnd: false,
    };
  }

  const periodEnd = currentPeriodEnd ? Date.parse(currentPeriodEnd) : 0;
  if (status === 'active' && periodEnd > now) {
    return {
      tier: 'pro',
      reason: 'subscription',
      hasProAccess: true,
      daysRemaining: 0,
      expiresAt: currentPeriodEnd ?? null,
      plan: null,
      provider: null,
      cancelAtPeriodEnd: false,
    };
  }

  return {
    tier: 'essential',
    reason: 'essential',
    hasProAccess: false,
    daysRemaining: 0,
    expiresAt: null,
    plan: null,
    provider: null,
    cancelAtPeriodEnd: false,
  };
}

export function shouldShowTrialExpiryNotice(access: SubscriptionAccess): boolean {
  return access.reason === 'trial' && access.daysRemaining <= 3;
}
