import { describe, it, expect, beforeEach } from 'vitest';
import { createOfflineQueue, MAX_SYNC_ATTEMPTS } from './offlineQueue';
import { flushQueue, supabaseGateway, type SyncGateway } from './syncEngine';

function makeGateway(behavior?: {
  failUpsert?: boolean;
}): SyncGateway & { upserts: number; deletes: number } {
  const calls = { upserts: 0, deletes: 0 };
  return {
    get upserts() {
      return calls.upserts;
    },
    get deletes() {
      return calls.deletes;
    },
    async upsert() {
      calls.upserts += 1;
      if (behavior?.failUpsert) throw new Error('network offline');
    },
    async delete() {
      calls.deletes += 1;
    },
  };
}

describe('flushQueue (ETAPA 6 — sync engine)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('drena a fila: sucesso remove ops e chama upsert por tabela', async () => {
    const q = createOfflineQueue();
    q.enqueue({
      table: 'vehicles',
      action: 'upsert',
      entityId: 'v-1',
      payload: { id: 'v-1', nickname: 'Moto' },
    });
    q.enqueue({
      table: 'transactions',
      action: 'upsert',
      entityId: 'tx-1',
      payload: { id: 'tx-1', amount: 100 },
    });
    const gw = makeGateway();

    const res = await flushQueue(q, gw);

    expect(res.flushed).toBe(2);
    expect(res.failed).toBe(0);
    expect(gw.upserts).toBe(2);
    expect(q.size()).toBe(0);
  });

  it('falha de rede: bumpAttempts e op permanece na fila', async () => {
    const q = createOfflineQueue();
    q.enqueue({ table: 'vehicles', action: 'upsert', entityId: 'v-2', payload: { id: 'v-2' } });
    const gw = makeGateway({ failUpsert: true });

    const res = await flushQueue(q, gw);

    expect(res.flushed).toBe(0);
    expect(res.failed).toBe(1);
    expect(res.errored).toBe(true);
    expect(q.size()).toBe(1);
    expect(q.all()[0].attempts).toBe(1);
  });

  it('delete é idempotente: remove op sem falhar', async () => {
    const q = createOfflineQueue();
    q.enqueue({
      table: 'shifts',
      action: 'delete',
      entityId: 'shift-x',
      payload: { id: 'shift-x' },
    });
    const gw = makeGateway();

    const res = await flushQueue(q, gw);

    expect(res.flushed).toBe(1);
    expect(gw.deletes).toBe(1);
    expect(q.size()).toBe(0);
  });

  it('respeita o limite de lote (processa só os primeiros)', async () => {
    const q = createOfflineQueue();
    for (let i = 0; i < 5; i++) {
      q.enqueue({
        table: 'vehicles',
        action: 'upsert',
        entityId: `v-${i}`,
        payload: { id: `v-${i}` },
      });
    }
    const gw = makeGateway();

    const res = await flushQueue(q, gw, 2);

    expect(res.flushed).toBe(2);
    expect(q.size()).toBe(3);
  });

  it('supabaseGateway está disponível (RLS-safe, não service_role)', () => {
    expect(typeof supabaseGateway).toBe('function');
  });

  it('ordena pais antes dos filhos dentro do mesmo lote (FK)', async () => {
    const q = createOfflineQueue();
    // Enfileirado na ordem errada de propósito: filho antes do pai.
    q.enqueue({ table: 'installments', action: 'upsert', entityId: 'i-1', payload: {} });
    q.enqueue({ table: 'transactions', action: 'upsert', entityId: 't-1', payload: {} });
    q.enqueue({ table: 'shift_pauses', action: 'upsert', entityId: 'p-1', payload: {} });
    q.enqueue({ table: 'shifts', action: 'upsert', entityId: 's-1', payload: {} });
    q.enqueue({ table: 'commitments', action: 'upsert', entityId: 'c-1', payload: {} });

    const order: string[] = [];
    const gw: SyncGateway = {
      async upsert(table) {
        order.push(table);
      },
      async delete() {},
    };

    const res = await flushQueue(q, gw);

    expect(res.flushed).toBe(5);
    expect(order).toEqual([
      'commitments',
      'shifts',
      'transactions',
      'shift_pauses',
      'installments',
    ]);
  });

  it('FK (23503) é transitória: o filho espera o pai em vez de bloquear', async () => {
    const q = createOfflineQueue();
    const op = q.enqueue({ table: 'transactions', action: 'upsert', entityId: 't-1', payload: {} });
    const gw: SyncGateway = {
      async upsert() {
        throw Object.assign(new Error('violation of foreign key constraint'), { code: '23503' });
      },
      async delete() {},
    };

    const res = await flushQueue(q, gw);

    expect(res.failed).toBe(1);
    expect(res.blocked).toBe(0);
    expect(q.find(op.opId)?.status).toBe('pending');
    expect(q.find(op.opId)?.attempts).toBe(1);
  });

  it('erro permanente (23505) bloqueia na hora e sobrevive ao drain seguinte', async () => {
    const q = createOfflineQueue();
    const op = q.enqueue({ table: 'vehicles', action: 'upsert', entityId: 'v-1', payload: {} });
    const gw: SyncGateway = {
      async upsert() {
        throw Object.assign(new Error('duplicate key'), { code: '23505' });
      },
      async delete() {},
    };

    const res = await flushQueue(q, gw);

    expect(res.blocked).toBe(1);
    expect(q.find(op.opId)?.status).toBe('blocked');
    const second = await flushQueue(q, gw);
    expect(second.flushed).toBe(0);
    expect(second.blocked).toBe(0);
    expect(q.size()).toBe(1);
  });

  it('tabela inexistente (PGRST205/404) bloqueia em vez de reprocessar em loop', async () => {
    const q = createOfflineQueue();
    const op = q.enqueue({ table: 'vehicles', action: 'upsert', entityId: 'v-1', payload: {} });
    const gw: SyncGateway = {
      async upsert() {
        throw Object.assign(new Error('Could not find the table'), {
          code: 'PGRST205',
          status: 404,
        });
      },
      async delete() {},
    };

    const res = await flushQueue(q, gw);

    expect(res.blocked).toBe(1);
    expect(q.find(op.opId)?.status).toBe('blocked');
    expect(q.find(op.opId)?.attempts).toBe(1);
  });

  it('bloqueia após MAX_SYNC_ATTEMPTS falhas transitórias', async () => {
    const q = createOfflineQueue();
    const op = q.enqueue({ table: 'vehicles', action: 'upsert', entityId: 'v-1', payload: {} });
    const gw: SyncGateway = {
      async upsert() {
        throw new Error('network offline');
      },
      async delete() {},
    };

    let clock = 0;
    for (let attempt = 0; attempt < MAX_SYNC_ATTEMPTS; attempt += 1) {
      await flushQueue(q, gw, 20, () => clock);
      clock += 10 * 60_000;
    }

    expect(q.find(op.opId)?.status).toBe('blocked');
    expect(q.find(op.opId)?.attempts).toBe(MAX_SYNC_ATTEMPTS);
  });

  it('coalesce mantém a intenção final: gainho + delete colapsa em delete', async () => {
    const q = createOfflineQueue();
    q.enqueue({ table: 'transactions', action: 'upsert', entityId: 't-1', payload: { a: 1 } });
    const del = q.enqueue({
      table: 'transactions',
      action: 'delete',
      entityId: 't-1',
      payload: { id: 't-1' },
    });
    const seen: string[] = [];
    const gw: SyncGateway = {
      async upsert() {
        seen.push('upsert');
      },
      async delete(table) {
        seen.push(`delete:${table}`);
      },
    };

    const res = await flushQueue(q, gw);

    expect(seen).toEqual(['delete:transactions']);
    expect(res.flushed).toBe(1);
    expect(q.find(del.opId)).toBeUndefined();
  });

  it('só descarta operações da mesma entidade depois do sucesso confirmado', async () => {
    const q = createOfflineQueue();
    q.enqueue({ table: 'vehicles', action: 'upsert', entityId: 'v-1', payload: { nome: 'antigo' } });
    q.enqueue({ table: 'vehicles', action: 'upsert', entityId: 'v-1', payload: { nome: 'novo' } });

    const failing: SyncGateway = {
      async upsert() {
        throw new Error('network offline');
      },
      async delete() {},
    };
    await flushQueue(q, failing);
    // A falha não pode apagar nada: a segunda payload ainda está na fila.
    expect(q.size()).toBe(1);
    expect(q.all()[0].payload).toEqual({ nome: 'novo' });
  });
});
