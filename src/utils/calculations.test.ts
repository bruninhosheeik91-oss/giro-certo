import { describe, it, expect } from 'vitest';
import {
  parseBRLInput,
  formatBRLInput,
  formatBRL,
  calculateFuelConsumption,
  calculateAnnualSummaries,
  calculateMonthlyGoalProjection,
  calculatePeriodSummary,
} from './calculations';
import { FuelTransaction, Shift, Transaction } from '../types';

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

describe('calculateMonthlyGoalProjection', () => {
  it('uses the actual day and remaining days of the selected current month', () => {
    const result = calculateMonthlyGoalProjection('2026-09', 1000, 3000, new Date(2026, 8, 15, 12));
    expect(result.periodState).toBe('current');
    expect(result.daysInMonth).toBe(30);
    expect(result.dayOfMonth).toBe(15);
    expect(result.daysRemaining).toBe(15);
    expect(result.actionableDays).toBe(16);
    expect(result.dailyRequired).toBe(125);
    expect(result.expectedProfitToDate).toBe(1500);
    expect(result.projectedMonthProfit).toBe(2000);
  });

  it('does not invent a day remaining on the last day of the month', () => {
    const result = calculateMonthlyGoalProjection('2026-09', 2500, 3000, new Date(2026, 8, 30, 12));
    expect(result.daysRemaining).toBe(0);
    expect(result.actionableDays).toBe(1);
    expect(result.dailyRequired).toBe(500);
  });

  it('treats past and future months without using todays day number', () => {
    const reference = new Date(2026, 8, 15, 12);
    const past = calculateMonthlyGoalProjection('2026-08', 2800, 3000, reference);
    const future = calculateMonthlyGoalProjection('2026-10', 0, 3100, reference);
    expect(past.status).toBe('Mês encerrado');
    expect(past.daysRemaining).toBe(0);
    expect(past.projectedMonthProfit).toBe(2800);
    expect(future.status).toBe('Planejada');
    expect(future.daysRemaining).toBe(31);
    expect(future.dailyRequired).toBe(100);
  });
});

describe('hourly metrics reliability', () => {
  const gain = {
    id: 'gain-1',
    type: 'ganho',
    gainType: 'total_periodo',
    app: 'Uber',
    baseAmount: 157.5,
    amount: 157.5,
    ridesCount: 1,
    date: '2026-09-30',
    time: '12:00',
    createdAt: 1,
  } as Transaction;
  const shift = (hours: number): Shift => ({
    id: 'shift-1',
    date: '2026-09-30',
    startTime: '12:00',
    endTime: '13:00',
    startKm: 100,
    endKm: 102,
    pauses: [],
    totalPauseMinutes: 0,
    totalWorkHours: hours,
    totalElapsedHours: hours,
    totalKm: 2,
    accumulatedGain: 157.5,
    accumulatedExpense: 0,
    status: 'completed',
    activeApps: ['Uber'],
  });

  it('does not extrapolate an hourly rate from only one minute', () => {
    const summary = calculatePeriodSummary([gain], [shift(1 / 60)], 1500, 0.12);
    expect(summary.hourlyMetricsReady).toBe(false);
    expect(summary.ganhoPorHora).toBe(0);
    expect(summary.lucroPorHora).toBe(0);
  });

  it('calculates the hourly rate after one worked hour', () => {
    const summary = calculatePeriodSummary([gain], [shift(1)], 1500, 0.12);
    expect(summary.hourlyMetricsReady).toBe(true);
    expect(summary.ganhoPorHora).toBe(157.5);
  });
});

describe('manual transactions in dashboard totals', () => {
  it('includes gains and expenses without a linked shift in the monthly goal', () => {
    const transactions = [
      {
        id: 'manual-gain',
        type: 'ganho',
        gainType: 'corrida_individual',
        app: 'Particular',
        baseAmount: 500,
        amount: 500,
        ridesCount: 1,
        date: '2026-10-01',
        time: '10:00',
        createdAt: 1,
      },
      {
        id: 'manual-expense',
        type: 'outra_despesa',
        category: 'Alimentação',
        amount: 100,
        date: '2026-10-01',
        time: '12:00',
        createdAt: 2,
      },
    ] as Transaction[];

    const summary = calculatePeriodSummary(transactions, [], 1000, 0.12);
    expect(summary.ganhoBruto).toBe(500);
    expect(summary.totalDespesas).toBe(100);
    expect(summary.lucroDisponivel).toBe(400);
    expect(summary.progressoMeta).toBe(40);
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

describe('calculateAnnualSummaries', () => {
  it('returns no history when the account has no real data', () => {
    expect(calculateAnnualSummaries([], [], 5400, 0.12)).toEqual([]);
  });

  it('groups real records by year and calculates best and worst active month', () => {
    const transaction = (id: string, date: string, amount: number): Transaction => ({
      id,
      type: 'ganho',
      gainType: 'total_periodo',
      app: 'Uber',
      baseAmount: amount,
      ridesCount: 1,
      date,
      time: '12:00',
      amount,
      createdAt: 1,
    });
    const shift = (id: string, date: string, km: number): Shift => ({
      id,
      date,
      startTime: '08:00',
      endTime: '10:00',
      startKm: 100,
      endKm: 100 + km,
      totalKm: km,
      pauses: [],
      totalPauseMinutes: 0,
      totalWorkHours: 2,
      totalElapsedHours: 2,
      accumulatedGain: 0,
      accumulatedExpense: 0,
      status: 'completed',
      activeApps: ['Uber'],
    });
    const result = calculateAnnualSummaries(
      [
        transaction('a', '2025-12-10', 100),
        transaction('b', '2026-01-10', 200),
        transaction('c', '2026-02-10', 400),
      ],
      [shift('s1', '2026-01-10', 10), shift('s2', '2026-02-10', 20)],
      5400,
      0.1,
    );

    expect(result.map((item) => item.year)).toEqual(['2026', '2025']);
    expect(result[0].ganhoBruto).toBe(600);
    expect(result[0].quilometrosRodados).toBe(30);
    expect(result[0].melhorMes.mes).toBe('Fevereiro');
    expect(result[0].piorMes.mes).toBe('Janeiro');
  });
});
