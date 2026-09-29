import { describe, it, expect, beforeEach } from 'vitest';
import { createOfflineQueue, retryDelayMs } from './offlineQueue';

describe('offlineQueue (ETAPA 6 — fila idempotente)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('enfileira uma operação e persiste no localStorage', () => {
    const q = createOfflineQueue();
    const op = q.enqueue({
      table: 'transactions',
      action: 'upsert',
      entityId: 'tx-1',
      payload: { id: 'tx-1' },
    });

    expect(q.size()).toBe(1);
    expect(op).toMatchObject({
      table: 'transactions',
      action: 'upsert',
      entityId: 'tx-1',
      attempts: 0,
    });
    expect(JSON.parse(localStorage.getItem('rota_financeira_sync_v2')!)).toHaveLength(1);
  });

  it('é idempotente: enfileirar a MESMA entidade (tabela+ação) não duplica', () => {
    const q = createOfflineQueue();

    const first = q.enqueue({
      table: 'shifts',
      action: 'upsert',
      entityId: 'shift-9',
      payload: {},
    });
    const second = q.enqueue({
      table: 'shifts',
      action: 'upsert',
      entityId: 'shift-9',
      payload: {},
    });

    expect(q.size()).toBe(1);
    expect(first.opId).toBe(second.opId);
  });

  it('enfileira ações distintas para a mesma entidade (upsert vs delete)', () => {
    const q = createOfflineQueue();
    q.enqueue({ table: 'vehicles', action: 'upsert', entityId: 'v1', payload: {} });
    q.enqueue({ table: 'vehicles', action: 'delete', entityId: 'v1', payload: { id: 'v1' } });
    expect(q.size()).toBe(2);
  });

  it('remove, bumpAttempts e clear funcionam isoladamente', () => {
    const q = createOfflineQueue();
    const op = q.enqueue({
      table: 'transactions',
      action: 'upsert',
      entityId: 'tx-2',
      payload: {},
    });

    q.bumpAttempts(op.opId);
    expect(q.all()[0].attempts).toBe(1);

    q.remove(op.opId);
    expect(q.size()).toBe(0);

    q.enqueue({ table: 'transactions', action: 'upsert', entityId: 'tx-3', payload: {} });
    q.clear();
    expect(q.size()).toBe(0);
  });

  it('enfileira com opId determinístico via idFactory injetada', () => {
    const q = createOfflineQueue();
    const op = q.enqueue(
      { table: 'fuel_records', action: 'upsert', entityId: 'fuel-1', payload: {} },
      () => 'op-fixed-1',
    );
    expect(op.opId).toBe('op-fixed-1');
  });

  it('enqueueMany preserva a ordem e grava o lote inteiro de uma vez', () => {
    const q = createOfflineQueue();
    const applied = q.enqueueMany([
      { table: 'commitments', action: 'upsert', entityId: 'c-1', payload: {} },
      { table: 'shifts', action: 'upsert', entityId: 's-1', payload: {} },
      { table: 'transactions', action: 'upsert', entityId: 't-1', payload: {} },
    ]);

    expect(applied.map((op) => op.table)).toEqual(['commitments', 'shifts', 'transactions']);
    expect(q.all().map((op) => op.entityId)).toEqual(['c-1', 's-1', 't-1']);
  });

  it('reenfileirar a mesma entidade zera tentativas, erro e backoff', () => {
    const q = createOfflineQueue();
    const op = q.enqueue({ table: 'vehicles', action: 'upsert', entityId: 'v-3', payload: {} });
    q.markFailed(op.opId, new Error('timeout'), 1000);
    q.block(op.opId, new Error('check violado'));
    expect(q.find(op.opId)?.status).toBe('blocked');

    q.enqueue({ table: 'vehicles', action: 'upsert', entityId: 'v-3', payload: { id: 'v-3' } });

    const revived = q.find(op.opId);
    expect(revived?.status).toBe('pending');
    expect(revived?.attempts).toBe(0);
    expect(revived?.lastError).toBeUndefined();
    expect(revived?.nextAttemptAt).toBeUndefined();
    expect(q.size()).toBe(1);
  });

  it('backoff cresce exponencialmente e satura', () => {
    expect(retryDelayMs(1)).toBe(1_000);
    expect(retryDelayMs(2)).toBe(2_000);
    expect(retryDelayMs(3)).toBe(4_000);
    expect(retryDelayMs(9)).toBe(256_000);
    // Expoente limitado a 8 e teto de 5 min: nunca passa de 300s.
    expect(retryDelayMs(20)).toBe(256_000);
    expect(retryDelayMs(50)).toBeLessThanOrEqual(300_000);
  });

  it('nextBatch respeita o backoff e ignora operações bloqueadas', () => {
    const q = createOfflineQueue();
    const a = q.enqueue({ table: 'vehicles', action: 'upsert', entityId: 'v-1', payload: {} });
    q.enqueue({ table: 'vehicles', action: 'upsert', entityId: 'v-2', payload: {} });
    q.markFailed(a.opId, new Error('rede'), 10_000);
    const b = q.enqueue({ table: 'vehicles', action: 'upsert', entityId: 'v-3', payload: {} });
    q.block(b.opId, new Error('23514'));

    // markFailed agendou a retry de v-1 para 11s; v-3 está bloqueado.
    expect(q.nextBatch(10, 10_050).map((op) => op.entityId)).toEqual(['v-2']);
    expect(q.nextBatch(10, 11_000).map((op) => op.entityId)).toEqual(['v-1', 'v-2']);
    expect(q.stats()).toEqual({ pending: 2, blocked: 1, total: 3 });
  });

  it('retryBlocked revive todas as bloqueadas de uma vez', () => {
    const q = createOfflineQueue();
    const a = q.enqueue({ table: 'vehicles', action: 'upsert', entityId: 'v-1', payload: {} });
    const b = q.enqueue({ table: 'shifts', action: 'upsert', entityId: 's-1', payload: {} });
    q.block(a.opId, new Error('23505'));
    q.block(b.opId, new Error('23514'));

    expect(q.retryBlocked()).toBe(2);
    expect(q.stats()).toEqual({ pending: 2, blocked: 0, total: 2 });
    expect(q.find(a.opId)?.attempts).toBe(0);
  });

  it('corrompido no localStorage: a fila se recupera como vazia em vez de quebrar', () => {
    localStorage.setItem('rota_financeira_sync_v2', '{nao é json');
    const q = createOfflineQueue();
    expect(q.all()).toEqual([]);
    q.enqueue({ table: 'vehicles', action: 'upsert', entityId: 'v-1', payload: {} });
    expect(q.size()).toBe(1);
  });

  it('fila é isolada por escopo: chaves de usuários diferentes não se misturam', () => {
    const alice = createOfflineQueue('giro_certo_user_alice_v4_sync_queue');
    const bob = createOfflineQueue('giro_certo_user_bob_v4_sync_queue');
    alice.enqueue({ table: 'vehicles', action: 'upsert', entityId: 'v-1', payload: {} });
    bob.enqueue({ table: 'vehicles', action: 'upsert', entityId: 'v-2', payload: {} });

    expect(alice.all().map((op) => op.entityId)).toEqual(['v-1']);
    expect(bob.all().map((op) => op.entityId)).toEqual(['v-2']);
  });
});
