import { describe, expect, it } from 'vitest';
import {
  BILLING_PLANS,
  formatBillingPrice,
  getBillingProvider,
  getDistributionChannel,
  isBillingEnabled,
} from './billingCatalog';

describe('billing catalog', () => {
  it('keeps the approved monthly and annual prices', () => {
    expect(BILLING_PLANS.map(({ id, price }) => ({ id, price }))).toEqual([
      { id: 'monthly', price: 19.9 },
      { id: 'annual', price: 159.9 },
    ]);
    expect(formatBillingPrice(19.9)).toBe('R$ 19,90');
  });

  it('uses Stripe for direct builds and Play Billing for store builds', () => {
    expect(getDistributionChannel(undefined)).toBe('direct');
    expect(getDistributionChannel('google_play')).toBe('google_play');
    expect(getBillingProvider('direct')).toBe('stripe');
    expect(getBillingProvider('google_play')).toBe('google_play');
  });

  it('never enables checkout without an explicit provider flag', () => {
    expect(isBillingEnabled('direct', undefined, undefined)).toBe(false);
    expect(isBillingEnabled('google_play', undefined, undefined)).toBe(false);
    expect(isBillingEnabled('direct', undefined, 'true')).toBe(true);
    expect(isBillingEnabled('google_play', 'true', undefined)).toBe(true);
  });
});
