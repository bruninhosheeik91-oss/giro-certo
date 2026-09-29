import { STORAGE_KEYS } from '../repositories/storageKeys';
import { createUuid } from './uuid';
import type { Json } from './database.types';

export const OFFLINE_QUEUE_KEY = STORAGE_KEYS.sync;
export const MAX_SYNC_ATTEMPTS = 5;

export type OfflineAction = 'upsert' | 'delete';
export type OfflineOpStatus = 'pending' | 'blocked';

export interface OfflineOp<T = Json> {
  opId: string;
  table: string;
  action: OfflineAction;
  entityId: string;
  payload: T;
  createdAt: number;
  attempts: number;
  nextAttemptAt?: number;
  lastError?: string;
  status?: OfflineOpStatus;
}

export interface QueueStats {
  pending: number;
  blocked: number;
  total: number;
}

type OfflineQueueInput<T = Json> = Omit<OfflineOp<T>, 'opId' | 'createdAt' | 'attempts'>;

export interface OfflineQueue {
  enqueue<T = Json>(input: OfflineQueueInput<T>, idFactory?: () => string): OfflineOp<T>;
  enqueueMany<T = Json>(inputs: OfflineQueueInput<T>[]): OfflineOp<T>[];
  all<T = Json>(): OfflineOp<T>[];
  find(opId: string): OfflineOp | undefined;
  nextBatch(limit: number, now?: number): OfflineOp[];
  remove(opId: string): void;
  removeMany(opIds: string[]): void;
  bumpAttempts(opId: string): void;
  markFailed(opId: string, error: unknown, now?: number): void;
  block(opId: string, error: unknown): void;
  retry(opId: string): void;
  retryBlocked(): number;
  pendingDeleteIds(table: string): Set<string>;
  stats(): QueueStats;
  clear(): void;
  size(): number;
}

function readQueueRaw(storageKey: string): OfflineOp[] | null {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return (parsed as OfflineOp[]).map((op) => ({
      ...op,
      attempts: typeof op.attempts === 'number' && op.attempts > 0 ? op.attempts : 0,
      status: op.status === 'blocked' ? 'blocked' : 'pending',
    }));
  } catch {
    return null;
  }
}

function writeQueue(storageKey: string, ops: OfflineOp[]): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(ops));
  } catch {
    return;
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return String(error);
}

export function retryDelayMs(attempts: number): number {
  return Math.min(5 * 60_000, 1_000 * 2 ** Math.min(Math.max(attempts - 1, 0), 8));
}

