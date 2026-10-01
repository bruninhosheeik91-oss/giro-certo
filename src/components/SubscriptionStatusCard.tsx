import React, { useState } from 'react';
import { Crown, ShieldCheck } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';
import { SubscriptionPlansModal } from './SubscriptionPlansModal';

export const SubscriptionStatusCard: React.FC = () => {
  const { subscription, loading, daysRemaining, hasProAccess, isAdmin } = useSubscription();
  const [plansOpen, setPlansOpen] = useState(false);
  if (loading || !subscription) return null;
  const active = subscription.status === 'active';
  const title = isAdmin ? 'Giro Certo Owner' : hasProAccess ? 'Giro Certo Pro' : 'Giro Certo Essencial';
  const description = isAdmin
    ? 'Acesso administrativo completo'
    : active
      ? subscription.plan === 'annual' ? 'Plano anual ativo' : 'Plano mensal ativo'
      : hasProAccess
        ? 'Período gratuito Pro'
        : 'Controle financeiro gratuito';

  return (
    <>
    <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-blue-950/40 border border-blue-500/25 space-y-3 shadow-md">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-300">
            {active ? <Crown className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">{title}</h3>
            <p className="text-[10px] text-slate-400">{description}</p>
          </div>
        </div>
        <span className="px-2 py-1 rounded-lg bg-blue-500/15 border border-blue-500/25 text-[10px] font-bold text-blue-300">
          {isAdmin ? 'OWNER' : active ? 'ATIVO' : hasProAccess ? `${daysRemaining} dias restantes` : 'ESSENCIAL'}
        </span>
      </div>
      {!isAdmin && !active && <p className="text-[10px] leading-relaxed text-slate-400">{hasProAccess ? 'Ao terminar o teste, o controle financeiro continua no Essencial. Apenas os recursos automáticos do Pro ficam bloqueados.' : 'Ganhos, gastos, metas, jornadas e relatórios continuam disponíveis. Faça upgrade para liberar o analisador automático.'}</p>}
      <button
        type="button"
        onClick={() => setPlansOpen(true)}
        className="w-full rounded-xl border border-blue-400/25 bg-blue-500/10 px-3 py-2.5 text-xs font-bold text-blue-200 transition active:scale-[0.98]"
      >
        {isAdmin ? 'Ver planos do aplicativo' : active ? 'Gerenciar assinatura' : 'Conhecer o Pro'}
      </button>
    </div>
    <SubscriptionPlansModal open={plansOpen} onClose={() => setPlansOpen(false)} daysRemaining={daysRemaining} />
    </>
  );
};
