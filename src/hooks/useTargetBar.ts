import { calculateFuelConsumption } from '../utils/calculations';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useSubscription } from './useSubscription';
import { MANUAL_COST_EVENT, readManualCostPerKm, calculateTargetBar, formatTargetBar, type TargetBar } from '../utils/targetBar';
import { hideTargetBar, isRideOfferNativeAvailable, showTargetBar } from '../lib/rideOffer';
import { requestGoalNotificationPermission } from '../lib/nativeCoach';

const ENABLED_KEY = 'giro_certo_target_bar_v1';
const CHANGE_EVENT = 'giro-certo-target-bar';

function readEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === 'on';
  } catch {
    return false;
  }
}

const DEFAULT_CRITERIA = { minProfitPerKm: 0.8, minProfitPerHour: 25, minAcceptableValue: 8 };

export function useTargetBar() {
  const { userProfile, activeVehicle, monthSummary, todaySummary, transactions } = useApp();

  // Custo/km pelo consumo real do veículo: usado no começo do mês, antes de 100 km rodados.
  const consumptionCostPerKm = useMemo(() => {
    const fuel = transactions.filter((t) => t.type === 'abastecimento');
    const { averageKmPerLiter } = calculateFuelConsumption(fuel, activeVehicle?.id);
    const last = [...fuel]
      .filter((t) => t.type === 'abastecimento' && (!activeVehicle?.id || t.vehicleId === activeVehicle.id) && t.pricePerLiter > 0)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    const price = last && last.type === 'abastecimento' ? last.pricePerLiter : 0;
    return averageKmPerLiter > 0 && price > 0 ? price / averageKmPerLiter : 0;
  }, [transactions, activeVehicle?.id]);
  const { hasProAccess, loading } = useSubscription();
  const native = isRideOfferNativeAvailable();
  const [enabled, setEnabledState] = useState(readEnabled);
  const [blocked, setBlocked] = useState(false);
  const [manualCost, setManualCost] = useState(readManualCostPerKm);

  useEffect(() => {
    const sync = () => setManualCost(readManualCostPerKm());
    window.addEventListener(MANUAL_COST_EVENT, sync);
    return () => window.removeEventListener(MANUAL_COST_EVENT, sync);
  }, []);

  useEffect(() => {
    const sync = () => setEnabledState(readEnabled());
    window.addEventListener(CHANGE_EVENT, sync);
    return () => window.removeEventListener(CHANGE_EVENT, sync);
  }, []);

  const bar: TargetBar = useMemo(
    () =>
      calculateTargetBar({
        vehicleType: activeVehicle?.type ?? 'moto',
      manualCostPerKm: manualCost,
        monthCostPerKm: monthSummary.quilometrosRodados > 0 ? monthSummary.combustivel / monthSummary.quilometrosRodados : 0,
        monthKm: monthSummary.quilometrosRodados,
        consumptionCostPerKm,
        reservePerKm: userProfile.maintenanceReservePerKm || 0,
        criteria: userProfile.rideCriteria || DEFAULT_CRITERIA,
        todayProfit: todaySummary.lucroDisponivel,
        dailyGoal: userProfile.monthlyGoal / 30,
      }),
    [activeVehicle?.type, monthSummary, todaySummary, userProfile, manualCost, consumptionCostPerKm],
  );

  const active = native && enabled && hasProAccess && !loading;
  const text = useMemo(() => formatTargetBar(bar), [bar]);

  useEffect(() => {
    if (!native || loading) return;
    if (active) {
      void showTargetBar(text.title, text.body).then((shown) => setBlocked(!shown));
    } else {
      void hideTargetBar();
    }
  }, [native, loading, active, text]);

  const setEnabled = useCallback(async (value: boolean) => {
    if (value) {
      const granted = await requestGoalNotificationPermission();
      if (!granted) {
        setBlocked(true);
        return;
      }
    }
    setBlocked(false);
    try {
      localStorage.setItem(ENABLED_KEY, value ? 'on' : 'off');
    } catch {
      /* preferência só local */
    }
    setEnabledState(value);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { native, enabled, active, blocked, bar, text, setEnabled, hasProAccess };
}
