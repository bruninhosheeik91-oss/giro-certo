import { useEffect, useMemo, useState } from 'react';
import { useSession } from '../context/SessionContext';
import { getSupabaseClient } from '../lib/auth';
import {
  deriveSubscriptionAccess,
  shouldShowTrialExpiryNotice,
  type SubscriptionAccess,
} from '../lib/subscriptionAccess';

export function useSubscription() {
  const { userId, mode } = useSession();
  const [serverAccess, setServerAccess] = useState<SubscriptionAccess | null>(null);
  const [loading, setLoading] = useState(mode === 'cloud');

  useEffect(() => {
    if (mode !== 'cloud' || !userId) {
      setServerAccess(null);
      setLoading(false);
      return;
    }
    const client = getSupabaseClient();
    if (!client) {
      setLoading(false);
      return;
    }
    setServerAccess(null);
    setLoading(true);
    let active = true;
    void client.rpc('get_my_subscription_access').then((accessResult) => {
      if (!active) return;
      const access = accessResult.data;
      if (access && typeof access === 'object' && !Array.isArray(access)) {
        const value = access as Record<string, unknown>;
        setServerAccess({
          tier: value.tier === 'pro' ? 'pro' : 'essential',
          reason:
            value.reason === 'owner' || value.reason === 'trial' || value.reason === 'subscription'
              ? value.reason
              : 'essential',
          hasProAccess: value.hasProAccess === true,
          daysRemaining: typeof value.daysRemaining === 'number' ? value.daysRemaining : 0,
          expiresAt: typeof value.expiresAt === 'string' ? value.expiresAt : null,
          plan:
            value.plan === 'trial' || value.plan === 'monthly' || value.plan === 'annual'
              ? value.plan
              : null,
          provider:
            value.provider === 'google_play' ||
            value.provider === 'mercado_pago' ||
            value.provider === 'apple'
              ? value.provider
              : null,
          cancelAtPeriodEnd: value.cancelAtPeriodEnd === true,
        });
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [mode, userId]);

  return useMemo(() => {
    const access =
      mode === 'local'
        ? deriveSubscriptionAccess({})
        : (serverAccess ?? deriveSubscriptionAccess({}));
    return {
      loading,
      ...access,
      isAdmin: access.reason === 'owner',
      hasAccess: true,
      planTier: access.reason === 'owner' ? 'owner' : access.tier,
      showExpiryNotice: shouldShowTrialExpiryNotice(access),
    };
  }, [loading, mode, serverAccess]);
}
