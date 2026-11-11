import type { RideCriteria } from '../types';

export interface TargetBarInput {
  vehicleType: string;
  /** Custo por km informado pelo motorista; quando > 0 substitui o cálculo automático. */
  manualCostPerKm?: number;
  monthCostPerKm: number;
  monthKm: number;
  /** Custo por km pelo consumo real (km/L de tanque cheio × último preço do litro). */
  consumptionCostPerKm?: number;
  reservePerKm: number;
  criteria: Pick<RideCriteria, 'minProfitPerKm' | 'minAcceptableValue' | 'minProfitPerHour'>;
  todayProfit: number;
  dailyGoal: number;
}

export interface TargetBar {
  costPerKm: number;
  costSource: 'manual' | 'real' | 'padrao';
  minGrossPerKm: number;
  minFare: number;
  minProfitPerHour: number;
  todayProfit: number;
  dailyGoal: number;
  goalRemaining: number;
  goalReached: boolean;
}

export const MIN_KM_FOR_REAL_COST = 100;

export function defaultCostPerKm(vehicleType: string): number {
  return vehicleType === 'moto' ? 0.28 : 0.62;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export function calculateTargetBar(input: TargetBarInput): TargetBar {
  const manual = input.manualCostPerKm && input.manualCostPerKm > 0 ? input.manualCostPerKm : 0;
  const useReal =
    input.monthKm >= MIN_KM_FOR_REAL_COST && Number.isFinite(input.monthCostPerKm) && input.monthCostPerKm > 0;
  const consumption =
    !useReal && input.consumptionCostPerKm && Number.isFinite(input.consumptionCostPerKm) && input.consumptionCostPerKm > 0
      ? input.consumptionCostPerKm
      : 0;
  const base = useReal ? input.monthCostPerKm : consumption > 0 ? consumption : defaultCostPerKm(input.vehicleType);
  const costPerKm = round2(manual > 0 ? manual : base + Math.max(0, input.reservePerKm || 0));
  const minGrossPerKm = round2(costPerKm + Math.max(0, input.criteria.minProfitPerKm || 0));
  const dailyGoal = Math.max(0, input.dailyGoal || 0);
  const goalRemaining = round2(Math.max(0, dailyGoal - input.todayProfit));
  return {
    costPerKm,
    costSource: manual > 0 ? 'manual' : useReal || consumption > 0 ? 'real' : 'padrao',
    minGrossPerKm,
    minFare: round2(Math.max(0, input.criteria.minAcceptableValue || 0)),
    minProfitPerHour: round2(Math.max(0, input.criteria.minProfitPerHour || 0)),
    todayProfit: round2(input.todayProfit),
    dailyGoal: round2(dailyGoal),
    goalRemaining,
    goalReached: dailyGoal > 0 && goalRemaining === 0,
  };
}

const brl = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

export function formatTargetBar(bar: TargetBar): { title: string; body: string } {
  const title = `🎯 Aceite acima de ${brl(bar.minGrossPerKm)}/km`;
  const goal = bar.dailyGoal > 0
    ? bar.goalReached
      ? `Meta do dia batida (${brl(bar.todayProfit)})`
      : `Faltam ${brl(bar.goalRemaining)} para a meta do dia`
    : '';
  const body = [`Corrida mínima ${brl(bar.minFare)}`, `Custo ${brl(bar.costPerKm)}/km`, goal]
    .filter(Boolean)
    .join(' · ');
  return { title, body };
}

const MANUAL_COST_KEY = 'giro_certo_manual_cost_per_km_v1';
export const MANUAL_COST_EVENT = 'giro-certo-manual-cost';

export function readManualCostPerKm(): number {
  try {
    const value = Number.parseFloat(localStorage.getItem(MANUAL_COST_KEY) ?? '');
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function saveManualCostPerKm(value: number): void {
  try {
    if (value > 0) localStorage.setItem(MANUAL_COST_KEY, value.toString());
    else localStorage.removeItem(MANUAL_COST_KEY);
  } catch {
    /* preferência só local */
  }
  window.dispatchEvent(new Event(MANUAL_COST_EVENT));
}
