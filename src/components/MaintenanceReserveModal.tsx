import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  formatBRL,
  formatBRLInput,
  formatDisplayDate,
  parseBRLInput,
} from '../utils/calculations';
import { X, Plus, ArrowDownToLine, PiggyBank, History } from 'lucide-react';

export const MaintenanceReserveModal: React.FC = () => {
  const {
    isReserveModalOpen,
    closeReserveModal,
    maintenanceReserveBalance,
    maintenanceReserveLedger,
    depositMaintenanceReserve,
    withdrawMaintenanceReserve,
    activeVehicle,
    monthSummary,
  } = useApp();

  const [mode, setMode] = useState<'deposito' | 'resgate'>('deposito');
  const [amountStr, setAmountStr] = useState('');

  if (!isReserveModalOpen) return null;

  const quickAmounts =
    mode === 'deposito'
      ? [20, 50, 100]
      : maintenanceReserveBalance > 0
        ? [20, 50, Math.round(maintenanceReserveBalance * 100) / 100]
        : [];

  const handleSubmit = () => {
    const amt = parseBRLInput(amountStr);
    if (mode === 'deposito') {
      depositMaintenanceReserve(amt, 'Depósito manual no cofrinho');
    } else {
      withdrawMaintenanceReserve(amt, 'Resgate manual do cofrinho');
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
              <h3 className="text-sm font-bold text-white">Cofrinho de Manutenção</h3>
              <p className="text-[10px] text-slate-400">
                Veículo: {activeVehicle?.nickname || activeVehicle?.model}
              </p>
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
          {/* Balance Card */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-teal-950/40 to-slate-900 border border-teal-500/30 text-center">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-400 block mb-1">
              Saldo Disponível
            </span>
            <span className="text-3xl font-extrabold font-mono text-teal-400 tracking-tight">
              {formatBRL(maintenanceReserveBalance)}
            </span>
            <p className="text-[10px] text-slate-400 mt-1.5">
              Sugerido no mês ({monthSummary.quilometrosRodados.toLocaleString('pt-BR')} km):{' '}
              {formatBRL(monthSummary.reservaManutencao)}
            </p>
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
                    {mode === 'resgate' && amt === maintenanceReserveBalance
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
                Histórico do Cofrinho
              </h4>
              <span className="text-[10px] text-slate-500 ml-auto">
                {maintenanceReserveLedger.length} movimentações
              </span>
            </div>

            {maintenanceReserveLedger.length === 0 ? (
              <p className="p-4 text-xs text-slate-500 text-center">
                Nenhuma movimentação ainda. Guarde parte da reserva sugerida para começar.
              </p>
            ) : (
              <div className="divide-y divide-slate-800/70 max-h-52 overflow-y-auto">
                {[...maintenanceReserveLedger]
                  .sort((a, b) => b.createdAt - a.createdAt)
                  .map((e) => (
                    <div key={e.id} className="px-3 py-2.5 flex items-center justify-between text-xs">
                      <div>
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
                      <span className="text-slate-500 text-[10px]">
                        {formatDisplayDate(e.date)}
                      </span>
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