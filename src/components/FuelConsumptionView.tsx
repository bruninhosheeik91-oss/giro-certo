import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  formatBRL,
  formatDisplayDate,
  formatNumber,
  calculateFuelConsumption,
  openFuelCycleLabel,
} from '../utils/calculations';
import { Fuel, Gauge, Route, Droplets, Timer, AlertCircle } from 'lucide-react';

export const FuelConsumptionView: React.FC = () => {
  const { transactions, activeVehicle } = useApp();

  const result = useMemo(() => {
    const fuelTxs = transactions.filter((t) => t.type === 'abastecimento');
    return calculateFuelConsumption(fuelTxs, activeVehicle?.id);
  }, [transactions, activeVehicle?.id]);

  const lastCycles = [...result.confirmedCycles].reverse().slice(0, 10);

  return (
    <div className="space-y-4 animate-in fade-in">
      {/* Fuel tank banner */}
      {result.openCycle && (
        <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/30 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Timer className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-amber-300">Ciclo de consumo em aberto</p>
            <p className="text-[11px] text-slate-300 mt-0.5">{openFuelCycleLabel(result.openCycle)}</p>
          </div>
        </div>
      )}

      {/* Hero: average consumption */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-950/30 to-slate-900 border border-rose-500/30 text-center shadow-md">
        <span className="text-xs uppercase tracking-wider font-semibold text-slate-400 block mb-1">
          Consumo Médio Real
        </span>
        <div className="flex items-end justify-center gap-2">
          <span className="text-4xl font-extrabold font-mono text-rose-400 tracking-tight">
            {result.validCyclesCount > 0 ? formatNumber(result.averageKmPerLiter, 2) : '--'}
          </span>
          <span className="text-sm font-bold text-slate-400 mb-1.5">km/L</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5">
          Último ciclo:{' '}
          {result.lastKmPerLiter > 0 ? (
            <span className="text-rose-300 font-bold font-mono">
              {formatNumber(result.lastKmPerLiter, 2)} km/L
            </span>
          ) : (
            'sem dados'
          )}
          {' '}• {result.validCyclesCount} ciclo(s) confirmado(s)
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Distância</span>
            <Route className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <p className="text-base font-bold text-white font-mono">
            {result.totalDistanceKm.toLocaleString('pt-BR')} km
          </p>
          <span className="text-[10px] text-slate-500">Entre tanques cheios</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Combustível</span>
            <Droplets className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <p className="text-base font-bold text-white font-mono">
            {formatNumber(result.totalLiters, 1)} L
          </p>
          <span className="text-[10px] text-slate-500">Total nos ciclos</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Custo</span>
            <Fuel className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <p className="text-base font-bold text-amber-400 font-mono">{formatBRL(result.totalAmount)}</p>
          <span className="text-[10px] text-slate-500">Total abastecido</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Custo / km</span>
            <Gauge className="w-3.5 h-3.5 text-teal-400" />
          </div>
          <p className="text-base font-bold text-teal-400 font-mono">
            {result.validCyclesCount > 0 ? formatBRL(result.confirmedCycles[result.confirmedCycles.length - 1].costPerKm) : '--'}
            <span className="text-xs font-normal">/{'km'}</span>
          </p>
          <span className="text-[10px] text-slate-500">Último ciclo</span>
        </div>
      </div>

      {/* Cycles list */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl">
        <div className="p-3 flex items-center gap-2 border-b border-slate-800">
          <Gauge className="w-3.5 h-3.5 text-slate-400" />
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Ciclos Confirmados
          </h4>
          <span className="text-[10px] text-slate-500 ml-auto">
            Método tanque cheio → tanque cheio
          </span>
        </div>

        {lastCycles.length === 0 ? (
          <div className="p-4 text-center">
            <AlertCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-500">
              Registre abastecimentos com marcação{' '}
              <span className="text-amber-300 font-semibold">"Tanque Cheio"</span> e o KM do
              odômetro para calcular o consumo real em km/l.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/70">
            {lastCycles.map((c, i) => (
              <div key={`${c.startDate}-${c.startKm}-${i}`} className="px-3 py-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">
                    {formatDisplayDate(c.startDate)} → {formatDisplayDate(c.endDate)}
                  </span>
                  <span className="font-mono font-bold text-rose-400">
                    {formatNumber(c.kmPerLiter, 2)} km/L
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase">Distância</span>
                    <span className="text-[11px] font-bold text-white font-mono">
                      {c.distanceKm.toLocaleString('pt-BR')} km
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase">Litros</span>
                    <span className="text-[11px] font-bold text-white font-mono">
                      {formatNumber(c.liters, 1)} L
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase">Custo</span>
                    <span className="text-[11px] font-bold text-white font-mono">
                      {formatBRL(c.totalAmount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase">R$/km</span>
                    <span className="text-[11px] font-bold text-white font-mono">
                      {formatBRL(c.costPerKm)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};