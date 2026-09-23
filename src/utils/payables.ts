import {
  FinancialCommitment,
  FinancialCommitmentProgress,
  FinancialState,
  OtherExpenseTransaction,
  PayableInstallment,
  PayableInstallmentStatus,
  PayablesSummary,
  Transaction,
} from '../types';

export const FINANCIAL_SCHEMA_VERSION = 3 as const;

export const EMPTY_FINANCIAL_STATE: FinancialState = {
  version: FINANCIAL_SCHEMA_VERSION,
  commitments: [],
  installments: [],
};

const FIXED_COMMITMENT_TYPES = new Set<FinancialCommitment['type']>([
  'conta_unica',
  'compra_parcelada',
  'financiamento_veiculo',
  'emprestimo',
  'consorcio',
]);

const roundMoney = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

const parseCivilDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
};

const formatCivilDate = (year: number, month: number, day: number) =>
  `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day
    .toString()
    .padStart(2, '0')}`;

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addMonthsClamped(date: string, offset: number): string {
  const parsed = parseCivilDate(date);
  if (!parsed) return date;
  const monthIndex = parsed.year * 12 + (parsed.month - 1) + offset;
  const year = Math.floor(monthIndex / 12);
  const month = (monthIndex % 12) + 1;
  const day = Math.min(parsed.day, daysInMonth(year, month));
  return formatCivilDate(year, month, day);
}

const monthDistance = (fromDate: string, throughMonth: string) => {
  const from = parseCivilDate(fromDate);
  const match = /^(\d{4})-(\d{2})$/.exec(throughMonth);
  if (!from || !match) return -1;
  return Number(match[1]) * 12 + Number(match[2]) - 1 - (from.year * 12 + from.month - 1);
};

const isFixedCommitment = (commitment: FinancialCommitment) =>
  FIXED_COMMITMENT_TYPES.has(commitment.type);

export function generatePayableSchedule(
  commitment: FinancialCommitment,
  throughMonth: string,
  initialPaidInstallments = 0,
  createdAt = Date.now(),
): PayableInstallment[] {
  let count = 0;
  if (commitment.type === 'conta_unica') {
    count = 1;
  } else if (isFixedCommitment(commitment)) {
    count = Math.max(1, Math.floor(commitment.totalInstallments || 1));
  } else {
    count = Math.max(0, monthDistance(commitment.firstDueDate, throughMonth) + 1);
  }

  const paidCount = Math.max(0, Math.min(count, Math.floor(initialPaidInstallments)));
  const installments: PayableInstallment[] = [];

  for (let index = 0; index < count; index += 1) {
    const dueDate = addMonthsClamped(commitment.firstDueDate, index);
    if (commitment.endDate && dueDate > commitment.endDate) break;
    const isOpeningBalance = index < paidCount;
    installments.push({
      id: `installment-${commitment.id}-${index + 1}`,
      commitmentId: commitment.id,
      number: index + 1,
      referenceMonth: dueDate.slice(0, 7),
      dueDate,
      expectedAmount: roundMoney(commitment.installmentAmount),
      paidAt: isOpeningBalance ? dueDate : undefined,
      paidAmount: isOpeningBalance ? roundMoney(commitment.installmentAmount) : undefined,
      paymentOrigin: isOpeningBalance ? 'opening_balance' : undefined,
      createdAt,
    });
  }

  return installments;
}

const getLinkedTransaction = (installment: PayableInstallment, transactions: Transaction[]) =>
  transactions.find(
    (transaction) =>
      transaction.id === installment.transactionId ||
      transaction.payableInstallmentId === installment.id,
  );

export function isInstallmentPaid(
  installment: PayableInstallment,
  transactions: Transaction[],
): boolean {
  if (installment.paymentOrigin === 'opening_balance' && installment.paidAt) return true;
  return Boolean(getLinkedTransaction(installment, transactions));
}

export function getInstallmentPaidAmount(
  installment: PayableInstallment,
  transactions: Transaction[],
): number {
  const linked = getLinkedTransaction(installment, transactions);
  if (linked) return roundMoney(linked.amount);
  if (installment.paymentOrigin === 'opening_balance') {
    return roundMoney(installment.paidAmount ?? installment.expectedAmount);
  }
  return 0;
}

