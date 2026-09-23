import { describe, expect, it } from 'vitest';
import {
  addMonthsClamped,
  calculateCommitmentProgress,
  calculatePayablesSummary,
  deriveInstallmentStatus,
  generatePayableSchedule,
  mergeCommitmentSchedule,
  migrateFinancialState,
  reconcileFinancialState,
  removeTransactionWithFinancialReconciliation,
  resolveScheduleThroughMonth,
  reopenInstallment,
  settleInstallment,
} from './payables';
import { FinancialCommitment, FinancialState, OtherExpenseTransaction } from '../types';

const makeCommitment = (overrides: Partial<FinancialCommitment> = {}): FinancialCommitment => ({
  id: 'bill-1',
  title: 'Financiamento da moto',
  type: 'financiamento_veiculo',
  category: 'Financiamento',
  creditor: 'Banco Exemplo',
  vehicleId: 'veh-factor-150',
  installmentAmount: 500,
  totalInstallments: 4,
  firstDueDate: '2026-01-31',
  dueDay: 31,
  status: 'ativo',
  createdAt: 1,
  ...overrides,
});

const makeState = (commitment = makeCommitment()): FinancialState => ({
  version: 3,
  commitments: [commitment],
  installments: generatePayableSchedule(commitment, '2026-12', 0, 1),
});

describe('payables schedule', () => {
  it('clamps days 29, 30 and 31 to the last valid day without drifting', () => {
    expect(addMonthsClamped('2025-01-31', 1)).toBe('2025-02-28');
    expect(addMonthsClamped('2026-01-30', 1)).toBe('2026-02-28');
    expect(addMonthsClamped('2024-01-29', 1)).toBe('2024-02-29');
    expect(addMonthsClamped('2026-01-31', 2)).toBe('2026-03-31');
  });

  it('generates a single due date for one-time bills', () => {
    const commitment = makeCommitment({
      type: 'conta_unica',
      totalInstallments: undefined,
      firstDueDate: '2026-09-25',
    });
    const installments = generatePayableSchedule(commitment, '2027-12', 0, 1);
    expect(installments).toHaveLength(1);
    expect(installments[0].dueDate).toBe('2026-09-25');
  });

  it('generates recurring occurrences only through the requested month', () => {
    const commitment = makeCommitment({
      type: 'conta_recorrente',
      totalInstallments: undefined,
      firstDueDate: '2026-07-10',
    });
    const installments = generatePayableSchedule(commitment, '2026-09', 0, 1);
    expect(installments.map((item) => item.dueDate)).toEqual([
      '2026-07-10',
      '2026-08-10',
      '2026-09-10',
    ]);
  });

  it('uses the full end date for a three-year recurring account', () => {
    const commitment = makeCommitment({
      type: 'conta_recorrente',
      totalInstallments: undefined,
      firstDueDate: '2026-10-02',
      endDate: '2029-09-02',
    });
    const throughMonth = resolveScheduleThroughMonth(commitment, '2026-09');
    const installments = generatePayableSchedule(commitment, throughMonth, 0, 1);

    expect(throughMonth).toBe('2029-09');
    expect(installments).toHaveLength(36);
    expect(installments.at(-1)?.dueDate).toBe('2029-09-02');
  });

  it('keeps an open-ended recurrence on a rolling projection window', () => {
    const commitment = makeCommitment({
      type: 'conta_recorrente',
      totalInstallments: undefined,
      firstDueDate: '2026-10-02',
      endDate: undefined,
    });

    expect(resolveScheduleThroughMonth(commitment, '2026-09')).toBe('2027-09');
  });

  it('imports explicitly informed historical installments without creating transactions', () => {
    const commitment = makeCommitment();
    const installments = generatePayableSchedule(commitment, '2026-12', 2, 1);
    expect(installments.filter((item) => item.paymentOrigin === 'opening_balance')).toHaveLength(2);
    expect(installments[0].transactionId).toBeUndefined();
  });
});

describe('payables payments and reconciliation', () => {
  it('creates exactly one expense when an installment is paid repeatedly', () => {
    const state = makeState();
    const first = settleInstallment(
      state,
      [],
      state.installments[0].id,
      510,
      '2026-01-30',
      '10:00',
      2,
    );
    const repeated = settleInstallment(
      first.financialState,
      first.transactions,
      state.installments[0].id,
      510,
      '2026-01-30',
      '10:01',
      3,
    );
    expect(first.changed).toBe(true);
    expect(repeated.changed).toBe(false);
    expect(repeated.transactions).toHaveLength(1);
    expect(repeated.transactions[0].payableInstallmentId).toBe(state.installments[0].id);
  });

  it('reopens a payment and removes its linked expense', () => {
    const state = makeState();
    const paid = settleInstallment(
      state,
      [],
      state.installments[0].id,
      500,
      '2026-01-31',
      '09:00',
      2,
    );
    const reopened = reopenInstallment(
      paid.financialState,
      paid.transactions,
      state.installments[0].id,
      3,
    );
    expect(reopened.changed).toBe(true);
    expect(reopened.transactions).toHaveLength(0);
    expect(reopened.financialState.installments[0].paidAt).toBeUndefined();
  });

  it('reopens the installment when its linked transaction is deleted', () => {
    const state = makeState();
    const paid = settleInstallment(
      state,
      [],
      state.installments[0].id,
      500,
      '2026-01-31',
      '09:00',
      2,
    );
    const removed = removeTransactionWithFinancialReconciliation(
      paid.financialState,
      paid.transactions,
      paid.transactions[0].id,
    );
    expect(removed.transactions).toHaveLength(0);
    expect(removed.financialState.installments[0].transactionId).toBeUndefined();
  });

  it('synchronizes amount and date after editing the linked transaction', () => {
    const state = makeState();
    const paid = settleInstallment(
      state,
      [],
      state.installments[0].id,
      500,
      '2026-01-31',
      '09:00',
      2,
    );
    const edited = paid.transactions.map((transaction) => ({
      ...transaction,
      amount: 525,
      date: '2026-02-01',
    })) as OtherExpenseTransaction[];
    const reconciled = reconcileFinancialState(paid.financialState, edited);
    expect(reconciled.installments[0].paidAmount).toBe(525);
    expect(reconciled.installments[0].paidAt).toBe('2026-02-01');
  });

  it('clears orphaned transaction links idempotently', () => {
    const state = makeState();
    state.installments[0] = {
      ...state.installments[0],
      transactionId: 'missing',
      paymentOrigin: 'transaction',
      paidAt: '2026-01-31',
      paidAmount: 500,
    };
    const once = reconcileFinancialState(state, []);
    const twice = reconcileFinancialState(once, []);
    expect(once.installments[0].transactionId).toBeUndefined();
    expect(twice).toEqual(once);
  });
});

