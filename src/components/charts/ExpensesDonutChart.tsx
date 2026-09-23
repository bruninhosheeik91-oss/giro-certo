import React from 'react';
import { PeriodSummary } from '../../types';
import { formatBRL, formatPercent } from '../../utils/calculations';

interface ExpensesDonutChartProps {
  summary: PeriodSummary;
}

export const ExpensesDonutChart: React.FC<ExpensesDonutChartProps> = ({ summary }) => {
  const { combustivel, manutencao, outrasDespesas, totalDespesas } = summary;

  if (totalDespesas <= 0) {
    return (
      <div className="py-8 text-center text-slate-500 text-xs">
        Nenhuma despesa registrada para o período selecionado.
      </div>
    );
  }

  const items = [
    {
      label: 'Combustível',
      value: combustivel,
      color: '#f43f5e', // Rose
      percent: (combustivel / totalDespesas) * 100,
    },
    {
      label: 'Manutenção',
      value: manutencao,
      color: '#f59e0b', // Amber
      percent: (manutencao / totalDespesas) * 100,
    },
    {
      label: 'Outras Despesas',
      value: outrasDespesas,
      color: '#8b5cf6', // Purple
      percent: (outrasDespesas / totalDespesas) * 100,
    },
  ].filter((item) => item.value > 0);

  // SVG Donut calculation
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  let accumulatedOffset = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      {/* SVG Donut */}
      <div className="relative w-32 h-32 flex-shrink-0 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
          {/* Background track */}
          <circle cx="50" cy="50" r={radius} fill="transparent" stroke="#1e293b" strokeWidth="12" />
          {/* Segments */}
          {items.map((item, idx) => {
            const strokeDasharray = `${(item.percent / 100) * circumference} ${circumference}`;
            const strokeDashoffset = -accumulatedOffset;
            accumulatedOffset += (item.percent / 100) * circumference;

            return (
              <circle
                key={idx}
                cx="50"
                cy="50"
                r={radius}
                fill="transparent"
                stroke={item.color}
                strokeWidth="12"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-700 ease-out"
              />
            );
          })}
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
            Total
          </span>
          <span className="text-xs font-bold text-slate-100 font-mono">
            {formatBRL(totalDespesas).replace('R$', '').trim()}
          </span>
        </div>
      </div>

      {/* Legend & Breakdown */}
      <div className="flex-1 w-full space-y-2.5">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-slate-300 font-medium">{item.label}</span>
            </div>
            <div className="text-right font-mono">
              <span className="text-slate-100 font-semibold">{formatBRL(item.value)}</span>
              <span className="text-slate-500 text-[11px] ml-1.5 font-normal">
                ({formatPercent(item.percent)})
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