export function deriveInstallmentStatus(
  installment: PayableInstallment,
  transactions: Transaction[],
  today: string,
): PayableInstallmentStatus {
  if (isInstallmentPaid(installment, transactions)) return 'paga';
  if (installment.dueDate < today) return 'atrasada';

  const due = parseCivilDate(installment.dueDate);
  const current = parseCivilDate(today);
  if (!due || !current) return 'pendente';
  const dueEpoch = Date.UTC(due.year, due.month - 1, due.day);
  const currentEpoch = Date.UTC(current.year, current.month - 1, current.day);
  const daysUntilDue = Math.floor((dueEpoch - currentEpoch) / 86_400_000);
  return daysUntilDue <= 5 ? 'vence_em_breve' : 'pendente';
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isFinancialCommitment = (value: unknown): value is FinancialCommitment =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.title === 'string' &&
  typeof value.type === 'string' &&
  typeof value.installmentAmount === 'number' &&
  typeof value.firstDueDate === 'string';

const isPayableInstallment = (value: unknown): value is PayableInstallment =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.commitmentId === 'string' &&
  typeof value.number === 'number' &&
  typeof value.dueDate === 'string' &&
  typeof value.expectedAmount === 'number';

export function migrateFinancialState(raw: unknown): FinancialState {
  let candidate = raw;
  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return { ...EMPTY_FINANCIAL_STATE };
    }
  }
  if (!isRecord(candidate)) return { ...EMPTY_FINANCIAL_STATE };

  const commitments = Array.isArray(candidate.commitments)
    ? candidate.commitments.filter(isFinancialCommitment)
    : [];
  const installments = Array.isArray(candidate.installments)
    ? candidate.installments.filter(isPayableInstallment)
    : [];

  return {
    version: FINANCIAL_SCHEMA_VERSION,
    commitments,
    installments,
  };
}

export function reconcileFinancialState(
  financialState: FinancialState,
  transactions: Transaction[],
): FinancialState {
  const migrated = migrateFinancialState(financialState);
  const transactionsById = new Map(
    transactions.map((transaction) => [transaction.id, transaction]),
  );
  const transactionsByInstallment = new Map(
    transactions
      .filter((transaction) => Boolean(transaction.payableInstallmentId))
      .map((transaction) => [transaction.payableInstallmentId as string, transaction]),
  );

  const installments = migrated.installments.map((installment) => {
    const linked =
      (installment.transactionId ? transactionsById.get(installment.transactionId) : undefined) ??
      transactionsByInstallment.get(installment.id);

    if (linked && linked.type !== 'ganho') {
      const next: PayableInstallment = {
        ...installment,
        transactionId: linked.id,
        paymentOrigin: 'transaction',
        paidAt: linked.date,
        paidAmount: roundMoney(linked.amount),
      };
      return next;
    }

    if (installment.paymentOrigin === 'transaction' || installment.transactionId) {
      const next: PayableInstallment = { ...installment };
      delete next.transactionId;
      delete next.paymentOrigin;
      delete next.paidAt;
      delete next.paidAmount;
      return next;
    }

    return installment;
  });

  return normalizeCommitmentStatuses({ ...migrated, installments }, transactions);
}

export function mergeCommitmentSchedule(
  commitment: FinancialCommitment,
  existing: PayableInstallment[],
  transactions: Transaction[],
  throughMonth: string,
  updatedAt = Date.now(),
): PayableInstallment[] {
  const generated = generatePayableSchedule(commitment, throughMonth, 0, updatedAt);
  const existingByNumber = new Map(
    existing.map((installment) => [installment.number, installment]),
  );
  const merged = generated.map((generatedInstallment) => {
    const current = existingByNumber.get(generatedInstallment.number);
    if (!current) return generatedInstallment;
    if (isInstallmentPaid(current, transactions)) return current;
    return {
      ...generatedInstallment,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt,
    };
  });

  const generatedNumbers = new Set(merged.map((installment) => installment.number));
  for (const current of existing) {
    if (!generatedNumbers.has(current.number) && isInstallmentPaid(current, transactions)) {
      merged.push(current);
    }
  }

  return merged.sort((a, b) => a.number - b.number);
}