describe('payables aggregates and migration', () => {
  it('preserves paid history while rebuilding only future installments', () => {
    const state = makeState();
    const paid = settleInstallment(
      state,
      [],
      state.installments[0].id,
      500,
      '2026-01-31',
      '09:00',
      2,
    );
    const updated = makeCommitment({
      installmentAmount: 550,
      firstDueDate: '2026-02-15',
      dueDay: 15,
    });
    const merged = mergeCommitmentSchedule(
      updated,
      paid.financialState.installments,
      paid.transactions,
      '2026-12',
      3,
    );
    expect(merged[0].dueDate).toBe('2026-01-31');
    expect(merged[0].expectedAmount).toBe(500);
    expect(merged[1].dueDate).toBe('2026-03-15');
    expect(merged[1].expectedAmount).toBe(550);
  });

  it('calculates paid, remaining and monetary progress', () => {
    const commitment = makeCommitment();
    const state: FinancialState = {
      version: 3,
      commitments: [commitment],
      installments: generatePayableSchedule(commitment, '2026-12', 2, 1),
    };
    const progress = calculateCommitmentProgress(commitment, state.installments, []);
    expect(progress.paidInstallments).toBe(2);
    expect(progress.openInstallments).toBe(2);
    expect(progress.totalPaid).toBe(1000);
    expect(progress.openBalance).toBe(1000);
    expect(progress.progressPercent).toBe(50);
  });

  it('derives overdue status from the supplied date', () => {
    const installment = makeState().installments[0];
    expect(deriveInstallmentStatus(installment, [], '2026-02-01')).toBe('atrasada');
    expect(deriveInstallmentStatus(installment, [], '2026-01-28')).toBe('vence_em_breve');
  });

  it('calculates the coverage gap and daily requirement without changing the goal', () => {
    const commitment = makeCommitment({
      firstDueDate: '2026-09-25',
      installmentAmount: 900,
      totalInstallments: 1,
    });
    const installments = generatePayableSchedule(commitment, '2026-09', 0, 1);
    const summary = calculatePayablesSummary(
      [commitment],
      installments,
      [],
      '2026-09',
      300,
      '2026-09-23',
    );
    expect(summary.pendingAmount).toBe(900);
    expect(summary.coverageGap).toBe(600);
    expect(summary.daysRemaining).toBe(8);
    expect(summary.dailyRequired).toBe(75);
  });

  it('filters pending and paid totals by the selected month', () => {
    const commitment = makeCommitment({
      type: 'conta_recorrente',
      firstDueDate: '2026-08-10',
      totalInstallments: undefined,
      installmentAmount: 200,
    });
    const state: FinancialState = {
      version: 3,
      commitments: [commitment],
      installments: generatePayableSchedule(commitment, '2026-10', 0, 1),
    };
    const september = state.installments.find((item) => item.referenceMonth === '2026-09');
    if (!september) throw new Error('Parcela de setembro não gerada');
    const paid = settleInstallment(state, [], september.id, 210, '2026-09-12', '10:00', 2);

    const septemberSummary = calculatePayablesSummary(
      paid.financialState.commitments,
      paid.financialState.installments,
      paid.transactions,
      '2026-09',
      0,
      '2026-09-23',
    );
    const octoberSummary = calculatePayablesSummary(
      paid.financialState.commitments,
      paid.financialState.installments,
      paid.transactions,
      '2026-10',
      0,
      '2026-09-23',
    );

    expect(septemberSummary.pendingAmount).toBe(0);
    expect(septemberSummary.paidAmount).toBe(210);
    expect(octoberSummary.pendingAmount).toBe(200);
    expect(octoberSummary.paidAmount).toBe(0);
  });

  it('migrates empty and existing data to version 3 idempotently', () => {
    expect(migrateFinancialState(null)).toEqual({ version: 3, commitments: [], installments: [] });
    const state = makeState();
    expect(migrateFinancialState(migrateFinancialState(JSON.stringify(state)))).toEqual(state);
  });
});
