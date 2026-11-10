import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useSubscription } from './useSubscription';
import { MANUAL_COST_EVENT, readManualCostPerKm, calculateTargetBar } from '../utils/targetBar';
import {
  disableRideAccessibility,
  getAnalyzerDiagnostic,
  getRideAnalyzerEnabled,
  isRideAccessibilityGranted,
  isRideOfferNativeAvailable,
  openRideAccessibilitySettings,
  saveNativeRideCriteria,
  setRideAnalyzerEnabled,
  type AnalyzerDiagnostic,
} from '../lib/rideOffer';
import { requestGoalNotificationPermission } from '../lib/nativeCoach';

const MIN_RATING_KEY = 'giro_certo_min_passenger_rating_v1';
const RATING_EVENT = 'giro-certo-min-rating';
const DEFAULT_CRITERIA = { minProfitPerKm: 0.8, minProfitPerHour: 25, minAcceptableValue: 8 };

export function readMinPassengerRating(): number {
  try {
    const value = Number.parseFloat(localStorage.getItem(MIN_RATING_KEY) ?? '');
    return Number.isFinite(value) && value >= 1 && value <= 5 ? value : 4.7;
  } catch {
    return 4.7;
  }
}

/** Mantém critérios nativos em dia e desliga a acessibilidade ao encerrar o turno. */
export function useCopilotSync() {
  const { userProfile, activeVehicle, monthSummary, todaySummary, activeShift } = useApp();
  const native = isRideOfferNativeAvailable();
  const [minRating, setMinRating] = useState(readMinPassengerRating);
  const hadShift = useRef(Boolean(activeShift));
  const [manualCost, setManualCost] = useState(readManualCostPerKm);

  useEffect(() => {
    const sync = () => setManualCost(readManualCostPerKm());
    window.addEventListener(MANUAL_COST_EVENT, sync);
    return () => window.removeEventListener(MANUAL_COST_EVENT, sync);
  }, []);

  useEffect(() => {
    const sync = () => setMinRating(readMinPassengerRating());
    window.addEventListener(RATING_EVENT, sync);
    return () => window.removeEventListener(RATING_EVENT, sync);
  }, []);

  useEffect(() => {
    if (!native) return;
    const criteria = userProfile.rideCriteria || DEFAULT_CRITERIA;
    const bar = calculateTargetBar({
      vehicleType: activeVehicle?.type ?? 'moto',
      manualCostPerKm: manualCost,
      monthCostPerKm: monthSummary.quilometrosRodados > 0 ? monthSummary.combustivel / monthSummary.quilometrosRodados : 0,
      monthKm: monthSummary.quilometrosRodados,
      reservePerKm: userProfile.maintenanceReservePerKm || 0,
      criteria,
      todayProfit: todaySummary.lucroDisponivel,
      dailyGoal: userProfile.monthlyGoal / 30,
    });
    void saveNativeRideCriteria({
      minProfitPerKm: criteria.minProfitPerKm,
      minProfitPerHour: criteria.minProfitPerHour,
      minAcceptableValue: criteria.minAcceptableValue,
      costPerKm: bar.costPerKm,
      minPassengerRating: minRating,
    });
  }, [native, userProfile, activeVehicle?.type, monthSummary, todaySummary, minRating, manualCost]);

  useEffect(() => {
    const hasShift = Boolean(activeShift);
    if (native && hadShift.current && !hasShift) void disableRideAccessibility();
    hadShift.current = hasShift;
  }, [native, activeShift]);
}

export function useCopilot() {
  const { activeShift } = useApp();
  const { hasProAccess, loading } = useSubscription();
  const native = isRideOfferNativeAvailable();
  const [granted, setGranted] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [diagnostic, setDiagnostic] = useState<AnalyzerDiagnostic | null>(null);
  const [minRating, setMinRatingState] = useState(readMinPassengerRating);

  const refresh = useCallback(async () => {
    if (!native) return;
    const [access, on, diag] = await Promise.all([
      isRideAccessibilityGranted(),
      getRideAnalyzerEnabled(),
      getAnalyzerDiagnostic(),
    ]);
    setGranted(access);
    setEnabled(on);
    setDiagnostic(diag);
  }, [native]);

  useEffect(() => {
    void refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const toggle = useCallback(async () => {
    if (!enabled) await requestGoalNotificationPermission().catch(() => false);
    await setRideAnalyzerEnabled(!enabled);
    await refresh();
  }, [enabled, refresh]);

  const turnOff = useCallback(async () => {
    await disableRideAccessibility();
    await refresh();
  }, [refresh]);

  const setMinRating = useCallback((value: number) => {
    const clamped = Math.min(5, Math.max(1, value));
    try {
      localStorage.setItem(MIN_RATING_KEY, clamped.toString());
    } catch {
      /* preferência só local */
    }
    setMinRatingState(clamped);
    window.dispatchEvent(new Event(RATING_EVENT));
  }, []);

  return {
    native,
    hasProAccess,
    loading,
    granted,
    enabled,
    diagnostic,
    minRating,
    onShift: Boolean(activeShift),
    openSettings: openRideAccessibilitySettings,
    toggle,
    turnOff,
    setMinRating,
  };
}
