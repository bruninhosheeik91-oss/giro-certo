import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  simulateRide,
  simulateGoal,
  formatBRL,
  formatPercent,
  parseBRLInput,
  parseDecimalInput,
} from '../utils/calculations';
import {
  X,
  Calculator,
  Navigation,
  Target,
  ShieldCheck,
  ChevronDown,
  History,
  Trash2,
  Crown,
  LockKeyhole,
} from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';
import { SubscriptionPlansModal } from './SubscriptionPlansModal';
import {
  isRideOfferAccessGranted,
  isRideOfferNativeAvailable,
  isRideOverlayGranted,
  openRideOfferAccessSettings,
  openRideOverlaySettings,
  saveNativeRideCriteria,
  testRideOverlay,
  clearRideOfferHistory,
  getRideOfferHistory,
  type AnalyzedRideOffer,
  getRideAnalyzerEnabled,
  setRideAnalyzerEnabled,
  setRideProEntitlement,
} from '../lib/rideOffer';

export const SimulatorsModal: React.FC = () => {
  const {
    isSimulatorsModalOpen,
    closeSimulatorsModal,
    openNewTransactionModal,
    activeVehicle,
    activeShift,
    userProfile,
  } = useApp();
  const {
    hasProAccess,
    loading: subscriptionLoading,
    daysRemaining,
    expiresAt,
    reason,
  } = useSubscription();
  const [activeTab, setActiveTab] = useState<'corrida' | 'meta'>('corrida');
  const [plansOpen, setPlansOpen] = useState(false);

  const criteria = userProfile.rideCriteria || {
    minProfitPerKm: 0.8,
    minProfitPerHour: 25.0,
    minAcceptableValue: 8.0,
    considerReturnDistance: true,
  };

  // Simulator 1: Ride / Delivery
  const defaultCostPerKm = activeVehicle.type === 'moto' ? '0.28' : '0.62';
  const [fareOffered, setFareOffered] = useState('28.50');
  const [distanceToPickup, setDistanceToPickup] = useState('2.5');
  const [tripDistance, setTripDistance] = useState('8.0');
  const [returnDistance, setReturnDistance] = useState('3.0');
  const [considerReturn, setConsiderReturn] = useState(criteria.considerReturnDistance);
  const [estimatedMinutes, setEstimatedMinutes] = useState('25');
  const [costPerKm, setCostPerKm] = useState(defaultCostPerKm);
  const [tollsAndParking, setTollsAndParking] = useState('0.00');
  const [notificationAccess, setNotificationAccess] = useState(false);
  const [overlayAccess, setOverlayAccess] = useState(false);
  const [overlayTestMessage, setOverlayTestMessage] = useState('');
  const [permissionTarget, setPermissionTarget] = useState<'notifications' | 'overlay' | null>(
    null,
  );
  const [offerHistory, setOfferHistory] = useState<AnalyzedRideOffer[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [analyzerEnabled, setAnalyzerEnabled] = useState(true);

  // Simulator 2: Goal
  const [targetProfit, setTargetProfit] = useState(userProfile.monthlyGoal.toString());
  const goalPeriod = 'mensal' as const;
  const [workDays, setWorkDays] = useState('24');
  const [hoursPerDay, setHoursPerDay] = useState('9');
  const [averagePerHour, setAveragePerHour] = useState('36.00');
  const [goalCostPerKm, setGoalCostPerKm] = useState(defaultCostPerKm);
  const [reservePerKm, setReservePerKm] = useState(
    (userProfile.maintenanceReservePerKm || 0.12).toString(),
  );

  useEffect(() => {
    void isRideOfferAccessGranted().then(setNotificationAccess);
    void isRideOverlayGranted().then(setOverlayAccess);
    void getRideAnalyzerEnabled().then(setAnalyzerEnabled);
    void saveNativeRideCriteria({
      minProfitPerKm: criteria.minProfitPerKm,
      minProfitPerHour: criteria.minProfitPerHour,
      minAcceptableValue: criteria.minAcceptableValue,
      costPerKm: Number(defaultCostPerKm),
    });

    const refreshAccess = () => {
      if (document.visibilityState === 'visible') {
        void isRideOfferAccessGranted().then(setNotificationAccess);
        void isRideOverlayGranted().then(setOverlayAccess);
      }
    };
    document.addEventListener('visibilitychange', refreshAccess);
    return () => {
      document.removeEventListener('visibilitychange', refreshAccess);
    };
  }, [
    criteria.minAcceptableValue,
    criteria.minProfitPerHour,
    criteria.minProfitPerKm,
    defaultCostPerKm,
  ]);

  useEffect(() => {
    if (isSimulatorsModalOpen) void getRideOfferHistory().then(setOfferHistory);
  }, [isSimulatorsModalOpen]);

  useEffect(() => {
    if (subscriptionLoading) return;
    const entitlementEnd = reason === 'owner' ? 0 : expiresAt ? Date.parse(expiresAt) : 0;
    void setRideProEntitlement(hasProAccess, entitlementEnd);
    if (!subscriptionLoading && !hasProAccess && analyzerEnabled) {
      setAnalyzerEnabled(false);
      void setRideAnalyzerEnabled(false);
    }
  }, [analyzerEnabled, expiresAt, hasProAccess, reason, subscriptionLoading]);

  if (!isSimulatorsModalOpen) return null;

  // Run calculation 1 with custom user criteria
  const rideResult = simulateRide({
    fareOffered: parseBRLInput(fareOffered),
    distanceToPickup: parseDecimalInput(distanceToPickup),
    tripDistance: parseDecimalInput(tripDistance),
    returnDistance: parseDecimalInput(returnDistance),
    estimatedMinutes: parseDecimalInput(estimatedMinutes) || 1,
    costPerKm: parseDecimalInput(costPerKm) || 0.28,
    tollsAndParking: parseBRLInput(tollsAndParking),
    criteria: {
      ...criteria,
      considerReturnDistance: considerReturn,
    },
  });

  // Run calculation 2
  const goalResult = simulateGoal({
    targetProfit: parseDecimalInput(targetProfit),
    period: goalPeriod,
    workDays: parseInt(workDays, 10) || 1,
    hoursPerDay: parseDecimalInput(hoursPerDay) || 1,
    averagePerHour: parseDecimalInput(averagePerHour) || 35,
    costPerKm: parseDecimalInput(goalCostPerKm) || 0.25,
    reservePerKm: parseDecimalInput(reservePerKm) || 0.12,
  });

  const continuePermission = () => {
    const target = permissionTarget;
    setPermissionTarget(null);
    localStorage.setItem('giro_certo_ride_analyzer_consent_v1', new Date().toISOString());
    if (target === 'notifications') void openRideOfferAccessSettings();
    if (target === 'overlay') void openRideOverlaySettings();
  };

  const requestPermission = (target: 'notifications' | 'overlay') => {
    const consented = Boolean(localStorage.getItem('giro_certo_ride_analyzer_consent_v1'));
    if (consented) {
      if (target === 'notifications') void openRideOfferAccessSettings();
      else void openRideOverlaySettings();
      return;
    }
    setPermissionTarget(target);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-[#0f172a] border border-slate-800 rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Simuladores Financeiros
              </h2>
              <p className="text-xs text-slate-400">
                Tome decisões com base no lucro real por km e hora
              </p>
            </div>
          </div>
          <button
            onClick={closeSimulatorsModal}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-950/80 border-b border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('corrida')}
            className={`py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
              activeTab === 'corrida'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Navigation className="w-4 h-4" />
            <span>Viabilidade de Corrida</span>
          </button>

          <button
            onClick={() => setActiveTab('meta')}
            className={`py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
              activeTab === 'meta'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Target className="w-4 h-4" />
            <span>Simulador de Meta</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'corrida' ? (
            /* Tab 1: Ride Simulator */
            <div className="space-y-4">
              {isRideOfferNativeAvailable() && !subscriptionLoading && !hasProAccess && (
                <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-300">
                      <LockKeyhole className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-white">Analisador automático</p>
                        <span className="rounded-md bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-300">
                          PRO
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
                        Analise ofertas sobre a tela da Uber, 99 e apps compatíveis sem sair do
                        aplicativo de corrida.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPlansOpen(true)}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-3 py-2.5 text-[11px] font-bold text-slate-950 active:scale-[0.99]"
                  >
                    <Crown className="h-4 w-4" />
                    Conhecer o Giro Certo Pro
                  </button>
                </div>
              )}
              {isRideOfferNativeAvailable() && hasProAccess && (
                <div
                  className={`p-3 rounded-xl border ${notificationAccess && overlayAccess && analyzerEnabled ? 'border-emerald-500/25 bg-emerald-500/10' : 'border-blue-500/25 bg-blue-500/10'}`}
                >
                  <div>
                    <div>
                      <p className="text-xs font-bold text-slate-100">
                        Analisador automático de ofertas
                      </p>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-slate-400">
                        {notificationAccess && overlayAccess && analyzerEnabled
                          ? 'Ativo. A análise aparece sobre o app de corrida, sem abrir o Giro Certo.'
                          : notificationAccess && overlayAccess
                            ? 'Pausado. Reative o interruptor para voltar a analisar ofertas.'
                            : 'Conclua as duas autorizações para analisar Uber, 99 e apps compatíveis.'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => requestPermission('notifications')}
                      className={`shrink-0 rounded-lg px-3 py-2 text-[11px] font-bold active:scale-95 ${
                        notificationAccess
                          ? 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                          : 'bg-blue-500 text-white'
                      }`}
                    >
                      {notificationAccess ? '✓ Leitura ativa' : '1. Ler ofertas'}
                    </button>
                    <button
                      type="button"
                      onClick={() => requestPermission('overlay')}
                      className={`rounded-lg px-2 py-2 text-[11px] font-bold active:scale-95 ${
                        overlayAccess
                          ? 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                          : 'bg-blue-500 text-white'
                      }`}
                    >
                      {overlayAccess ? '✓ Sobreposição ativa' : '2. Aparecer por cima'}
                    </button>
                  </div>
                  {notificationAccess && overlayAccess && (
                    <label className="mt-2 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                      <span>
                        <span className="block text-[11px] font-bold text-slate-200">
                          Analisador em segundo plano
                        </span>
                        <span className="block text-[9px] text-slate-500">
                          Pause sem remover as permissões
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={analyzerEnabled}
                        onChange={(event) => {
                          const enabled = event.target.checked;
                          setAnalyzerEnabled(enabled);
                          void setRideAnalyzerEnabled(enabled).then(setAnalyzerEnabled);
                        }}
                        className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-500"
                      />
                    </label>
                  )}
                  <button
                    type="button"
                    disabled={!notificationAccess || !overlayAccess}
                    onClick={() => {
                      setOverlayTestMessage('');
                      void testRideOverlay()
                        .then(() =>
                          setOverlayTestMessage('Cartão de teste exibido por 12 segundos.'),
                        )
                        .catch(() =>
                          setOverlayTestMessage('Não foi possível exibir. Confira as permissões.'),
                        );
                    }}
                    className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/50 py-2 text-[11px] font-bold text-slate-200 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.99]"
                  >
                    Testar cartão flutuante
                  </button>
                  {overlayTestMessage && (
                    <p className="mt-2 text-center text-[10px] text-emerald-300">
                      {overlayTestMessage}
                    </p>
                  )}
                </div>
              )}
              {isRideOfferNativeAvailable() && hasProAccess && offerHistory.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70">
                  <button
                    type="button"
                    onClick={() => setHistoryOpen((value) => !value)}
                    className="flex w-full items-center gap-2 p-3 text-left"
                  >
                    <History className="h-4 w-4 text-blue-400" />
                    <span className="text-xs font-bold text-slate-100">Ofertas analisadas</span>
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                      {offerHistory.length}
                    </span>
                    <ChevronDown
                      className={`ml-auto h-4 w-4 text-slate-500 transition-transform ${historyOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {historyOpen && (
                    <div className="space-y-2 border-t border-slate-800 p-3">
                      {offerHistory.slice(0, 10).map((offer) => (
                        <div
                          key={offer.id}
                          className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`h-2 w-2 rounded-full ${offer.status === 'COMPENSA' ? 'bg-emerald-400' : offer.status === 'ATENÇÃO' ? 'bg-amber-400' : 'bg-rose-400'}`}
                              />
                              <span className="text-[11px] font-bold text-slate-200">
                                {offer.appName}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {new Date(offer.analyzedAt).toLocaleString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <span
                              className={`text-[10px] font-extrabold ${offer.status === 'COMPENSA' ? 'text-emerald-400' : offer.status === 'ATENÇÃO' ? 'text-amber-400' : 'text-rose-400'}`}
                            >
                              {offer.status}
                            </span>
                          </div>
                          <div className="mt-2 grid grid-cols-4 gap-1 text-center">
                            <span className="text-[10px] text-slate-400">
                              <strong className="block text-slate-200">
                                {formatBRL(offer.fare)}
                              </strong>
                              oferta
                            </span>
                            <span className="text-[10px] text-slate-400">
                              <strong className="block text-slate-200">
                                {offer.totalKm.toFixed(1)} km
                              </strong>
                              distância
                            </span>
                            <span className="text-[10px] text-slate-400">
                              <strong className="block text-slate-200">
                                {offer.minutes || '—'} min
                              </strong>
                              tempo
                            </span>
                            <span className="text-[10px] text-slate-400">
                              <strong className="block text-emerald-300">
                                {formatBRL(offer.profit)}
                              </strong>
                              lucro
                            </span>
                          </div>
                          <button
                            type="button"
                            disabled={Boolean(offer.convertedAt)}
                            onClick={() => {
                              const analyzedAt = new Date(offer.analyzedAt);
                              const date = `${analyzedAt.getFullYear()}-${String(analyzedAt.getMonth() + 1).padStart(2, '0')}-${String(analyzedAt.getDate()).padStart(2, '0')}`;
                              const time = `${String(analyzedAt.getHours()).padStart(2, '0')}:${String(analyzedAt.getMinutes()).padStart(2, '0')}`;
                              closeSimulatorsModal();
                              openNewTransactionModal('ganho', {
                                amount: offer.fare,
                                app: offer.appName,
                                ridesCount: 1,
                                date,
                                time,
                                vehicleId: activeVehicle.id,
                                shiftId: activeShift?.shiftId,
                                description: `Corrida analisada pelo Giro Certo · ${offer.totalKm.toFixed(1)} km`,
                                rideOfferId: offer.id,
                              });
                            }}
                            className="mt-2 w-full rounded-lg border border-emerald-500/25 bg-emerald-500/10 py-1.5 text-[10px] font-bold text-emerald-300 disabled:border-slate-700 disabled:bg-slate-800/60 disabled:text-slate-500 active:scale-[0.99]"
                          >
                            {offer.convertedAt
                              ? '✓ Ganho registrado'
                              : 'Corrida concluída · preencher ganho'}
                          </button>
                        </div>
                      ))}
                      <p className="text-center text-[10px] text-slate-500">
                        Histórico local. Não altera ganhos ou relatórios.
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          void clearRideOfferHistory().then(() => {
                            setOfferHistory([]);
                            setHistoryOpen(false);
                          })
                        }
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-500/20 py-2 text-[10px] font-bold text-rose-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Limpar histórico
                      </button>
                    </div>
                  )}
                </div>
              )}
              {/* Inputs Card */}
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Dados da Corrida / Entrega
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Veículo: <strong className="text-slate-200">{activeVehicle.nickname}</strong>
                  </span>
                </div>

                {/* Valor Oferecido */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Valor Oferecido pelo App (R$) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      R$
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      value={fareOffered}
                      onChange={(e) => setFareOffered(e.target.value)}
                      placeholder="Ex: 28.50"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-9 pr-3 text-base font-bold font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Distâncias */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Coleta (km)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={distanceToPickup}
                      onChange={(e) => setDistanceToPickup(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Viagem (km)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={tripDistance}
                      onChange={(e) => setTripDistance(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-400">
                        Retorno (km)
                      </label>
                      <button
                        type="button"
                        onClick={() => setConsiderReturn(!considerReturn)}
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          considerReturn
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {considerReturn ? 'Ativo' : 'Ignorar'}
                      </button>
                    </div>
                    <input
                      type="number"
                      step="0.1"
                      disabled={!considerReturn}
                      value={returnDistance}
                      onChange={(e) => setReturnDistance(e.target.value)}
                      className={`w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white font-mono ${
                        !considerReturn ? 'opacity-40 cursor-not-allowed' : ''
                      }`}
                    />
                  </div>
                </div>

                {/* Tempo & Custos */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Tempo (minutos)
                    </label>
                    <input
                      type="number"
                      value={estimatedMinutes}
                      onChange={(e) => setEstimatedMinutes(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Custo/km (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={costPerKm}
                      onChange={(e) => setCostPerKm(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Pedágio (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={tollsAndParking}
                      onChange={(e) => setTollsAndParking(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Simulation Result Card */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 space-y-3 shadow-lg">
                {/* Result Badge & Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-300 uppercase">Diagnóstico:</span>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-extrabold border ${
                        rideResult.status === 'Compensa'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : rideResult.status === 'Atenção'
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                            : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                      }`}
                    >
                      {rideResult.status === 'Compensa' && '✓ COMPENSA'}
                      {rideResult.status === 'Atenção' && '⚠️ ATENÇÃO'}
                      {rideResult.status === 'Não compensa' && '✕ NÃO COMPENSA'}
                    </span>
                  </div>

                  <span className="text-xs font-bold font-mono text-white">
                    Margem: {formatPercent(rideResult.marginPercent)}
                  </span>
                </div>

                <p className="text-xs text-slate-200 bg-slate-950/70 p-3 rounded-lg border border-slate-800 leading-relaxed">
                  {rideResult.reason}
                </p>

                {/* Applied criteria bar */}
                <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-1.5">
                  <span className="font-semibold text-slate-300">Seus critérios:</span>
                  <span>
                    Mín. <strong>{formatBRL(rideResult.appliedCriteria.minProfitPerKm)}/km</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Mín. <strong>{formatBRL(rideResult.appliedCriteria.minProfitPerHour)}/h</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Mín. valor{' '}
                    <strong>{formatBRL(rideResult.appliedCriteria.minAcceptableValue)}</strong>
                  </span>
                </div>

                {/* Metric Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase">
                      Distância Total
                    </span>
                    <span className="text-sm font-bold text-white font-mono">
                      {rideResult.totalDistance.toFixed(1)} km
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {considerReturn ? '(com retorno)' : '(sem retorno)'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase">
                      Custo Estimado
                    </span>
                    <span className="text-sm font-bold text-rose-400 font-mono">
                      -{formatBRL(rideResult.estimatedCost)}
                    </span>
                    <span className="text-[10px] text-slate-500 block">veículo + pedágio</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase">
                      Lucro Estimado
                    </span>
                    <span
                      className={`text-sm font-bold font-mono ${rideResult.estimatedProfit > 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                    >
                      {formatBRL(rideResult.estimatedProfit)}
                    </span>
                    <span className="text-[10px] text-slate-500 block">valor − custos</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase">Lucro por KM</span>
                    <span
                      className={`text-sm font-bold font-mono ${rideResult.profitPerKm >= rideResult.appliedCriteria.minProfitPerKm ? 'text-emerald-400' : 'text-rose-400'}`}
                    >
                      {formatBRL(rideResult.profitPerKm)}/km
                    </span>
                    <span
                      className={`text-[10px] block ${rideResult.profitPerKm >= rideResult.appliedCriteria.minProfitPerKm ? 'text-emerald-500' : 'text-rose-400'}`}
                    >
                      {rideResult.profitPerKm >= rideResult.appliedCriteria.minProfitPerKm
                        ? '✓ Atingiu meta'
                        : `✕ Abaixo de ${formatBRL(rideResult.appliedCriteria.minProfitPerKm)}`}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase">
                      Receita por Hora
                    </span>
                    <span className="text-sm font-bold text-slate-200 font-mono">
                      {formatBRL(rideResult.revenuePerHour)}/h
                    </span>
                    <span className="text-[10px] text-slate-500 block">bruto por hora</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase">
                      Lucro por Hora
                    </span>
                    <span
                      className={`text-sm font-bold font-mono ${rideResult.profitPerHour >= rideResult.appliedCriteria.minProfitPerHour ? 'text-emerald-400' : 'text-rose-400'}`}
                    >
                      {formatBRL(rideResult.profitPerHour)}/h
                    </span>
                    <span
                      className={`text-[10px] block ${rideResult.profitPerHour >= rideResult.appliedCriteria.minProfitPerHour ? 'text-emerald-500' : 'text-rose-400'}`}
                    >
                      {rideResult.profitPerHour >= rideResult.appliedCriteria.minProfitPerHour
                        ? '✓ Atingiu meta'
                        : `✕ Abaixo de ${formatBRL(rideResult.appliedCriteria.minProfitPerHour)}`}
                    </span>
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 italic text-center pt-1">
                  * Este resultado é uma estimativa operacional com base nos custos e critérios
                  configurados.
                </p>
              </div>
            </div>
          ) : (
            /* Tab 2: Goal Simulator */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Parâmetros da Meta Desejada
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Meta de Lucro Disponível (R$) *
                  </label>
                  <input
                    type="number"
                    step="100"
                    value={targetProfit}
                    onChange={(e) => setTargetProfit(e.target.value)}
                    placeholder="Ex: 5400"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-base font-bold font-mono text-blue-400 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Dias de Trabalho ({goalPeriod === 'mensal' ? 'no Mês' : 'na Semana'})
                    </label>
                    <input
                      type="number"
                      value={workDays}
                      onChange={(e) => setWorkDays(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Horas por Dia
                    </label>
                    <input
                      type="number"
                      value={hoursPerDay}
                      onChange={(e) => setHoursPerDay(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Ganho/h Atual (R$)
                    </label>
                    <input
                      type="number"
                      value={averagePerHour}
                      onChange={(e) => setAveragePerHour(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Custo/km (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={goalCostPerKm}
                      onChange={(e) => setGoalCostPerKm(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Reserva/km (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={reservePerKm}
                      onChange={(e) => setReservePerKm(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Goal Projection Breakdown */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Plano de Ação para Alcançar a Meta
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      goalResult.isFeasible
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {goalResult.isFeasible ? 'Meta Viável' : 'Requer Ajuste'}
                  </span>
                </div>

                <p className="text-xs text-slate-300 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/80">
                  {goalResult.feasibilityFeedback}
                </p>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase">
                      Necessário por Dia
                    </span>
                    <span className="text-sm font-bold text-blue-400 font-mono">
                      {formatBRL(goalResult.neededPerDay)}/dia
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase">
                      Necessário por Hora
                    </span>
                    <span className="text-sm font-bold text-blue-400 font-mono">
                      {formatBRL(goalResult.neededPerHour)}/h
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase">Horas Totais</span>
                    <span className="text-sm font-bold text-white font-mono">
                      {goalResult.totalHours} horas
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase">KM Previstos</span>
                    <span className="text-sm font-bold text-white font-mono">
                      {goalResult.estimatedKm.toLocaleString('pt-BR')} km
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase">
                      Faturamento Bruto
                    </span>
                    <span className="text-sm font-bold text-emerald-400 font-mono">
                      {formatBRL(goalResult.projectedGross)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase">
                      Reserva Poupança
                    </span>
                    <span className="text-sm font-bold text-teal-400 font-mono">
                      {formatBRL(goalResult.projectedReserve)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {permissionTarget && (
          <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/80 p-5 backdrop-blur-sm">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="ride-consent-title"
              className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
            >
              <div className="mb-3 flex items-center gap-2 text-emerald-400">
                <ShieldCheck className="h-5 w-5" />
                <h3 id="ride-consent-title" className="text-sm font-bold text-white">
                  Antes de ativar
                </h3>
              </div>
              <p className="text-xs leading-relaxed text-slate-300">
                O Giro Certo lerá somente notificações de aplicativos de corrida e entrega para
                identificar valor, distância e tempo da oferta. A análise aparece em um cartão sobre
                o aplicativo que estiver aberto.
              </p>
              <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-[11px] leading-relaxed text-emerald-200">
                O texto das ofertas é processado no próprio celular. Ele não é enviado ao Supabase,
                não é usado para publicidade e o Giro Certo não aceita corridas automaticamente.
              </div>
              <p className="mt-3 text-[10px] leading-relaxed text-slate-400">
                Você pode retirar as autorizações a qualquer momento nas configurações do Android.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPermissionTarget(null)}
                  className="rounded-xl border border-slate-700 py-2.5 text-xs font-bold text-slate-300"
                >
                  Agora não
                </button>
                <button
                  type="button"
                  onClick={continuePermission}
                  className="rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-slate-950"
                >
                  Li e quero continuar
                </button>
              </div>
            </div>
          </div>
        )}
        <SubscriptionPlansModal
          open={plansOpen}
          onClose={() => setPlansOpen(false)}
          daysRemaining={daysRemaining}
        />
      </div>
    </div>
  );
};
