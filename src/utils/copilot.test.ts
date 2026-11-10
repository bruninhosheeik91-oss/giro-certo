import { describe, expect, it } from 'vitest';
import { analyzeRideCapture } from './copilot';
import type { NativeCaptureResult } from '../lib/rideOffer';
import type { RideCriteria } from '../types';

const criteria: RideCriteria = {
  minProfitPerKm: 0.8,
  minProfitPerHour: 25,
  minAcceptableValue: 8,
  considerReturnDistance: true,
};

function capture(overrides: Partial<NativeCaptureResult> = {}): NativeCaptureResult {
  return {
    appName: 'Uber',
    packageName: 'com.ubercab.driver',
    rawText: 'R$ 28,50 · 2,5 km · 8 km · 25 min',
    fareOffered: 28.5,
    distanceToPickupKm: 2.5,
    tripDistanceKm: 8,
    pickupMinutes: 5,
    tripMinutes: 20,
    complete: true,
    capturedAt: 1000,
    fullScreen: false,
    ...overrides,
  };
}

describe('analyzeRideCapture', () => {
  it('calcula valor bruto por km, por hora, lucro e margem com os custos configurados', () => {
    const analysis = analyzeRideCapture(capture(), { costPerKm: 0.28, criteria });

    expect(analysis.complete).toBe(true);
    expect(analysis.totalDistanceKm).toBe(10.5);
    expect(analysis.totalMinutes).toBe(25);
    expect(analysis.result).not.toBeNull();
    expect(analysis.result!.revenuePerKm).toBeCloseTo(28.5 / 10.5, 5);
    expect(analysis.result!.revenuePerHour).toBeCloseTo(28.5 / (25 / 60), 5);
    expect(analysis.result!.estimatedProfit).toBeCloseTo(28.5 - 10.5 * 0.28, 5);
    expect(analysis.result!.marginPercent).toBeCloseTo(
      ((28.5 - 10.5 * 0.28) / 28.5) * 100,
      5,
    );
  });

  it('informa análise incompleta quando falta distância e não inventa resultado', () => {
    const analysis = analyzeRideCapture(
      capture({ distanceToPickupKm: undefined, tripDistanceKm: undefined, complete: false }),
      { costPerKm: 0.28, criteria },
    );

    expect(analysis.complete).toBe(false);
    expect(analysis.result).toBeNull();
    expect(analysis.missing).toContain('distância');
    expect(analysis.reason.length).toBeGreaterThan(0);
  });

  it('usa o motivo nativo quando presente', () => {
    const analysis = analyzeRideCapture(
      capture({
        fareOffered: undefined,
        complete: false,
        incompleteReason: 'Análise incompleta: valor não identificado(s) na tela.',
      }),
      { costPerKm: 0.28, criteria },
    );

    expect(analysis.complete).toBe(false);
    expect(analysis.reason).toContain('valor');
  });
});
