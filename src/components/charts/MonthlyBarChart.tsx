import React from 'react';
import { Transaction } from '../../types';
import { formatBRL } from '../../utils/calculations';

interface MonthlyBarChartProps {
  transactions: Transaction[];
  selectedMonth: string; // YYYY-MM
}

export const MonthlyBarChart: React.FC<MonthlyBarChartProps> = ({
  transactions,
  selectedMonth,
}) => {
  // Aggregate transactions by week of the month (Week 1: 1-7, Week 2: 8-14, Week 3: 15-21, Week 4: 22-end)
  const weeks = [
    { label: 'Sem 1 (1-7)', startDay: 1, endDay: 7, gains: 0, expenses: 0 },
    { label: 'Sem 2 (8-14)', startDay: 8, endDay: 14, gains: 0, expenses: 0 },
    { label: 'Sem 3 (15-21)', startDay: 15, endDay: 21, gains: 0, expenses: 0 },
    { label: 'Sem 4 (22+)', startDay: 22, endDay: 31, gains: 0, expenses: 0 },
  ];

  transactions.forEach((tx) => {
    if (tx.date.startsWith(selectedMonth)) {
      const day = parseInt(tx.date.split('-')[2], 10);
      const week = weeks.find((w) => day >= w.startDay && day <= w.endDay);
      if (week) {
        if (tx.type === 'ganho') {
          week.gains += tx.amount;
        } else {
          week.expenses += tx.amount;
        }
      }
    }
  });

  const maxVal = Math.max(...weeks.flatMap((w) => [w.gains, w.expenses]), 100);

  return (
    <div className="w-full">
      {/* Legend */}
      <div className="flex items-center justify-between text-xs mb-3 text-slate-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block"></span>
            Ganhos
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block"></span>
            Despesas
          </span>
        </div>
        <span className="text-[11px] text-slate-500">Por semanas do mês</span>
      </div>

      {/* Bars Container */}
      <div className="grid grid-cols-4 gap-2 h-44 items-end pt-4 pb-2 border-b border-slate-800">
        {weeks.map((week, idx) => {
          const gainHeight = Math.max(4, Math.min(100, (week.gains / maxVal) * 100));
          const expHeight = Math.max(4, Math.min(100, (week.expenses / maxVal) * 100));

          return (
            <div key={idx} className="flex flex-col items-center h-full justify-end group relative">
              {/* Tooltip on hover/touch */}
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 text-[10px] text-slate-200 px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
                <span className="text-emerald-400">+{formatBRL(week.gains)}</span> /{' '}
                <span className="text-rose-400">-{formatBRL(week.expenses)}</span>
              </div>

              {/* Bars Pair */}
              <div className="flex items-end gap-1.5 w-full justify-center h-32">
                {/* Gain Bar */}
                <div
                  className="w-3.5 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t transition-all duration-500 hover:brightness-110"
                  style={{ height: `${gainHeight}%` }}
                  title={`Ganhos: ${formatBRL(week.gains)}`}
                />
                {/* Expense Bar */}
                <div
                  className="w-3.5 bg-gradient-to-t from-rose-600 to-rose-400 rounded-t transition-all duration-500 hover:brightness-110"
                  style={{ height: `${expHeight}%` }}
                  title={`Despesas: ${formatBRL(week.expenses)}`}
                />
              </div>

              {/* Week Label */}
              <span className="text-[11px] text-slate-400 mt-2 font-medium truncate max-w-full text-center">
                Sem {idx + 1}
              </span>
            </div>
          );
        })}
      </div>

      {/* Bottom Values Summary */}
      <div className="grid grid-cols-4 gap-2 pt-2 text-[11px] text-center font-mono">
        {weeks.map((w, idx) => (
          <div key={idx} className="truncate">
            <span className="text-emerald-400 font-semibold block">
              +{formatBRL(w.gains).replace('R$', '').trim()}
            </span>
            <span className="text-rose-400/80 text-[10px] block">
              -{formatBRL(w.expenses).replace('R$', '').trim()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
