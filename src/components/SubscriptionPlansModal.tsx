import React, { useState } from 'react';
import { Check, Crown, LockKeyhole, ShieldCheck, Sparkles, X } from 'lucide-react';
import {
  BILLING_PLANS,
  type BillingPlanId,
  formatBillingPrice,
  getBillingProvider,
  getDistributionChannel,
  isBillingEnabled,
} from '../lib/billingCatalog';
import { startStripeCheckout } from '../lib/stripeCheckout';

interface SubscriptionPlansModalProps {
  open: boolean;
  onClose: () => void;
  daysRemaining?: number;
  activePlan?: BillingPlanId | null;
  subscriptionActive?: boolean;
  onSubscribe?: (planId: BillingPlanId) => void;
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
  activePlan = null,
  subscriptionActive = false,
  onSubscribe,
}) => {
  const [checkoutPlan, setCheckoutPlan] = useState<BillingPlanId | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  if (!open) return null;
  const channel = getDistributionChannel();
  const provider = getBillingProvider(channel);
  const checkoutEnabled = isBillingEnabled(channel);
  const providerLabel = provider === 'google_play' ? 'Google Play' : 'Stripe';
  const canSubscribe = checkoutEnabled && (provider === 'stripe' || Boolean(onSubscribe));

  const subscribe = async (planId: BillingPlanId) => {
    setCheckoutError(null);
    setCheckoutPlan(planId);
    try {
      if (provider === 'stripe') await startStripeCheckout(planId);
      else onSubscribe?.(planId);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Não foi possível assinar.');
      setCheckoutPlan(null);
    }
  };

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
                {subscriptionActive
                  ? `Seu plano ${activePlan === 'annual' ? 'Pro Anual' : 'Pro Mensal'} está ativo.`
                  : daysRemaining !== undefined && daysRemaining > 0
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
            <div className="mt-4 grid gap-2">
              {BILLING_PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className="rounded-xl border border-emerald-400/20 bg-slate-950/40 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-white">{plan.title}</p>
                      <p className="text-lg font-extrabold text-emerald-300">
                        {formatBillingPrice(plan.price)}
                        <span className="ml-1 text-[10px] font-medium text-slate-400">
                          {plan.periodLabel}
                        </span>
                      </p>
                      {plan.savingsLabel && (
                        <p className="text-[10px] text-emerald-300">{plan.savingsLabel}</p>
                      )}
                    </div>
                    {subscriptionActive && activePlan === plan.id ? (
                      <span className="rounded-lg bg-emerald-400/15 px-2 py-1 text-[9px] font-bold text-emerald-300">
                        PLANO ATUAL
                      </span>
                    ) : plan.id === 'annual' ? (
                      <span className="rounded-lg bg-amber-400/15 px-2 py-1 text-[9px] font-bold text-amber-300">
                        MELHOR VALOR
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={subscriptionActive || !canSubscribe || checkoutPlan !== null}
                    onClick={() => void subscribe(plan.id)}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {!checkoutEnabled && <LockKeyhole className="h-3.5 w-3.5" />}
                    {subscriptionActive
                      ? activePlan === plan.id
                        ? 'Plano atual'
                        : 'Você já possui um plano ativo'
                      : checkoutPlan === plan.id
                      ? 'Abrindo pagamento...'
                      : canSubscribe
                        ? `Assinar com ${providerLabel}`
                        : 'Em breve'}
                  </button>
                </div>
              ))}
              {checkoutError && (
                <p className="rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-[10px] text-red-200">
                  {checkoutError}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-start gap-2 rounded-xl bg-slate-950/50 p-3 text-[10px] leading-relaxed text-slate-400">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
          <span>
            {checkoutEnabled
              ? `O pagamento é processado com segurança pela ${providerLabel}. O Giro Certo não armazena os dados do seu cartão.`
              : `Os preços já estão definidos. A cobrança via ${providerLabel} será liberada depois da ativação e validação da conta do provedor.`}
          </span>
        </div>
      </div>
    </div>
  );
};
