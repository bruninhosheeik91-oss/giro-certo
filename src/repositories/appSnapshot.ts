import type {
  ActiveShiftState,
  FinancialState,
  MaintenanceReserveEntry,
  PayableInstallment,
  RegisteredApp,
  Shift,
  Transaction,
  UserProfile,
  UserSettings,
  UserVehicle,
} from '../types';
import {
  INITIAL_REGISTERED_APPS,
  INITIAL_SHIFTS,
  INITIAL_TRANSACTIONS,
  INITIAL_USER_PROFILE,
  INITIAL_VEHICLES,
} from '../data/mockData';
import { migrateFinancialState } from '../utils/payables';
import { normalizeUuid } from '../lib/uuid';
import type { ScopedStorageKeys } from './storageKeys';

export interface AppSnapshot {
  profile: UserProfile;
  vehicles: UserVehicle[];
  registeredApps: RegisteredApp[];
  transactions: Transaction[];
  shifts: Shift[];
  activeShift: ActiveShiftState | null;
  maintenanceReserve: MaintenanceReserveEntry[];
  financialState: FinancialState;
  selectedMonth: string;
  settings: UserSettings;
}

const CANONICAL_VEHICLE_ID = 'veh-factor-150';
const LEGACY_VEHICLE_ID = 'veh-fazer-250';
const CANONICAL_VEHICLE_NAME = 'Moto do Dia a Dia';

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
}

function cloneProfile(profile: UserProfile): UserProfile {
  return {
    ...profile,
    rideCriteria: { ...profile.rideCriteria },
    notificationPreferences: { ...profile.notificationPreferences },
  };
}

function defaultFinancialState(): FinancialState {
  return migrateFinancialState(null);
}

export function createDefaultSnapshot(mode: 'local' | 'cloud'): AppSnapshot {
  const month = currentMonth();
  const profile = cloneProfile(INITIAL_USER_PROFILE);
  if (mode === 'cloud') {
    profile.name = 'Usuário';
    profile.city = '';
    profile.startDate = month;
    profile.maintenanceReserveSaved = 0;
  }
  return {
    profile,
    vehicles: mode === 'local' ? INITIAL_VEHICLES.map((vehicle) => ({ ...vehicle })) : [],
    registeredApps: INITIAL_REGISTERED_APPS.map((app) => ({ ...app })),
    transactions: mode === 'local' ? INITIAL_TRANSACTIONS.map((transaction) => ({ ...transaction })) : [],
    shifts: mode === 'local' ? INITIAL_SHIFTS.map((shift) => ({ ...shift, pauses: [...shift.pauses] })) : [],
    activeShift: null,
    maintenanceReserve: [],
    financialState: defaultFinancialState(),
    selectedMonth: month,
    settings: { selectedMonth: month },
  };
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}

function normalizeProfile(profile: Partial<UserProfile> | null | undefined): UserProfile {
  const fallback = cloneProfile(INITIAL_USER_PROFILE);
  return {
    ...fallback,
    ...(profile ?? {}),
    rideCriteria: {
      ...fallback.rideCriteria,
      ...(profile?.rideCriteria ?? {}),
    },
    notificationPreferences: {
      ...fallback.notificationPreferences,
      ...(profile?.notificationPreferences ?? {}),
    },
  };
}

