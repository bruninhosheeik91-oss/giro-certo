import React from 'react';
import { Crown, Gauge, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useTargetBar } from '../hooks/useTargetBar';
import { formatBRL } from '../utils/calculations';

interface TargetBarCardProps {
  subscriptionLoading: boolean;
  onRequestUpgrade: () => void;
}

export const TargetBarCard: React.FC<TargetBarCardProps> = ({ subscriptionLoading, onRequestUpgrade }) => {
  const { native, enabled, blocked, bar, setEnabled, hasProAccess } = useTargetBar();

  if (subscriptionLoading) return null;

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-slate-900/70 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Gauge className="h-4 w-4 text-emerald-400" />
        <span className="text-sm font-bold text-slate-100">Régua de aceite</span>
        {native && hasProAccess && (
          <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${enabled ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
            {enabled ? 'NA BARRA' : 'DESLIGADA'}
          </span>
        )}
      </div>

      <div className="rounded-lg bg-slate-950/60 p-3 text-center">
        <p className="text-[11px] text-slate-400">Aceite corridas acima de</p>
        <p className="text-3xl font-black text-emerald-300">{formatBRL(bar.minGrossPerKm)}<span className="text-base text-slate-400">/km</span></p>
        <p className="mt-1 text-[11px] text-slate-400">
          e de no mínimo <span className="font-bold text-slate-200">{formatBRL(bar.minFare)}</span> por corrida
        </p>
      </div>

      <p className="text-[11px] text-slate-400">
        Compare com o "R$/km" que a Uber e a 99 mostram na oferta. Seu custo é {formatBRL(bar.costPerKm)}/km
        {bar.costSource === 'real' ? ' (real, dos seus lançamentos do mês)' : ' (estimado — fica real após 100 km lançados no mês)'}
        {' '}+ lucro mínimo de {formatBRL(bar.minGrossPerKm - bar.costPerKm)}/km.
        {bar.dailyGoal > 0 && (bar.goalReached ? ' Meta do dia batida.' : ` Faltam ${formatBRL(bar.goalRemaining)} para a meta do dia.`)}
      </p>

      {!native ? (
        <p className="text-[11px] text-slate-500">No app Android a régua fica fixa na barra de notificações.</p>
      ) : !hasProAccess ? (
        <button type="button" onClick={onRequestUpgrade} className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950">
          <LockKeyhole className="h-3.5 w-3.5" /> <Crown className="h-3.5 w-3.5" /> Régua na barra é Pro
        </button>
      ) : (
        <button type="button" onClick={() => void setEnabled(!enabled)} className={`w-full rounded-lg px-3 py-2.5 text-xs font-bold ${enabled ? 'bg-slate-800 text-slate-200' : 'bg-emerald-600 text-white'}`}>
          {enabled ? 'Tirar régua da barra de notificações' : 'Fixar régua na barra de notificações'}
        </button>
      )}
      {blocked && <p className="text-[11px] text-amber-300">Permita as notificações do Giro Certo nas configurações do Android.</p>}
      <p className="flex items-start gap-1.5 text-[10px] text-slate-500">
        <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
        Não lê a tela nem outros apps: sem acessibilidade, sem captura, sem sobreposição.
      </p>
    </div>
  );
};
