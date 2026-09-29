import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json, TablesInsert } from '../lib/database.types';
import { getSupabaseClient } from '../lib/auth';
import type { OfflineQueue } from '../lib/offlineQueue';
import type { SyncTable } from '../lib/syncEngine';
import type { ScopedStorageKeys } from './storageKeys';
import type { AppSnapshot } from './appSnapshot';
import {
  createDefaultSnapshot,
  hasPersistedLocalData,
  normalizeAppSnapshot,
  readAppSnapshot,
  snapshotFromValues,
  withReserveSeed,
} from './appSnapshot';
import {
  activePauseId,
  activeShiftFromRow,
  activeShiftToRow,
  commitmentFromRow,
  commitmentToRow,
  fuelRecordToRow,
  installmentFromRow,
  installmentToRow,
  maintenanceRecordToRow,
  profileFromRow,
  profileToRow,
  registeredAppFromRow,
  registeredAppToRow,
  reserveFromRow,
  reserveToRow,
  settingsFromRow,
  settingsToRow,
  shiftFromRow,
  shiftPauseToRow,
  shiftToRow,
  transactionFromRow,
  transactionToRow,
  vehicleFromRow,
  vehicleToRow,
} from './mappers';
import type { Transaction } from '../types';

type Client = SupabaseClient<Database>;

function cloudError(result: { error: { message: string } | null }, operation: string): void {
  if (result.error) throw new Error(`${operation}: ${result.error.message}`);
}

function jsonRow<T>(value: T): Record<string, unknown> {
  return value as unknown as Record<string, unknown>;
}

export interface CloudRepository {
  pull(): Promise<AppSnapshot>;
}

export class SupabaseCloudRepository implements CloudRepository {
  private readonly client: Client;
  private readonly userId: string;

  constructor(client: Client, userId: string) {
    this.client = client;
    this.userId = userId;
  }

  async pull(): Promise<AppSnapshot> {
    const [
      profileResult,
      vehiclesResult,
      appsResult,
      transactionsResult,
      shiftsResult,
      pausesResult,
      commitmentsResult,
      installmentsResult,
      reserveResult,
      settingsResult,
    ] = await Promise.all([
      this.client.from('profiles').select('*').maybeSingle(),
      this.client.from('vehicles').select('*').order('created_at'),
      this.client.from('registered_apps').select('*').order('created_at'),
      this.client.from('transactions').select('*').order('occurred_at'),
      this.client.from('shifts').select('*').order('start_at'),
      this.client.from('shift_pauses').select('*').order('start_at'),
      this.client.from('commitments').select('*').order('first_due_date'),
      this.client.from('installments').select('*').order('due_date'),
      this.client.from('maintenance_reserve_entries').select('*').order('date'),
      this.client.from('user_settings').select('*').eq('user_id', this.userId).maybeSingle(),
    ]);
    cloudError(profileResult, 'carregar perfil');
    cloudError(vehiclesResult, 'carregar veículos');
    cloudError(appsResult, 'carregar aplicativos');
    cloudError(transactionsResult, 'carregar transações');
    cloudError(shiftsResult, 'carregar jornadas');
    cloudError(pausesResult, 'carregar pausas');
    cloudError(commitmentsResult, 'carregar contas');
    cloudError(installmentsResult, 'carregar parcelas');
    cloudError(reserveResult, 'carregar reserva');
    cloudError(settingsResult, 'carregar configurações');

    const defaults = createDefaultSnapshot('cloud');
    const vehicles = (vehiclesResult.data ?? []).map(vehicleFromRow);
    const vehicleNames = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle.nickname]));
    const pausesByShift = new Map<string, Database['public']['Tables']['shift_pauses']['Row'][]>();
    for (const pause of pausesResult.data ?? []) {
      const current = pausesByShift.get(pause.shift_id) ?? [];
      current.push(pause);
      pausesByShift.set(pause.shift_id, current);
    }

    const cloudShifts = (shiftsResult.data ?? []).filter(
      (row) => !pausesByShift.get(row.id)?.some((pause) => !pause.end_at) && row.end_at !== null,
    );
    const activeRow = (shiftsResult.data ?? []).find(
      (row) => row.end_at === null && (row.status === 'ativa' || row.status === 'pausada'),
    );
    const activeShift = activeRow
      ? activeShiftFromRow(
          activeRow,
          pausesByShift.get(activeRow.id) ?? [],
          vehicleNames.get(activeRow.vehicle_id ?? '') ?? 'Veículo',
        )
      : null;
    const shifts = cloudShifts.map((row) => {
      const shift = shiftFromRow(row, pausesByShift.get(row.id) ?? []);
      shift.vehicleName = shift.vehicleId ? vehicleNames.get(shift.vehicleId) : undefined;
      return shift;
    });

    const settings = settingsResult.data ? settingsFromRow(settingsResult.data) : defaults.settings;
    return normalizeAppSnapshot(
      snapshotFromValues({
        profile: profileResult.data ? profileFromRow(profileResult.data) : defaults.profile,
        vehicles,
        registeredApps: (appsResult.data ?? []).map(registeredAppFromRow),
        transactions: (transactionsResult.data ?? []).map(transactionFromRow),
        shifts,
        activeShift,
        maintenanceReserve: (reserveResult.data ?? []).map(reserveFromRow),
        financialState: {
          version: 3,
          commitments: (commitmentsResult.data ?? []).map(commitmentFromRow),
          installments: (installmentsResult.data ?? []).map(installmentFromRow),
        },
        selectedMonth: settings.selectedMonth,
        settings,
      }),
      this.userId,
    );
  }
}

