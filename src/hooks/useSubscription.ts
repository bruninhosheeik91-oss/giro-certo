import { useEffect, useMemo, useState } from 'react';
import { useSession } from '../context/SessionContext';
import { getSupabaseClient } from '../lib/auth';
import type { Database } from '../lib/database.types';
import {
  deriveSubscriptionAccess,
  shouldShowTrialExpiryNotice,
  type SubscriptionAccess,
} from '../lib/subscriptionAccess';

export type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row'];

export function useSubscription() {
  const { userId, mode } = useSession();
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [serverAccess, setServerAccess] = useState<SubscriptionAccess | null>(null);
  const [loading, setLoading] = useState(mode === 'cloud');

  useEffect(() => {
    if (mode !== 'cloud' || !userId) {
      setSubscription(null);
      setServerAccess(null);
      setLoading(false);
      return;
    }
    const client = getSupabaseClient();
    if (!client) {
      setLoading(false);
      return;
    }
    setSubscription(null);
    setServerAccess(null);
    setLoading(true);
    let active = true;
    void Promise.all([
      client.from('subscriptions').select('*').eq('user_id', userId).maybeSingle(),
      client.rpc('get_my_subscription_access'),
    ]).then(([subscriptionResult, accessResult]) => {
      if (!active) return;
      setSubscription(subscriptionResult.data);
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
        : (serverAccess ??
          deriveSubscriptionAccess({
            status: subscription?.status,
            trialEndsAt: subscription?.trial_ends_at,
            currentPeriodEnd: subscription?.current_period_end,
          }));
    return {
      subscription,
      loading,
      ...access,
      isAdmin: access.reason === 'owner',
      hasAccess: true,
      planTier: access.reason === 'owner' ? 'owner' : access.tier,
      showExpiryNotice: shouldShowTrialExpiryNotice(access),
    };
  }, [loading, mode, serverAccess, subscription]);
}
