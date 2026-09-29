import type { Database, Json, TablesInsert } from '../lib/database.types';
import { normalizeUuid } from '../lib/uuid';
import type {
  ActiveShiftState,
  AppSource,
  FinancialCommitment,
  MaintenanceCategory,
  MaintenanceReserveEntry,
  OtherExpenseCategory,
  PayableInstallment,
  PayablePaymentOrigin,
  RegisteredApp,
  Shift,
  ShiftPause,
  Transaction,
  UserProfile,
  UserSettings,
  UserVehicle,
} from '../types';

export type CloudTable = keyof Database['public']['Tables'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type VehicleRow = Database['public']['Tables']['vehicles']['Row'];
type ShiftRow = Database['public']['Tables']['shifts']['Row'];
type ShiftPauseRow = Database['public']['Tables']['shift_pauses']['Row'];
type TransactionRow = Database['public']['Tables']['transactions']['Row'];
type CommitmentRow = Database['public']['Tables']['commitments']['Row'];
type InstallmentRow = Database['public']['Tables']['installments']['Row'];
type ReserveRow = Database['public']['Tables']['maintenance_reserve_entries']['Row'];
type RegisteredAppRow = Database['public']['Tables']['registered_apps']['Row'];
type UserSettingsRow = Database['public']['Tables']['user_settings']['Row'];

const APP_SOURCES = new Set(['Uber', '99', 'iFood', 'Lalamove', 'Rappi', 'Borzo', 'Particular', 'Outro']);

function epoch(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isoDateTime(date: string | undefined, time: string | undefined): string {
  if (!date) return new Date().toISOString();
  const normalizedTime = !time ? '00:00' : time.length === 5 ? `${time}:00` : time;
  const parsed = Date.parse(`${date}T${normalizedTime}-03:00`);
  return new Date(Number.isFinite(parsed) ? parsed : Date.now()).toISOString();
}

function localParts(value: string): { date: string; time: string } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date(value)).map((part) => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

function localDate(value: string): string {
  return localParts(value).date;
}

function metadata(value: unknown): Record<string, Json | undefined> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, Json | undefined>;
}

function text(value: Json | undefined, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function number(value: Json | undefined, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function boolean(value: Json | undefined, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function nullableText(value: string | undefined): string | null {
  return value?.trim() ? value : null;
}

export function profileToRow(profile: UserProfile, userId: string): TablesInsert<'profiles'> {
  return {
    id: userId,
    name: profile.name.trim() || 'Usuário',
    city: nullableText(profile.city),
    start_date: profile.startDate || null,
    photo_url: nullableText(profile.photoUrl),
    monthly_goal: profile.monthlyGoal,
    maintenance_reserve_per_km: profile.maintenanceReservePerKm,
    ride_criteria_min_per_km: profile.rideCriteria.minProfitPerKm,
    ride_criteria_min_per_hour: profile.rideCriteria.minProfitPerHour,
    ride_criteria_min_value: profile.rideCriteria.minAcceptableValue,
    ride_criteria_consider_return: profile.rideCriteria.considerReturnDistance,
    notification_daily_goal: profile.notificationPreferences.dailyGoalAlert,
    notification_maintenance: profile.notificationPreferences.maintenanceAlert,
    notification_fuel_reminder: profile.notificationPreferences.fuelReminder,
    notification_shift_reminders: profile.notificationPreferences.shiftReminders,
    created_at: profile.createdAt ? new Date(profile.createdAt).toISOString() : undefined,
    updated_at: profile.updatedAt ? new Date(profile.updatedAt).toISOString() : undefined,
  };
}

export function profileFromRow(row: ProfileRow): UserProfile {
  return {
    name: row.name,
    city: row.city ?? '',
    startDate: row.start_date ?? localDate(row.created_at),
    photoUrl: row.photo_url ?? '',
    monthlyGoal: row.monthly_goal,
    maintenanceReservePerKm: row.maintenance_reserve_per_km,
    rideCriteria: {
      minProfitPerKm: row.ride_criteria_min_per_km,
      minProfitPerHour: row.ride_criteria_min_per_hour,
      minAcceptableValue: row.ride_criteria_min_value,
      considerReturnDistance: row.ride_criteria_consider_return,
    },
    notificationPreferences: {
      dailyGoalAlert: row.notification_daily_goal,
      maintenanceAlert: row.notification_maintenance,
      fuelReminder: row.notification_fuel_reminder,
      shiftReminders: row.notification_shift_reminders,
    },
    maintenanceReserveSaved: 0,
    createdAt: epoch(row.created_at, 0),
    updatedAt: epoch(row.updated_at, 0),
  };
}

export function vehicleToRow(vehicle: UserVehicle, userId: string): TablesInsert<'vehicles'> {
  return {
    id: vehicle.id,
    user_id: userId,
    nickname: vehicle.nickname,
    type: vehicle.type,
    brand: vehicle.brand,
    model: vehicle.model,
    year: vehicle.year,
    plate: nullableText(vehicle.plate),
    current_km: vehicle.currentKm,
    odometer_baseline_km: vehicle.odometerBaselineKm ?? vehicle.currentKm,
    fuel_type: vehicle.fuelType,
    fuel_avg_km_liter: vehicle.fuelAverageKmPerLiter,
    ref_price_liter: vehicle.refPricePerLiter,
    acquisition_value: vehicle.acquisitionPrice ?? null,
    acquisition_date: vehicle.acquisitionDate ?? null,
    notes: nullableText(vehicle.notes),
    is_active: vehicle.isActive,
    is_archived: vehicle.isArchived ?? false,
    created_at: vehicle.createdAt ? new Date(vehicle.createdAt).toISOString() : undefined,
    updated_at: vehicle.updatedAt ? new Date(vehicle.updatedAt).toISOString() : undefined,
  };
}

export function vehicleFromRow(row: VehicleRow): UserVehicle {
  return {
    id: row.id,
    nickname: row.nickname,
    type: row.type as UserVehicle['type'],
    brand: row.brand ?? '',
    model: row.model ?? '',
    year: row.year ?? '',
    plate: row.plate ?? undefined,
    currentKm: row.current_km,
    odometerBaselineKm: row.odometer_baseline_km,
    fuelType: (row.fuel_type ?? 'Outro') as UserVehicle['fuelType'],
    fuelAverageKmPerLiter: row.fuel_avg_km_liter ?? 0,
    refPricePerLiter: row.ref_price_liter ?? 0,
    acquisitionPrice: row.acquisition_value ?? undefined,
    acquisitionDate: row.acquisition_date ?? undefined,
    notes: row.notes ?? undefined,
    isActive: row.is_active,
    isArchived: row.is_archived,
    createdAt: epoch(row.created_at, 0),
    updatedAt: epoch(row.updated_at, 0),
  };
}

export function registeredAppToRow(app: RegisteredApp, userId: string): TablesInsert<'registered_apps'> {
  return {
    id: app.id,
    user_id: userId,
    name: app.name,
    color: app.color,
    icon: app.icon,
    is_active: app.isActive,
    is_default: app.isDefault ?? false,
    created_at: app.createdAt ? new Date(app.createdAt).toISOString() : undefined,
    updated_at: app.updatedAt ? new Date(app.updatedAt).toISOString() : undefined,
  };
}

export function registeredAppFromRow(row: RegisteredAppRow): RegisteredApp {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    isActive: row.is_active,
    isDefault: row.is_default,
    createdAt: epoch(row.created_at, 0),
    updatedAt: epoch(row.updated_at, 0),
  };
}

function transactionMetadata(transaction: Transaction): Record<string, Json | undefined> {
  if (transaction.type === 'ganho') {
    return {
      gainType: transaction.gainType,
      app: transaction.app,
      baseAmount: transaction.baseAmount,
      tipAmount: transaction.tipAmount,
      bonusAmount: transaction.bonusAmount,
      ridesCount: transaction.ridesCount,
    };
  }
  if (transaction.type === 'abastecimento') {
    return {
      liters: transaction.liters,
      pricePerLiter: transaction.pricePerLiter,
      fuelType: transaction.fuelType,
      currentKm: transaction.currentKm,
      stationName: transaction.stationName,
      fullTank: transaction.fullTank,
    };
  }
  if (transaction.type === 'manutencao') {
    return {
      category: transaction.category,
      servicePerformed: transaction.servicePerformed,
      partsAmount: transaction.partsAmount,
      laborAmount: transaction.laborAmount,
      workshop: transaction.workshop,
      currentKm: transaction.currentKm,
      nextMaintenanceKm: transaction.nextMaintenanceKm,
      nextMaintenanceDate: transaction.nextMaintenanceDate,
    };
  }
  return {
    category: transaction.category,
    isRecurring: transaction.isRecurring,
    frequency: transaction.frequency,
  };
}

export function transactionToRow(
  transaction: Transaction,
  userId: string,
): TablesInsert<'transactions'> {
  return {
    id: transaction.id,
    user_id: userId,
    type: transaction.type,
    category:
      transaction.type === 'manutencao' || transaction.type === 'outra_despesa'
        ? transaction.category
        : null,
    amount: transaction.amount,
    occurred_at: isoDateTime(transaction.date, transaction.time),
    description: nullableText(transaction.description),
    vehicle_id: transaction.vehicleId ?? null,
    shift_id: transaction.shiftId ?? null,
    installment_id: transaction.payableInstallmentId ?? null,
    commitment_id: transaction.payableId ?? null,
    origin: transaction.origin === 'opening_balance' ? 'opening_balance' : 'manual',
    metadata: transactionMetadata(transaction),
    created_at: new Date(transaction.createdAt).toISOString(),
    updated_at: new Date(transaction.updatedAt ?? transaction.createdAt).toISOString(),
  };
}

export function transactionFromRow(row: TransactionRow): Transaction {
  const parts = localParts(row.occurred_at);
  const data = metadata(row.metadata);
  const base = {
    id: row.id,
    date: parts.date,
    time: parts.time,
    amount: row.amount,
    description: row.description ?? undefined,
    vehicleId: row.vehicle_id ?? undefined,
    shiftId: row.shift_id ?? undefined,
    payableId: row.commitment_id ?? undefined,
    payableInstallmentId: row.installment_id ?? undefined,
    origin: row.origin,
    createdAt: epoch(row.created_at, 0),
    updatedAt: epoch(row.updated_at, 0),
  };

  if (row.type === 'ganho') {
    const app = text(data.app, 'Outro');
    return {
      ...base,
      type: 'ganho',
      gainType: text(data.gainType, 'individual') === 'total_periodo' ? 'total_periodo' : 'individual',
      app: APP_SOURCES.has(app) ? (app as AppSource) : 'Outro',
      baseAmount: number(data.baseAmount, row.amount),
      tipAmount: typeof data.tipAmount === 'number' ? data.tipAmount : undefined,
      bonusAmount: typeof data.bonusAmount === 'number' ? data.bonusAmount : undefined,
      ridesCount: Math.max(1, Math.round(number(data.ridesCount, 1))),
    };
  }

  if (row.type === 'abastecimento') {
    return {
      ...base,
      type: 'abastecimento',
      vehicleId: row.vehicle_id ?? '',
      liters: number(data.liters),
      pricePerLiter: number(data.pricePerLiter),
      fuelType: text(data.fuelType, 'Outro') as UserVehicle['fuelType'],
      currentKm: number(data.currentKm),
      stationName: text(data.stationName) || undefined,
      fullTank: boolean(data.fullTank, true),
    };
  }

  if (row.type === 'manutencao') {
    return {
      ...base,
      type: 'manutencao',
      vehicleId: row.vehicle_id ?? '',
      category: text(data.category, 'Outra') as MaintenanceCategory,
      servicePerformed: text(data.servicePerformed, row.description ?? ''),
      partsAmount: number(data.partsAmount),
      laborAmount: number(data.laborAmount),
      workshop: text(data.workshop) || undefined,
      currentKm: number(data.currentKm),
      nextMaintenanceKm: typeof data.nextMaintenanceKm === 'number' ? data.nextMaintenanceKm : undefined,
      nextMaintenanceDate: text(data.nextMaintenanceDate) || undefined,
    };
  }

  return {
    ...base,
    type: 'outra_despesa',
    category: text(data.category ?? row.category, 'Outra') as OtherExpenseCategory,
    isRecurring: typeof data.isRecurring === 'boolean' ? data.isRecurring : undefined,
    frequency: text(data.frequency) === 'Semanal' || text(data.frequency) === 'Mensal' || text(data.frequency) === 'Anual'
      ? (text(data.frequency) as 'Semanal' | 'Mensal' | 'Anual')
      : undefined,
  };
}

export function fuelRecordToRow(
  transaction: Extract<Transaction, { type: 'abastecimento' }>,
  userId: string,
): TablesInsert<'fuel_records'> {
  return {
    id: transaction.id,
    user_id: userId,
    vehicle_id: transaction.vehicleId,
    shift_id: transaction.shiftId ?? null,
    odometer_km: transaction.currentKm,
    liters: transaction.liters,
    price_per_liter: transaction.pricePerLiter,
    total: transaction.amount,
    occurred_at: isoDateTime(transaction.date, transaction.time),
    created_at: new Date(transaction.createdAt).toISOString(),
    updated_at: new Date(transaction.updatedAt ?? transaction.createdAt).toISOString(),
  };
}

export function maintenanceRecordToRow(
  transaction: Extract<Transaction, { type: 'manutencao' }>,
  userId: string,
): TablesInsert<'maintenance_records'> {
  const categoryMap: Record<string, Database['public']['Enums']['maintenance_category']> = {
    'Troca de óleo': 'troca_oleo',
    'Pneu dianteiro': 'pneu_dianteiro',
    'Pneu traseiro': 'pneu_traseiro',
    Relação: 'relacao',
    Freios: 'freios',
    Filtro: 'filtro',
    Revisão: 'revisao',
    Elétrica: 'eletrica',
    Motor: 'motor',
    Suspensão: 'suspensao',
    Lavagem: 'lavagem',
    Acessório: 'acessorio',
    Outra: 'outra',
  };
  return {
    id: transaction.id,
    user_id: userId,
    vehicle_id: transaction.vehicleId,
    date: transaction.date,
    category: categoryMap[transaction.category] ?? 'outra',
    description: transaction.servicePerformed,
    cost: transaction.amount,
    odometer_km: transaction.currentKm,
    created_at: new Date(transaction.createdAt).toISOString(),
    updated_at: new Date(transaction.updatedAt ?? transaction.createdAt).toISOString(),
  };
}

function shiftStatus(status: Shift['status']): string {
  if (status === 'completed') return 'encerrada';
  if (status === 'paused') return 'pausada';
  return 'ativa';
}

function localShiftStatus(status: string): Shift['status'] {
  if (status === 'encerrada') return 'completed';
  if (status === 'pausada') return 'paused';
  return 'active';
}

export function shiftToRow(shift: Shift, userId: string): TablesInsert<'shifts'> {
  const startAt = isoDateTime(shift.date, shift.startTime);
  const endAt = isoDateTime(shift.date, shift.endTime);
  return {
    id: shift.id,
    user_id: userId,
    vehicle_id: shift.vehicleId ?? null,
    start_at: startAt,
    end_at: endAt,
    status: shiftStatus(shift.status),
    km_start: shift.startKm,
    km_end: shift.endKm,
    earnings_cents: Math.round(shift.accumulatedGain * 100),
    expenses_cents: Math.round(shift.accumulatedExpense * 100),
    paused_seconds: Math.round(shift.totalPauseMinutes * 60),
    note: nullableText(shift.notes),
    metadata: { activeApps: shift.activeApps },
    created_at: shift.createdAt ? new Date(shift.createdAt).toISOString() : undefined,
    updated_at: shift.updatedAt ? new Date(shift.updatedAt).toISOString() : undefined,
  };
}

export function shiftFromRow(row: ShiftRow, pauseRows: ShiftPauseRow[] = []): Shift {
  const start = localParts(row.start_at);
  const end = localParts(row.end_at ?? row.start_at);
  const pausedMinutes = row.paused_seconds / 60;
  const elapsedHours = row.end_at
    ? Math.max(0, (Date.parse(row.end_at) - Date.parse(row.start_at)) / 3_600_000)
    : 0;
  const data = metadata(row.metadata);
  const apps = Array.isArray(data.activeApps)
    ? data.activeApps.filter((value): value is string => typeof value === 'string')
    : [];
  const pauses = pauseRows
    .map((pause) => {
      const pauseStart = localParts(pause.start_at);
      const pauseEnd = pause.end_at ? localParts(pause.end_at) : undefined;
      return {
        id: pause.id,
        startTime: pauseStart.time,
        endTime: pauseEnd?.time,
        durationMinutes: pause.end_at
          ? Math.max(0, (Date.parse(pause.end_at) - Date.parse(pause.start_at)) / 60_000)
          : 0,
      };
    })
    .sort((left, right) => left.startTime.localeCompare(right.startTime));
  return {
    id: row.id,
    vehicleId: row.vehicle_id ?? undefined,
    date: start.date,
    startTime: start.time,
    endTime: end.time,
    startKm: row.km_start ?? 0,
    endKm: row.km_end ?? row.km_start ?? 0,
    pauses,
    totalPauseMinutes: pausedMinutes,
    totalWorkHours: Math.max(0, elapsedHours - pausedMinutes / 60),
    totalElapsedHours: elapsedHours,
    totalKm: Math.max(0, (row.km_end ?? row.km_start ?? 0) - (row.km_start ?? 0)),
    accumulatedGain: row.earnings_cents / 100,
    accumulatedExpense: row.expenses_cents / 100,
    status: localShiftStatus(row.status),
    notes: row.note ?? undefined,
    activeApps: apps,
    createdAt: epoch(row.created_at, 0),
    updatedAt: epoch(row.updated_at, 0),
  };
}

export function shiftPauseToRow(
  pause: ShiftPause,
  shiftId: string,
  userId: string,
  date: string,
  timestamp = Date.now(),
): TablesInsert<'shift_pauses'> {
  return {
    id: pause.id,
    user_id: userId,
    shift_id: shiftId,
    start_at: isoDateTime(date, pause.startTime),
    end_at: pause.endTime ? isoDateTime(date, pause.endTime) : null,
    created_at: new Date(timestamp).toISOString(),
    updated_at: new Date(timestamp).toISOString(),
  };
}

export function activeShiftToRow(shift: ActiveShiftState, userId: string): TablesInsert<'shifts'> {
  return {
    id: shift.shiftId,
    user_id: userId,
    vehicle_id: shift.vehicleId,
    start_at: new Date(shift.startEpoch).toISOString(),
    end_at: null,
    status: shift.isPaused ? 'pausada' : 'ativa',
    km_start: shift.startKm,
    km_end: shift.currentKm ?? shift.startKm,
    earnings_cents: Math.round(shift.accumulatedGain * 100),
    expenses_cents: Math.round(shift.accumulatedExpense * 100),
    paused_seconds: shift.totalPausedSeconds,
    note: null,
    metadata: { activeShift: true, vehicleName: shift.vehicleName },
    created_at: new Date(shift.createdAt ?? shift.startEpoch).toISOString(),
    updated_at: new Date(shift.updatedAt ?? shift.startEpoch).toISOString(),
  };
}

export function activePauseId(shiftId: string, userId: string): string {
  return normalizeUuid(`active-pause:${shiftId}`, userId, 'shift_pause');
}

export function activeShiftFromRow(
  row: ShiftRow,
  pauseRows: ShiftPauseRow[],
  vehicleName: string,
): ActiveShiftState | null {
  if (row.status === 'encerrada' || row.status === 'cancelada' || row.end_at) return null;
  const start = localParts(row.start_at);
  const openPause = pauseRows.find((pause) => !pause.end_at);
  return {
    isActive: true,
    isPaused: row.status === 'pausada' || Boolean(openPause),
    shiftId: row.id,
    vehicleId: row.vehicle_id ?? '',
    vehicleName,
    date: start.date,
    startTime: start.time,
    startEpoch: Date.parse(row.start_at),
    startKm: row.km_start ?? 0,
    currentKm: row.km_end ?? row.km_start ?? undefined,
    pauseStartEpoch: openPause ? Date.parse(openPause.start_at) : undefined,
    pauseId: openPause?.id,
    totalPausedSeconds: row.paused_seconds,
    accumulatedGain: row.earnings_cents / 100,
    accumulatedExpense: row.expenses_cents / 100,
    activeApps: [],
    notes: row.note ?? undefined,
    createdAt: epoch(row.created_at, Date.parse(row.start_at)),
    updatedAt: epoch(row.updated_at, Date.parse(row.start_at)),
  };
}

export function commitmentToRow(commitment: FinancialCommitment, userId: string): TablesInsert<'commitments'> {
  return {
    id: commitment.id,
    user_id: userId,
    type: commitment.type,
    title: commitment.title,
    category: commitment.category,
    creditor: nullableText(commitment.creditor),
    installment_amount: commitment.installmentAmount,
    first_due_date: commitment.firstDueDate,
    total_installments: commitment.totalInstallments ?? null,
    due_day: commitment.dueDay,
    end_date: commitment.endDate ?? null,
    notes: nullableText(commitment.notes),
    status: commitment.status,
    created_at: commitment.createdAt ? new Date(commitment.createdAt).toISOString() : undefined,
    updated_at: commitment.updatedAt ? new Date(commitment.updatedAt).toISOString() : undefined,
  };
}

export function commitmentFromRow(row: CommitmentRow): FinancialCommitment {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    category: (row.category ?? 'Outra') as OtherExpenseCategory,
    creditor: row.creditor ?? undefined,
    installmentAmount: row.installment_amount,
    firstDueDate: row.first_due_date,
    totalInstallments: row.total_installments ?? undefined,
    dueDay: row.due_day,
    endDate: row.end_date ?? undefined,
    notes: row.notes ?? undefined,
    status: row.status,
    createdAt: epoch(row.created_at, 0),
    updatedAt: epoch(row.updated_at, 0),
  };
}

export function installmentToRow(
  installment: PayableInstallment,
  userId: string,
): TablesInsert<'installments'> {
  return {
    id: installment.id,
    commitment_id: installment.commitmentId,
    user_id: userId,
    number: installment.number,
    reference_month: `${installment.referenceMonth}-01`,
    due_date: installment.dueDate,
    expected_amount: installment.expectedAmount,
    status: installment.paidAt ? 'paga' : 'pendente',
    paid_at: installment.paidAt ?? null,
    paid_amount: installment.paidAmount ?? null,
    payment_origin: installment.paymentOrigin ?? null,
    transaction_id: installment.transactionId ?? null,
    created_at: installment.createdAt ? new Date(installment.createdAt).toISOString() : undefined,
    updated_at: installment.updatedAt ? new Date(installment.updatedAt).toISOString() : undefined,
  };
}

export function installmentFromRow(row: InstallmentRow): PayableInstallment {
  return {
    id: row.id,
    commitmentId: row.commitment_id,
    number: row.number,
    referenceMonth: row.reference_month?.slice(0, 7) ?? row.due_date.slice(0, 7),
    dueDate: row.due_date,
    expectedAmount: row.expected_amount,
    paidAt: row.paid_at ?? undefined,
    paidAmount: row.paid_amount ?? undefined,
    paymentOrigin:
      row.payment_origin === 'transaction' || row.payment_origin === 'opening_balance'
        ? (row.payment_origin as PayablePaymentOrigin)
        : undefined,
    transactionId: row.transaction_id ?? undefined,
    createdAt: epoch(row.created_at, 0),
    updatedAt: epoch(row.updated_at, 0),
  };
}

export function reserveToRow(
  entry: MaintenanceReserveEntry,
  userId: string,
): TablesInsert<'maintenance_reserve_entries'> {
  return {
    id: entry.id,
    user_id: userId,
    vehicle_id: null,
    date: entry.date,
    amount: Math.abs(entry.amount),
    entry_type: entry.type,
    description: nullableText(entry.description),
    note: nullableText(entry.description),
    created_at: entry.createdAt ? new Date(entry.createdAt).toISOString() : undefined,
    updated_at: entry.updatedAt ? new Date(entry.updatedAt).toISOString() : undefined,
  };
}

export function reserveFromRow(row: ReserveRow): MaintenanceReserveEntry {
  const type =
    row.entry_type === 'resgate' || row.entry_type === 'ajuste'
      ? row.entry_type
      : 'deposito';
  return {
    id: row.id,
    type,
    date: row.date,
    amount: type === 'ajuste' ? -row.amount : row.amount,
    description: row.description ?? row.note ?? undefined,
    createdAt: epoch(row.created_at, 0),
    updatedAt: epoch(row.updated_at, 0),
  };
}

export function settingsToRow(settings: UserSettings, userId: string): TablesInsert<'user_settings'> {
  return {
    user_id: userId,
    selected_month: `${settings.selectedMonth}-01`,
    local_import_completed_at: settings.localImportCompletedAt ?? null,
    updated_at: settings.updatedAt ? new Date(settings.updatedAt).toISOString() : undefined,
  };
}

export function settingsFromRow(row: UserSettingsRow): UserSettings {
  return {
    selectedMonth: row.selected_month?.slice(0, 7) ?? new Date().toISOString().slice(0, 7),
    localImportCompletedAt: row.local_import_completed_at ?? undefined,
    updatedAt: epoch(row.updated_at, 0),
  };
}
