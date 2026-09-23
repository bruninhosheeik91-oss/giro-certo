import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Transaction } from '../types';
import { formatBRL, formatDisplayDate } from '../utils/calculations';
import { Search, Trash2, Fuel, Wrench, PlusCircle, Wallet } from 'lucide-react';

export const TransactionsView: React.FC = () => {
  const {
    transactions,
    deleteTransaction,
    openNewTransactionModal,
    openTransactionDetail,
  } = useApp();
  const [filterType, setFilterType] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Filtered list
  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (filterType !== 'todos' && t.type !== filterType) return false;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const desc = (t.description || '').toLowerCase();
        const app = t.type === 'ganho' ? (t.app || '').toLowerCase() : '';
        const cat = t.type === 'outra_despesa' ? (t.category || '').toLowerCase() : '';
        const srv = t.type === 'manutencao' ? (t.servicePerformed || '').toLowerCase() : '';
        if (
          !desc.includes(term) &&
          !app.includes(term) &&
          !cat.includes(term) &&
          !srv.includes(term)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [transactions, filterType, searchTerm]);

  // Group by date
  const groupedByDate = useMemo(() => {
    const map: Record<string, Transaction[]> = {};
    for (const t of filtered) {
      if (!map[t.date]) {
        map[t.date] = [];
      }
      map[t.date].push(t);
    }
    return map;
  }, [filtered]);

  const datesSorted = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-4 pb-2">
      {/* Search & Filter Header */}
      <div className="space-y-3">
        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por app, posto, serviço, nota..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'ganho', label: 'Ganhos' },
            { id: 'abastecimento', label: 'Combustível' },
            { id: 'manutencao', label: 'Manutenção' },
            { id: 'outra_despesa', label: 'Outras Despesas' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilterType(item.id)}
              className={`px-3 py-1.5 rounded-xl font-semibold flex-shrink-0 transition-all ${
                filterType === item.id
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions List Grouped */}
      {datesSorted.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800">
          <Wallet className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-300">Nenhum lançamento encontrado</p>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Adicione um novo ganho ou despesa para acompanhar.
          </p>
          <button
            onClick={() => openNewTransactionModal('ganho')}
            className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs"
          >
            Novo Lançamento
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {datesSorted.map((dateStr) => {
            const dayTxs = groupedByDate[dateStr];
            const dayGain = dayTxs
              .filter((t) => t.type === 'ganho')
              .reduce((s, t) => s + t.amount, 0);
            const dayExpense = dayTxs
              .filter((t) => t.type !== 'ganho')
              .reduce((s, t) => s + t.amount, 0);

            return (
              <div key={dateStr} className="space-y-2">
                {/* Date header */}
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {formatDisplayDate(dateStr)}
                  </span>
                  <div className="flex items-center gap-2 text-xs font-mono">
                    {dayGain > 0 && <span className="text-emerald-400">+{formatBRL(dayGain)}</span>}
                    {dayExpense > 0 && (
                      <span className="text-rose-400">-{formatBRL(dayExpense)}</span>
                    )}
                  </div>
                </div>

                {/* Day transactions cards */}
                <div className="space-y-2">
                  {dayTxs.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => openTransactionDetail(t.id)}
                      className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between group cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            t.type === 'ganho'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : t.type === 'abastecimento'
                                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                : t.type === 'manutencao'
                                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                  : 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                          }`}
                        >
                          {t.type === 'ganho' && <PlusCircle className="w-4 h-4" />}
                          {t.type === 'abastecimento' && <Fuel className="w-4 h-4" />}
                          {t.type === 'manutencao' && <Wrench className="w-4 h-4" />}
                          {t.type === 'outra_despesa' && <Wallet className="w-4 h-4" />}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white tracking-tight">
                              {t.type === 'ganho'
                                ? t.app || 'Ganho'
                                : t.type === 'abastecimento'
                                  ? `Abastecimento (${t.fuelType})`
                                  : t.type === 'manutencao'
                                    ? t.servicePerformed || t.category
                                    : t.category || 'Outro'}
                            </span>
                            {t.type === 'ganho' && t.ridesCount && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-semibold">
                                {t.ridesCount} corridas
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-400 mt-0.5">
                            {t.description ||
                              (t.type === 'abastecimento' ? t.stationName || '' : '') ||
                              (t.type === 'manutencao' ? t.workshop || '' : '') ||
                              'Sem descrição'}
                            {t.time ? ` • ${t.time}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span
                            className={`text-sm font-extrabold font-mono block ${
                              t.type === 'ganho' ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {t.type === 'ganho'
                              ? `+${formatBRL(t.amount)}`
                              : `-${formatBRL(t.amount)}`}
                          </span>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(t.id);
                          }}
                          className="opacity-60 hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition-colors"
                          title="Excluir lançamento"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Inline Delete Dialog */}
                      {deleteConfirmId === t.id && (
                        <div className="absolute inset-x-4 p-3 bg-slate-900 border border-rose-500/50 rounded-xl shadow-2xl z-10 flex items-center justify-between">
                          <span className="text-xs text-rose-300 font-semibold">
                            Excluir lançamento?
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                deleteTransaction(t.id);
                                setDeleteConfirmId(null);
                              }}
                              className="px-2.5 py-1 bg-rose-600 text-white text-xs font-bold rounded"
                            >
                              Excluir
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-2.5 py-1 bg-slate-800 text-slate-300 text-xs rounded"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
