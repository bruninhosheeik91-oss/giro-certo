import { describe, expect, it } from 'vitest';
import { deriveSubscriptionAccess, shouldShowTrialExpiryNotice } from './subscriptionAccess';

const now = Date.parse('2026-10-01T12:00:00Z');

describe('deriveSubscriptionAccess', () => {
  it('keeps the essential tier available after a trial expires', () => {
    const access = deriveSubscriptionAccess({
      status: 'trialing',
      trialEndsAt: '2026-09-30T12:00:00Z',
      now,
    });
    expect(access).toMatchObject({ tier: 'essential', hasProAccess: false });
  });

  it('keeps Pro locked during the trial and warns in the last three days', () => {
    const access = deriveSubscriptionAccess({
      status: 'trialing',
      trialEndsAt: '2026-10-03T12:00:00Z',
      now,
    });
    expect(access).toMatchObject({
      tier: 'essential',
      reason: 'trial',
      hasProAccess: false,
      daysRemaining: 2,
    });
    expect(shouldShowTrialExpiryNotice(access)).toBe(true);
  });

  it('always grants Pro to the owner', () => {
    expect(deriveSubscriptionAccess({ status: 'expired', isOwner: true, now })).toMatchObject({
      tier: 'pro',
      reason: 'owner',
      hasProAccess: true,
    });
  });

  it('grants Pro to an active paid subscription', () => {
    expect(
      deriveSubscriptionAccess({
        status: 'active',
        currentPeriodEnd: '2026-11-01T12:00:00Z',
        now,
      }),
    ).toMatchObject({ tier: 'pro', reason: 'subscription', hasProAccess: true });
  });
});
