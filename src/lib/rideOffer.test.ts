import { describe, expect, it } from 'vitest';
import { parseRideOfferNotification } from './rideOffer';

describe('parseRideOfferNotification', () => {
  it('reconhece valor, coleta, viagem e tempo em uma oferta', () => {
    const parsed = parseRideOfferNotification({
      packageName: 'com.ubercab.driver',
      appName: 'Uber',
      title: 'Nova oportunidade · R$ 28,50',
      text: '2,5 km até a coleta · viagem 8 km · 25 min',
      receivedAt: 1,
    });

    expect(parsed.fareOffered).toBe(28.5);
    expect(parsed.distanceToPickup).toBe(2.5);
    expect(parsed.tripDistance).toBe(8);
    expect(parsed.estimatedMinutes).toBe(25);
  });

  it('mantém campos ausentes indefinidos para revisão manual', () => {
    const parsed = parseRideOfferNotification({
      packageName: 'br.com.app', appName: '99', title: 'Nova corrida', text: 'R$ 12,00', receivedAt: 2,
    });
    expect(parsed.fareOffered).toBe(12);
    expect(parsed.tripDistance).toBeUndefined();
  });
});
