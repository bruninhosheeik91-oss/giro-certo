import {
  Transaction,
  Shift,
  PeriodSummary,
  VehiclePartHealth,
  MaintenanceTransaction,
} from '../types';

/**
 * Format currency to Brazilian Real (R$)
 */
export function formatBRL(value: number): string {
  if (isNaN(value) || !isFinite(value)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format raw numbers (e.g. 1.250,5)
 */
export function formatNumber(value: number, decimals: number = 1): string {
  if (isNaN(value) || !isFinite(value)) return '0';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format percentage
 */
export function formatPercent(value: number): string {
  if (isNaN(value) || !isFinite(value)) return '0%';
  return `${value.toFixed(1).replace('.', ',')}%`;
}

/**
 * Format decimal hours to 'Xh YYm'
 */
export function formatHours(decimalHours: number): string {
  if (isNaN(decimalHours) || decimalHours <= 0) return '0h 00m';
  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hours) * 60);
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

/**
 * Safe division handling zero or negative denominator
 */
export function safeDivide(numerator: number, denominator: number): number {
  if (
    !denominator ||
    denominator <= 0 ||
    isNaN(denominator) ||
    isNaN(numerator) ||
    !isFinite(numerator) ||
    !isFinite(denominator)
  ) {
    return 0;
  }
  return numerator / denominator;
}

/**
 * Mask/Format currency string during typing:
 * E.g.: "12" -> "0,12", "1250" -> "12,50", "150000" -> "1.500,00"
 */
export function formatBRLInput(rawValue: string): string {
  // Strip non-digits
  const digits = rawValue.replace(/\D/g, '');
  if (!digits) return '';

  const num = parseInt(digits, 10) / 100;
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Parse Brazilian currency string into float number
 */
export function parseBRLInput(formattedValue: string): number {
  if (!formattedValue) return 0;
  const digits = formattedValue.replace(/\D/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
}

/**
 * Calculate total work hours between start and end times minus pause minutes
 */
export function calculateWorkHours(
  startTime: string,
  endTime: string,
  pauseMinutes: number = 0,
): {
  workHours: number;
  elapsedHours: number;
} {
  try {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    const startTotalMinutes = startH * 60 + (startM || 0);
    let endTotalMinutes = endH * 60 + (endM || 0);

    // Shift crossed midnight
    if (endTotalMinutes < startTotalMinutes) {
      endTotalMinutes += 24 * 60;
    }

    const elapsedMinutes = Math.max(0, endTotalMinutes - startTotalMinutes);
    const netMinutes = Math.max(0, elapsedMinutes - pauseMinutes);

    return {
      workHours: Number((netMinutes / 60).toFixed(2)),
      elapsedHours: Number((elapsedMinutes / 60).toFixed(2)),
    };
  } catch {
    return { workHours: 0, elapsedHours: 0 };
  }
}

/**
 * Calculate complete summary for a period
 */
export function calculatePeriodSummary(
  transactions: Transaction[],
  shifts: Shift[],
  monthlyGoal: number = 5400,
  reservePerKm: number = 0.12,
): PeriodSummary {
  let ganhoBruto = 0;
  let combustivel = 0;
  let manutencao = 0;
  let outrasDespesas = 0;

  const appTotals: Record<string, { total: number; rides: number }> = {};
  const dayGains: Record<string, { gain: number; expense: number }> = {};

  for (const t of transactions) {
    const day = t.date;
    if (!dayGains[day]) {
      dayGains[day] = { gain: 0, expense: 0 };
    }

    if (t.type === 'ganho') {
      ganhoBruto += t.amount;
      dayGains[day].gain += t.amount;
      const appKey = t.app || 'Outro';
      const prev = appTotals[appKey] || { total: 0, rides: 0 };
      appTotals[appKey] = {
        total: prev.total + t.amount,
        rides: prev.rides + (t.ridesCount || 1),
      };
    } else {
      dayGains[day].expense += t.amount;
      if (t.type === 'abastecimento') {
        combustivel += t.amount;
      } else if (t.type === 'manutencao') {
        manutencao += t.amount;
      } else if (t.type === 'outra_despesa') {
        outrasDespesas += t.amount;
      }
    }
  }

  const totalDespesas = combustivel + manutencao + outrasDespesas;
  const lucroAposDespesas = ganhoBruto - totalDespesas;

  // Aggregate shifts metrics
  let horasTrabalhadas = 0;
  let quilometrosRodados = 0;

  for (const shift of shifts) {
    horasTrabalhadas += shift.totalWorkHours || 0;
    quilometrosRodados += Math.max(0, (shift.endKm || 0) - (shift.startKm || 0));
  }

  // Reserva de Manutenção calculada por quilometragem (não é despesa paga, é poupança recomendada)
  const reservaManutencao = quilometrosRodados * (reservePerKm || 0.12);
  const lucroDisponivel = lucroAposDespesas - reservaManutencao;
  const lucroLiquido = lucroAposDespesas;

  // Key performance indicators
  const ganhoPorHora = safeDivide(ganhoBruto, horasTrabalhadas);
  const lucroPorHora = safeDivide(lucroDisponivel, horasTrabalhadas);
  const ganhoPorKm = safeDivide(ganhoBruto, quilometrosRodados);
  const lucroPorKm = safeDivide(lucroDisponivel, quilometrosRodados);
  const custoPorKm = safeDivide(totalDespesas, quilometrosRodados);

  // A meta agora é calculada sobre o LUCRO DISPONÍVEL (após despesas e reserva de manutenção)
  const progressoMeta = monthlyGoal > 0 ? (lucroDisponivel / monthlyGoal) * 100 : 0;
  const metaRestante = Math.max(0, monthlyGoal - lucroDisponivel);

  const uniqueDays = Object.keys(dayGains).length || 1;
  const mediaPorDia = safeDivide(lucroDisponivel, uniqueDays);

  // Best day calculation
  let melhorDia: { date: string; lucro: number; ganho: number } | undefined;
  for (const [date, val] of Object.entries(dayGains)) {
    const net = val.gain - val.expense;
    if (!melhorDia || net > melhorDia.lucro) {
      melhorDia = { date, lucro: net, ganho: val.gain };
    }
  }

  // Most profitable app
  let appMaisLucrativo: { app: string; total: number; percentage: number } | undefined;
  let highestAppTotal = 0;
  let bestAppName = 'Uber';

  for (const [app, data] of Object.entries(appTotals)) {
    if (data.total > highestAppTotal) {
      highestAppTotal = data.total;
      bestAppName = app;
    }
  }

  if (highestAppTotal > 0) {
    appMaisLucrativo = {
      app: bestAppName,
      total: highestAppTotal,
      percentage: ganhoBruto > 0 ? (highestAppTotal / ganhoBruto) * 100 : 0,
    };
  }

  // Per-app breakdown (unified source for Reports/Home charts)
  const appStats = Object.entries(appTotals)
    .map(([name, data]) => ({
      name,
      total: data.total,
      rides: data.rides,
      percentage: ganhoBruto > 0 ? (data.total / ganhoBruto) * 100 : 0,
      avgPerRide: safeDivide(data.total, data.rides),
    }))
    .sort((a, b) => b.total - a.total);

  return {
    ganhoBruto,
    combustivel,
    manutencao,
    outrasDespesas,
    totalDespesas,
    lucroAposDespesas,
    reservaManutencao,
    lucroDisponivel,
    lucroLiquido,
    horasTrabalhadas,
    quilometrosRodados,
    ganhoPorHora,
    lucroPorHora,
    ganhoPorKm,
    lucroPorKm,
    custoPorKm,
    mediaPorDia,
    progressoMeta,
    metaRestante,
    melhorDia,
    appMaisLucrativo,
    appStats,
  };
}

/**
 * Filter transactions by selected time period
 */
export function filterTransactionsByPeriod(
  transactions: Transaction[],
  period: 'hoje' | 'semana' | 'mes' | 'ano' | 'personalizado',
  customStart?: string,
  customEnd?: string,
  referenceDateStr?: string,
): Transaction[] {
  const refDate = referenceDateStr ? new Date(referenceDateStr) : new Date();
  const currentIsoDate = refDate.toISOString().split('T')[0];

  return transactions.filter((t) => {
    if (period === 'hoje') {
      return t.date === currentIsoDate;
    }

    const tDate = new Date(t.date + 'T12:00:00');

    if (period === 'semana') {
      const diffTime = Math.abs(refDate.getTime() - tDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 7;
    }

    if (period === 'mes') {
      return (
        tDate.getMonth() === refDate.getMonth() && tDate.getFullYear() === refDate.getFullYear()
      );
    }

    if (period === 'ano') {
      return tDate.getFullYear() === refDate.getFullYear();
    }

    if (period === 'personalizado' && customStart && customEnd) {
      return t.date >= customStart && t.date <= customEnd;
    }

    return true;
  });
}

/**
 * Format relative Brazilian date (e.g., 'Hoje', 'Ontem', '22 de Set')
 */
export function formatDisplayDate(dateStr: string): string {
  try {
    const today = new Date().toISOString().split('T')[0];
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toISOString().split('T')[0];

    if (dateStr === today) return 'Hoje';
    if (dateStr === yesterday) return 'Ontem';

    const [, m, d] = dateStr.split('-');
    const months = [
      'Jan',
      'Fev',
      'Mar',
      'Abr',
      'Mai',
      'Jun',
      'Jul',
      'Ago',
      'Set',
      'Out',
      'Nov',
      'Dez',
    ];
    const monthName = months[parseInt(m, 10) - 1] || m;
    return `${d} de ${monthName}`;
  } catch {
    return dateStr;
  }
}

/**
 * Calculate maintenance parts health for motorcycle/vehicle
 */
export function calculateVehiclePartsHealth(
  currentKm: number,
  maintenanceTransactions: MaintenanceTransaction[] = [],
): VehiclePartHealth[] {
  const definitions = [
    { key: 'oleo' as const, label: 'Óleo e Filtro', interval: 3000, last: 41450 },
    { key: 'pneu_dianteiro' as const, label: 'Pneu Dianteiro', interval: 18000, last: 28000 },
    { key: 'pneu_traseiro' as const, label: 'Pneu Traseiro', interval: 12000, last: 30000 },
    { key: 'relacao' as const, label: 'Kit Relação (Transmissão)', interval: 20000, last: 15000 },
    { key: 'freios' as const, label: 'Pastilhas de Freio', interval: 10000, last: 33000 },
    { key: 'revisao' as const, label: 'Revisão Preventiva Geral', interval: 10000, last: 38000 },
  ];

  const categoryByPart: Record<string, string[]> = {
    oleo: ['Troca de óleo', 'Filtro'],
    pneu_dianteiro: ['Pneu dianteiro'],
    pneu_traseiro: ['Pneu traseiro'],
    relacao: ['Relação'],
    freios: ['Freios'],
    revisao: ['Revisão', 'Suspensão', 'Motor', 'Elétrica'],
  };

  const byCategory = (partKey: string, fallback: number): number => {
    const cats = categoryByPart[partKey] || [];
    const matches = maintenanceTransactions
      .filter((t) => cats.includes(t.category))
      .sort((a, b) => {
        const ka = a.currentKm || 0;
        const kb = b.currentKm || 0;
        return ka - kb;
      });
    const latest = matches.length > 0 ? matches[matches.length - 1] : null;
    return latest ? latest.currentKm : fallback;
  };

  return definitions.map((item) => {
    const last = byCategory(item.key, item.last);
    const nextChange = last + item.interval;
    const remaining = nextChange - currentKm;
    const elapsed = Math.max(0, currentKm - last);
    const progressPercent = Math.min(100, Math.max(0, (elapsed / item.interval) * 100));

    let status: 'Em dia' | 'Atenção' | 'Troca próxima' | 'Atrasada' = 'Em dia';
    if (remaining <= 0) {
      status = 'Atrasada';
    } else if (remaining <= 300) {
      status = 'Troca próxima';
    } else if (remaining <= 800) {
      status = 'Atenção';
    }

    return {
      partKey: item.key,
      label: item.label,
      lastChangeKm: last,
      nextChangeKm: nextChange,
      intervalKm: item.interval,
      remainingKm: remaining,
      progressPercent,
      status,
    };
  });
}

/**
 * Derived totals of a shift from its linked transactions (Decision 5 - single source of truth)
 */
export function calculateShiftTotals(
  transactions: Transaction[],
  shiftId: string,
): { gain: number; expense: number } {
  let gain = 0;
  let expense = 0;
  for (const t of transactions) {
    if (t.shiftId !== shiftId) continue;
    if (t.type === 'ganho') {
      gain += t.amount;
    } else {
      expense += Math.max(0, t.amount);
    }
  }
  return { gain: round2(gain), expense: round2(expense) };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Ride/Delivery Simulator
 */
export interface RideSimulationInput {
  fareOffered: number; // Valor oferecido
  distanceToPickup: number; // Coleta (km)
  tripDistance: number; // Viagem (km)
  returnDistance: number; // Retorno/área útil (km)
  estimatedMinutes: number; // Tempo estimado em minutos
  costPerKm: number; // Custo estimado por km do veículo
  tollsAndParking?: number; // Pedágio / estacionamento
  criteria?: {
    minProfitPerKm: number;
    minProfitPerHour: number;
    minAcceptableValue: number;
    considerReturnDistance: boolean;
  };
}

export interface RideSimulationResult {
  totalDistance: number;
  revenuePerKm: number;
  revenuePerHour: number;
  estimatedCost: number;
  estimatedProfit: number;
  profitPerKm: number;
  profitPerHour: number;
  marginPercent: number;
  status: 'Compensa' | 'Atenção' | 'Não compensa';
  reason: string;
  appliedCriteria: {
    minProfitPerKm: number;
    minProfitPerHour: number;
    minAcceptableValue: number;
    considerReturnDistance: boolean;
  };
}

export function simulateRide(input: RideSimulationInput): RideSimulationResult {
  const criteria = {
    minProfitPerKm: input.criteria?.minProfitPerKm ?? 0.8,
    minProfitPerHour: input.criteria?.minProfitPerHour ?? 25.0,
    minAcceptableValue: input.criteria?.minAcceptableValue ?? 8.0,
    considerReturnDistance: input.criteria?.considerReturnDistance ?? true,
  };

  // distância total = coleta + viagem + retorno (se configurado)
  const pickup = Math.max(0, input.distanceToPickup || 0);
  const trip = Math.max(0, input.tripDistance || 0);
  const ret = criteria.considerReturnDistance ? Math.max(0, input.returnDistance || 0) : 0;
  const totalDistance = pickup + trip + ret;

  // Tempo em horas (tratar divisão por zero com segurança)
  const timeMinutes = Math.max(0, input.estimatedMinutes || 0);
  const timeHours = timeMinutes > 0 ? timeMinutes / 60 : 0;

  // custo estimado = distância total × custo por quilômetro + pedágio + estacionamento
  const costPerKm = Math.max(0, input.costPerKm || 0);
  const tollsAndParking = Math.max(0, input.tollsAndParking || 0);
  const estimatedCost = totalDistance * costPerKm + tollsAndParking;

  // lucro estimado = valor oferecido − custo estimado
  const fareOffered = Math.max(0, input.fareOffered || 0);
  const estimatedProfit = fareOffered - estimatedCost;

  // receita por quilômetro = valor oferecido ÷ distância total
  const revenuePerKm = totalDistance > 0 ? fareOffered / totalDistance : 0;

  // lucro por quilômetro = lucro estimado ÷ distância total
  const profitPerKm = totalDistance > 0 ? estimatedProfit / totalDistance : 0;

  // receita por hora = valor oferecido ÷ tempo em horas
  const revenuePerHour = timeHours > 0 ? fareOffered / timeHours : 0;

  // lucro por hora = lucro estimado ÷ tempo em horas
  const profitPerHour = timeHours > 0 ? estimatedProfit / timeHours : 0;

  // margem de lucro = lucro estimado ÷ valor oferecido × 100
  const marginPercent = fareOffered > 0 ? (estimatedProfit / fareOffered) * 100 : 0;

  // Classificação baseada estritamente nos critérios configurados
  let status: 'Compensa' | 'Atenção' | 'Não compensa' = 'Compensa';
  let reason = '';

  const meetsKm = profitPerKm >= criteria.minProfitPerKm;
  const meetsHour = profitPerHour >= criteria.minProfitPerHour;
  const meetsMinFare = fareOffered >= criteria.minAcceptableValue;

  if (fareOffered <= 0) {
    status = 'Não compensa';
    reason = 'Informe o valor oferecido pelo aplicativo para analisar a viabilidade da corrida.';
  } else if (estimatedProfit <= 0) {
    status = 'Não compensa';
    reason = `Não compensa porque a corrida dá prejuízo estimado de ${formatBRL(Math.abs(estimatedProfit))} (custo de ${formatBRL(estimatedCost)} supera o valor de ${formatBRL(fareOffered)}). Estimativa operacional.`;
  } else if (!meetsMinFare) {
    status = 'Não compensa';
    reason = `Não compensa porque o valor oferecido de ${formatBRL(fareOffered)} está abaixo do seu valor mínimo configurado de ${formatBRL(criteria.minAcceptableValue)}. Estimativa operacional.`;
  } else if (meetsKm && meetsHour) {
    status = 'Compensa';
    reason = `Compensa porque o lucro estimado de ${formatBRL(profitPerKm)}/km e ${formatBRL(profitPerHour)}/h atingem ou superam seus mínimos configurados de ${formatBRL(criteria.minProfitPerKm)}/km e ${formatBRL(criteria.minProfitPerHour)}/h. Estimativa operacional.`;
  } else if (meetsKm && !meetsHour) {
    status = 'Atenção';
    reason = `Atenção: o lucro por km (${formatBRL(profitPerKm)}/km) atinge seu mínimo (mín. ${formatBRL(criteria.minProfitPerKm)}/km), mas o lucro por hora de ${formatBRL(profitPerHour)}/h está abaixo do seu mínimo configurado de ${formatBRL(criteria.minProfitPerHour)}/h. Estimativa operacional.`;
  } else if (!meetsKm && meetsHour) {
    status = 'Atenção';
    reason = `Atenção: o lucro por hora (${formatBRL(profitPerHour)}/h) atinge seu mínimo (mín. ${formatBRL(criteria.minProfitPerHour)}/h), mas o lucro por km de ${formatBRL(profitPerKm)}/km está abaixo do seu mínimo configurado de ${formatBRL(criteria.minProfitPerKm)}/km. Estimativa operacional.`;
  } else {
    // Neither met
    status = 'Não compensa';
    reason = `Não compensa porque o lucro estimado de ${formatBRL(profitPerKm)}/km está abaixo do seu mínimo configurado de ${formatBRL(criteria.minProfitPerKm)}/km e o lucro de ${formatBRL(profitPerHour)}/h está abaixo do mínimo de ${formatBRL(criteria.minProfitPerHour)}/h. Estimativa operacional.`;
  }

  return {
    totalDistance,
    revenuePerKm,
    revenuePerHour,
    estimatedCost,
    estimatedProfit,
    profitPerKm,
    profitPerHour,
    marginPercent,
    status,
    reason,
    appliedCriteria: criteria,
  };
}

/**
 * Goal Simulator
 */
export interface GoalSimulationInput {
  targetProfit: number; // Meta desejada de lucro disponível
  period: 'mensal' | 'semanal';
  workDays: number; // Dias que pretende trabalhar
  hoursPerDay: number; // Horas diárias
  averagePerHour: number; // Média atual de ganho bruto por hora
  costPerKm: number; // Custo médio por km (combustível + peças)
  reservePerKm: number; // Reserva recomendada por km
  avgKmPerHour?: number; // Média de km rodados por hora (padrão 18 km/h para moto, 22 para carro)
}

export interface GoalSimulationResult {
  totalHours: number;
  neededPerDay: number;
  neededPerHour: number;
  estimatedKm: number;
  projectedGross: number;
  projectedExpenses: number;
  projectedReserve: number;
  projectedAvailableProfit: number;
  isFeasible: boolean;
  feasibilityFeedback: string;
}

export function simulateGoal(input: GoalSimulationInput): GoalSimulationResult {
  const safeDays = Math.max(1, input.workDays);
  const safeHoursPerDay = Math.max(1, input.hoursPerDay);
  const totalHours = safeDays * safeHoursPerDay;
  const avgSpeed = input.avgKmPerHour || 20;

  const neededPerDay = safeDivide(input.targetProfit, safeDays);
  const neededPerHour = safeDivide(input.targetProfit, totalHours);

  // Estimated km rodados
  const estimatedKm = totalHours * avgSpeed;

  // Expenses & Reserve
  const projectedExpenses = estimatedKm * (input.costPerKm || 0.22);
  const projectedReserve = estimatedKm * (input.reservePerKm || 0.12);

  // Total gross needed to achieve target profit after expenses & reserve
  const projectedGross = input.targetProfit + projectedExpenses + projectedReserve;
  const projectedAvailableProfit = projectedGross - projectedExpenses - projectedReserve;

  const currentCapacityGross = totalHours * (input.averagePerHour || 35);
  const isFeasible = currentCapacityGross >= projectedGross * 0.9;

  let feasibilityFeedback = 'Meta perfeitamente atingível dentro do ritmo e das horas planejadas!';
  if (neededPerHour > 55) {
    feasibilityFeedback =
      'Meta muito agressiva para a jornada informada. Recomenda-se aumentar dias ou horas.';
  } else if (!isFeasible) {
    feasibilityFeedback =
      'Você precisará de tarifa dinâmica ou aumentar em torno de 1 a 2 horas por dia.';
  }

  return {
    totalHours,
    neededPerDay,
    neededPerHour,
    estimatedKm,
    projectedGross,
    projectedExpenses,
    projectedReserve,
    projectedAvailableProfit,
    isFeasible,
    feasibilityFeedback,
  };
}
