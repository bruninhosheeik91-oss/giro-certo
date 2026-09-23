export type TransactionType = 'ganho' | 'abastecimento' | 'manutencao' | 'outra_despesa';

export type AppSource =
  'Uber' | '99' | 'iFood' | 'Lalamove' | 'Rappi' | 'Borzo' | 'Particular' | 'Outro';

export type FuelType = 'Gasolina' | 'Etanol' | 'Flex' | 'Diesel' | 'GNV' | 'Elétrico' | 'Outro';

export type MaintenanceCategory =
  | 'Troca de óleo'
  | 'Pneu dianteiro'
  | 'Pneu traseiro'
  | 'Relação'
  | 'Freios'
  | 'Filtro'
  | 'Revisão'
  | 'Elétrica'
  | 'Motor'
  | 'Suspensão'
  | 'Lavagem'
  | 'Acessório'
  | 'Outra';

export type OtherExpenseCategory =
  | 'Alimentação'
  | 'Estacionamento'
  | 'Pedágio'
  | 'Seguro'
  | 'Financiamento'
  | 'Aluguel do veículo'
  | 'IPVA'
  | 'Licenciamento'
  | 'Multa'
  | 'Internet'
  | 'Equipamentos'
  | 'Impostos'
  | 'Outra';

export interface RegisteredApp {
  id: string;
  name: string;
  color: string; // Hex color e.g. '#000000'
  icon: string; // 'car' | 'bike' | 'package' | 'navigation' | 'zap' | 'shopping-bag'
  isActive: boolean;
  isDefault?: boolean;
}

export interface UserVehicle {
  id: string;
  nickname: string;
  type: 'moto' | 'carro' | 'bicicleta';
  brand: string;
  model: string;
  year: string;
  plate?: string;
  currentKm: number;
  odometerBaselineKm?: number; // Piso de reconciliação do odômetro (nunca regride abaixo)
  fuelType: FuelType;
  fuelAverageKmPerLiter: number; // Consumo estimado km/l
  refPricePerLiter: number; // Custo de referência R$/l
  acquisitionPrice?: number; // Valor pago pelo veículo
  acquisitionDate?: string; // Data de aquisição YYYY-MM-DD
  notes?: string;
  isActive: boolean;
  isArchived?: boolean;
}

