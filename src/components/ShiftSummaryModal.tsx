import React, { useMemo } from 'react';
import { CheckCircle2, Share2, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useTargetBar } from '../hooks/useTargetBar';
import type { Shift } from '../types';
import { formatBRL, formatHours, safeDivide } from '../utils/calculations';

interface Props {
  shift: Shift;
  onClose: () => void;
}

/** Fechamento do dia: resumo da jornada mostrado ao encerrar. */
export const ShiftSummaryModal: React.FC<Props> = ({ shift, onClose }) => {
  const { transactions, getShiftTotals, userProfile, monthSummary } = useApp();
  const { bar } = useTargetBar();

  const data = useMemo(() => {
    const { gain, expense } = getShiftTotals(shift.id);
    const gains = transactions.filter((t) => t.shiftId === shift.id && t.type === 'ganho');
    const byApp: Record<string, number> = {};
    for (const t of gains) {
      const app = (t.type === 'ganho' && t.app) || 'Outros';
      byApp[app] = (byApp[app] || 0) + t.amount;
    }
    const best = Object.entries(byApp).sort((a, b) => b[1] - a[1])[0];
    const hours = Math.max(0, shift.totalWorkHours || 0);
    const km = Math.max(0, shift.totalKm || 0);
    const vehicleCost = km * bar.costPerKm;
    const net = gain - expense - vehicleCost;
    const goalLeft = Math.max(0, (userProfile.monthlyGoal || 0) - monthSummary.lucroDisponivel);
    return {
      gain,
      expense,
      vehicleCost,
      net,
      hours,
      km,
      rides: gains.length,
      perHour: hours >= 0.25 ? safeDivide(net, hours) : 0,
      perKm: km > 0 ? safeDivide(gain, km) : 0,
      best,
      goalLeft,
      goal: userProfile.monthlyGoal || 0,
    };
  }, [shift, transactions, getShiftTotals, bar.costPerKm, userProfile.monthlyGoal, monthSummary.lucroDisponivel]);

  const shareText = [
    `🚗 Meu dia no Giro Certo`,
    `Faturei ${formatBRL(data.gain)} em ${formatHours(data.hours)} e ${data.km.toLocaleString('pt-BR')} km`,
    `Lucro real: ${formatBRL(data.net)}`,
    data.perHour > 0 ? `${formatBRL(data.perHour)}/hora` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ text: shareText });
      else await navigator.clipboard.writeText(shareText);
    } catch {
      /* usuário cancelou */
    }
  };

  const row = 'flex items-center justify-between py-2 text-sm';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="fechamento-titulo">
      <div className="w-full max-w-md rounded-[24px] border border-slate-800 bg-slate-900 p-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <h3 id="fechamento-titulo" className="text-lg font-bold text-white">Fechamento do dia</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-1 text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Lucro real do dia</span>
          <p className={`mt-1 text-4xl font-extrabold tracking-tight ${data.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatBRL(data.net)}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {formatHours(data.hours)} trabalhadas · {data.km.toLocaleString('pt-BR')} km · {data.rides} {data.rides === 1 ? 'corrida' : 'corridas'}
          </p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-slate-800/60 p-3">
            <span className="text-[11px] text-slate-400">Lucro por hora</span>
            <p className="text-base font-bold text-white">{data.perHour > 0 ? formatBRL(data.perHour) : '—'}</p>
          </div>
          <div className="rounded-xl bg-slate-800/60 p-3">
            <span className="text-[11px] text-slate-400">Ganho por km</span>
            <p className="text-base font-bold text-white">{data.perKm > 0 ? formatBRL(data.perKm) : '—'}</p>
          </div>
        </div>

        <div className="mt-3 divide-y divide-slate-800">
          <div className={row}><span className="text-slate-400">Faturamento bruto</span><span className="font-semibold text-white">{formatBRL(data.gain)}</span></div>
          <div className={row}><span className="text-slate-400">Despesas lançadas</span><span className="font-semibold text-rose-300">− {formatBRL(data.expense)}</span></div>
          <div className={row}>
            <span className="text-slate-400">Custo do veículo <span className="text-[11px]">({formatBRL(bar.costPerKm)}/km)</span></span>
            <span className="font-semibold text-rose-300">− {formatBRL(data.vehicleCost)}</span>
          </div>
          {data.best && (
            <div className={row}><span className="text-slate-400">Melhor app</span><span className="font-semibold text-white">{data.best[0]} · {formatBRL(data.best[1])}</span></div>
          )}
          {data.goal > 0 && (
            <div className={row}>
              <span className="text-slate-400">Meta do mês</span>
              <span className="font-semibold text-white">{data.goalLeft > 0 ? `faltam ${formatBRL(data.goalLeft)}` : 'atingida! 🎉'}</span>
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => void share()} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-700 text-sm font-semibold text-white">
            <Share2 className="h-4 w-4" /> Compartilhar
          </button>
          <button type="button" onClick={onClose} className="h-12 rounded-xl bg-emerald-500 text-sm font-bold text-on-accent">
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
