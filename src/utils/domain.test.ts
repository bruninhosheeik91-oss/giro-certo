import { describe, it, expect } from 'vitest';
import {
  calculateShiftTotals,
  calculateReserveBalance,
  reconcileVehicleOdometer,
  simulateRide,
  openFuelCycleLabel,
  parseBRLInput,
  parseDecimalInput,
} from './calculations';
import { Transaction, MaintenanceReserveEntry, OdometerRecord } from '../types';

describe('calculateShiftTotals', () => {
  it('derives gain and expense from linked transactions', () => {
    const txs = [
      { type: 'ganho', shiftId: 's1', amount: 100 },
      { type: 'abastecimento', shiftId: 's1', amount: 20 },
      { type: 'ganho', shiftId: 's2', amount: 50 },
    ] as Transaction[];
    expect(calculateShiftTotals(txs, 's1')).toEqual({ gain: 100, expense: 20 });
    expect(calculateShiftTotals(txs, 's2')).toEqual({ gain: 50, expense: 0 });
  });
});

describe('calculateReserveBalance', () => {
  it('computes balance from ledger with deposits, withdraws and adjustments', () => {
    const entries = [
      { type: 'deposito', amount: 100 },
      { type: 'resgate', amount: 30 },
      { type: 'ajuste', amount: -10 },
    ] as MaintenanceReserveEntry[];
    expect(calculateReserveBalance(entries)).toBe(60);
  });

  it('never counts negative deposit amounts', () => {
    const entries = [
      { type: 'deposito', amount: -50 },
    ] as MaintenanceReserveEntry[];
    expect(calculateReserveBalance(entries)).toBe(0);
  });
});

describe('reconcileVehicleOdometer', () => {
  it('keeps the highest chronologically valid reading, never regressing', () => {
    const records = [
      { date: '2026-09-01', km: 42150, sourceId: 'a' },
      { date: '2026-09-02', km: 42100, sourceId: 'b' }, // regression -> anomaly
      { date: '2026-09-03', km: 42300, sourceId: 'c' },
    ] as OdometerRecord[];
    const result = reconcileVehicleOdometer(records, 42118);
    expect(result.currentKm).toBe(42300);
    expect(result.anomalies).toHaveLength(1);
    expect(result.anomalies[0].sourceId).toBe('b');
  });

  it('uses initialKm as floor when no record is higher', () => {
    const records = [
      { date: '2026-09-01', km: 20000, sourceId: 'a' },
    ] as OdometerRecord[];
    expect(reconcileVehicleOdometer(records, 42118).currentKm).toBe(42118);
  });

  it('ignores non-finite records', () => {
    const records = [
      { date: '2026-09-01', km: Infinity, sourceId: 'a' },
      { date: '2026-09-01', km: NaN, sourceId: 'b' },
    ] as OdometerRecord[];
    expect(reconcileVehicleOdometer(records, 42118).currentKm).toBe(42118);
  });
});

describe('simulateRide', () => {
  const baseInput = {
    fareOffered: 25,
    distanceToPickup: 2,
    tripDistance: 8,
    returnDistance: 2,
    estimatedMinutes: 25,
    costPerKm: 0.28,
  };

  it('accepts a profitable ride', () => {
    const res = simulateRide(baseInput);
    expect(res.status).toBe('Compensa');
    expect(res.totalDistance).toBe(12);
    expect(res.estimatedProfit).toBeGreaterThan(0);
  });

  it('rejects rides below the configured minimum profit', () => {
    const res = simulateRide({
      ...baseInput,
      fareOffered: 8,
      tripDistance: 12,
      returnDistance: 6,
      estimatedMinutes: 40,
      costPerKm: 0.5,
    });
    expect(res.status).toBe('Não compensa');
  });

  it('handles zero fare gracefully (never NaN)', () => {
    const res = simulateRide({ ...baseInput, fareOffered: 0 });
    expect(res.status).toBe('Não compensa');
    expect(Number.isFinite(res.profitPerKm)).toBe(true);
  });
});

describe('parseDecimalInput', () => {
  it('parses pt-BR decimals', () => {
    expect(parseDecimalInput('1.250,50')).toBe(1250.5);
    expect(parseDecimalInput('0,12')).toBe(0.12);
    expect(parseDecimalInput('42118')).toBe(42118);
    expect(parseDecimalInput('1,5')).toBe(1.5);
    expect(parseDecimalInput('')).toBe(0);
  });

  it('parses plain/en decimals as number inputs expose them', () => {
    expect(parseDecimalInput('2.5')).toBe(2.5);
    expect(parseDecimalInput('0.12')).toBe(0.12);
    expect(parseDecimalInput('28.50')).toBe(28.5);
    expect(parseDecimalInput('5400')).toBe(5400);
  });
});

describe('openFuelCycleLabel', () => {
  it('renders helper text for open cycles', () => {
    expect(
      openFuelCycleLabel({ startDate: '2026-09-01', startKm: 43200, liters: 0, totalAmount: 0 }),
    ).toContain('43.200 km');
    expect(openFuelCycleLabel(null)).toBe('');
  });
});

describe('parseBRLInput edge', () => {
  it('never leaks NaN or Infinity', () => {
    expect(parseBRLInput(Infinity)).toBe(0);
    expect(parseBRLInput('abc')).toBe(0);
  });
});