export interface BaseTransaction {
  id: string;
  type: TransactionType;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  amount: number;
  description?: string;
  vehicleId?: string;
  shiftId?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface GainTransaction extends BaseTransaction {
  type: 'ganho';
  gainType: 'total_periodo' | 'individual';
  app: string;
  baseAmount: number;
  tipAmount?: number;
  bonusAmount?: number;
  ridesCount: number; // Maior que zero
  shiftId?: string;
}

export interface FuelTransaction extends BaseTransaction {
  type: 'abastecimento';
  vehicleId: string;
  liters: number;
  pricePerLiter: number;
  fuelType: FuelType;
  currentKm: number;
  stationName?: string;
  fullTank: boolean;
}

export interface MaintenanceTransaction extends BaseTransaction {
  type: 'manutencao';
  vehicleId: string;
  category: MaintenanceCategory;
  servicePerformed: string;
  partsAmount: number;
  laborAmount: number;
  workshop?: string;
  currentKm: number;
  nextMaintenanceKm?: number;
  nextMaintenanceDate?: string;
}

export interface OtherExpenseTransaction extends BaseTransaction {
  type: 'outra_despesa';
  category: OtherExpenseCategory;
  isRecurring?: boolean;
  frequency?: 'Semanal' | 'Mensal' | 'Anual';
}

export type Transaction =
  GainTransaction | FuelTransaction | MaintenanceTransaction | OtherExpenseTransaction;

export interface ShiftPause {
  id: string;
  startTime: string; // HH:mm
  endTime?: string; // HH:mm
  durationMinutes: number;
  reason?: string;
}

export interface Shift {
  id: string;
  vehicleId?: string;
  vehicleName?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  startKm: number;
  endKm: number;
  pauses: ShiftPause[];
  totalPauseMinutes: number;
  totalWorkHours: number; // Decimal hours (efetivamente trabalhado)
  totalElapsedHours: number; // Decimal hours (total corrido)
  totalKm: number;
  accumulatedGain: number;
  accumulatedExpense: number;
  status: 'completed' | 'active' | 'paused';
  notes?: string;
  activeApps: string[];
}

export interface ActiveShiftState {
  isActive: boolean;
  isPaused: boolean;
  shiftId: string;
  vehicleId: string;
  vehicleName: string;
  date: string;
  startTime: string; // HH:mm:ss
  startEpoch: number;
  startKm: number;
  currentKm?: number;
  pauseStartEpoch?: number;
  totalPausedSeconds: number;
  accumulatedGain: number;
  accumulatedExpense: number;
  activeApps: string[];
  notes?: string;
}

export interface RideCriteria {
  minProfitPerKm: number; // Lucro mínimo por quilômetro (ex: R$ 0,80)
  minProfitPerHour: number; // Lucro mínimo por hora (ex: R$ 25,00)
  minAcceptableValue: number; // Valor mínimo aceitável (ex: R$ 8,00)
  considerReturnDistance: boolean; // Considerar distância de retorno: sim ou não
}

export interface UserProfile {
  name: string;
  photoUrl: string;
  city: string;
  startDate: string;
  monthlyGoal: number; // Ex: R$ 5.400,00
  maintenanceReservePerKm: number; // Ex: R$ 0,12 por km
  maintenanceReserveSaved: number; // Valor guardado manualmente no cofrinho
  rideCriteria: RideCriteria; // Critérios de corrida para o simulador
  notificationPreferences: {
    dailyGoalAlert: boolean;
    fuelReminder: boolean;
    maintenanceAlert: boolean;
    shiftReminders: boolean;
  };
}

export interface PeriodSummary {
  ganhoBruto: number;
  combustivel: number;
  manutencao: number;
  outrasDespesas: number;
  totalDespesas: number; // Despesas pagas
  lucroAposDespesas: number; // Ganho bruto - despesas pagas
  reservaManutencao: number; // KM rodados * reserva por KM
  lucroDisponivel: number; // Lucro após despesas - reserva para manutenção
  lucroLiquido: number; // Sinônimo de lucro após despesas
  horasTrabalhadas: number;
  quilometrosRodados: number;
  ganhoPorHora: number;
  lucroPorHora: number;
  ganhoPorKm: number;
  lucroPorKm: number;
  custoPorKm: number;
  mediaPorDia: number;
  progressoMeta: number; // Calculado sobre o lucro disponível
  metaRestante: number; // Calculado sobre o lucro disponível
  melhorDia?: {
    date: string;
    lucro: number;
    ganho: number;
  };
  appMaisLucrativo?: {
    app: string;
    total: number;
    percentage: number;
  };
  appStats: Array<{
    name: string;
    total: number;
    rides: number;
    percentage: number;
    avgPerRide: number;
  }>;
}

export type TimeFilter = 'hoje' | 'semana' | 'mes' | 'ano' | 'personalizado';

export type MaintenanceStatus = 'Em dia' | 'Atenção' | 'Troca próxima' | 'Atrasada';

export interface VehiclePartHealth {
  partKey: 'oleo' | 'pneu_dianteiro' | 'pneu_traseiro' | 'relacao' | 'freios' | 'revisao';
  label: string;
  lastChangeKm: number;
  nextChangeKm: number;
  intervalKm: number;
  remainingKm: number;
  progressPercent: number;
  status: MaintenanceStatus;
}

export type MaintenanceReserveEntryType = 'deposito' | 'resgate' | 'ajuste';

export interface MaintenanceReserveEntry {
  id: string;
  type: MaintenanceReserveEntryType;
  amount: number; // Positivo para depósito/resgate; ajuste pode ser negativo
  date: string; // YYYY-MM-DD
  description?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface FuelConsumptionCycle {
  startDate: string;
  startTime?: string;
  startKm: number;
  endDate: string;
  endTime?: string;
  endKm: number;
  distanceKm: number;
  liters: number;
  kmPerLiter: number;
  totalAmount: number;
  costPerKm: number;
}

export interface OpenFuelCycle {
  startDate: string;
  startTime?: string;
  startKm: number;
  liters: number;
  totalAmount: number;
}

export interface FuelConsumptionResult {
  confirmedCycles: FuelConsumptionCycle[];
  openCycle: OpenFuelCycle | null;
  lastKmPerLiter: number;
  averageKmPerLiter: number;
  totalDistanceKm: number;
  totalLiters: number;
  totalAmount: number;
  validCyclesCount: number;
}

export interface OdometerRecord {
  date: string;
  time?: string;
  km: number;
  source: string;
  sourceId: string;
}

export interface OdometerReconcileResult {
  currentKm: number;
  anomalies: OdometerRecord[];
}
