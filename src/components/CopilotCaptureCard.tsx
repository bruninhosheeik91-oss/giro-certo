import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Crown,
  LockKeyhole,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Square,
} from 'lucide-react';
import { formatBRL, formatPercent } from '../utils/calculations';
import { analyzeRideCapture } from '../utils/copilot';
import {
  getLatestRideCaptureResult,
  getRideCaptureStatus,
  isRideOfferNativeAvailable,
  isRideScreenCaptureSupported,
  listenForRideCapture,
  startRideScreenCapture,
  stopRideScreenCapture,
  type NativeCaptureResult,
  type ScreenCaptureSupport,
} from '../lib/rideOffer';
import type { RideCriteria } from '../types';

const APPS = [
  { key: 'Uber', name: 'Uber Driver', packageName: 'com.ubercab.driver' },
  { key: '99', name: '99 Motorista', packageName: 'com.taxis99' },
] as const;

type AppKey = (typeof APPS)[number]['key'];

interface CopilotCaptureCardProps {
  hasProAccess: boolean;
  subscriptionLoading: boolean;
  costPerKm: number;
  criteria: RideCriteria;
  onRequestUpgrade: () => void;
}

export const CopilotCaptureCard: React.FC<CopilotCaptureCardProps> = ({
  hasProAccess,
  subscriptionLoading,
  costPerKm,
  criteria,
  onRequestUpgrade,
}) => {
  const native = isRideOfferNativeAvailable();
  const [support, setSupport] = useState<ScreenCaptureSupport | null>(null);
  const [selectedApp, setSelectedApp] = useState<AppKey>('Uber');
  const [active, setActive] = useState(false);
  const [capture, setCapture] = useState<NativeCaptureResult | null>(null);
  const [warning, setWarning] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!native) return;
    let cancelled = false;
    void isRideScreenCaptureSupported().then((value) => {
      if (!cancelled) setSupport(value);
    });
    return () => {
      cancelled = true;
    };
  }, [native]);

  const refresh = useCallback(async () => {
    const [status, latest] = await Promise.all([
      getRideCaptureStatus(),
      getLatestRideCaptureResult(),
    ]);
    setActive(status.active);
    if (status.stopReason) setMessage(status.stopReason);
    if (latest) setCapture(latest);
    setWarning(status.fullScreen);
  }, []);

  useEffect(() => {
    if (!native || !hasProAccess) return;
    let cancelled = false;
    const handles: { remove: () => Promise<void> }[] = [];
    void listenForRideCapture(
      (result) => {
        if (cancelled) return;
        setCapture(result);
        setWarning(result.fullScreen);
        setMessage('');
      },
      (event) => {
        if (cancelled) return;
        setActive(false);
        if (event.reason) setMessage(event.reason);
      },
    ).then((created) => {
      if (cancelled) {
        created.forEach((handle) => void handle.remove());
        return;
      }
      handles.push(...created);
    });
    void refresh();
    return () => {
      cancelled = true;
      handles.forEach((handle) => void handle.remove());
    };
  }, [native, hasProAccess, refresh]);

  useEffect(() => {
    if (!native || !hasProAccess || !active) return;
    const interval = window.setInterval(() => {
      void getLatestRideCaptureResult().then((latest) => {
        if (latest) setCapture(latest);
      });
      void getRideCaptureStatus().then((status) => {
        if (!status.active) setActive(false);
        setWarning(status.fullScreen);
      });
    }, 2500);
    return () => window.clearInterval(interval);
  }, [native, hasProAccess, active]);

  const analysis = useMemo(
    () => (capture ? analyzeRideCapture(capture, { costPerKm, criteria }) : null),
    [capture, costPerKm, criteria],
  );

  const handleStart = async () => {
    setBusy(true);
    setMessage('');
    try {
      const app = APPS.find((item) => item.key === selectedApp) ?? APPS[0];
      const result = await startRideScreenCapture({
        appName: app.name,
        packageName: app.packageName,
      });
      if (result.started) {
        setActive(true);
        setCapture(null);
        setWarning(false);
      } else {
        setMessage(result.message ?? 'Não foi possível iniciar a captura.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleStop = async () => {
    setBusy(true);
    try {
      await stopRideScreenCapture();
      setActive(false);
    } finally {
      setBusy(false);
    }
  };

  if (!native) return null;

  if (!subscriptionLoading && !hasProAccess) {
    return (
      <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-300">
            <LockKeyhole className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-bold text-white">Copiloto Giro Certo</p>
              <span className="rounded-md bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-300">
                PRO
              </span>
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
              Recurso experimental que estima a oferta lendo a tela (Uber Driver ou 99
              Motorista) com captura oficial do Android e OCR local no aparelho. Nada é salvo
              ou enviado.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRequestUpgrade}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-3 py-2.5 text-[11px] font-bold text-slate-950 active:scale-[0.99]"
        >
          <Crown className="h-4 w-4" />
          Conhecer o Giro Certo Pro
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-teal-500/25 bg-teal-500/[0.07]">
      <div className="flex items-start gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-teal-500/30 bg-teal-500/10 text-teal-300">
          <ScanLine className="h-4 w-4" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-bold text-white">Copiloto Giro Certo</p>
            <span className="rounded-md bg-teal-500/15 px-1.5 py-0.5 text-[9px] font-extrabold text-teal-300">
              EXPERIMENTAL
            </span>
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
            Estima a oferta a partir de uma captura de tela oficial do Android, com o seu
            consentimento a cada sessão, e leitura 100% local (OCR no aparelho). Nada é salvo,
            enviado ou sobreposto a outros apps.
          </p>
        </div>
      </div>

      {support && !support.supported ? (
        <div className="mx-4 mb-4 rounded-lg border border-slate-700 bg-slate-950/40 p-3">
          <p className="text-[11px] font-bold text-slate-200">Disponível apenas no Android 14+</p>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
            {support.reason ||
              'Este aparelho não permite restringir a captura a um único app.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3 px-4 pb-4">
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              App a acompanhar
            </p>
            <div className="grid grid-cols-2 gap-2">
              {APPS.map((app) => (
                <button
                  key={app.key}
                  type="button"
                  disabled={active}
                  onClick={() => setSelectedApp(app.key)}
                  className={`rounded-lg border px-3 py-2 text-[11px] font-bold transition-colors disabled:opacity-50 ${
                    selectedApp === app.key
                      ? 'border-teal-500/40 bg-teal-500/15 text-teal-200'
                      : 'border-slate-700 bg-slate-950/40 text-slate-400'
                  }`}
                >
                  {app.name}
                </button>
              ))}
            </div>
          </div>

          <p className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5 text-[10px] leading-relaxed text-slate-500">
            O diálogo do sistema é controlado pelo Android e não conseguimos verificar
            tecnicamente qual janela você compartilhou. Escolha apenas &quot;Uber Driver&quot;
            ou &quot;99 Motorista&quot;. Compartilhar a tela inteira pode incluir conteúdo de
            outros apps na leitura.
          </p>

          {active ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleStop()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/15 px-3 py-2.5 text-[11px] font-bold text-rose-200 active:scale-[0.99] disabled:opacity-50"
            >
              <Square className="h-4 w-4" />
              Encerrar captura
            </button>
          ) : (
            <button
              type="button"
              disabled={busy || subscriptionLoading}
              onClick={() => void handleStart()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-400 px-3 py-2.5 text-[11px] font-bold text-slate-950 active:scale-[0.99] disabled:opacity-50"
            >
              <ScanLine className="h-4 w-4" />
              Iniciar captura
            </button>
          )}

          {active && (
            <div className="flex items-center gap-2 rounded-lg border border-teal-500/20 bg-teal-500/10 p-2.5">
              <ShieldCheck className="h-4 w-4 shrink-0 text-teal-300" />
              <p className="text-[10px] leading-relaxed text-teal-200">
                Captura ativa. Abra o app escolhido e a análise aparece aqui quando voltar.
              </p>
            </div>
          )}

          {warning && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-500/25 bg-rose-500/10 p-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-300" />
              <p className="text-[10px] leading-relaxed text-rose-200">
                Estimativa: a região capturada parece ser a tela inteira. Recomendamos encerrar e
                escolher apenas o Uber ou o 99 — não é possível garantir tecnicamente que só um
                app será lido.
              </p>
            </div>
          )}

          {message && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 p-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />
              <p className="text-[10px] leading-relaxed text-amber-200">{message}</p>
            </div>
          )}
        </div>
      )}

      {analysis && (
        <div className="border-t border-slate-800 bg-slate-950/50 p-4">
          {analysis.complete && analysis.result ? (
            <>
              <div className="flex items-center justify-between">
                <span
                  className={`rounded-full border px-3 py-1 text-[11px] font-extrabold ${
                    analysis.result.status === 'Compensa'
                      ? 'border-emerald-500/30 bg-emerald-500/20 text-emerald-400'
                      : analysis.result.status === 'Atenção'
                        ? 'border-amber-500/30 bg-amber-500/20 text-amber-400'
                        : 'border-rose-500/30 bg-rose-500/20 text-rose-400'
                  }`}
                >
                  {analysis.result.status === 'Compensa' && '✓ COMPENSA'}
                  {analysis.result.status === 'Atenção' && '⚠️ ATENÇÃO'}
                  {analysis.result.status === 'Não compensa' && '✕ NÃO COMPENSA'}
                </span>
                <span className="text-[11px] font-bold text-slate-300">
                  Margem: {formatPercent(analysis.result.marginPercent)}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <Metric label="Valor" value={formatBRL(capture?.fareOffered ?? 0)} />
                <Metric label="Valor bruto/km" value={`${formatBRL(analysis.result.revenuePerKm)}/km`} />
                <Metric label="Valor bruto/h" value={`${formatBRL(analysis.result.revenuePerHour)}/h`} />
                <Metric
                  label="Lucro estimado"
                  value={formatBRL(analysis.result.estimatedProfit)}
                  tone={analysis.result.estimatedProfit > 0 ? 'good' : 'bad'}
                />
                <Metric label="Margem" value={formatPercent(analysis.result.marginPercent)} />
                <Metric label="App" value={analysis.appName || '—'} />
                <Metric label="Tempo" value={`${Math.round(analysis.totalMinutes)} min`} />
                <Metric label="Distância" value={`${analysis.totalDistanceKm.toFixed(1)} km`} />
              </div>

              <p className="mt-3 text-[10px] italic leading-relaxed text-slate-500">
                {analysis.result.reason} Leitura local da tela; confira antes de aceitar.
              </p>
            </>
          ) : (
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />
              <div>
                <p className="text-[11px] font-bold text-amber-200">Análise incompleta</p>
                <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
                  {analysis.reason}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {!analysis && capture && (
        <div className="border-t border-slate-800 bg-slate-950/50 p-4">
          <p className="text-[10px] leading-relaxed text-slate-500">
            Nenhuma oferta legível no momento. Mantenha o cartão de oferta aberto no app escolhido.
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-slate-800 px-4 py-2.5">
        <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
        <button
          type="button"
          onClick={() => void refresh()}
          className="text-[10px] font-bold text-slate-400"
        >
          Atualizar leitura
        </button>
      </div>
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string; tone?: 'good' | 'bad' }> = ({
  label,
  value,
  tone,
}) => (
  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
    <span className="block text-[9px] uppercase text-slate-500">{label}</span>
    <span
      className={`text-xs font-bold font-mono ${
        tone === 'good' ? 'text-emerald-400' : tone === 'bad' ? 'text-rose-400' : 'text-slate-100'
      }`}
    >
      {value}
    </span>
  </div>
);