export function calculateCommitmentProgress(
  commitment: FinancialCommitment,
  installments: PayableInstallment[],
  transactions: Transaction[],
): FinancialCommitmentProgress {
  const related = installments
    .filter((installment) => installment.commitmentId === commitment.id)
    .sort((a, b) => a.number - b.number);
  const paid = related.filter((installment) => isInstallmentPaid(installment, transactions));
  const open = related.filter((installment) => !isInstallmentPaid(installment, transactions));
  const totalInstallments = commitment.totalInstallments ?? related.length;
  const paidInstallments = paid.length;

  return {
    totalInstallments,
    paidInstallments,
    openInstallments: open.length,
    progressPercent:
      totalInstallments > 0 ? Math.min(100, (paidInstallments / totalInstallments) * 100) : 0,
    totalExpected: roundMoney(
      related.reduce((sum, installment) => sum + installment.expectedAmount, 0),
    ),
    totalPaid: roundMoney(
      paid.reduce(
        (sum, installment) => sum + getInstallmentPaidAmount(installment, transactions),
        0,
      ),
    ),
    openBalance: roundMoney(open.reduce((sum, installment) => sum + installment.expectedAmount, 0)),
    nextInstallment: open.sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] ?? null,
    projectedEndDate: related.at(-1)?.dueDate,
  };
}

function normalizeCommitmentStatuses(
  state: FinancialState,
  transactions: Transaction[],
): FinancialState {
  const commitments = state.commitments.map((commitment) => {
    if (commitment.status === 'cancelado' || commitment.status === 'pausado') return commitment;
    if (!isFixedCommitment(commitment)) return commitment;
    const related = state.installments.filter(
      (installment) => installment.commitmentId === commitment.id,
    );
    const expectedCount = commitment.type === 'conta_unica' ? 1 : commitment.totalInstallments || 1;
    const isCompleted =
      related.length >= expectedCount &&
      related
        .slice(0, expectedCount)
        .every((installment) => isInstallmentPaid(installment, transactions));
    const status: FinancialCommitment['status'] = isCompleted
      ? 'concluido'
      : commitment.status === 'concluido'
        ? 'ativo'
        : commitment.status;
    return status === commitment.status ? commitment : { ...commitment, status };
  });
  return { ...state, commitments };
}

const selectedMonthDaysRemaining = (selectedMonth: string, today: string) => {
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(selectedMonth);
  const current = parseCivilDate(today);
  if (!monthMatch || !current) return 1;
  const selectedIndex = Number(monthMatch[1]) * 12 + Number(monthMatch[2]) - 1;
  const currentIndex = current.year * 12 + current.month - 1;
  if (selectedIndex < currentIndex) return 1;
  const totalDays = daysInMonth(Number(monthMatch[1]), Number(monthMatch[2]));
  if (selectedIndex > currentIndex) return totalDays;
  return Math.max(1, totalDays - current.day + 1);
};

export function calculatePayablesSummary(
  commitments: FinancialCommitment[],
  installments: PayableInstallment[],
  transactions: Transaction[],
  selectedMonth: string,
  availableNetProfit: number,
  today: string,
): PayablesSummary {
  const commitmentsById = new Map(commitments.map((commitment) => [commitment.id, commitment]));
  const isOpenCommitment = (installment: PayableInstallment) => {
    const commitment = commitmentsById.get(installment.commitmentId);
    return commitment?.status === 'ativo';
  };

  const pendingInMonth = installments.filter(
    (installment) =>
      installment.referenceMonth === selectedMonth &&
      isOpenCommitment(installment) &&
      !isInstallmentPaid(installment, transactions),
  );
  const paidInMonth = installments.filter((installment) => {
    if (!isInstallmentPaid(installment, transactions)) return false;
    const linked = getLinkedTransaction(installment, transactions);
    const paidAt = linked?.date ?? installment.paidAt;
    return paidAt?.startsWith(selectedMonth) ?? false;
  });
  const overdue = installments.filter(
    (installment) =>
      isOpenCommitment(installment) &&
      deriveInstallmentStatus(installment, transactions, today) === 'atrasada',
  );
  const nextDue =
    installments
      .filter(
        (installment) =>
          isOpenCommitment(installment) && !isInstallmentPaid(installment, transactions),
      )
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] ?? null;
  const pendingAmount = roundMoney(
    pendingInMonth.reduce((sum, installment) => sum + installment.expectedAmount, 0),
  );
  const coverageGap = roundMoney(Math.max(pendingAmount - Math.max(availableNetProfit, 0), 0));
  const daysRemaining = selectedMonthDaysRemaining(selectedMonth, today);

  return {
    pendingAmount,
    paidAmount: roundMoney(
      paidInMonth.reduce(
        (sum, installment) => sum + getInstallmentPaidAmount(installment, transactions),
        0,
      ),
    ),
    overdueAmount: roundMoney(
      overdue.reduce((sum, installment) => sum + installment.expectedAmount, 0),
    ),
    overdueCount: overdue.length,
    nextDue,
    coverageGap,
    dailyRequired: roundMoney(coverageGap / Math.max(daysRemaining, 1)),
    daysRemaining,
  };
}

