import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatBRL, safeDivide, formatDisplayDate } from '../utils/calculations';
import { Play, Square, Clock, Coffee, AlertTriangle, History } from 'lucide-react';

export const ShiftView: React.FC = () => {
  const {
    activeShift,
    startShift,
    pauseShift,
    resumeShift,
    endShift,
    elapsedShiftSeconds,
    elapsedWorkSeconds,
    elapsedPausedSeconds,
    shifts,
    vehicles,
    activeVehicle,
    registeredApps,
    openNewTransactionModal,
    getShiftTotals,
  } = useApp();

  // Start shift form state
  const [selectedVehicleId, setSelectedVehicleId] = useState(activeVehicle?.id || '');
  const [startKmInput, setStartKmInput] = useState((activeVehicle?.currentKm || 42118).toString());
  const [selectedApps, setSelectedApps] = useState<string[]>(['Uber', '99']);
  const [startNotes, setStartNotes] = useState('');
  const [startError, setStartError] = useState<string | null>(null);

  // Sync start KM whenever active vehicle changes
  React.useEffect(() => {
    if (activeVehicle) {
      setSelectedVehicleId(activeVehicle.id);
      setStartKmInput(activeVehicle.currentKm.toString());
    }
  }, [activeVehicle]);

  // End shift modal state
  const [isEndModalOpen, setIsEndModalOpen] = useState(false);
  const [endKmInput, setEndKmInput] = useState('');
  const [endNotes, setEndNotes] = useState('');
  const [endError, setEndError] = useState<string | null>(null);

  // Helper format seconds to hh:mm:ss
  const formatSeconds = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleToggleApp = (appName: string) => {
    setSelectedApps((prev) =>
      prev.includes(appName) ? prev.filter((a) => a !== appName) : [...prev, appName],
    );
  };

  const handleStartSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStartError(null);

    const km = parseFloat(startKmInput);
    if (isNaN(km) || km <= 0) {
      setStartError('Informe uma quilometragem inicial válida.');
      return;
    }

    const veh =
      vehicles.find((v) => v.id === (selectedVehicleId || activeVehicle.id)) || activeVehicle;
    if (veh && km < veh.currentKm) {
      setStartError(
        `A quilometragem inicial não pode ser inferior à atual do veículo (${veh.currentKm.toLocaleString('pt-BR')} km).`,
      );
      return;
    }

    if (selectedApps.length === 0) {
      setStartError('Selecione pelo menos um aplicativo para a jornada.');
      return;
    }

    startShift(selectedVehicleId || activeVehicle.id, km, selectedApps, startNotes);
  };

  const handleOpenEndModal = () => {
    const currentEstimate = (activeShift?.startKm || 0) + 120;
    setEndKmInput(currentEstimate.toString());
    setEndError(null);
    setIsEndModalOpen(true);
  };

  const handleConfirmEndShift = (e: React.FormEvent) => {
    e.preventDefault();
    setEndError(null);

    const endKm = parseFloat(endKmInput);
    if (isNaN(endKm) || !activeShift || endKm < activeShift.startKm) {
      setEndError(
        `A quilometragem final não pode ser menor que a inicial (${activeShift?.startKm.toLocaleString('pt-BR')} km).`,
      );
      return;
    }

    endShift(endKm, endNotes);
    setIsEndModalOpen(false);
  };

  // Real-time calculations for ongoing shift (Decision 5: derived from linked transactions)
  const activeTotals = activeShift ? getShiftTotals(activeShift.shiftId) : { gain: 0, expense: 0 };
  const currentWorkHoursDecimal = Math.max(0.01, elapsedWorkSeconds / 3600);
  const currentGain = activeTotals.gain;
  const currentExpense = activeTotals.expense;
  const currentPerHour = safeDivide(currentGain, currentWorkHoursDecimal);

  return (
    <div className="space-y-4 pb-2">
      {/* Shift State Header */}
      {!activeShift ? (
        /* State 1: Shift Not Started */
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Iniciar Nova Jornada
              </h2>
              <p className="text-xs text-slate-400">
                Registre seu turno, pausas e desempenho por hora
              </p>
            </div>
          </div>

          {startError && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{startError}</span>
            </div>
          )}

          <form onSubmit={handleStartSubmit} className="space-y-3.5">
            {/* Vehicle Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Veículo para esta Jornada *
              </label>
              <select
                value={selectedVehicleId || activeVehicle.id}
                onChange={(e) => {
                  setSelectedVehicleId(e.target.value);
                  const v = vehicles.find((item) => item.id === e.target.value);
                  if (v) setStartKmInput(v.currentKm.toString());
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nickname} ({v.brand} {v.model}) {v.isActive ? '• Ativo' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Km */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Quilometragem Inicial do Odômetro *
              </label>
              <div className="relative">
                <input
                  type="number"
                  required
                  value={startKmInput}
                  onChange={(e) => setStartKmInput(e.target.value)}
                  placeholder="Ex: 42118"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                  KM
                </span>
              </div>
            </div>

            {/* Apps to work with */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Aplicativos que serão utilizados hoje *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {registeredApps
                  .filter((a) => a.isActive)
                  .map((app) => {
                    const isChecked = selectedApps.includes(app.name);
                    return (
                      <button
                        key={app.id}
                        type="button"
                        onClick={() => handleToggleApp(app.name)}
                        className={`py-2 px-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                          isChecked
                            ? 'bg-blue-500/20 border-blue-500 text-blue-300 shadow-sm'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <span>{app.name}</span>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Start Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Objetivo ou Observação do Dia (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: Focar na zona Sul e almoço corporativo"
                value={startNotes}
                onChange={(e) => setStartNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-emerald-500/20 transition-all active:scale-98 flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>INICIAR JORNADA AGORA</span>
            </button>
          </form>
        </div>
      ) : (
        /* State 2 & 3: Shift Active or Paused */
        <div
          className={`p-5 rounded-2xl border shadow-xl space-y-4 transition-all ${
            activeShift.isPaused
              ? 'bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950 border-amber-500/40'
              : 'bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/30 border-emerald-500/40'
          }`}
        >
          {/* Status badge and vehicle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    activeShift.isPaused ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                ></span>
                <span
                  className={`relative inline-flex rounded-full h-3 w-3 ${
                    activeShift.isPaused ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                ></span>
              </span>
              <span
                className={`text-xs font-extrabold uppercase tracking-wider ${
                  activeShift.isPaused ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {activeShift.isPaused ? 'Jornada Pausada (Descanso)' : 'Jornada em Andamento'}
              </span>
            </div>

            <span className="text-xs text-slate-300 font-medium">
              Início: <strong className="font-mono text-white">{activeShift.startTime}</strong>
            </span>
          </div>

          {/* Timers Display */}
          <div className="text-center py-2 bg-slate-950/80 rounded-2xl border border-slate-800/80 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">
              Tempo Efetivo de Trabalho
            </span>
            <div className="text-4xl font-extrabold font-mono tracking-tight text-white">
              {formatSeconds(elapsedWorkSeconds)}
            </div>
            <div className="flex items-center justify-center gap-4 text-xs text-slate-400 pt-1">
              <span>
                Corrido:{' '}
                <strong className="text-slate-200 font-mono">
                  {formatSeconds(elapsedShiftSeconds)}
                </strong>
              </span>
              <span>•</span>
              <span>
                Pausas:{' '}
                <strong className="text-amber-400 font-mono">
                  {formatSeconds(elapsedPausedSeconds)}
                </strong>
              </span>
            </div>
          </div>

          {/* Real-time Earnings of this shift */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase block font-semibold">
                Ganhos
              </span>
              <span className="text-xs font-bold text-emerald-400 font-mono">
                {formatBRL(currentGain)}
              </span>
            </div>
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase block font-semibold">
                Despesas
              </span>
              <span className="text-xs font-bold text-rose-400 font-mono">
                -{formatBRL(currentExpense)}
              </span>
            </div>
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase block font-semibold">
                Ganho / Hora
              </span>
              <span className="text-xs font-bold text-blue-400 font-mono">
                {formatBRL(currentPerHour)}/h
              </span>
            </div>
          </div>

          {/* Shift Control Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            {activeShift.isPaused ? (
              <button
                onClick={resumeShift}
                className="py-3 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Retomar Trabalho</span>
              </button>
            ) : (
              <button
                onClick={pauseShift}
                className="py-3 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Coffee className="w-4 h-4" />
                <span>Pausar (Almoço/Café)</span>
              </button>
            )}

            <button
              onClick={handleOpenEndModal}
              className="py-3 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Square className="w-4 h-4 fill-current" />
              <span>Finalizar Turno</span>
            </button>
          </div>

          {/* Quick launch for earnings during shift */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
            <span className="text-xs text-slate-400">Registrar ganhos enquanto roda:</span>
            <button
              onClick={() => openNewTransactionModal('ganho')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-bold transition-colors"
            >
              + Lançar Ganho
            </button>
          </div>
        </div>
      )}

      {/* End Shift Modal Dialog */}
      {isEndModalOpen && activeShift && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-[#0f172a] border border-slate-800 rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white tracking-tight">Finalizar Turno</h3>
              <button
                onClick={() => setIsEndModalOpen(false)}
                className="p-1 rounded-full bg-slate-800 text-slate-400"
              >
                ✕
              </button>
            </div>

            {endError && (
              <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300">
                {endError}
              </div>
            )}

            <form onSubmit={handleConfirmEndShift} className="space-y-3">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>KM Inicial informado:</span>
                  <strong className="text-white font-mono">{activeShift.startKm} km</strong>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Tempo de trabalho líquido:</span>
                  <strong className="text-emerald-400 font-mono">
                    {formatSeconds(elapsedWorkSeconds)}
                  </strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Quilometragem Final do Odômetro *
                </label>
                <input
                  type="number"
                  required
                  value={endKmInput}
                  onChange={(e) => setEndKmInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Observações de Fechamento (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Dia muito produtivo, tarifa dinâmica no fim da tarde..."
                  value={endNotes}
                  onChange={(e) => setEndNotes(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEndModalOpen(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-800 text-slate-300 text-xs font-bold"
                >
                  Continuar Rodando
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md"
                >
                  Confirmar e Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shifts History List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Histórico de Jornadas Anteriores
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">{shifts.length} jornadas</span>
        </div>

        {shifts.length === 0 ? (
          <div className="text-center py-8 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800">
            <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-400">Nenhuma jornada concluída ainda.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {shifts.map((s) => {
              const totals = getShiftTotals(s.id);
              const netProfit = totals.gain - totals.expense;
              const perHour = safeDivide(totals.gain, s.totalWorkHours);

              return (
                <div
                  key={s.id}
                  className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 hover:border-slate-700 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white tracking-tight">
                          {formatDisplayDate(s.date)}
                        </span>
                        <span className="text-xs text-slate-400">
                          {s.startTime} às {s.endTime}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Veículo:{' '}
                        <strong className="text-slate-300">{s.vehicleName || 'Moto do Dia a Dia'}</strong>
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-extrabold text-emerald-400 font-mono block">
                        {formatBRL(totals.gain)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Líquido: {formatBRL(netProfit)}
                      </span>
                    </div>
                  </div>

                  {/* 4 Metrics in pill grid */}
                  <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
                    <div className="bg-slate-950/60 p-1.5 rounded-lg">
                      <span className="text-[9px] text-slate-500 block uppercase">Trabalho</span>
                      <span className="font-bold text-slate-200 font-mono text-[11px]">
                        {s.totalWorkHours}h
                      </span>
                    </div>
                    <div className="bg-slate-950/60 p-1.5 rounded-lg">
                      <span className="text-[9px] text-slate-500 block uppercase">Pausas</span>
                      <span className="font-bold text-amber-400 font-mono text-[11px]">
                        {s.totalPauseMinutes || 0}m
                      </span>
                    </div>
                    <div className="bg-slate-950/60 p-1.5 rounded-lg">
                      <span className="text-[9px] text-slate-500 block uppercase">Distância</span>
                      <span className="font-bold text-slate-200 font-mono text-[11px]">
                        {s.totalKm} km
                      </span>
                    </div>
                    <div className="bg-slate-950/60 p-1.5 rounded-lg">
                      <span className="text-[9px] text-slate-500 block uppercase">Ganho/h</span>
                      <span className="font-bold text-blue-400 font-mono text-[11px]">
                        {formatBRL(perHour)}/h
                      </span>
                    </div>
                  </div>

                  {s.notes && (
                    <p className="text-[11px] text-slate-400 bg-slate-950/40 p-2 rounded-lg italic">
                      "{s.notes}"
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
