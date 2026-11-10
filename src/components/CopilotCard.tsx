import React from 'react';
import { Crown, LockKeyhole, Power, Radar } from 'lucide-react';
import { useCopilot } from '../hooks/useCopilot';
import { CopilotCriteriaEditor } from './CopilotCriteriaEditor';
import { CopilotLogPanel } from './CopilotLogPanel';

interface CopilotCardProps {
  onRequestUpgrade: () => void;
}

const timeFormat = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

export const CopilotCard: React.FC<CopilotCardProps> = ({ onRequestUpgrade }) => {
  const { native, hasProAccess, loading, granted, enabled, diagnostic, minRating, onShift, openSettings, toggle, turnOff, setMinRating } =
    useCopilot();

  if (loading) return null;

  if (!native) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-xs text-slate-400">
        O Copiloto (cartão verde/amarelo/vermelho em cada oferta) funciona no app Android.
      </div>
    );
  }

  if (!hasProAccess) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-bold text-amber-300">
          <LockKeyhole className="h-4 w-4" /> Copiloto Giro Certo (Pro)
        </div>
        <p className="text-xs text-slate-400">Cartão colorido em cada oferta da Uber, 99 e inDrive dizendo se compensa.</p>
        <button type="button" onClick={onRequestUpgrade} className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950">
          <Crown className="h-3.5 w-3.5" /> Conhecer o Pro
        </button>
      </div>
    );
  }

  const running = granted && enabled;

  return (
    <div className="rounded-xl border border-blue-500/30 bg-slate-900/70 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Radar className="h-4 w-4 text-blue-400" />
        <span className="text-sm font-bold text-slate-100">Copiloto Giro Certo</span>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold ${running ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
          {running ? 'ATIVO' : 'DESLIGADO'}
        </span>
      </div>

      <div className="flex gap-1.5 text-[11px] font-bold">
        <span className="flex-1 rounded bg-emerald-500 py-1 text-center text-on-accent">Vale a pena</span>
        <span className="flex-1 rounded bg-amber-500 py-1 text-center text-on-accent">Atenção</span>
        <span className="flex-1 rounded bg-red-500 py-1 text-center text-on-accent">Não compensa</span>
      </div>

      {!granted ? (
        <>
          <p className="text-xs text-slate-400">
            Toque abaixo, entre em <b>Apps instalados → Copiloto Giro Certo</b> e ative. Ele lê só a Uber, 99 e inDrive.
          </p>
          <button type="button" onClick={() => void openSettings()} className="w-full rounded-lg bg-blue-600 px-3 py-2.5 text-xs font-bold text-on-accent">
            Ativar Copiloto nas configurações
          </button>
        </>
      ) : (
        <div className="flex gap-2">
          <button type="button" onClick={() => void toggle()} className={`flex-1 rounded-lg px-3 py-2.5 text-xs font-bold ${enabled ? 'bg-slate-800 text-slate-200' : 'bg-emerald-600 text-on-accent'}`}>
            {enabled ? 'Pausar análise' : 'Analisar ofertas'}
          </button>
          <button type="button" onClick={() => void turnOff()} className="flex items-center gap-1 rounded-lg bg-red-600/90 px-3 py-2.5 text-xs font-bold text-white">
            <Power className="h-3.5 w-3.5" /> Desligar
          </button>
        </div>
      )}

      <CopilotCriteriaEditor minRating={minRating} onMinRatingChange={setMinRating} />
      <CopilotLogPanel />

      {diagnostic && (
        <p className={`rounded bg-slate-950/60 p-2 text-xs ${diagnostic.analyzed ? 'text-emerald-300' : 'text-amber-300'}`}>
          {timeFormat.format(diagnostic.at)} · {diagnostic.message}
        </p>
      )}

      <p className="text-[11px] text-slate-500">
        {granted
          ? onShift
            ? 'Ao encerrar a jornada no Giro Certo, o Copiloto se desliga sozinho e seus apps de banco voltam a funcionar.'
            : 'Inicie uma jornada para o Copiloto se desligar sozinho ao final. Enquanto ligado, alguns apps de banco podem não abrir.'
          : 'Enquanto o Copiloto estiver ligado, alguns apps de banco podem não abrir. Ele se desliga sozinho ao encerrar a jornada.'}
      </p>
    </div>
  );
};
