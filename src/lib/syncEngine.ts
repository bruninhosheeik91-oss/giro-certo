import type { Database } from './database.types';
import { MAX_SYNC_ATTEMPTS, type OfflineOp, type OfflineQueue } from './offlineQueue';
import { getSupabaseClient } from './auth';

export type SyncTable = keyof Database['public']['Tables'];

export interface SyncGateway {
  upsert(table: SyncTable, rows: Record<string, unknown>[]): Promise<void>;
  delete(table: SyncTable, id: string): Promise<void>;
}

export const supabaseGateway = (): SyncGateway => {
  const sb = getSupabaseClient();
  if (!sb) {
    return {
      upsert: async () => undefined,
      delete: async () => undefined,
    };
  }
  return {
    upsert: async (table, rows) => {
      const conflict = table === 'user_settings' ? 'user_id' : 'id';
      const result = await sb.from(table).upsert(rows as never[], { onConflict: conflict });
      if (result.error) throw result.error;
    },
    delete: async (table, id) => {
      const result = await sb.rpc('delete_cloud_entity', { p_table: table, p_id: id });
      if (result.error) throw result.error;
    },
  };
};

export interface FlushResult {
  flushed: number;
  failed: number;
  attempts: number;
  blocked: number;
  errored: boolean;
}

interface ErrorShape {
  code?: string;
  status?: number;
  message?: string;
}

/**
 * Erros que não melhoram com nova tentativa. `23505` (unique), `23514` (check)
 * e `PGRST301`/`42501` (RLS/permissão) exigem mudança de dado ou de sessão —
 * tentar de novo apenas repete o erro. `401`/`403` não entram aqui: o token
 * pode estar prestes a ser renovado pelo refresh automático do Supabase.
 *
 * `404`/`PGRST205` significa que a tabela não existe no projeto, o que só se
 * resolve aplicando as migrations. Sem isso a fila ficaria reprocessando em
 * loop e o Perfil mostraria "sincronizando" para sempre; bloqueando, o erro fica
 * visível e o dado continua na fila.
 *
 * `23503` (FK) é deliberadamente transitório: cada tabela é gravada em uma
 * requisição separada, então o filho falha enquanto o pai ainda está na fila ou
 * bloqueado por um erro anterior. Bloquear o filho nesse momento perderia dados
 * definitivos; o backoff normal resolve assim que o pai é gravado.
 */
function isPermanentError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as ErrorShape;
  return (
    value.code === '42501' ||
    value.code === 'PGRST301' ||
    value.code === '23514' ||
    value.code === '23505' ||
    value.code === 'PGRST205' ||
    value.status === 404
  );
}

function operationKey(op: Pick<OfflineOp, 'table' | 'entityId'>): string {
  return `${op.table}:${op.entityId}`;
}

/**
 * Mantém apenas a operação mais recente de cada entidade. Ganha + delete
 * colapsam em delete, que é a intenção final do usuário.
 */
function coalesce(ops: OfflineOp[]): OfflineOp[] {
  const latest = new Map<string, OfflineOp>();
  for (const op of ops) latest.set(operationKey(op), op);
  return [...latest.values()];
}

/**
 * Pais antes dos filhos dentro do mesmo lote.
 *
 * A fila já é enfileirada nessa ordem, mas operações podem vir de lotes
 * anteriores (pai bloqueado por erro transiente, filho reprocessado depois), e
 * o Postgres valida a FK no INSERT. Ordenar aqui torna cada lote autoconsistente
 * e faz o backoff do pai decidir o do filho.
 */
const TABLE_ORDER: Record<string, number> = {
  profiles: 0,
  user_settings: 1,
  vehicles: 2,
  registered_apps: 3,
  commitments: 4,
  shifts: 5,
  transactions: 6,
  shift_pauses: 7,
  installments: 8,
  fuel_records: 9,
  maintenance_records: 10,
  maintenance_reserve_entries: 11,
};

function tableRank(table: string): number {
  return TABLE_ORDER[table] ?? 99;
}

export async function flushQueue(
  queue: OfflineQueue,
  gateway: SyncGateway,
  limit = 20,
  now: () => number = Date.now,
): Promise<FlushResult> {
  const due = queue.nextBatch(Number.MAX_SAFE_INTEGER, now());
  const operations = coalesce(due)
    .sort((a, b) => tableRank(a.table) - tableRank(b.table) || a.createdAt - b.createdAt)
    .slice(0, Math.max(0, limit));
  const latestKeys = new Set(operations.map(operationKey));
  let flushed = 0;
  let failed = 0;
  let attempts = 0;
  let blocked = 0;

  for (const op of operations) {
    try {
      if (op.action === 'upsert') {
        const rows = (Array.isArray(op.payload) ? op.payload : [op.payload]) as Record<
          string,
          unknown
        >[];
        await gateway.upsert(op.table as SyncTable, rows);
      } else {
        await gateway.delete(op.table as SyncTable, op.entityId);
      }
    } catch (error) {
      attempts += 1;
      failed += 1;
      const permanent = isPermanentError(error);
      if (permanent) queue.block(op.opId, error);
      else if (op.attempts + 1 >= MAX_SYNC_ATTEMPTS) queue.block(op.opId, error);
      else queue.markFailed(op.opId, error, now());
      if (queue.find(op.opId)?.status === 'blocked') blocked += 1;
      // A op que falhou permanece: nada é descartado antes da confirmação.
      continue;
    }

    // Só descarta o histórico da mesma entidade depois que a mais recente foi
    // confirmada pela nuvem.
    const superseded = queue
      .all()
      .filter(
        (candidate) =>
          latestKeys.has(operationKey(candidate)) &&
          operationKey(candidate) === operationKey(op) &&
          candidate.opId !== op.opId,
      )
      .map((candidate) => candidate.opId);
    queue.removeMany([op.opId, ...superseded]);
    flushed += 1;
  }

  return { flushed, failed, attempts, blocked, errored: failed > 0 };
}
