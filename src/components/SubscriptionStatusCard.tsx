import React, { useState } from 'react';
import { Crown, ShieldCheck } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';
import { SubscriptionPlansModal } from './SubscriptionPlansModal';

export const SubscriptionStatusCard: React.FC = () => {
  const { subscription, loading, daysRemaining, tier, reason } = useSubscription();
  const [plansOpen, setPlansOpen] = useState(false);
  if (loading) return null;
  const isPro = tier === 'pro';
  const isTrial = reason === 'trial';
  const subtitle =
    reason === 'owner'
      ? 'Acesso administrativo completo'
      : reason === 'subscription'
        ? subscription?.plan === 'annual'
          ? 'Plano anual ativo'
          : 'Plano mensal ativo'
        : isTrial
          ? 'Período de apresentação'
          : 'Controle financeiro essencial';

  return (
    <>
      <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-blue-950/40 border border-blue-500/25 space-y-3 shadow-md">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-300">
              {isPro ? <Crown className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Meu Plano</h3>
              <p className="text-[10px] text-slate-400">{subtitle}</p>
            </div>
          </div>
          <span className="px-2 py-1 rounded-lg bg-blue-500/15 border border-blue-500/25 text-[10px] font-bold text-blue-300">
            {isTrial ? `${daysRemaining} dias` : isPro ? 'PRO' : 'ESSENCIAL'}
          </span>
        </div>
        <p className="text-[10px] leading-relaxed text-slate-400">
          {isTrial
            ? 'O analisador automático é exclusivo para assinantes Pro. O Essencial e o simulador manual continuam disponíveis.'
            : isPro
              ? 'Você tem acesso aos recursos Essencial e Pro.'
              : 'Ganhos, gastos, jornadas, metas, contas e relatórios continuam disponíveis sem prazo.'}
        </p>
        <button
          type="button"
          onClick={() => setPlansOpen(true)}
          className="w-full rounded-xl border border-blue-400/25 bg-blue-500/10 px-3 py-2.5 text-xs font-bold text-blue-200 transition active:scale-[0.98]"
        >
          Ver detalhes do plano
        </button>
      </div>
      <SubscriptionPlansModal
        open={plansOpen}
        onClose={() => setPlansOpen(false)}
        daysRemaining={daysRemaining}
      />
    </>
  );
};
