import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Zap } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatBRL } from '../utils/calculations';
import { getRideOfferHistory, isRideOfferNativeAvailable, markRideOfferConverted, type AnalyzedRideOffer } from '../lib/rideOffer';

const WINDOW_MS = 4 * 60 * 60 * 1000;

const dot = (status: AnalyzedRideOffer['status']) =>
  status === 'COMPENSA' ? 'bg-emerald-400' : status === 'ATENÇÃO' ? 'bg-amber-400' : 'bg-rose-400';

/** Últimas ofertas lidas pelo Copiloto: 1 toque registra o ganho, sem formulário. */
export const QuickRideRegister: React.FC = () => {
  const { activeShift, activeVehicle, addTransaction, showToast } = useApp();
  const [offers, setOffers] = useState<AnalyzedRideOffer[]>([]);
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const refresh = useCallback(async () => {
    const since = Date.now() - WINDOW_MS;
    const list = await getRideOfferHistory();
    setOffers(list.filter((offer) => offer.analyzedAt >= since).slice(0, 5));
  }, []);

  useEffect(() => {
    if (!isRideOfferNativeAvailable()) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  if (!activeShift || offers.length === 0) return null;

  const register = (offer: AnalyzedRideOffer) => {
    const at = new Date(offer.analyzedAt);
    const pad = (n: number) => String(n).padStart(2, '0');
    addTransaction({
      type: 'ganho',
      gainType: 'individual',
      app: offer.appName,
      baseAmount: offer.fare,
      tipAmount: 0,
      bonusAmount: 0,
      amount: offer.fare,
      ridesCount: 1,
      shiftId: activeShift.shiftId,
      vehicleId: activeVehicle?.id,
      date: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`,
      time: `${pad(at.getHours())}:${pad(at.getMinutes())}`,
      description: `Corrida ${offer.appName} · ${offer.totalKm.toFixed(1)} km (Copiloto)`,
    });
    void markRideOfferConverted(offer.id);
    setSaved((value) => ({ ...value, [offer.id]: true }));
    showToast(`Ganho de ${formatBRL(offer.fare)} registrado. Para corrigir, edite em Lançamentos.`);
  };

  return (
    <div className="space-y-2 rounded-2xl border border-emerald-500/25 bg-slate-900/80 p-4">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-emerald-400" />
        <span className="text-sm font-bold text-white">Registrar corrida com 1 toque</span>
      </div>
      <p className="text-[11px] text-slate-400">Ofertas lidas pelo Copiloto nas últimas horas. Toque na que você fez.</p>
      {offers.map((offer) => {
        const done = Boolean(offer.convertedAt) || saved[offer.id];
        return (
          <button
            key={offer.id}
            type="button"
            disabled={done}
            onClick={() => register(offer)}
            className="flex w-full items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-left active:scale-[0.99] disabled:opacity-60"
          >
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot(offer.status)}`} />
            <span className="flex-1">
              <span className="block text-sm font-bold text-slate-100">
                {formatBRL(offer.fare)} <span className="text-[11px] font-normal text-slate-400">· {offer.appName}</span>
              </span>
              <span className="block text-[10px] text-slate-500">
                {new Date(offer.analyzedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} ·{' '}
                {offer.totalKm.toFixed(1)} km · {Math.round(offer.minutes)} min
              </span>
            </span>
            {done ? (
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> Registrada
              </span>
            ) : (
              <span className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white">Fiz esta</span>
            )}
          </button>
        );
      })}
    </div>
  );
};
