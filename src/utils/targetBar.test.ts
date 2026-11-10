import { describe, expect, it } from 'vitest';
import { calculateTargetBar, formatTargetBar } from './targetBar';

const criteria = { minProfitPerKm: 0.8, minAcceptableValue: 8, minProfitPerHour: 25 };

describe('régua de aceite', () => {
  it('usa o custo padrão do veículo enquanto há poucos km no mês', () => {
    const bar = calculateTargetBar({
      vehicleType: 'moto', monthCostPerKm: 0.5, monthKm: 40, reservePerKm: 0.12,
      criteria, todayProfit: 0, dailyGoal: 180,
    });
    expect(bar.costSource).toBe('padrao');
    expect(bar.costPerKm).toBe(0.4);
    expect(bar.minGrossPerKm).toBe(1.2);
    expect(bar.goalRemaining).toBe(180);
  });

  it('usa o custo real com km suficientes e soma a reserva', () => {
    const bar = calculateTargetBar({
      vehicleType: 'carro', monthCostPerKm: 0.55, monthKm: 900, reservePerKm: 0.1,
      criteria, todayProfit: 200, dailyGoal: 180,
    });
    expect(bar.costSource).toBe('real');
    expect(bar.minGrossPerKm).toBe(1.45);
    expect(bar.goalReached).toBe(true);
  });

  it('formata a notificação comparável ao R$/km da plataforma', () => {
    const bar = calculateTargetBar({
      vehicleType: 'moto', monthCostPerKm: 0, monthKm: 0, reservePerKm: 0,
      criteria, todayProfit: 50, dailyGoal: 180,
    });
    const text = formatTargetBar(bar);
    expect(text.title).toContain('/km');
    expect(text.body).toContain('Faltam');
  });
  it('usa o custo informado pelo motorista quando existe', () => {
    const bar = calculateTargetBar({
      vehicleType: 'moto', manualCostPerKm: 0.35, monthCostPerKm: 2.5, monthKm: 900, reservePerKm: 0.12,
      criteria, todayProfit: 0, dailyGoal: 0,
    });
    expect(bar.costSource).toBe('manual');
    expect(bar.costPerKm).toBe(0.35);
    expect(bar.minGrossPerKm).toBe(1.15);
  });
});