export interface FinancialMutationResult {
  financialState: FinancialState;
  transactions: Transaction[];
  changed: boolean;
}

export function settleInstallment(
  financialState: FinancialState,
  transactions: Transaction[],
  installmentId: string,
  paidAmount: number,
  paidAt: string,
  paidTime: string,
  createdAt = Date.now(),
): FinancialMutationResult {
  const state = reconcileFinancialState(financialState, transactions);
  const installment = state.installments.find((item) => item.id === installmentId);
  if (!installment || isInstallmentPaid(installment, transactions)) {
    return { financialState: state, transactions, changed: false };
  }
  const commitment = state.commitments.find((item) => item.id === installment.commitmentId);
  const amount = roundMoney(paidAmount);
  if (!commitment || commitment.status === 'cancelado' || amount <= 0 || !parseCivilDate(paidAt)) {
    return { financialState: state, transactions, changed: false };
  }

  const existingTransaction = transactions.find(
    (transaction) =>
      transaction.id === `tx-payable-${installment.id}` ||
      transaction.payableInstallmentId === installment.id,
  );
  if (existingTransaction) {
    const reconciled = reconcileFinancialState(state, transactions);
    return { financialState: reconciled, transactions, changed: false };
  }

  const transaction: OtherExpenseTransaction = {
    id: `tx-payable-${installment.id}`,
    type: 'outra_despesa',
    category: commitment.category,
    amount,
    date: paidAt,
    time: paidTime,
    description: `${commitment.title}${
      commitment.type === 'conta_unica' ? '' : ` — parcela ${installment.number}`
    }`,
    vehicleId: commitment.vehicleId,
    payableId: commitment.id,
    payableInstallmentId: installment.id,
    createdAt,
  };
  const nextTransactions: Transaction[] = [transaction, ...transactions];
  const installments = state.installments.map((item) =>
    item.id === installment.id
      ? {
          ...item,
          transactionId: transaction.id,
          paymentOrigin: 'transaction' as const,
          paidAt,
          paidAmount: amount,
          updatedAt: createdAt,
        }
      : item,
  );
  const nextState = normalizeCommitmentStatuses({ ...state, installments }, nextTransactions);
  return { financialState: nextState, transactions: nextTransactions, changed: true };
}

export function reopenInstallment(
  financialState: FinancialState,
  transactions: Transaction[],
  installmentId: string,
  updatedAt = Date.now(),
): FinancialMutationResult {
  const installment = financialState.installments.find((item) => item.id === installmentId);
  if (!installment || !isInstallmentPaid(installment, transactions)) {
    return { financialState, transactions, changed: false };
  }
  const linked = getLinkedTransaction(installment, transactions);
  const nextTransactions = linked
    ? transactions.filter((transaction) => transaction.id !== linked.id)
    : transactions;
  const installments = financialState.installments.map((item) => {
    if (item.id !== installmentId) return item;
    const next: PayableInstallment = { ...item, updatedAt };
    delete next.transactionId;
    delete next.paymentOrigin;
    delete next.paidAt;
    delete next.paidAmount;
    return next;
  });
  const nextState = normalizeCommitmentStatuses(
    { ...financialState, installments },
    nextTransactions,
  );
  return { financialState: nextState, transactions: nextTransactions, changed: true };
}

export function removeTransactionWithFinancialReconciliation(
  financialState: FinancialState,
  transactions: Transaction[],
  transactionId: string,
): FinancialMutationResult {
  const nextTransactions = transactions.filter((transaction) => transaction.id !== transactionId);
  if (nextTransactions.length === transactions.length) {
    return { financialState, transactions, changed: false };
  }
  return {
    financialState: reconcileFinancialState(financialState, nextTransactions),
    transactions: nextTransactions,
    changed: true,
  };
}