export function createOfflineQueue(storageKey: string = OFFLINE_QUEUE_KEY): OfflineQueue {
  /**
   * Grava um lote com uma única leitura/escrita de `localStorage`.
   *
   * Subir um snapshot inteiro passa por centenas de linhas, então persistir a
   * fila a cada `enqueue` faria O(n) serializações por sincronização.
   */
  const appendBatch = <T>(
    inputs: OfflineQueueInput<T>[],
    idFactory: () => string = createUuid,
  ): OfflineOp<T>[] => {
    const ops = readQueueRaw(storageKey) ?? [];
    const applied: OfflineOp<T>[] = [];
    for (const input of inputs) {
      const index = ops.findIndex(
        (candidate) =>
          candidate.table === input.table &&
          candidate.action === input.action &&
          candidate.entityId === input.entityId,
      );
      if (index >= 0) {
        // Revivar uma operação: o payload novo zera o histórico de tentativas e
        // o backoff, senão uma op bloqueada voltaria a falhar com backoff máximo.
        const revived: OfflineOp = {
          ...ops[index],
          payload: input.payload as unknown as Json,
          attempts: 0,
          status: 'pending',
          lastError: undefined,
          nextAttemptAt: undefined,
        };
        ops[index] = revived;
        applied.push(revived as unknown as OfflineOp<T>);
        continue;
      }
      const op: OfflineOp = {
        opId: idFactory(),
        createdAt: Date.now(),
        attempts: 0,
        status: 'pending',
        ...input,
        payload: input.payload as unknown as Json,
      };
      ops.push(op);
      applied.push(op as unknown as OfflineOp<T>);
    }
    if (applied.length > 0) writeQueue(storageKey, ops);
    return applied;
  };

  const enqueue = <T = Json>(input: OfflineQueueInput<T>, idFactory = createUuid): OfflineOp<T> =>
    appendBatch([input], idFactory)[0];

  const mutate = (opId: string, change: (op: OfflineOp) => OfflineOp): void => {
    const ops = readQueueRaw(storageKey) ?? [];
    writeQueue(
      storageKey,
      ops.map((op) => (op.opId === opId ? change(op) : op)),
    );
  };

  return {
    enqueue,
    enqueueMany(inputs) {
      return appendBatch(inputs);
    },
    all<T = Json>() {
      return (readQueueRaw(storageKey) ?? []) as OfflineOp<T>[];
    },
    find(opId) {
      return (readQueueRaw(storageKey) ?? []).find((op) => op.opId === opId);
    },
    nextBatch(limit, now = Date.now()) {
      return (readQueueRaw(storageKey) ?? [])
        .filter(
          (op) =>
            (op.status ?? 'pending') === 'pending' && (op.nextAttemptAt ?? 0) <= now,
        )
        .slice(0, Math.max(0, limit));
    },
    remove(opId) {
      const ops = readQueueRaw(storageKey) ?? [];
      writeQueue(
        storageKey,
        ops.filter((op) => op.opId !== opId),
      );
    },
    removeMany(opIds) {
      if (opIds.length === 0) return;
      const drop = new Set(opIds);
      const ops = readQueueRaw(storageKey) ?? [];
      writeQueue(
        storageKey,
        ops.filter((op) => !drop.has(op.opId)),
      );
    },
    bumpAttempts(opId) {
      mutate(opId, (op) => ({ ...op, attempts: op.attempts + 1 }));
    },
    markFailed(opId, error, now = Date.now()) {
      mutate(opId, (op) => {
        const attempts = op.attempts + 1;
        return {
          ...op,
          attempts,
          lastError: errorMessage(error),
          nextAttemptAt: now + retryDelayMs(attempts),
          status: 'pending',
        };
      });
    },
    block(opId, error) {
      mutate(opId, (op) => ({
        ...op,
        attempts: op.attempts + 1,
        lastError: errorMessage(error),
        nextAttemptAt: undefined,
        status: 'blocked',
      }));
    },
    retry(opId) {
      mutate(opId, (op) => ({
        ...op,
        attempts: 0,
        lastError: undefined,
        nextAttemptAt: undefined,
        status: 'pending',
      }));
    },
    retryBlocked() {
      const ops = readQueueRaw(storageKey) ?? [];
      let revived = 0;
      const next = ops.map((op) => {
        if (op.status !== 'blocked') return op;
        revived += 1;
        return { ...op, attempts: 0, status: 'pending' as const, lastError: undefined, nextAttemptAt: undefined };
      });
      if (revived > 0) writeQueue(storageKey, next);
      return revived;
    },
    pendingDeleteIds(table) {
      return new Set(
        (readQueueRaw(storageKey) ?? [])
          .filter(
            (op) =>
              op.table === table &&
              op.action === 'delete' &&
              (op.status ?? 'pending') === 'pending',
          )
          .map((op) => op.entityId),
      );
    },
    stats() {
      const ops = readQueueRaw(storageKey) ?? [];
      const blocked = ops.filter((op) => op.status === 'blocked').length;
      return { pending: ops.length - blocked, blocked, total: ops.length };
    },
    clear() {
      writeQueue(storageKey, []);
    },
    size() {
      return (readQueueRaw(storageKey) ?? []).length;
    },
  };
}
