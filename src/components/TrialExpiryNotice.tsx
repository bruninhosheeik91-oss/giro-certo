import React, { useState } from 'react';
import { Clock3, X } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';

export const TrialExpiryNotice: React.FC = () => {
  const { loading, showExpiryNotice, daysRemaining } = useSubscription();
  const [dismissed, setDismissed] = useState(false);
  if (loading || !showExpiryNotice || dismissed) return null;

  const deadline = daysRemaining === 1 ? 'amanhã' : `em ${daysRemaining} dias`;
  return (
    <div className="mx-4 mt-3 flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-amber-100">
      <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
      <div className="flex-1">
        <p className="text-xs font-bold">Sua apresentação termina {deadline}</p>
        <p className="mt-1 text-[10px] leading-relaxed text-amber-100/70">
          O Essencial continuará funcionando. O analisador automático só é liberado com uma
          assinatura Pro ativa.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Fechar aviso"
        className="rounded-lg p-1 text-amber-200/70"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
