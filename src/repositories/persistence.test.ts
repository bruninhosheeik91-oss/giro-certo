import { describe, it, expect, beforeEach } from 'vitest';
import { createOfflineQueue } from '../lib/offlineQueue';
import { normalizeUuid } from '../lib/uuid';
import { getScopedStorageKeys } from './storageKeys';
import {
  createDefaultSnapshot,
  hasPersistedLocalData,
  markScopeTouched,
  readAppSnapshot,
  writeAppSnapshot,
} from './appSnapshot';
import { importLocalScopeOnce, mergeCloudSnapshot, queueSnapshotUpserts } from './persistence';

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';

describe('migração localStorage → conta (Fase 4B)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('hasPersistedLocalData é falso numa instalação que nunca gravou', () => {
    const local = getScopedStorageKeys('local');
    expect(hasPersistedLocalData(local)).toBe(false);

    // O default semeia mockData, mas isso não conta como dado do usuário.
    writeAppSnapshot(local, createDefaultSnapshot('local'));
    expect(hasPersistedLocalData(local)).toBe(false);
  });

  it('hasPersistedLocalData detecta o escopo local já persistido', () => {
    const local = getScopedStorageKeys('local');
    localStorage.setItem(local.transactions, JSON.stringify([{ id: 'tx-local' }]));
    expect(hasPersistedLocalData(local)).toBe(true);
  });

  it('hasPersistedLocalData pega edição e remoção dentro da semente', () => {
    const local = getScopedStorageKeys('local');
    writeAppSnapshot(local, createDefaultSnapshot('local'));
    expect(hasPersistedLocalData(local)).toBe(false);

    // Usuário apagou um lançamento da demonstração: os IDs restantes ainda são
    // da semente, só falta um.
    const remaining = createDefaultSnapshot('local').transactions.slice(1);
    writeAppSnapshot(local, { ...createDefaultSnapshot('local'), transactions: remaining });
    expect(hasPersistedLocalData(local)).toBe(true);
  });

  it('markScopeTouched faz a migração rodar mesmo sem linha nova', () => {
    const local = getScopedStorageKeys('local');
    writeAppSnapshot(local, createDefaultSnapshot('local'));
    expect(hasPersistedLocalData(local)).toBe(false);

    markScopeTouched(local);
    expect(hasPersistedLocalData(local)).toBe(true);
  });

  it('importa o escopo local uma única vez e marca localImportCompletedAt', () => {
    const local = getScopedStorageKeys('local');
    localStorage.setItem(local.transactions, JSON.stringify([{ id: 'tx-local', amount: 42 }]));
    localStorage.setItem(local.vehicles, JSON.stringify([{ id: 'veh-local', nickname: 'Moto' }]));

    const queue = createOfflineQueue();
    const cloud = createDefaultSnapshot('cloud');

    const outcome = importLocalScopeOnce(local, cloud, queue, ALICE);

    expect(outcome.imported).toBeGreaterThan(0);
    expect(outcome.alreadyImported).toBe(false);

    const tables = new Set(queue.all().map((op) => op.table));
    expect(tables).toContain('transactions');
    expect(tables).toContain('vehicles');

    const settingsOp = queue
      .all()
      .find((op) => op.table === 'user_settings' && op.entityId === ALICE);
    expect(settingsOp?.payload).toMatchObject({
      local_import_completed_at: new Date(outcome.completedAt).toISOString(),
    });
  });

  it('não reimporta quando outro dispositivo já concluiu a migração', () => {
    const local = getScopedStorageKeys('local');
    localStorage.setItem(local.transactions, JSON.stringify([{ id: 'tx-local' }]));

    const queue = createOfflineQueue();
    const cloud = createDefaultSnapshot('cloud');
    const markedAt = new Date().toISOString();
    cloud.settings.localImportCompletedAt = markedAt;

    const outcome = importLocalScopeOnce(local, cloud, queue, ALICE);

    expect(outcome).toEqual({ imported: 0, completedAt: Date.parse(markedAt), alreadyImported: true });
    expect(queue.size()).toBe(0);
  });

  it('carimba a conclusão mesmo sem dado local, senão o servidor nunca sabe', () => {
    const queue = createOfflineQueue();
    const outcome = importLocalScopeOnce(
      getScopedStorageKeys('local'),
      createDefaultSnapshot('cloud'),
      queue,
      ALICE,
    );

    expect(outcome.imported).toBe(0);
    const ops = queue.all();
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({
      table: 'user_settings',
      action: 'upsert',
      entityId: ALICE,
      payload: {
        user_id: ALICE,
        local_import_completed_at: new Date(outcome.completedAt).toISOString(),
      },
    });
  });

  it('é idempotente: reexecutar com o mesmo escopo reescreve as mesmas linhas', () => {
    const local = getScopedStorageKeys('local');
    localStorage.setItem(local.transactions, JSON.stringify([{ id: 'tx-local' }]));

    const first = createOfflineQueue('queue-a');
    importLocalScopeOnce(local, createDefaultSnapshot('cloud'), first, ALICE);
    const firstIds = first.all().map((op) => op.entityId).sort();

    const second = createOfflineQueue('queue-b');
    importLocalScopeOnce(local, createDefaultSnapshot('cloud'), second, ALICE);
    const secondIds = second.all().map((op) => op.entityId).sort();

    expect(secondIds).toEqual(firstIds);
  });

  it('preserva parcelas pagas em vez de recalcular o status', () => {
    const local = getScopedStorageKeys('local');
    localStorage.setItem(
      local.financial,
      JSON.stringify({
        version: 3,
        commitments: [
          {
            id: 'fin-1',
            type: 'financiamento',
            description: 'Moto 36x',
            totalAmount: 18_000,
            installments: 36,
            interestRate: 1.8,
            startDate: '2024-01-10',
            firstDueDate: '2024-02-10',
            status: 'ativo',
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        installments: [
          {
            id: 'inst-1',
            commitmentId: 'fin-1',
            number: 1,
            referenceMonth: '2024-02',
            dueDate: '2024-02-10',
            expectedAmount: 500,
            paidAt: '2024-02-11',
            paidAmount: 500,
            transactionId: 'tx-pagadora',
            createdAt: 1,
            updatedAt: 1,
          },
          {
            id: 'inst-2',
            commitmentId: 'fin-1',
            number: 2,
            referenceMonth: '2024-03',
            dueDate: '2024-03-10',
            expectedAmount: 500,
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      }),
    );

    const queue = createOfflineQueue();
    importLocalScopeOnce(local, createDefaultSnapshot('cloud'), queue, ALICE);

    const installments = queue
      .all()
      .filter((op) => op.table === 'installments')
      .map((op) => op.payload as { number: number; status: string; paid_at: string | null; paid_amount: number | null })
      .sort((a, b) => a.number - b.number);

    expect(installments).toHaveLength(2);
    expect(installments[0]).toMatchObject({
      number: 1,
      status: 'paga',
      paid_at: '2024-02-11',
      paid_amount: 500,
    });
    expect(installments[1]).toMatchObject({ number: 2, status: 'pendente', paid_at: null });
  });

  it('mantém o vínculo da parcela paga com a transação que a quitou', () => {
    const local = getScopedStorageKeys('local');
    localStorage.setItem(local.financial, JSON.stringify({
      version: 3,
      commitments: [
        {
          id: 'fin-2',
          type: 'compra_parcelada',
          description: 'Bateria',
          totalAmount: 1_200,
          installments: 12,
          interestRate: 0,
          startDate: '2024-03-01',
          firstDueDate: '2024-04-01',
          status: 'ativo',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      installments: [
        {
          id: 'inst-10',
          commitmentId: 'fin-2',
          number: 1,
          referenceMonth: '2024-04',
          dueDate: '2024-04-01',
          expectedAmount: 100,
          paidAt: '2024-04-02',
          paidAmount: 100,
          transactionId: 'tx-quitacao',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    }));

    const queue = createOfflineQueue();
    importLocalScopeOnce(local, createDefaultSnapshot('cloud'), queue, ALICE);

    const op = queue.all().find((item) => item.table === 'installments');
    expect(op).toBeDefined();
    const payload = op?.payload as { transaction_id: string | null; status: string };
    // A transação que quitou a parcela é normalizada para o mesmo UUID do usuário.
    expect(payload.transaction_id).toBe(normalizeUuid('tx-quitacao', ALICE, 'transaction'));
    expect(payload.status).toBe('paga');
  });
});

describe('isolamento entre usuários (RLS + escopo local)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('chaves de escopo não colidem entre dois usuários', () => {
    const alice = getScopedStorageKeys(ALICE);
    const bob = getScopedStorageKeys(BOB);
    const shared = Object.keys(alice).filter((key) => alice[key as keyof typeof alice] === bob[key as keyof typeof bob]);
    expect(shared).toEqual([]);
  });

  it('snapshot de um usuário não aparece no cache do outro', () => {
    writeAppSnapshot(getScopedStorageKeys(ALICE), {
      ...createDefaultSnapshot('cloud'),
      profile: { ...createDefaultSnapshot('cloud').profile, name: 'Alice' },
    });

    const bobSnapshot = readAppSnapshot(getScopedStorageKeys(BOB), 'cloud', BOB);
    expect(bobSnapshot.profile.name).not.toBe('Alice');
  });

  it('merge descarta o item local sem upsert pendente e preserva com', () => {
    const local = createDefaultSnapshot('cloud');
    const cloud = createDefaultSnapshot('cloud');
    const extra = {
      ...cloud.vehicles[0]!,
      id: 'veh-extra-alice',
      model: 'CG 160',
      nickname: 'Moto da Alice',
      isActive: false,
      createdAt: 5,
      updatedAt: 5,
    };
    local.vehicles = [...local.vehicles, extra];

    const emptyQueue = createOfflineQueue('queue-empty');
    const semFila = mergeCloudSnapshot(local, cloud, emptyQueue, ALICE);
    expect(semFila.vehicles.map((item) => item.id)).not.toContain('veh-extra-alice');

    const pendingQueue = createOfflineQueue('queue-pending');
    queueSnapshotUpserts(local, pendingQueue, ALICE);
    const comFila = mergeCloudSnapshot(local, cloud, pendingQueue, ALICE);
    expect(comFila.vehicles.map((item) => item.id)).toContain('veh-extra-alice');
    expect(comFila.vehicles.find((item) => item.id === 'veh-extra-alice')?.nickname).toBe(
      'Moto da Alice',
    );
  });

  it('merge dá precedência ao item local mais recente quando ambos estão pendentes', () => {
    const local = createDefaultSnapshot('cloud');
    const cloud = createDefaultSnapshot('cloud');
    local.vehicles = [
      {
        ...local.vehicles[0]!,
        id: 'veh-1',
        model: 'CG 160',
        nickname: 'Local novo',
        createdAt: 10,
        updatedAt: 10,
      },
    ];
    cloud.vehicles = [
      {
        ...cloud.vehicles[0]!,
        id: 'veh-1',
        model: 'CG 160',
        nickname: 'Nuvem velha',
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    const queue = createOfflineQueue('queue-recent');
    queueSnapshotUpserts(local, queue, ALICE);
    const merged = mergeCloudSnapshot(local, cloud, queue, ALICE);
    expect(merged.vehicles[0].nickname).toBe('Local novo');
  });
});
