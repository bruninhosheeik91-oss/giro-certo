import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Transaction } from '../types';
import { formatBRL, formatDisplayDate } from '../utils/calculations';
import { ChevronRight, Fuel, Plus, Search, Wallet, Wrench, X } from 'lucide-react';

export const TransactionsView: React.FC = () => {
  const { transactions, selectedMonth, openNewTransactionModal, openTransactionDetail } = useApp();
  const [filterType, setFilterType] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState('');

  // Filtered list
  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (!t.date.startsWith(selectedMonth)) return false;
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
  }, [transactions, selectedMonth, filterType, searchTerm]);

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

  const totals = useMemo(() => {
    let gain = 0;
    let expense = 0;
    for (const t of filtered) {
      if (t.type === 'ganho') gain += t.amount;
      else expense += t.amount;
    }
    return { gain, expense, balance: gain - expense };
  }, [filtered]);

  const titleOf = (t: Transaction) =>
    t.type === 'ganho'
      ? t.app || 'Ganho'
      : t.type === 'abastecimento'
        ? `Abastecimento · ${t.fuelType}`
        : t.type === 'manutencao'
          ? t.servicePerformed || t.category
          : t.category || 'Outro gasto';

  const detailOf = (t: Transaction) => {
    const parts = [
      t.time?.slice(0, 5),
      t.type === 'ganho' && t.ridesCount ? `${t.ridesCount} ${t.ridesCount === 1 ? 'corrida' : 'corridas'}` : '',
      t.description || (t.type === 'abastecimento' ? t.stationName : '') || (t.type === 'manutencao' ? t.workshop : ''),
    ];
    return parts.filter(Boolean).join(' · ');
  };

  const iconOf = (t: Transaction) => {
    const map = {
      ganho: { Icon: Plus, tone: 'text-emerald-400' },
      abastecimento: { Icon: Fuel, tone: 'text-sky-400' },
      manutencao: { Icon: Wrench, tone: 'text-amber-400' },
      outra_despesa: { Icon: Wallet, tone: 'text-violet-400' },
    } as const;
    return map[t.type];
  };

  const filters = [
    { id: 'todos', label: 'Todos' },
    { id: 'ganho', label: 'Ganhos' },
    { id: 'abastecimento', label: 'Combustível' },
    { id: 'manutencao', label: 'Manutenção' },
    { id: 'outra_despesa', label: 'Outros gastos' },
  ];

  return (
    <div className="space-y-4 pb-2">
      <section aria-label="Resumo" className="grid grid-cols-3 rounded-[20px] border border-slate-800/70 bg-slate-900 py-3.5 text-center">
        <div>
          <p className="text-[13px] text-slate-400">Entradas</p>
          <p className="mt-0.5 text-[15px] font-bold text-emerald-400">{formatBRL(totals.gain)}</p>
        </div>
        <div className="border-x border-slate-800">
          <p className="text-[13px] text-slate-400">Saídas</p>
          <p className={`mt-0.5 text-[15px] font-bold ${totals.expense > 0 ? 'text-rose-400' : 'text-white'}`}>{formatBRL(totals.expense)}</p>
        </div>
        <div>
          <p className="text-[13px] text-slate-400">Saldo</p>
          <p className="mt-0.5 text-[15px] font-bold text-white">{formatBRL(totals.balance)}</p>
        </div>
      </section>

      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            aria-label="Buscar lançamentos"
            placeholder="Buscar app, posto, serviço, nota…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-12 w-full rounded-xl border border-slate-700 bg-slate-900 pl-11 pr-11 text-[15px] text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              aria-label="Limpar busca"
              className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={filterType === item.id}
              onClick={() => setFilterType(item.id)}
              className={`h-10 flex-none rounded-full px-4 text-[13px] font-semibold ${
                filterType === item.id
                  ? 'bg-emerald-500 text-on-accent'
                  : 'border border-slate-700 bg-slate-900 text-slate-300'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {datesSorted.length === 0 ? (
        <div className="rounded-[20px] border border-slate-800/70 bg-slate-900 px-6 py-12 text-center">
          <Wallet className="mx-auto mb-3 h-10 w-10 text-slate-600" />
          <p className="text-[15px] font-semibold text-white">
            {searchTerm || filterType !== 'todos' ? 'Nada encontrado' : 'Nenhum lançamento ainda'}
          </p>
          <p className="mb-5 mt-1 text-[13px] text-slate-400">
            {searchTerm || filterType !== 'todos'
              ? 'Tente outra busca ou outro filtro.'
              : 'Registre um ganho ou um gasto para acompanhar seu lucro.'}
          </p>
          <button
            type="button"
            onClick={() => openNewTransactionModal('ganho')}
            className="h-12 rounded-[14px] bg-emerald-500 px-6 text-[15px] font-bold text-on-accent"
          >
            Novo lançamento
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {datesSorted.map((dateStr) => {
            const dayTxs = groupedByDate[dateStr];
            const dayGain = dayTxs.filter((t) => t.type === 'ganho').reduce((s, t) => s + t.amount, 0);
            const dayExpense = dayTxs.filter((t) => t.type !== 'ganho').reduce((s, t) => s + t.amount, 0);
            return (
              <section key={dateStr} aria-label={formatDisplayDate(dateStr)} className="space-y-2">
                <div className="flex items-baseline justify-between px-1">
                  <h3 className="text-[15px] font-bold text-white">{formatDisplayDate(dateStr)}</h3>
                  <p className="text-[13px] text-slate-400">
                    saldo <b className="font-semibold text-white">{formatBRL(dayGain - dayExpense)}</b>
                  </p>
                </div>
                <ul className="overflow-hidden rounded-[20px] border border-slate-800/70 bg-slate-900">
                  {dayTxs.map((t, index) => {
                    const { Icon, tone } = iconOf(t);
                    const gain = t.type === 'ganho';
                    return (
                      <li key={t.id} className={index > 0 ? 'border-t border-slate-800' : ''}>
                        <button
                          type="button"
                          onClick={() => openTransactionDetail(t.id)}
                          className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-800/60"
                        >
                          <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-slate-800 ${tone}`}>
                            <Icon className="h-[18px] w-[18px]" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-semibold text-white">{titleOf(t)}</span>
                            <span className="block truncate text-[13px] text-slate-400">{detailOf(t) || 'Sem descrição'}</span>
                          </span>
                          <span className={`flex-none whitespace-nowrap text-[15px] font-bold ${gain ? 'text-emerald-400' : 'text-white'}`}>
                            {gain ? '+' : '−'} {formatBRL(t.amount)}
                          </span>
                          <ChevronRight className="h-4 w-4 flex-none text-slate-500" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
