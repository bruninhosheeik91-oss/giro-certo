import { useEffect, useMemo, useState } from 'react';
import { useSession } from '../context/SessionContext';
import { getSupabaseClient } from '../lib/auth';
import type { Database } from '../lib/database.types';

export type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row'];

export function useSubscription() {
  const { userId, mode } = useSession();
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(mode === 'cloud');

  useEffect(() => {
    if (mode !== 'cloud' || !userId) { setLoading(false); return; }
    const client = getSupabaseClient();
    if (!client) { setLoading(false); return; }
    let active = true;
    void Promise.all([
      client.from('subscriptions').select('*').eq('user_id', userId).maybeSingle(),
      client.rpc('is_giro_certo_admin'),
    ]).then(([subscriptionResult, adminResult]) => {
      if (!active) return;
      setSubscription(subscriptionResult.data);
      setIsAdmin(adminResult.data === true);
      setLoading(false);
    });
    return () => { active = false; };
  }, [mode, userId]);

  return useMemo(() => {
    const now = Date.now();
    const trialEnd = subscription ? Date.parse(subscription.trial_ends_at) : 0;
    const periodEnd = subscription?.current_period_end ? Date.parse(subscription.current_period_end) : 0;
    const hasProAccess = mode === 'local' || isAdmin || !!subscription && (
      subscription.status === 'trialing' && trialEnd > now ||
      subscription.status === 'active' && periodEnd > now
    );
    const daysRemaining = subscription?.status === 'trialing'
      ? Math.max(0, Math.ceil((trialEnd - now) / 86_400_000))
      : 0;
    const planTier = isAdmin ? 'owner' : hasProAccess ? 'pro' : 'essential';
    return {
      subscription,
      loading,
      isAdmin,
      hasAccess: hasProAccess,
      hasProAccess,
      planTier,
      daysRemaining,
    };
  }, [isAdmin, loading, mode, subscription]);
}