export function createCloudRepository(userId: string): CloudRepository {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase não está configurado');
  return new SupabaseCloudRepository(client, userId);
}

type RowOp = {
  table: keyof Database['public']['Tables'];
  entityId: string;
  row: Record<string, unknown>;
};

function rowOps<T extends keyof Database['public']['Tables']>(
  table: T,
  entityId: string,
  row: TablesInsert<T>,
): RowOp {
  return { table, entityId, row: jsonRow(row) as Record<string, unknown> };
}

function transactionDetailOps(transaction: Transaction, userId: string): RowOp[] {
  if (transaction.type === 'abastecimento') {
    return [rowOps('fuel_records', transaction.id, fuelRecordToRow(transaction, userId))];
  }
  if (transaction.type === 'manutencao') {
    return [
      rowOps('maintenance_records', transaction.id, maintenanceRecordToRow(transaction, userId)),
    ];
  }
  return [];
}

/**
 * Enfileira o snapshot inteiro para a nuvem.
 *
 * A ordem importa: o Postgres valida FK no momento do INSERT e cada tabela é
 * gravada em uma requisição separada, então os pais precisam vir antes dos
 * filhos — `commitments` antes de `transactions` (FK commitment_id), `shifts`
 * antes de `transactions` (FK shift_id) e de `shift_pauses`, `transactions`
 * antes de `installments` (FK transaction_id) e de `fuel_records`.
 */
