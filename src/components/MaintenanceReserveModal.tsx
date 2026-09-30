import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatBRL, formatBRLInput, formatDisplayDate, parseBRLInput } from '../utils/calculations';
import { X, Plus, ArrowDownToLine, PiggyBank, History, Trash2, Landmark, Settings2 } from 'lucide-react';

export const MaintenanceReserveModal: React.FC = () => {
  const {
    isReserveModalOpen,
    closeReserveModal,
    maintenanceReserveLedger,
    depositMaintenanceReserve,
    withdrawMaintenanceReserve,
    removeMaintenanceReserveEntry,
    createFinancialReserve,
    updateFinancialReserve,
  } = useApp();

  const [mode, setMode] = useState<'deposito' | 'resgate'>('deposito');
  const [amountStr, setAmountStr] = useState('');
  const [selectedReserveId, setSelectedReserveId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingReserveId, setEditingReserveId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [goalStr, setGoalStr] = useState('');
  const [category, setCategory] = useState<'manutencao' | 'emergencia' | 'impostos' | 'veiculo' | 'outro'>('manutencao');

  const reserveMap = new Map<string, (typeof maintenanceReserveLedger)[number]>();
  for (const entry of maintenanceReserveLedger) {
    const id = entry.reserveId ?? 'default-financial-reserve';
    if (!reserveMap.has(id) || entry.updatedAt! > reserveMap.get(id)!.updatedAt!) {
      reserveMap.set(id, entry);
    }
  }
  const reserves = [...reserveMap.entries()].map(([id, meta]) => ({
    id,
    name: meta.reserveName ?? 'Manutenção do veículo',
    category: meta.reserveCategory ?? 'manutencao',
    institution: meta.institution,
    goalAmount: meta.goalAmount,
    isPrimary: meta.isPrimary,
    balance: maintenanceReserveLedger
      .filter((entry) => (entry.reserveId ?? 'default-financial-reserve') === id)
      .reduce(
        (total, entry) =>
          total + (entry.type === 'resgate' ? -entry.amount : entry.type === 'ajuste' ? entry.amount : entry.amount),
        0,
      ),
  }));
  const selected = reserves.find((reserve) => reserve.id === selectedReserveId) ?? reserves[0];
  const selectedBalance = Math.round((selected?.balance ?? 0) * 100) / 100;
  const selectedLedger = selected
    ? maintenanceReserveLedger.filter(
        (entry) => (entry.reserveId ?? 'default-financial-reserve') === selected.id && entry.amount !== 0,
      )
    : [];

  if (!isReserveModalOpen) return null;

  const quickAmounts =
    mode === 'deposito'
      ? [20, 50, 100]
      : selectedBalance > 0
        ? [20, 50, selectedBalance]
        : [];

  const handleSubmit = () => {
    const amt = parseBRLInput(amountStr);
    if (mode === 'deposito') {
      depositMaintenanceReserve(amt, 'Depósito manual', selected?.id);
    } else {
      withdrawMaintenanceReserve(amt, 'Resgate manual', selected?.id);
    }
    setAmountStr('');
  };

  const typeLabel = (t: string) =>
    t === 'deposito' ? 'Depósito' : t === 'resgate' ? 'Resgate' : 'Ajuste';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={closeReserveModal}
    >
      <div
        className="w-full max-w-md bg-[#0f172a] border border-slate-800 rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <PiggyBank className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Reservas Financeiras</h3>
              <p className="text-[10px] text-slate-400">Organize valores por objetivo e instituição</p>
            </div>
          </div>
          <button
            onClick={closeReserveModal}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {reserves.map((reserve) => (
              <button key={reserve.id} onClick={() => setSelectedReserveId(reserve.id)} className={`min-w-[150px] p-3 rounded-xl border text-left ${selected?.id === reserve.id ? 'border-teal-400 bg-teal-500/10' : 'border-slate-800 bg-slate-900'}`}>
                <span className="text-xs font-bold text-white block truncate">{reserve.name}</span>
                <span className="text-[10px] text-slate-400 block truncate">{reserve.institution || 'Local não informado'}</span>
                <span className="text-sm font-mono font-bold text-teal-400 block mt-1">{formatBRL(reserve.balance)}</span>
              </button>
            ))}
            <button onClick={() => { setEditingReserveId(null); setShowForm(true); setName(''); setInstitution(''); setGoalStr(''); setCategory('manutencao'); }} className="min-w-[92px] rounded-xl border border-dashed border-teal-500/40 text-teal-300 text-xs font-bold flex items-center justify-center gap-1"><Plus className="w-4 h-4" /> Nova</button>
          </div>

          {showForm && (
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 space-y-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da reserva" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white" />
              <div className="grid grid-cols-2 gap-2">
                <input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="Banco ou carteira" className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white" />
                <input value={goalStr} onChange={(e) => setGoalStr(formatBRLInput(e.target.value))} placeholder="Meta: R$ 0,00" inputMode="decimal" className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white" />
              </div>
              <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white">
                <option value="manutencao">Manutenção</option><option value="emergencia">Emergência</option><option value="impostos">Impostos</option><option value="veiculo">Troca/financiamento do veículo</option><option value="outro">Outro objetivo</option>
              </select>
              <div className="flex gap-2">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs">Cancelar</button>
                <button disabled={!name.trim()} onClick={() => { const input = { name, institution, goalAmount: parseBRLInput(goalStr), category }; if (editingReserveId) { updateFinancialReserve(editingReserveId, input); } else { const id = createFinancialReserve(input); setSelectedReserveId(id); } setShowForm(false); }} className="flex-1 py-2 rounded-lg bg-teal-500 text-slate-950 text-xs font-bold disabled:opacity-40">{editingReserveId ? 'Salvar alterações' : 'Criar reserva'}</button>
              </div>
            </div>
          )}

          {/* Balance Card */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-teal-950/40 to-slate-900 border border-teal-500/30 text-center">
            <div className="flex justify-center items-center gap-1 text-[10px] text-slate-400 mb-1"><Landmark className="w-3 h-3" /> {selected?.institution || 'Informe onde o dinheiro está guardado'}</div>
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-400 block mb-1">
              Saldo Disponível
            </span>
            <span className="text-3xl font-extrabold font-mono text-teal-400 tracking-tight">
              {formatBRL(selectedBalance)}
            </span>
            {selected?.goalAmount ? <p className="text-[10px] text-slate-400 mt-1.5">Meta {formatBRL(selected.goalAmount)} · {Math.min(100, Math.round((selectedBalance / selected.goalAmount) * 100))}% alcançada</p> : <p className="text-[10px] text-slate-400 mt-1.5">Sem meta definida</p>}
            {selected && <button onClick={() => { setEditingReserveId(selected.id); setName(selected.name); setInstitution(selected.institution || ''); setGoalStr(formatBRLInput(String(Math.round((selected.goalAmount || 0) * 100)))); setCategory(selected.category); setShowForm(true); }} className="mt-2 text-[10px] text-teal-300 inline-flex items-center gap-1"><Settings2 className="w-3 h-3" /> Ajustar dados</button>}
          </div>

          {/* Mode Toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setMode('deposito');
                setAmountStr('');
              }}
              className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                mode === 'deposito'
                  ? 'bg-teal-500 text-slate-950 shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Plus className="w-4 h-4" />
              Guardar
            </button>
            <button
              onClick={() => {
                setMode('resgate');
                setAmountStr('');
              }}
              className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                mode === 'resgate'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <ArrowDownToLine className="w-4 h-4" />
              Resgatar
            </button>
          </div>

          {/* Amount Input + Submit */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5">
              <span className="text-xs font-bold text-slate-400">R$</span>
              <input
                type="text"
                inputMode="decimal"
                value={amountStr}
                onChange={(e) => setAmountStr(formatBRLInput(e.target.value))}
                placeholder="0,00"
                className="w-full bg-transparent text-sm font-bold text-white font-mono focus:outline-none"
              />
            </div>

            {/* Quick amounts */}
            <div className="flex items-center gap-2">
              {Array.from(new Set(quickAmounts))
                .filter((amt) => amt > 0)
                .map((amt) => (
                  <button
                    key={String(amt)}
                    onClick={() => setAmountStr(formatBRLInput(String(Math.round(amt * 100))))}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      mode === 'deposito'
                        ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30 hover:bg-teal-500/25'
                        : 'bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25'
                    }`}
                  >
                    {mode === 'resgate' && amt === selectedBalance
                      ? 'Saldo total'
                      : formatBRL(amt)}
                  </button>
                ))}
            </div>

            <button
              onClick={handleSubmit}
              disabled={parseBRLInput(amountStr) <= 0}
              className={`w-full py-2.5 rounded-xl text-xs font-bold text-slate-950 transition-all flex items-center justify-center gap-1.5 ${
                mode === 'deposito'
                  ? 'bg-teal-500 hover:bg-teal-400 disabled:opacity-40'
                  : 'bg-amber-500 hover:bg-amber-400 disabled:opacity-40'
              }`}
            >
              {mode === 'deposito' ? 'Guardar na Reserva' : 'Resgatar da Reserva'}
            </button>
          </div>

          {/* History */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl">
            <div className="p-3 flex items-center gap-2 border-b border-slate-800">
              <History className="w-3.5 h-3.5 text-slate-400" />
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Histórico da Reserva
              </h4>
              <span className="text-[10px] text-slate-500 ml-auto">
                {selectedLedger.length} movimentações
              </span>
            </div>

            {selectedLedger.length === 0 ? (
              <p className="p-4 text-xs text-slate-500 text-center">
                Nenhuma movimentação ainda. Guarde parte da reserva sugerida para começar.
              </p>
            ) : (
              <div className="divide-y divide-slate-800/70 max-h-52 overflow-y-auto">
                {[...selectedLedger]
                  .sort((a, b) => b.createdAt - a.createdAt)
                  .map((e) => (
                    <div
                      key={e.id}
                      className="px-3 py-2.5 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <span
                          className={`font-bold ${
                            e.type === 'deposito'
                              ? 'text-teal-400'
                              : e.type === 'resgate'
                                ? 'text-amber-400'
                                : 'text-slate-400'
                          }`}
                        >
                          {e.type === 'deposito' ? '+' : e.type === 'resgate' ? '-' : '±'}
                          {formatBRL(Math.abs(e.amount))}
                        </span>
                        <span className="text-slate-500 ml-2">{typeLabel(e.type)}</span>
                        {e.description && (
                          <span className="text-slate-500 block text-[10px] truncate max-w-[200px]">
                            {e.description}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-slate-500 text-[10px]">
                          {formatDisplayDate(e.date)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeMaintenanceReserveEntry(e.id)}
                          title="Excluir movimentação"
                          aria-label="Excluir movimentação"
                          className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-950 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
