import React from 'react';
import { Transaction, GainTransaction, AppSource } from '../../types';
import { formatBRL, formatPercent } from '../../utils/calculations';

interface AppsBarChartProps {
  transactions: Transaction[];
  selectedMonth?: string;
}

export const AppsBarChart: React.FC<AppsBarChartProps> = ({ transactions, selectedMonth }) => {
  // Filter gains
  const gains: GainTransaction[] = transactions.filter((t): t is GainTransaction => {
    if (t.type !== 'ganho') return false;
    if (selectedMonth && !t.date.startsWith(selectedMonth)) return false;
    return true;
  });

  const totalGains = gains.reduce((acc, t) => acc + t.amount, 0);

  // Group by app
  const appMap: Record<string, { total: number; count: number; color: string; bg: string }> = {
    Uber: { total: 0, count: 0, color: '#000000', bg: '#ffffff' },
    99: { total: 0, count: 0, color: '#ffffff', bg: '#f97316' },
    iFood: { total: 0, count: 0, color: '#ffffff', bg: '#ea1d2c' },
    Lalamove: { total: 0, count: 0, color: '#ffffff', bg: '#ff6200' },
  };

  gains.forEach((g) => {
    const app = g.app as AppSource;
    if (!appMap[app]) {
      appMap[app] = { total: 0, count: 0, color: '#ffffff', bg: '#3b82f6' };
    }
    appMap[app].total += g.amount;
    appMap[app].count += g.ridesCount || 1;
  });

  const sortedApps = Object.entries(appMap)
    .map(([name, data]) => ({
      name,
      ...data,
      percent: totalGains > 0 ? (data.total / totalGains) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  if (totalGains === 0) {
    return (
      <div className="py-6 text-center text-slate-500 text-xs">
        Nenhum ganho registrado neste período.
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {sortedApps.map((app) => (
        <div key={app.name} className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span
                className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shadow-sm"
                style={{ backgroundColor: app.bg, color: app.color }}
              >
                {app.name.charAt(0)}
              </span>
              <span className="font-semibold text-slate-200">{app.name}</span>
              <span className="text-[11px] text-slate-400">
                • {app.count} {app.name === 'iFood' ? 'entregas' : 'corridas'}
              </span>
            </div>
            <div className="text-right">
              <span className="font-mono font-bold text-slate-100">{formatBRL(app.total)}</span>
              <span className="text-slate-400 text-[11px] ml-1.5 font-medium">
                ({formatPercent(app.percent)})
              </span>
            </div>
          </div>

          {/* Progress track */}
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${Math.max(2, app.percent)}%`,
                backgroundColor: app.bg,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};