export function queueSnapshotUpserts(
  snapshot: AppSnapshot,
  queue: OfflineQueue,
  userId: string,
): number {
  const ops: RowOp[] = [
    rowOps('profiles', userId, profileToRow(snapshot.profile, userId)),
  ];

  // O índice parcial permite um único veículo ativo por usuário: os inativos
  // precisam ser gravados/desativados antes de o próximo virar ativo.
  for (const vehicle of snapshot.vehicles) {
    if (!vehicle.isActive) ops.push(rowOps('vehicles', vehicle.id, vehicleToRow(vehicle, userId)));
  }
  for (const vehicle of snapshot.vehicles) {
    if (vehicle.isActive) ops.push(rowOps('vehicles', vehicle.id, vehicleToRow(vehicle, userId)));
  }
  for (const app of snapshot.registeredApps) {
    ops.push(rowOps('registered_apps', app.id, registeredAppToRow(app, userId)));
  }
  for (const commitment of snapshot.financialState.commitments) {
    ops.push(rowOps('commitments', commitment.id, commitmentToRow(commitment, userId)));
  }
  for (const shift of snapshot.shifts) {
    ops.push(rowOps('shifts', shift.id, shiftToRow(shift, userId)));
  }
  for (const transaction of snapshot.transactions) {
    ops.push(rowOps('transactions', transaction.id, transactionToRow(transaction, userId)));
  }
  for (const installment of snapshot.financialState.installments) {
    ops.push(rowOps('installments', installment.id, installmentToRow(installment, userId)));
  }
  for (const shift of snapshot.shifts) {
    for (const pause of shift.pauses) {
      ops.push(
        rowOps(
          'shift_pauses',
          pause.id,
          shiftPauseToRow(pause, shift.id, userId, shift.date, shift.updatedAt ?? shift.createdAt),
        ),
      );
    }
  }
  for (const transaction of snapshot.transactions) {
    ops.push(...transactionDetailOps(transaction, userId));
  }
  if (snapshot.activeShift) {
    ops.push(
      rowOps('shifts', snapshot.activeShift.shiftId, activeShiftToRow(snapshot.activeShift, userId)),
    );
    const currentPauseId =
      snapshot.activeShift.pauseId ?? activePauseId(snapshot.activeShift.shiftId, userId);
    if (snapshot.activeShift.pauseStartEpoch !== undefined) {
      ops.push(
        rowOps('shift_pauses', currentPauseId, {
          id: currentPauseId,
          user_id: userId,
          shift_id: snapshot.activeShift.shiftId,
          start_at: new Date(snapshot.activeShift.pauseStartEpoch).toISOString(),
          end_at: null,
          created_at: new Date(
            snapshot.activeShift.createdAt ?? snapshot.activeShift.startEpoch,
          ).toISOString(),
          updated_at: new Date(
            snapshot.activeShift.updatedAt ?? snapshot.activeShift.pauseStartEpoch,
          ).toISOString(),
        }),
      );
    } else {
      queue.enqueue({
        table: 'shift_pauses',
        action: 'delete',
        entityId: currentPauseId,
        payload: { id: currentPauseId },
      });
    }
  }
  for (const entry of snapshot.maintenanceReserve) {
    ops.push(
      rowOps('maintenance_reserve_entries', entry.id, reserveToRow(entry, userId)),
    );
  }
  ops.push(rowOps('user_settings', userId, settingsToRow(snapshot.settings, userId)));

  const applied = queue.enqueueMany(
    ops.map((op) => ({
      table: op.table,
      action: 'upsert' as const,
      entityId: op.entityId,
      payload: op.row as Json,
    })),
  );
  return applied.length;
}

function hasPendingUpsert(queue: OfflineQueue, table: SyncTable, id: string): boolean {
  return queue
    .all()
    .some((op) => op.table === table && op.entityId === id && op.action === 'upsert');
}

function timestamp(value: { updatedAt?: number; createdAt?: number }): number {
  return value.updatedAt ?? value.createdAt ?? 0;
}

function mergeCollection<T extends { id: string; createdAt?: number; updatedAt?: number }>(
  cloud: T[],
  local: T[],
  queue: OfflineQueue,
  table: SyncTable,
): T[] {
  const cloudById = new Map(
    cloud
      .filter((item) => !queue.pendingDeleteIds(table).has(item.id))
      .map((item) => [item.id, item]),
  );
  const merged = new Map(cloudById);
  for (const item of local) {
    if (!hasPendingUpsert(queue, table, item.id)) continue;
    const remote = cloudById.get(item.id);
    if (!remote || timestamp(item) > timestamp(remote)) merged.set(item.id, item);
  }
  return [...merged.values()];
}

