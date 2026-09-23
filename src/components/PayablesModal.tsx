import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  FinancialCommitment,
  FinancialCommitmentType,
  OtherExpenseCategory,
  PayableInstallment,
  PayableInstallmentStatus,
} from '../types';
import { formatBRL, formatBRLInput, formatDisplayDate, parseBRLInput } from '../utils/calculations';
import {
  calculateCommitmentProgress,
  deriveInstallmentStatus,
  getInstallmentPaidAmount,
  isInstallmentPaid,
} from '../utils/payables';
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FilePenLine,
  Pause,
  Play,
  Plus,
  ReceiptText,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react';

type Screen = 'list' | 'form' | 'detail';
type ListFilter = 'abertas' | 'pagas' | 'todas';

interface FormState {
  title: string;
  type: FinancialCommitmentType;
  category: OtherExpenseCategory;
  creditor: string;
  amount: string;
  totalInstallments: string;
  initialPaidInstallments: string;
  firstDueDate: string;
  endDate: string;
  vehicleId: string;
  notes: string;
}

const TYPE_LABELS: Record<FinancialCommitmentType, string> = {
  conta_unica: 'Conta única',
  conta_recorrente: 'Conta recorrente',
  compra_parcelada: 'Compra parcelada',
  financiamento_veiculo: 'Financiamento de veículo',
  emprestimo: 'Empréstimo',
  consorcio: 'Consórcio',
};

const CATEGORY_OPTIONS: OtherExpenseCategory[] = [
  'Financiamento',
  'Empréstimo',
  'Consórcio',
  'Compra parcelada',
  'Conta de consumo',
  'Seguro',
  'Aluguel do veículo',
  'Internet',
  'Impostos',
  'Outra',
];

const STATUS_LABELS: Record<PayableInstallmentStatus, string> = {
  pendente: 'Pendente',
  vence_em_breve: 'Vence em breve',
  atrasada: 'Atrasada',
  paga: 'Paga',
};

const STATUS_CLASSES: Record<PayableInstallmentStatus, string> = {
  pendente: 'bg-slate-700/50 text-slate-300 border-slate-600',
  vence_em_breve: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  atrasada: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  paga: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
};