function epochForDate(date: string | undefined, fallback = 0): number {
  if (!date) return fallback;
  const parsed = Date.parse(`${date.slice(0, 10)}T12:00:00-03:00`);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function localEpoch(date: string | undefined, time: string | undefined, fallback = 0): number {
  if (!date) return fallback;
  const clock = time && time.length === 5 ? `${time}:00` : (time ?? '00:00');
  const parsed = Date.parse(`${date}T${clock}-03:00`);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mapId(id: string, namespace: string, entityType: string): string {
  return normalizeUuid(id, namespace, entityType);
}

function remapVehicleId(
  id: string | undefined,
  vehicleIds: Map<string, string>,
): string | undefined {
  if (!id) return undefined;
  if (id === LEGACY_VEHICLE_ID) return vehicleIds.get(CANONICAL_VEHICLE_ID) ?? vehicleIds.get(id);
  return vehicleIds.get(id) ?? id;
}

export function normalizeAppSnapshot(snapshot: AppSnapshot, userId: string | null): AppSnapshot {
  const sourceVehicles = snapshot.vehicles;
  const officialVehicle = sourceVehicles.find(
    (vehicle) => vehicle.id === CANONICAL_VEHICLE_ID || vehicle.model?.includes('Factor 150'),
  );
  const vehicleSeedByOriginalId = new Map<string, string>();
  if (officialVehicle) {
    const originalId = officialVehicle.id;
    const canonicalSeed = originalId === LEGACY_VEHICLE_ID ? CANONICAL_VEHICLE_ID : originalId;
    vehicleSeedByOriginalId.set(originalId, canonicalSeed);
    if (originalId !== CANONICAL_VEHICLE_ID) vehicleSeedByOriginalId.set(CANONICAL_VEHICLE_ID, canonicalSeed);
  }
  for (const vehicle of sourceVehicles) vehicleSeedByOriginalId.set(vehicle.id, vehicle.id);

  const mapEntityId = (id: string, type: string): string => {
    if (userId === null) return id;
    const seed = type === 'vehicle' ? vehicleSeedByOriginalId.get(id) ?? id : id;
    return mapId(seed, userId, type);
  };

  const vehicleIds = new Map<string, string>();
  const vehicles: UserVehicle[] = sourceVehicles.map((vehicle) => {
    const seed = vehicleSeedByOriginalId.get(vehicle.id) ?? vehicle.id;
    const id = mapEntityId(vehicle.id, 'vehicle');
    vehicleIds.set(vehicle.id, id);
    vehicleIds.set(seed, id);
    const baseline = Math.max(
      0,
      vehicle.odometerBaselineKm ?? vehicle.currentKm ?? 0,
      vehicle.model?.includes('Factor 150') ? 42118 : 0,
    );
    return {
      ...vehicle,
      id,
      nickname: vehicle.model?.includes('Factor 150') ? CANONICAL_VEHICLE_NAME : vehicle.nickname,
      currentKm: Math.max(vehicle.currentKm ?? 0, baseline),
      odometerBaselineKm: baseline,
      createdAt: vehicle.createdAt ?? epochForDate(vehicle.acquisitionDate),
      updatedAt: vehicle.updatedAt ?? vehicle.createdAt ?? epochForDate(vehicle.acquisitionDate),
    };
  });

  const hasActiveVehicle = vehicles.some((vehicle) => vehicle.isActive);
  if (vehicles.length > 0 && !hasActiveVehicle && vehicles[0]) vehicles[0].isActive = true;

  const shiftIds = new Map<string, string>();
  const shifts = snapshot.shifts.map((shift) => {
    const id = mapEntityId(shift.id, 'shift');
    shiftIds.set(shift.id, id);
    return {
      ...shift,
      id,
      vehicleId: remapVehicleId(shift.vehicleId, vehicleIds),
      vehicleName: shift.vehicleName,
      pauses: shift.pauses.map((pause) => ({
        ...pause,
        id: mapEntityId(pause.id, 'shift_pause'),
      })),
      createdAt: shift.createdAt ?? localEpoch(shift.date, shift.startTime),
      updatedAt: shift.updatedAt ?? shift.createdAt ?? localEpoch(shift.date, shift.startTime),
    };
  });

  const activeShift = snapshot.activeShift
    ? {
        ...snapshot.activeShift,
        shiftId: mapEntityId(snapshot.activeShift.shiftId, 'shift'),
        vehicleId: vehicleIds.get(snapshot.activeShift.vehicleId) ?? mapEntityId(snapshot.activeShift.vehicleId, 'vehicle'),
        vehicleName:
          snapshot.activeShift.vehicleId === LEGACY_VEHICLE_ID
            ? CANONICAL_VEHICLE_NAME
            : snapshot.activeShift.vehicleName,
        createdAt: snapshot.activeShift.createdAt ?? snapshot.activeShift.startEpoch,
        updatedAt: snapshot.activeShift.updatedAt ?? snapshot.activeShift.startEpoch,
      }
    : null;
  if (activeShift) shiftIds.set(activeShift.shiftId, activeShift.shiftId);

  const transactionIds = new Map<string, string>();
  const commitmentIds = new Map<string, string>();
  const installmentIds = new Map<string, string>();

  const transactions = snapshot.transactions.map((transaction) => {
    const id = mapEntityId(transaction.id, 'transaction');
    transactionIds.set(transaction.id, id);
    if (transaction.payableId) commitmentIds.set(transaction.payableId, mapEntityId(transaction.payableId, 'commitment'));
    if (transaction.payableInstallmentId) {
      installmentIds.set(
        transaction.payableInstallmentId,
        mapEntityId(transaction.payableInstallmentId, 'installment'),
      );
    }
    return {
      ...transaction,
      id,
      vehicleId: remapVehicleId(transaction.vehicleId, vehicleIds),
      shiftId: transaction.shiftId ? shiftIds.get(transaction.shiftId) ?? mapEntityId(transaction.shiftId, 'shift') : undefined,
      payableId: transaction.payableId
        ? commitmentIds.get(transaction.payableId)
        : undefined,
      payableInstallmentId: transaction.payableInstallmentId
        ? installmentIds.get(transaction.payableInstallmentId)
        : undefined,
      createdAt: transaction.createdAt ?? localEpoch(transaction.date, transaction.time),
      updatedAt: transaction.updatedAt ?? transaction.createdAt ?? localEpoch(transaction.date, transaction.time),
    } as Transaction;
  });

  for (const transaction of snapshot.transactions) {
    if (transaction.payableId) {
      transactionIds.set(transaction.id, mapEntityId(transaction.id, 'transaction'));
    }
  }

  const commitments = snapshot.financialState.commitments.map((commitment) => {
    const id = mapEntityId(commitment.id, 'commitment');
    commitmentIds.set(commitment.id, id);
    return {
      ...commitment,
      id,
      vehicleId: remapVehicleId(commitment.vehicleId, vehicleIds),
      createdAt: commitment.createdAt ?? epochForDate(commitment.firstDueDate),
      updatedAt: commitment.updatedAt ?? commitment.createdAt ?? epochForDate(commitment.firstDueDate),
    };
  });

  const installments = snapshot.financialState.installments.map((installment) => {
    const id = mapEntityId(installment.id, 'installment');
    installmentIds.set(installment.id, id);
    return {
      ...installment,
      id,
      commitmentId: commitmentIds.get(installment.commitmentId) ?? mapEntityId(installment.commitmentId, 'commitment'),
      transactionId: installment.transactionId
        ? transactionIds.get(installment.transactionId) ?? mapEntityId(installment.transactionId, 'transaction')
        : undefined,
      createdAt: installment.createdAt ?? epochForDate(installment.dueDate),
      updatedAt: installment.updatedAt ?? installment.createdAt ?? epochForDate(installment.dueDate),
    };
  });

  const normalizedTransactions = transactions.map((transaction) => ({
    ...transaction,
    payableInstallmentId: transaction.payableInstallmentId
      ? installmentIds.get(transaction.payableInstallmentId) ?? transaction.payableInstallmentId
      : undefined,
  })) as Transaction[];

  const reserve = snapshot.maintenanceReserve.map((entry) => ({
    ...entry,
    id: mapEntityId(entry.id, 'reserve'),
    createdAt: entry.createdAt ?? epochForDate(entry.date),
    updatedAt: entry.updatedAt ?? entry.createdAt ?? epochForDate(entry.date),
  }));

  const selectedMonth = /^\d{4}-\d{2}$/.test(snapshot.selectedMonth)
    ? snapshot.selectedMonth
    : currentMonth();

  return {
    profile: {
      ...normalizeProfile(snapshot.profile),
      updatedAt: snapshot.profile.updatedAt,
    },
    vehicles,
    registeredApps: snapshot.registeredApps.map((app) => ({
      ...app,
      id: mapEntityId(app.id, 'registered_app'),
      createdAt: app.createdAt ?? 0,
      updatedAt: app.updatedAt ?? app.createdAt ?? 0,
    })),
    transactions: normalizedTransactions,
    shifts,
    activeShift,
    maintenanceReserve: reserve,
    financialState: { version: 3, commitments, installments },
    selectedMonth,
    settings: {
      ...snapshot.settings,
      selectedMonth: snapshot.settings.selectedMonth || selectedMonth,
    },
  };
}

export function readAppSnapshot(
  keys: ScopedStorageKeys,
  mode: 'local' | 'cloud',
  userId: string | null = null,
): AppSnapshot {
  const defaults = createDefaultSnapshot(mode);
  const snapshot: AppSnapshot = {
    profile: normalizeProfile(readJson<Partial<UserProfile> | null>(keys.profile, defaults.profile)),
    vehicles: readJson<UserVehicle[]>(keys.vehicles, defaults.vehicles),
    registeredApps: readJson<RegisteredApp[]>(keys.apps, defaults.registeredApps),
    transactions: readJson<Transaction[]>(keys.transactions, defaults.transactions),
    shifts: readJson<Shift[]>(keys.shifts, defaults.shifts),
    activeShift: readJson<ActiveShiftState | null>(keys.activeShift, null),
    maintenanceReserve: readJson<MaintenanceReserveEntry[]>(
      keys.maintenanceReserve,
      defaults.maintenanceReserve,
    ),
    financialState: migrateFinancialState(localStorage.getItem(keys.financial)),
    selectedMonth: readJson<string>(keys.selectedMonth, defaults.selectedMonth),
    settings: readJson<UserSettings>(keys.userSettings, defaults.settings),
  };
  return normalizeAppSnapshot(snapshot, userId);
}

/**
 * O saldo inicial do cofrinho já vivia em `profile.maintenanceReserveSaved`.
 * Quando o usuário ainda não tem lançamentos na reserva, semeia um depósito
 * equivalente para que o saldo não suma na primeira leitura.
 */
export function withReserveSeed(snapshot: AppSnapshot, mode: 'local' | 'cloud'): AppSnapshot {
  if (mode !== 'local' || snapshot.maintenanceReserve.length > 0) return snapshot;
  const initial = Number(snapshot.profile.maintenanceReserveSaved || 0);
  if (initial <= 0) return snapshot;
  const now = Date.now();
  return {
    ...snapshot,
    maintenanceReserve: [
      {
        id: 'reserve-migrated',
        type: 'deposito',
        amount: Math.round(initial * 100) / 100,
        date: new Date().toISOString().split('T')[0],
        description: 'Saldo inicial migrado do perfil',
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}

/**
 * Marca o escopo local como tendo dado do usuário.
 *
 * Chamado uma vez, na primeira mutação. Só isso não migra nada: serve para a
 * próxima sessão distinguir um usuário que editou ou apagou um registro da
 * semente de uma instalação que apenas abriu o app.
 */
export function markScopeTouched(keys: ScopedStorageKeys): void {
  if (localStorage.getItem(keys.touched)) return;
  localStorage.setItem(keys.touched, new Date().toISOString());
}

/**
 * Detecta se o escopo "local" tem dados do usuário, e não só a semente.
 *
 * `createDefaultSnapshot('local')` semeia mockData e o AppContext grava esse
 * snapshot no primeiro carregamento, então a simples existência das chaves não
 * prova nada — numa instalação nova subiria a demonstração inteira para a conta.
 *
 * Três sinais, do mais confiável para o mais frágil:
 *  1. `markScopeTouched` gravado em alguma mutação;
 *  2. coleção com linha fora da semente, ou com menos linhas que a semente
 *     (o usuário apagou um lançamento da demonstração);
 *  3. financeiros ou perfil divergentes da semente.
 */
export function hasPersistedLocalData(keys: ScopedStorageKeys): boolean {
  if (localStorage.getItem(keys.touched)) return true;

  const seeded: Record<string, ReadonlySet<string>> = {
    transactions: new Set(INITIAL_TRANSACTIONS.map((item) => item.id)),
    shifts: new Set(INITIAL_SHIFTS.map((item) => item.id)),
    vehicles: new Set(INITIAL_VEHICLES.map((item) => item.id)),
    apps: new Set(INITIAL_REGISTERED_APPS.map((item) => item.id)),
    maintenanceReserve: new Set<string>(),
  };

  for (const key of Object.keys(seeded) as (keyof typeof seeded)[]) {
    const raw = localStorage.getItem(keys[key as keyof ScopedStorageKeys]);
    if (!raw) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!Array.isArray(parsed)) continue;
    const ids = parsed.map((item) => String((item as { id?: unknown })?.id));
    if (ids.some((id) => !seeded[key].has(id))) return true;
    if (ids.length < seeded[key].size) return true;
  }

  const financialRaw = localStorage.getItem(keys.financial);
  if (financialRaw) {
    try {
      const state = JSON.parse(financialRaw) as {
        commitments?: unknown[];
        installments?: unknown[];
      };
      if ((state.commitments?.length ?? 0) > 0 || (state.installments?.length ?? 0) > 0) {
        return true;
      }
    } catch {
      // chave corrompida não prova dado do usuário
    }
  }

  const profileRaw = localStorage.getItem(keys.profile);
  if (profileRaw) {
    try {
      const stored = JSON.parse(profileRaw) as Partial<UserProfile>;
      const seed = INITIAL_USER_PROFILE;
      if (
        stored.name !== seed.name ||
        stored.city !== seed.city ||
        Number(stored.monthlyGoal ?? 0) !== Number(seed.monthlyGoal) ||
        Number(stored.maintenanceReserveSaved ?? 0) !== Number(seed.maintenanceReserveSaved) ||
        Number(stored.maintenanceReservePerKm ?? 0) !== Number(seed.maintenanceReservePerKm)
      ) {
        return true;
      }
    } catch {
      // chave corrompida não prova dado do usuário
    }
  }

  return false;
}

export function writeAppSnapshot(keys: ScopedStorageKeys, snapshot: AppSnapshot): void {
  writeJson(keys.transactions, snapshot.transactions);
  writeJson(keys.shifts, snapshot.shifts);
  writeJson(keys.profile, snapshot.profile);
  writeJson(keys.vehicles, snapshot.vehicles);
  writeJson(keys.apps, snapshot.registeredApps);
  if (snapshot.activeShift) writeJson(keys.activeShift, snapshot.activeShift);
  else localStorage.removeItem(keys.activeShift);
  writeJson(keys.selectedMonth, snapshot.selectedMonth);
  writeJson(keys.maintenanceReserve, snapshot.maintenanceReserve);
  writeJson(keys.financial, snapshot.financialState);
  writeJson(keys.userSettings, snapshot.settings);
}

export function snapshotFromValues(input: {
  profile: UserProfile;
  vehicles: UserVehicle[];
  registeredApps: RegisteredApp[];
  transactions: Transaction[];
  shifts: Shift[];
  activeShift: ActiveShiftState | null;
  maintenanceReserve: MaintenanceReserveEntry[];
  financialState: FinancialState;
  selectedMonth: string;
  settings?: UserSettings;
}): AppSnapshot {
  return {
    ...input,
    settings: input.settings ?? { selectedMonth: input.selectedMonth },
  };
}

export function mergeById<T extends { id: string }>(primary: T[], fallback: T[]): T[] {
  const fallbackById = new Map(fallback.map((item) => [item.id, item]));
  return primary.map((item) => fallbackById.get(item.id) ?? item);
}

export function isSameEntity<T extends { id: string; updatedAt?: number }>(
  left: T | undefined,
  right: T | undefined,
): boolean {
  if (!left || !right) return left === right;
  if (left.id !== right.id) return false;
  return (left.updatedAt ?? 0) === (right.updatedAt ?? 0);
}

export function financialStateFromArrays(
  commitments: FinancialState['commitments'],
  installments: PayableInstallment[],
): FinancialState {
  return { version: 3, commitments, installments };
}
