import React, { useState } from 'react';
import { Crown, LockKeyhole } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';
import { SubscriptionPlansModal } from './SubscriptionPlansModal';

const enforcementEnabled = import.meta.env.VITE_SUBSCRIPTION_ENFORCEMENT === 'true';

export const SubscriptionAccessGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { subscription, loading, hasAccess, daysRemaining } = useSubscription();
  const [plansOpen, setPlansOpen] = useState(false);

  if (!enforcementEnabled || loading || hasAccess || !subscription) return <>{children}</>;

  return (
    <div className="safe-top safe-bottom flex min-h-[100dvh] items-center justify-center bg-[#060910] px-5 text-slate-100">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-[#0f172a] p-7 text-center shadow-2xl shadow-black">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10 text-amber-300">
          <LockKeyhole className="h-8 w-8" />
        </div>
        <h1 className="mt-5 text-xl font-bold text-white">Seu período gratuito terminou</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Assine o Giro Certo Pro para continuar acompanhando seus ganhos, metas e organização financeira.
        </p>
        <button
          type="button"
          onClick={() => setPlansOpen(true)}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950"
        >
          <Crown className="h-4 w-4" />
          Conhecer planos
        </button>
      </div>
      <SubscriptionPlansModal
        open={plansOpen}
        onClose={() => setPlansOpen(false)}
        daysRemaining={daysRemaining}
      />
    </div>
  );
};