const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now
    .getDate()
    .toString()
    .padStart(2, '0')}`;
};

const emptyForm = (): FormState => ({
  title: '',
  type: 'conta_recorrente',
  category: 'Conta de consumo',
  creditor: '',
  amount: '',
  totalInstallments: '12',
  initialPaidInstallments: '0',
  firstDueDate: localDate(),
  endDate: '',
  vehicleId: '',
  notes: '',
});

const categoryForType = (type: FinancialCommitmentType): OtherExpenseCategory => {
  if (type === 'financiamento_veiculo') return 'Financiamento';
  if (type === 'emprestimo') return 'Empréstimo';
  if (type === 'consorcio') return 'Consórcio';
  if (type === 'compra_parcelada') return 'Compra parcelada';
  return type === 'conta_recorrente' ? 'Conta de consumo' : 'Outra';
};

export const PayablesModal: React.FC = () => {
  const {
    isPayablesModalOpen,
    closePayablesModal,
    selectedMonth,
    financialCommitments,
    payableInstallments,
    payablesSummary,
    transactions,
    vehicles,
    addFinancialCommitment,
    updateFinancialCommitment,
    setFinancialCommitmentStatus,
    removeFinancialCommitment,
    payInstallment,
    reopenPayableInstallment,
  } = useApp();

  const [screen, setScreen] = useState<Screen>('list');
  const [filter, setFilter] = useState<ListFilter>('abertas');
  const [selectedCommitmentId, setSelectedCommitmentId] = useState<string | null>(null);
  const [editingCommitmentId, setEditingCommitmentId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmFutureEdit, setConfirmFutureEdit] = useState(false);
  const [payingInstallmentId, setPayingInstallmentId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(localDate());
  const [reopenConfirmId, setReopenConfirmId] = useState<string | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const [showAllInstallments, setShowAllInstallments] = useState(false);

  const today = localDate();
  const commitmentsById = useMemo(
    () => new Map(financialCommitments.map((commitment) => [commitment.id, commitment])),
    [financialCommitments],
  );
  const selectedCommitment = selectedCommitmentId
    ? (commitmentsById.get(selectedCommitmentId) ?? null)
    : null;

  const listInstallments = useMemo(() => {
    return payableInstallments
      .filter((installment) => {
        const commitment = commitmentsById.get(installment.commitmentId);
        if (!commitment) return false;
        const paid = isInstallmentPaid(installment, transactions);
        const paidMonth =
          transactions
            .find((transaction) => transaction.id === installment.transactionId)
            ?.date.slice(0, 7) ?? installment.paidAt?.slice(0, 7);
        const dueInMonth = installment.referenceMonth === selectedMonth;
        const overdue =
          commitment.status === 'ativo' &&
          deriveInstallmentStatus(installment, transactions, today) === 'atrasada';
        if (filter === 'abertas') {
          return commitment.status === 'ativo' && !paid && (dueInMonth || overdue);
        }
        if (filter === 'pagas') return paid && paidMonth === selectedMonth;
        return dueInMonth || paidMonth === selectedMonth;
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [commitmentsById, filter, payableInstallments, selectedMonth, today, transactions]);

  if (!isPayablesModalOpen) return null;

  const resetTransientState = () => {
    setScreen('list');
    setSelectedCommitmentId(null);
    setEditingCommitmentId(null);
    setForm(emptyForm());
    setFormError(null);
    setConfirmFutureEdit(false);
    setPayingInstallmentId(null);
    setReopenConfirmId(null);
    setRemoveConfirm(false);
    setShowAllInstallments(false);
  };

  const handleClose = () => {
    resetTransientState();
    closePayablesModal();
  };

  const openNewForm = () => {
    setEditingCommitmentId(null);
    setForm(emptyForm());
    setFormError(null);
    setConfirmFutureEdit(false);
    setScreen('form');
  };

  const openDetail = (commitmentId: string) => {
    setSelectedCommitmentId(commitmentId);
    setPayingInstallmentId(null);
    setReopenConfirmId(null);
    setRemoveConfirm(false);
    setShowAllInstallments(false);
    setScreen('detail');
  };

  const openEditForm = (commitment: FinancialCommitment) => {
    const progress = calculateCommitmentProgress(commitment, payableInstallments, transactions);
    setEditingCommitmentId(commitment.id);
    setForm({
      title: commitment.title,
      type: commitment.type,
      category: commitment.category,
      creditor: commitment.creditor || '',
      amount: formatBRLInput(String(Math.round(commitment.installmentAmount * 100))),
      totalInstallments: String(commitment.totalInstallments || 1),
      initialPaidInstallments: String(progress.paidInstallments),
      firstDueDate: commitment.firstDueDate,
      endDate: commitment.endDate || '',
      vehicleId: commitment.vehicleId || '',
      notes: commitment.notes || '',
    });
    setFormError(null);
    setConfirmFutureEdit(false);
    setScreen('form');
  };

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const handleTypeChange = (type: FinancialCommitmentType) => {
    setForm((current) => ({ ...current, type, category: categoryForType(type) }));
  };

  const handleSave = () => {
    setFormError(null);
    const amount = parseBRLInput(form.amount);
    const isFixed = !['conta_unica', 'conta_recorrente'].includes(form.type);
    const totalInstallments = isFixed
      ? Math.max(1, Number(form.totalInstallments) || 1)
      : undefined;
    const initialPaidInstallments = editingCommitmentId
      ? undefined
      : Math.max(0, Number(form.initialPaidInstallments) || 0);
    if (!form.title.trim() || amount <= 0 || !form.firstDueDate) {
      setFormError('Informe nome, valor e primeiro vencimento.');
      return;
    }
    if (
      initialPaidInstallments !== undefined &&
      totalInstallments !== undefined &&
      initialPaidInstallments > totalInstallments
    ) {
      setFormError('Parcelas já pagas não podem superar o total do contrato.');
      return;
    }

    const payload = {
      title: form.title,
      type: form.type,
      category: form.category,
      creditor: form.creditor,
      vehicleId: form.vehicleId || undefined,
      installmentAmount: amount,
      totalInstallments,
      firstDueDate: form.firstDueDate,
      endDate: form.type === 'conta_recorrente' ? form.endDate || undefined : undefined,
      notes: form.notes,
      initialPaidInstallments,
    };

    if (editingCommitmentId) {
      const current = commitmentsById.get(editingCommitmentId);
      if (!current) return;
      const hasPaid = payableInstallments.some(
        (installment) =>
          installment.commitmentId === current.id && isInstallmentPaid(installment, transactions),
      );
      const scheduleChanged =
        current.installmentAmount !== amount ||
        current.firstDueDate !== form.firstDueDate ||
        current.totalInstallments !== totalInstallments;
      if (hasPaid && scheduleChanged && !confirmFutureEdit) {
        setConfirmFutureEdit(true);
        return;
      }
      if (updateFinancialCommitment(editingCommitmentId, payload)) {
        openDetail(editingCommitmentId);
      }
      return;
    }

    const createdId = addFinancialCommitment(payload);
    if (createdId) openDetail(createdId);
  };

  const startPayment = (installment: PayableInstallment) => {
    setPayingInstallmentId(installment.id);
    setPaymentAmount(formatBRLInput(String(Math.round(installment.expectedAmount * 100))));
    setPaymentDate(today);
    setReopenConfirmId(null);
  };

  const confirmPayment = (installmentId: string) => {
    const amount = parseBRLInput(paymentAmount);
    if (payInstallment(installmentId, amount, paymentDate)) {
      setPayingInstallmentId(null);
      setPaymentAmount('');
    }
  };

  const renderHeader = () => {
    const canGoBack = screen !== 'list';
    return (
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/70">
        <div className="flex items-center gap-2.5">
          {canGoBack ? (
            <button
              type="button"
              onClick={() =>
                setScreen(screen === 'form' && editingCommitmentId ? 'detail' : 'list')
              }
              aria-label="Voltar"
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <WalletCards className="w-4 h-4" />
            </div>
          )}
          <div>
            <h2 className="text-sm font-bold text-white">
              {screen === 'form'
                ? editingCommitmentId
                  ? 'Editar conta'
                  : 'Nova conta'
                : screen === 'detail'
                  ? selectedCommitment?.title || 'Detalhes da conta'
                  : 'Contas e Parcelas'}
            </h2>
            <p className="text-[10px] text-slate-400">
              {screen === 'list'
                ? 'Compromissos financeiros sem misturar previsão com despesa'
                : screen === 'form'
                  ? 'Os campos mudam conforme o tipo escolhido'
                  : TYPE_LABELS[selectedCommitment?.type || 'conta_unica']}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Fechar Contas e Parcelas"
          className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  };

  const renderList = () => (
    <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
      <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-blue-950/30 border border-slate-800 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              Pendente no mês
            </span>
            <p className="text-lg font-extrabold font-mono text-white">
              {formatBRL(payablesSummary.pendingAmount)}
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              Pago no mês
            </span>
            <p className="text-lg font-extrabold font-mono text-emerald-400">
              {formatBRL(payablesSummary.paidAmount)}
            </p>
          </div>
        </div>
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3 text-[11px]">
          <span className={payablesSummary.overdueCount ? 'text-rose-300' : 'text-slate-400'}>
            {payablesSummary.overdueCount
              ? `${payablesSummary.overdueCount} em atraso · ${formatBRL(payablesSummary.overdueAmount)}`
              : 'Nenhuma conta atrasada'}
          </span>
          <span className="text-slate-400 text-right">
            {payablesSummary.nextDue
              ? `Próxima: ${formatDisplayDate(payablesSummary.nextDue.dueDate)}`
              : 'Sem próximo vencimento'}
          </span>
        </div>
        {payablesSummary.coverageGap > 0 && (
          <div className="px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-200">
            Estimativa para cobrir as contas: {formatBRL(payablesSummary.dailyRequired)}/dia por{' '}
            {payablesSummary.daysRemaining} dias. Isso não altera sua meta original.
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800">
          {(
            [
              ['abertas', 'Em aberto'],
              ['pagas', 'Pagas'],
              ['todas', 'Todas'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                filter === value
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={openNewForm}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          Nova
        </button>
      </div>

      {listInstallments.length === 0 ? (
        <div className="py-12 px-5 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40">
          <ReceiptText className="w-10 h-10 mx-auto text-slate-600 mb-2" />
          <p className="text-sm font-semibold text-slate-300">
            {financialCommitments.length === 0
              ? 'Nenhuma conta cadastrada'
              : 'Nenhuma conta neste filtro'}
          </p>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Cadastre somente os compromissos que deseja acompanhar.
          </p>
          {financialCommitments.length === 0 && (
            <button
              type="button"
              onClick={openNewForm}
              className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold"
            >
              Cadastrar primeira conta
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {listInstallments.map((installment) => {
            const commitment = commitmentsById.get(installment.commitmentId);
            if (!commitment) return null;
            const status = deriveInstallmentStatus(installment, transactions, today);
            return (
              <button
                key={installment.id}
                type="button"
                onClick={() => openDetail(commitment.id)}
                className="w-full p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 text-left flex items-center justify-between gap-3 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white truncate">
                      {commitment.title}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded-md border text-[9px] font-bold ${STATUS_CLASSES[status]}`}
                    >
                      {STATUS_LABELS[status]}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {commitment.type === 'conta_unica'
                      ? TYPE_LABELS[commitment.type]
                      : `Parcela ${installment.number}${commitment.totalInstallments ? ` de ${commitment.totalInstallments}` : ''}`}{' '}
                    · vence {formatDisplayDate(installment.dueDate)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className={`text-sm font-bold font-mono ${status === 'paga' ? 'text-emerald-400' : 'text-slate-200'}`}
                  >
                    {formatBRL(
                      status === 'paga'
                        ? getInstallmentPaidAmount(installment, transactions)
                        : installment.expectedAmount,
                    )}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderForm = () => {
    const fixedInstallments = !['conta_unica', 'conta_recorrente'].includes(form.type);
    return (
      <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
        {formError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {formError}
          </div>
        )}

        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1">Nome *</label>
          <input
            aria-label="Nome da conta"
            value={form.title}
            onChange={(event) => updateForm('title', event.target.value)}
            placeholder="Ex.: Financiamento da moto"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1">Tipo *</label>
          <select
            aria-label="Tipo da conta"
            value={form.type}
            onChange={(event) => handleTypeChange(event.target.value as FinancialCommitmentType)}
            disabled={Boolean(editingCommitmentId)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white disabled:opacity-60"
          >
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Valor {fixedInstallments ? 'da parcela' : ''} *
            </label>
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5">
              <span className="text-xs font-bold text-slate-500 mr-1">R$</span>
              <input
                aria-label="Valor da conta"
                value={form.amount}
                onChange={(event) => updateForm('amount', formatBRLInput(event.target.value))}
                inputMode="decimal"
                placeholder="0,00"
                className="w-full bg-transparent text-xs font-bold font-mono text-white focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Primeiro vencimento *
            </label>
            <input
              aria-label="Primeiro vencimento"
              type="date"
              value={form.firstDueDate}
              onChange={(event) => updateForm('firstDueDate', event.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white"
            />
          </div>
        </div>

        {fixedInstallments && (
          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-900/70 border border-slate-800">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Total de parcelas
              </label>
              <input
                aria-label="Total de parcelas"
                type="number"
                min="1"
                value={form.totalInstallments}
                onChange={(event) => updateForm('totalInstallments', event.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Já pagas
              </label>
              <input
                aria-label="Parcelas já pagas"
                type="number"
                min="0"
                value={form.initialPaidInstallments}
                disabled={Boolean(editingCommitmentId)}
                onChange={(event) => updateForm('initialPaidInstallments', event.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono disabled:opacity-60"
              />
            </div>
            {!editingCommitmentId && Number(form.initialPaidInstallments) > 0 && (
              <p className="col-span-2 text-[10px] text-amber-300">
                As parcelas anteriores entrarão como histórico informado e não criarão despesas
                retroativas.
              </p>
            )}
          </div>
        )}

        {form.type === 'conta_recorrente' && (
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Data final (opcional)
            </label>
            <input
              aria-label="Data final da recorrência"
              type="date"
              value={form.endDate}
              min={form.firstDueDate}
              onChange={(event) => updateForm('endDate', event.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Categoria</label>
            <select
              aria-label="Categoria da conta"
              value={form.category}
              onChange={(event) =>
                updateForm('category', event.target.value as OtherExpenseCategory)
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white"
            >
              {CATEGORY_OPTIONS.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Instituição
            </label>
            <input
              aria-label="Instituição ou credor"
              value={form.creditor}
              onChange={(event) => updateForm('creditor', event.target.value)}
              placeholder="Opcional"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white"
            />
          </div>
        </div>

        {form.type === 'financiamento_veiculo' && (
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Veículo relacionado
            </label>
            <select
              aria-label="Veículo relacionado"
              value={form.vehicleId}
              onChange={(event) => updateForm('vehicleId', event.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white"
            >
              <option value="">Nenhum</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.nickname}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1">Observação</label>
          <input
            aria-label="Observação da conta"
            value={form.notes}
            onChange={(event) => updateForm('notes', event.target.value)}
            placeholder="Opcional"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white"
          />
        </div>

        {confirmFutureEdit && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 space-y-2">
            <p>
              Existem parcelas pagas. Elas serão preservadas; as alterações serão aplicadas somente
              às parcelas futuras.
            </p>
            <button
              type="button"
              onClick={handleSave}
              className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold"
            >
              Confirmar alteração futura
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={handleSave}
          className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold active:scale-[0.99]"
        >
          {editingCommitmentId ? 'Salvar alterações' : 'Cadastrar conta'}
        </button>
      </div>
    );
  };

  const renderDetail = () => {
    if (!selectedCommitment) return renderList();
    const related = payableInstallments
      .filter((installment) => installment.commitmentId === selectedCommitment.id)
      .sort((a, b) => a.number - b.number);
    const progress = calculateCommitmentProgress(selectedCommitment, related, transactions);
    const firstOpenIndex = related.findIndex(
      (installment) => !isInstallmentPaid(installment, transactions),
    );
    const startIndex =
      firstOpenIndex < 0 ? Math.max(0, related.length - 6) : Math.max(0, firstOpenIndex - 2);
    const visibleInstallments = showAllInstallments
      ? related
      : related.slice(startIndex, startIndex + 8);
    const hasPayments = progress.paidInstallments > 0;

    return (
      <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-emerald-950/20 border border-slate-800 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                {TYPE_LABELS[selectedCommitment.type]}
              </span>
              <p className="text-xs text-slate-300 mt-0.5">
                {selectedCommitment.creditor || 'Sem instituição informada'}
              </p>
            </div>
            <span className="px-2 py-1 rounded-lg bg-slate-800 text-[10px] font-bold text-slate-300 capitalize">
              {selectedCommitment.status}
            </span>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <p className="text-2xl font-extrabold text-white font-mono">
                {progress.paidInstallments} de {progress.totalInstallments || related.length}
              </p>
              <span className="text-[10px] text-slate-400">parcelas pagas</span>
            </div>
            <span className="text-sm font-bold text-emerald-400 font-mono">
              {progress.progressPercent.toFixed(0)}%
            </span>
          </div>
          <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full"
              style={{ width: `${Math.min(100, progress.progressPercent)}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs">
            <div className="col-span-2 p-2.5 rounded-xl bg-slate-950/60 flex items-center justify-between gap-3">
              <span className="text-[9px] uppercase text-slate-500">Total previsto</span>
              <strong className="text-white font-mono">{formatBRL(progress.totalExpected)}</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/60">
              <span className="text-[9px] uppercase text-slate-500 block">Total pago</span>
              <strong className="text-emerald-400 font-mono">
                {formatBRL(progress.totalPaid)}
              </strong>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/60">
              <span className="text-[9px] uppercase text-slate-500 block">Saldo em aberto</span>
              <strong className="text-white font-mono">{formatBRL(progress.openBalance)}</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/60">
              <span className="text-[9px] uppercase text-slate-500 block">Próximo vencimento</span>
              <strong className="text-slate-200">
                {progress.nextInstallment
                  ? formatDisplayDate(progress.nextInstallment.dueDate)
                  : 'Concluído'}
              </strong>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/60">
              <span className="text-[9px] uppercase text-slate-500 block">Previsão de término</span>
              <strong className="text-slate-200">
                {progress.projectedEndDate
                  ? formatDisplayDate(progress.projectedEndDate)
                  : 'Sem prazo final'}
              </strong>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => openEditForm(selectedCommitment)}
            className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5"
          >
            <FilePenLine className="w-3.5 h-3.5" /> Editar
          </button>
          <button
            type="button"
            disabled={
              selectedCommitment.status === 'cancelado' || selectedCommitment.status === 'concluido'
            }
            onClick={() =>
              setFinancialCommitmentStatus(
                selectedCommitment.id,
                selectedCommitment.status === 'pausado' ? 'ativo' : 'pausado',
              )
            }
            className="py-2.5 rounded-xl border border-slate-700 text-xs font-bold text-slate-300 flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            {selectedCommitment.status === 'pausado' ? (
              <Play className="w-3.5 h-3.5" />
            ) : (
              <Pause className="w-3.5 h-3.5" />
            )}
            {selectedCommitment.status === 'pausado' ? 'Reativar' : 'Pausar'}
          </button>
        </div>

        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Parcelas</h3>
            </div>
            <span className="text-[10px] text-slate-500">{related.length} registradas</span>
          </div>

          <div className="divide-y divide-slate-800/70">
            {visibleInstallments.map((installment) => {
              const status = deriveInstallmentStatus(installment, transactions, today);
              const paid = status === 'paga';
              return (
                <div key={installment.id} className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-200">
                          {selectedCommitment.type === 'conta_unica'
                            ? 'Vencimento único'
                            : `Parcela ${installment.number}${selectedCommitment.totalInstallments ? `/${selectedCommitment.totalInstallments}` : ''}`}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded-md border text-[9px] font-bold ${STATUS_CLASSES[status]}`}
                        >
                          {STATUS_LABELS[status]}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Vence {formatDisplayDate(installment.dueDate)}
                        {installment.paymentOrigin === 'opening_balance' &&
                          ' · histórico informado'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-xs font-bold font-mono block ${paid ? 'text-emerald-400' : 'text-white'}`}
                      >
                        {formatBRL(
                          paid
                            ? getInstallmentPaidAmount(installment, transactions)
                            : installment.expectedAmount,
                        )}
                      </span>
                      {selectedCommitment.status !== 'cancelado' &&
                        (paid ? (
                          <button
                            type="button"
                            onClick={() => setReopenConfirmId(installment.id)}
                            className="text-[10px] text-slate-500 hover:text-amber-300"
                          >
                            Reabrir
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startPayment(installment)}
                            className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300"
                          >
                            Marcar como paga
                          </button>
                        ))}
                    </div>
                  </div>

                  {payingInstallmentId === installment.id && (
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2">
                          <span className="text-[10px] text-slate-500 mr-1">R$</span>
                          <input
                            aria-label="Valor pago"
                            value={paymentAmount}
                            onChange={(event) =>
                              setPaymentAmount(formatBRLInput(event.target.value))
                            }
                            inputMode="decimal"
                            className="w-full bg-transparent text-xs text-white font-mono focus:outline-none"
                          />
                        </div>
                        <input
                          aria-label="Data do pagamento"
                          type="date"
                          value={paymentDate}
                          onChange={(event) => setPaymentDate(event.target.value)}
                          className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setPayingInstallmentId(null)}
                          className="flex-1 py-1.5 rounded-lg text-[10px] text-slate-400 border border-slate-800"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => confirmPayment(installment.id)}
                          className="flex-1 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-500 text-slate-950"
                        >
                          Confirmar pagamento
                        </button>
                      </div>
                    </div>
                  )}

                  {reopenConfirmId === installment.id && (
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-200">
                      <p>
                        {installment.paymentOrigin === 'opening_balance'
                          ? 'O histórico informado será removido e a parcela voltará para pendente.'
                          : 'A despesa vinculada será removida e a parcela voltará para pendente.'}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => setReopenConfirmId(null)}
                          className="px-2.5 py-1 rounded-lg border border-slate-700"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            reopenPayableInstallment(installment.id);
                            setReopenConfirmId(null);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold"
                        >
                          Reabrir parcela
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {related.length > 8 && (
            <button
              type="button"
              onClick={() => setShowAllInstallments((current) => !current)}
              className="w-full py-2.5 border-t border-slate-800 text-[11px] font-semibold text-blue-300 hover:bg-slate-800/50"
            >
              {showAllInstallments
                ? 'Mostrar menos'
                : `Mostrar todas as ${related.length} parcelas`}
            </button>
          )}
        </div>

        {removeConfirm ? (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 space-y-2">
            <p>
              {hasPayments
                ? 'A conta será cancelada, mas todo o histórico pago será preservado.'
                : 'A conta e suas parcelas pendentes serão removidas.'}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRemoveConfirm(false)}
                className="flex-1 py-2 rounded-lg border border-slate-700 text-slate-300"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => {
                  removeFinancialCommitment(selectedCommitment.id);
                  setScreen('list');
                  setSelectedCommitmentId(null);
                  setRemoveConfirm(false);
                }}
                className="flex-1 py-2 rounded-lg bg-rose-600 text-white font-bold"
              >
                Confirmar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setRemoveConfirm(true)}
            className="w-full py-2 text-[11px] text-slate-500 hover:text-rose-400 flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {hasPayments ? 'Cancelar conta e preservar histórico' : 'Remover conta'}
          </button>
        )}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Contas e Parcelas"
        className="w-full max-w-md bg-[#0f172a] border border-slate-800 rounded-t-2xl sm:rounded-2xl h-[94vh] sm:max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        {renderHeader()}
        {screen === 'list' && renderList()}
        {screen === 'form' && renderForm()}
        {screen === 'detail' && renderDetail()}
      </div>
    </div>
  );
};