export function mergeCloudSnapshot(
  local: AppSnapshot,
  cloud: AppSnapshot,
  queue: OfflineQueue,
  userId: string,
): AppSnapshot {
  const activePending = hasPendingUpsert(queue, 'shifts', local.activeShift?.shiftId ?? '');
  const activeShift = cloud.activeShift
    ? activePending && timestamp(local.activeShift ?? {}) > timestamp(cloud.activeShift)
      ? local.activeShift
      : cloud.activeShift
    : activePending
      ? local.activeShift
      : null;
  const settingsPending = hasPendingUpsert(queue, 'user_settings', userId);
  return normalizeAppSnapshot(
    snapshotFromValues({
      profile:
        hasPendingUpsert(queue, 'profiles', userId) && timestamp(local.profile) > timestamp(cloud.profile)
          ? local.profile
          : cloud.profile,
      vehicles: mergeCollection(cloud.vehicles, local.vehicles, queue, 'vehicles'),
      registeredApps: mergeCollection(
        cloud.registeredApps,
        local.registeredApps,
        queue,
        'registered_apps',
      ),
      transactions: mergeCollection(
        cloud.transactions,
        local.transactions,
        queue,
        'transactions',
      ),
      shifts: mergeCollection(cloud.shifts, local.shifts, queue, 'shifts'),
      activeShift,
      maintenanceReserve: mergeCollection(
        cloud.maintenanceReserve,
        local.maintenanceReserve,
        queue,
        'maintenance_reserve_entries',
      ),
      financialState: {
        version: 3,
        commitments: mergeCollection(
          cloud.financialState.commitments,
          local.financialState.commitments,
          queue,
          'commitments',
        ),
        installments: mergeCollection(
          cloud.financialState.installments,
          local.financialState.installments,
          queue,
          'installments',
        ),
      },
      selectedMonth:
        settingsPending || timestamp(local.settings) > timestamp(cloud.settings)
          ? local.selectedMonth
          : cloud.selectedMonth,
      settings: settingsPending ? local.settings : cloud.settings,
    }),
    null,
  );
}

/**
 * Importa o snapshot do modo local para a conta do usuário.
 *
 * Idempotente por dois motivos:
 *  1. `normalizeAppSnapshot(local, userId)` deriva IDs determinísticos
 *     (`uuid.ts`) a partir do par usuário/entidade, então reexecutar a migração
 *     reescreve as mesmas linhas em vez de duplicar.
 *  2. `queueSnapshotUpserts` enfileira por entidade; a fila coalesce e drena
 *     no máximo uma vez por ID.
 *
 * A marca de conclusão fica em `user_settings.local_import_completed_at` (nuvem)
 * e no próprio cache do usuário, para que outro dispositivo da mesma conta não
 * reimporte o modo local desta máquina.
 */
export function enqueueLocalImport(
  local: AppSnapshot,
  queue: OfflineQueue,
  userId: string,
): number {
  const normalized = normalizeAppSnapshot(local, userId);
  return queueSnapshotUpserts(normalized, queue, userId);
}

export function enqueueDelete(
  queue: OfflineQueue,
  table: SyncTable,
  id: string,
): void {
  queue.enqueue({ table, action: 'delete', entityId: id, payload: { id } });
}

export interface LocalImportOutcome {
  /** Quantidade de operações de dado enfileiradas; 0 quando o local estava intacto. */
  imported: number;
  /** Timestamp gravado em `user_settings.local_import_completed_at`. */
  completedAt: number;
  /** true quando a marca já existia e nada foi enfileirado. */
  alreadyImported: boolean;
}

/**
 * Migra o escopo local para a conta, uma única vez.
 *
 * A marca `localImportCompletedAt` é lida da nuvem, porque outro dispositivo da
 * mesma conta pode ter concluído antes. Só sobe dado quando existe algo
 * persistido, evitando enviar `mockData` de uma instalação que nunca gravou
 * nada; a marca é enfileirada de qualquer forma, senão o servidor nunca ficaria
 * sabendo que a migração acabou e a checagem se repetiria a cada sessão.
 */
export function importLocalScopeOnce(
  localKeys: ScopedStorageKeys,
  cloudSnapshot: AppSnapshot,
  queue: OfflineQueue,
  userId: string,
): LocalImportOutcome {
  const previous = cloudSnapshot.settings.localImportCompletedAt;
  if (previous) {
    return { imported: 0, completedAt: Date.parse(previous) || 0, alreadyImported: true };
  }

  const completedAt = Date.now();
  const stamped = {
    ...cloudSnapshot.settings,
    localImportCompletedAt: new Date(completedAt).toISOString(),
    updatedAt: completedAt,
  };

  if (!hasPersistedLocalData(localKeys)) {
    queue.enqueueMany([
      {
        table: 'user_settings',
        action: 'upsert',
        entityId: userId,
        payload: settingsToRow(stamped, userId) as Json,
      },
    ]);
    return { imported: 0, completedAt, alreadyImported: false };
  }

  const local = withReserveSeed(readAppSnapshot(localKeys, 'local', null), 'local');
  const imported = enqueueLocalImport({ ...local, settings: stamped }, queue, userId);
  return { imported, completedAt, alreadyImported: false };
}
