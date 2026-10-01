import React from 'react';
import { Check, Crown, RotateCcw, ShieldCheck, Sparkles, X } from 'lucide-react';

export const SUBSCRIPTION_PRODUCTS = {
  monthly: 'giro_certo_monthly',
  annual: 'giro_certo_annual',
} as const;

interface SubscriptionPlansModalProps {
  open: boolean;
  onClose: () => void;
  daysRemaining?: number;
}

const benefits = [
  'Analisador automático de ofertas da Uber, 99 e apps compatíveis',
  'Cartão de viabilidade sobre o aplicativo de corrida',
  'Histórico das ofertas analisadas e conversão em ganho',
  'Recursos inteligentes e automações futuras',
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
                  ? `Seu teste gratuito ainda tem ${daysRemaining} dia${daysRemaining === 1 ? '' : 's'}.`
                  : 'Automação para decidir melhor cada corrida.'}
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

        <div className="mt-5 space-y-2">
          {benefits.map((benefit) => (
            <div key={benefit} className="flex items-start gap-2 text-xs text-slate-300">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <span>{benefit}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950/40 p-3 text-[10px] leading-relaxed text-slate-400">
          O plano Essencial continua gratuito com ganhos, gastos, metas, jornadas, contas e relatórios.
        </div>

        <div className="mt-6 grid gap-3">
          <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">Plano anual</h3>
                </div>
                <p className="mt-1 text-[10px] text-emerald-300">Melhor custo-benefício · economize 33%</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-white">R$ 119,90</p>
                <p className="text-[10px] text-slate-400">por ano</p>
              </div>
            </div>
            <button
              type="button"
              disabled
              className="mt-4 w-full cursor-not-allowed rounded-xl bg-emerald-500/50 px-4 py-3 text-xs font-bold text-slate-950"
            >
              Em preparação para a Google Play
            </button>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white">Plano mensal</h3>
                <p className="mt-1 text-[10px] text-slate-400">Flexibilidade para cancelar quando quiser</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-white">R$ 14,90</p>
                <p className="text-[10px] text-slate-400">por mês</p>
              </div>
            </div>
            <button
              type="button"
              disabled
              className="mt-4 w-full cursor-not-allowed rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-xs font-bold text-slate-400"
            >
              Em preparação para a Google Play
            </button>
          </div>
        </div>

        <div className="mt-5 flex items-start gap-2 rounded-xl bg-slate-950/50 p-3 text-[10px] leading-relaxed text-slate-400">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
          <span>A compra será processada com segurança pela Google Play. Nenhuma cobrança está ativa nesta versão.</span>
        </div>

        <button
          type="button"
          disabled
          className="mt-4 flex w-full cursor-not-allowed items-center justify-center gap-2 py-2 text-xs font-semibold text-slate-500"
        >
          <RotateCcw className="h-4 w-4" />
          Restaurar compra
        </button>
      </div>
    </div>
  );
};
