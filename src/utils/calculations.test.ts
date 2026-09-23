import { describe, it, expect } from 'vitest';
import {
  parseBRLInput,
  formatBRLInput,
  formatBRL,
  calculateFuelConsumption,
} from './calculations';
import { FuelTransaction } from '../types';

describe('parseBRLInput', () => {
  it('parses numbers and strings to cents precision', () => {
    expect(parseBRLInput('10')).toBe(0.1);
    expect(parseBRLInput('10,50')).toBe(10.5);
    expect(parseBRLInput('1.234,56')).toBe(1234.56);
    expect(parseBRLInput('R$ 1.234,56')).toBe(1234.56);
    expect(parseBRLInput(1234.567)).toBe(1234.57);
    expect(parseBRLInput('')).toBe(0);
    expect(parseBRLInput(NaN)).toBe(0);
  });
});

describe('formatBRLInput', () => {
  it('masks BRL during typing', () => {
    expect(formatBRLInput('')).toBe('');
    expect(formatBRLInput('1')).toBe('0,01');
    expect(formatBRLInput('12')).toBe('0,12');
    expect(formatBRLInput('1250')).toBe('12,50');
    expect(formatBRLInput('150000')).toBe('1.500,00');
    expect(formatBRLInput('abc123')).toBe('1,23');
  });
});

describe('formatBRL', () => {
  it('formats BRL with pt-BR', () => {
    expect(formatBRL(0)).toContain('0,00');
    expect(formatBRL(1234.56)).toContain('1.234,56');
  });
});

describe('calculateFuelConsumption', () => {
  it('computes confirmed cycles from full tanks and partials in between', () => {
    const txs = [
      {
        type: 'abastecimento',
        id: 't1',
        date: '2026-09-01',
        time: '08:00',
        amount: 50,
        liters: 15,
        pricePerLiter: 3.333,
        stationName: 'Posto A',
        fuelType: 'Flex',
        fullTank: true,
        currentKm: 42150,
        vehicleId: 'veh-1',
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        type: 'abastecimento',
        id: 't2',
        date: '2026-09-10',
        time: '09:30',
        amount: 25,
        liters: 25.5,
        pricePerLiter: 3.333,
        stationName: 'Posto B',
        fuelType: 'Flex',
        fullTank: false,
        currentKm: 42600,
        vehicleId: 'veh-1',
        createdAt: 2000,
        updatedAt: 2000,
      },
      {
        type: 'abastecimento',
        id: 't3',
        date: '2026-09-15',
        time: '18:00',
        amount: 60,
        liters: 18,
        pricePerLiter: 3.333,
        stationName: 'Posto A',
        fuelType: 'Flex',
        fullTank: true,
        currentKm: 43050,
        vehicleId: 'veh-1',
        createdAt: 3000,
        updatedAt: 3000,
      },
    ] as FuelTransaction[];
    const res = calculateFuelConsumption(txs);
    expect(res.validCyclesCount).toBe(1);
    expect(res.confirmedCycles[0].distanceKm).toBe(900);
    expect(Math.round(res.confirmedCycles[0].liters * 100) / 100).toBe(43.5);
  });

  it('creates open cycle for last full tank without closing', () => {
    const txs = [
      {
        type: 'abastecimento',
        id: 't1',
        date: '2026-09-20',
        time: '07:00',
        amount: 60,
        liters: 18,
        pricePerLiter: 3.333,
        stationName: 'Posto A',
        fuelType: 'Flex',
        fullTank: true,
        currentKm: 43200,
        vehicleId: 'veh-1',
        createdAt: 4000,
        updatedAt: 4000,
      },
    ] as FuelTransaction[];
    const res = calculateFuelConsumption(txs);
    expect(res.validCyclesCount).toBe(0);
    expect(res.openCycle).not.toBeNull();
    expect(res.openCycle?.startKm).toBe(43200);
  });
});