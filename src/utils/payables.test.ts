import { describe, expect, it } from 'vitest';
import {
  addMonthsClamped,
  calculateCommitmentProgress,
  calculatePayablesSummary,
  deriveInstallmentStatus,
  generatePayableSchedule,
  isInstallmentPaid,
  mergeCommitmentSchedule,
  migrateFinancialState,
  reconcileFinancialState,
  removeTransactionWithFinancialReconciliation,
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

  it('imports explicitly informed historical installments without creating transactions', () => {
    const commitment = makeCommitment();
    const installments = generatePayableSchedule(commitment, '2026-12', 2, 1);
    expect(installments.filter((item) => item.paymentOrigin === 'opening_balance')).toHaveLength(2);
    expect(installments[0].transactionId).toBeUndefined();
  });
});

describe('payables recurring schedule with an end date', () => {
  const THREE_YEAR_RECURRING = (installmentAmount = 748): FinancialCommitment =>
    makeCommitment({
      type: 'conta_recorrente',
      totalInstallments: undefined,
      installmentAmount,
      firstDueDate: '2026-10-02',
      endDate: '2029-09-02',
    });

  it('generates exactly 36 installments for a 3 year recurring bill, not limited to 12', () => {
    const installments = generatePayableSchedule(THREE_YEAR_RECURRING(), '2027-09', 0, 1);
    expect(installments).toHaveLength(36);
    expect(installments[0].dueDate).toBe('2026-10-02');
    expect(installments[35].dueDate).toBe('2029-09-02');
    expect(installments.map((item) => item.number)).toEqual(
      Array.from({ length: 36 }, (_, i) => i + 1),
    );
  });

  it('does not allow a fixed 12-installment limit when an end date defines the duration', () => {
    const earlyWindow = generatePayableSchedule(THREE_YEAR_RECURRING(), '2027-09', 0, 1);
    const farWindow = generatePayableSchedule(THREE_YEAR_RECURRING(), '2030-12', 0, 1);
    expect(earlyWindow).toHaveLength(36);
    expect(farWindow).toHaveLength(36);
  });

  it('totals exactly R$ 26.928,00 for 36 installments of R$ 748,00', () => {
    const installments = generatePayableSchedule(THREE_YEAR_RECURRING(), '2027-09', 0, 1);
    const total = installments.reduce((sum, item) => sum + item.expectedAmount, 0);
    expect(total).toBe(26928);
    const progress = calculateCommitmentProgress(THREE_YEAR_RECURRING(), installments, []);
    expect(progress.totalInstallments).toBe(36);
    expect(progress.totalExpected).toBe(26928);
  });

  it('does not present the 12 month rolling projection as the contract duration', () => {
    const commitment = THREE_YEAR_RECURRING();
    const openEnded = {
      ...commitment,
      endDate: undefined,
    };
    const projected = generatePayableSchedule(openEnded, '2027-09', 0, 1);
    expect(projected).toHaveLength(12);
    const progress = calculateCommitmentProgress(openEnded, projected, []);
    expect(progress.isOpenEnded).toBe(true);
    expect(progress.totalInstallments).toBe(0);
    expect(progress.projectedEndDate).toBeUndefined();
  });

  it('returns an empty schedule when the end date comes before the first due date', () => {
    const commitment = THREE_YEAR_RECURRING();
    const invalid = {
      ...commitment,
      endDate: '2026-09-02',
    };
    expect(generatePayableSchedule(invalid, '2027-09', 0, 1)).toEqual([]);
  });

  it('preserves paid installments when editing a recurring contract with an end date', () => {
    const commitment = THREE_YEAR_RECURRING();
    const state: FinancialState = {
      version: 3,
      commitments: [commitment],
      installments: generatePayableSchedule(commitment, '2027-09', 0, 1),
    };
    const paid = settleInstallment(
      state,
      [],
      state.installments[0].id,
      748,
      '2026-10-02',
      '09:00',
      2,
    );
    const merged = mergeCommitmentSchedule(
      THREE_YEAR_RECURRING(),
      paid.financialState.installments,
      paid.transactions,
      '2027-09',
      3,
    );
    expect(merged).toHaveLength(36);
    expect(merged[0].number).toBe(1);
    expect(isInstallmentPaid(merged[0], paid.transactions)).toBe(true);
    expect(merged[1].number).toBe(2);
    expect(merged[35].dueDate).toBe('2029-09-02');
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
