import React from 'react';
import { Check, Crown, ShieldCheck, Sparkles, X } from 'lucide-react';

export const SUBSCRIPTION_PRODUCTS = {
  monthly: 'giro_certo_monthly',
  annual: 'giro_certo_annual',
} as const;

interface SubscriptionPlansModalProps {
  open: boolean;
  onClose: () => void;
  daysRemaining?: number;
}

const essentialBenefits = [
  'Ganhos, gastos e jornadas',
  'Metas e relatórios',
  'Contas e parcelas',
  'Simulador manual',
];
const proBenefits = [
  'Tudo do Essencial',
  'Analisador automático de corridas',
  'Cartão sobre Uber e 99',
  'Histórico das ofertas analisadas',
];

export const SubscriptionPlansModal: React.FC<SubscriptionPlansModalProps> = ({
  open,
  onClose,
  daysRemaining,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="safe-bottom max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-slate-700/80 bg-[#0f172a] p-5 shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-300">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Giro Certo Pro</h2>
              <p className="mt-0.5 text-xs text-slate-400">
                {daysRemaining !== undefined && daysRemaining > 0
                  ? `Sua apresentação termina em ${daysRemaining} dia${daysRemaining === 1 ? '' : 's'}. O analisador exige assinatura Pro.`
                  : 'Compare os recursos disponíveis em cada plano.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar planos"
            className="rounded-xl bg-slate-800 p-2 text-slate-400 transition hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-3">
          <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white">Essencial</h3>
                <p className="mt-1 text-[10px] text-slate-400">
                  Seu controle diário continua disponível.
                </p>
              </div>
              <ShieldCheck className="h-5 w-5 text-blue-400" />
            </div>
            <div className="mt-3 space-y-2">
              {essentialBenefits.map((benefit) => (
                <div key={benefit} className="flex gap-2 text-xs text-slate-300">
                  <Check className="h-4 w-4 shrink-0 text-blue-400" />
                  {benefit}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">Pro</h3>
                </div>
                <p className="mt-1 text-[10px] text-emerald-300">
                  Exclusivo para assinantes ativos.
                </p>
              </div>
              <Crown className="h-5 w-5 text-amber-300" />
            </div>
            <div className="mt-3 space-y-2">
              {proBenefits.map((benefit) => (
                <div key={benefit} className="flex gap-2 text-xs text-slate-200">
                  <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                  {benefit}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-start gap-2 rounded-xl bg-slate-950/50 p-3 text-[10px] leading-relaxed text-slate-400">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
          <span>
            Preços e cobrança ainda não estão ativos. Eles serão definidos antes da publicação na
            Google Play.
          </span>
        </div>
      </div>
    </div>
  );
};
