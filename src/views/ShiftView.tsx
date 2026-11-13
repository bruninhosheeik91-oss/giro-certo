import { QuickRideRegister } from '../components/QuickRideRegister';
import { ShiftSummaryModal } from '../components/ShiftSummaryModal';
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import type { Shift } from '../types';
import {
  formatBRL,
  formatHours,
  safeDivide,
  formatDisplayDate,
  parseDecimalInput,
  calculateOdometerDistance,
} from '../utils/calculations';
import { AlertTriangle, Clock, Coffee, Play, Plus, Square, Trash2, X } from 'lucide-react';

export const ShiftView: React.FC = () => {
  const {
    activeShift,
    startShift,
    pauseShift,
    resumeShift,
    endShift,
    removeShift,
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

  const [closedShift, setClosedShift] = useState<Shift | null>(null);

  // Start shift form state
  const [selectedVehicleId, setSelectedVehicleId] = useState(activeVehicle?.id || '');
  const [startKmInput, setStartKmInput] = useState(String(activeVehicle?.currentKm ?? ''));
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
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Helper format seconds to hh:mm:ss
  const formatSeconds = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const odometerOnly = (value: string) => value.replace(/[^\d,]/g, '').replace(/,(?=.*,)/g, '');

  const formatPauses = (minutes: number) => {
    if (!minutes) return '0 min';
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return h > 0 ? `${h}h${m ? ` ${String(m).padStart(2, '0')}` : ''}` : `${m} min`;
  };

  const handleToggleApp = (appName: string) => {
    setSelectedApps((prev) =>
      prev.includes(appName) ? prev.filter((a) => a !== appName) : [...prev, appName],
    );
  };

  const handleStartSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStartError(null);

    const km = parseDecimalInput(startKmInput);
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
    // Nunca inventar distância: o usuário deve informar a leitura real do odômetro.
    setEndKmInput('');
    setEndError(null);
    setIsEndModalOpen(true);
  };

  const handleConfirmEndShift = (e: React.FormEvent) => {
    e.preventDefault();
    setEndError(null);

    const endKm = parseDecimalInput(endKmInput);
    if (!endKm || !activeShift || endKm < activeShift.startKm) {
      setEndError(
        `A quilometragem final não pode ser menor que a inicial (${activeShift?.startKm.toLocaleString('pt-BR')} km).`,
      );
      return;
    }

    setClosedShift(endShift(endKm, endNotes));
    setIsEndModalOpen(false);
  };

  // Real-time calculations for ongoing shift (Decision 5: derived from linked transactions)
  const activeTotals = activeShift ? getShiftTotals(activeShift.shiftId) : { gain: 0, expense: 0 };
  const currentWorkHoursDecimal = Math.max(0.01, elapsedWorkSeconds / 3600);
  const currentGain = activeTotals.gain;
  const currentExpense = activeTotals.expense;
  const currentPerHour = safeDivide(currentGain, currentWorkHoursDecimal);

  const card = 'rounded-[20px] border border-slate-800/70 bg-slate-900';
  const label = 'mb-1.5 block text-[13px] font-semibold text-slate-300';
  const field =
    'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-[15px] text-white focus:border-emerald-400 focus:outline-none';

  return (
    <div className="space-y-4 pb-2">
      {!activeShift ? (
        <section aria-label="Iniciar jornada" className={`${card} space-y-4 p-5`}>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-white">Iniciar jornada</h2>
            <p className="text-[13px] text-slate-400">Registre seu turno, pausas e quanto rende cada hora.</p>
          </div>

          {startError && (
            <p role="alert" className="flex items-center gap-2 rounded-xl bg-rose-500/10 p-3 text-[13px] text-rose-400">
              <AlertTriangle className="h-4 w-4 flex-none" /> {startError}
            </p>
          )}

          <form onSubmit={handleStartSubmit} className="space-y-4">
            {vehicles.length > 1 && (
              <div>
                <label htmlFor="jornada-veiculo" className={label}>Veículo</label>
                <select
                  id="jornada-veiculo"
                  value={selectedVehicleId || activeVehicle.id}
                  onChange={(e) => {
                    setSelectedVehicleId(e.target.value);
                    const v = vehicles.find((item) => item.id === e.target.value);
                    if (v) setStartKmInput(String(v.currentKm));
                  }}
                  className={`${field} h-12`}
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nickname} · {v.brand} {v.model}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="jornada-km" className={label}>Odômetro agora</label>
              <div className="relative">
                <input
                  id="jornada-km"
                  type="text"
                  inputMode="numeric"
                  required
                  value={startKmInput}
                  onChange={(e) => setStartKmInput(odometerOnly(e.target.value))}
                  placeholder="Ex.: 42118"
                  className={`${field} h-12 pr-12 font-semibold`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400">km</span>
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                {parseDecimalInput(startKmInput) > 0
                  ? `${parseDecimalInput(startKmInput).toLocaleString('pt-BR')} km · último registro ${activeVehicle.currentKm.toLocaleString('pt-BR')} km`
                  : 'Digite o número que aparece no painel do veículo.'}
              </p>
            </div>

            <fieldset>
              <legend className={label}>Aplicativos de hoje</legend>
              <div className="flex flex-wrap gap-2">
                {registeredApps
                  .filter((a) => a.isActive)
                  .map((app) => {
                    const isChecked = selectedApps.includes(app.name);
                    return (
                      <button
                        key={app.id}
                        type="button"
                        aria-pressed={isChecked}
                        onClick={() => handleToggleApp(app.name)}
                        className={`h-10 rounded-full border px-4 text-[13px] font-semibold active:scale-95 ${
                          isChecked
                            ? 'border-emerald-400 bg-emerald-500/10 text-emerald-400'
                            : 'border-slate-700 bg-slate-950 text-slate-300'
                        }`}
                      >
                        {app.name}
                      </button>
                    );
                  })}
              </div>
            </fieldset>

            <div>
              <label htmlFor="jornada-obs" className={label}>
                Objetivo do dia <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              <input
                id="jornada-obs"
                type="text"
                placeholder="Ex.: focar na zona Sul no almoço"
                value={startNotes}
                onChange={(e) => setStartNotes(e.target.value)}
                className={`${field} h-12`}
              />
            </div>

            <button
              type="submit"
              className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-emerald-500 text-base font-bold text-on-accent active:scale-[0.98]"
            >
              <Play className="h-4 w-4 fill-current" /> Iniciar jornada
            </button>
          </form>
        </section>
      ) : (
        <section
          aria-label="Jornada em andamento"
          className={`${card} space-y-4 p-5 ${activeShift.isPaused ? 'border-amber-400/50' : ''}`}
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              {!activeShift.isPaused && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              )}
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${activeShift.isPaused ? 'bg-amber-400' : 'bg-emerald-400'}`} />
            </span>
            <span className={`text-sm font-semibold ${activeShift.isPaused ? 'text-amber-400' : 'text-white'}`}>
              {activeShift.isPaused ? 'Jornada pausada' : 'Jornada em andamento'}
            </span>
            <span className="ml-auto text-[13px] text-slate-400">desde {activeShift.startTime.slice(0, 5)}</span>
          </div>

          <div className="text-center">
            <p className="text-[13px] text-slate-400">Tempo trabalhando</p>
            <p className="mt-1 text-5xl font-extrabold tracking-tight text-white">{formatSeconds(elapsedWorkSeconds)}</p>
            <p className="mt-2 text-[13px] text-slate-400">
              Total {formatSeconds(elapsedShiftSeconds)} · pausas{' '}
              <span className="font-semibold text-amber-400">{formatSeconds(elapsedPausedSeconds)}</span>
            </p>
          </div>

          <div className="grid grid-cols-3 border-y border-slate-800 py-3 text-center">
            <div>
              <p className="text-[13px] text-slate-400">Ganho</p>
              <p className={`mt-0.5 text-base font-bold ${currentGain > 0 ? 'text-emerald-400' : 'text-white'}`}>{formatBRL(currentGain)}</p>
            </div>
            <div className="border-x border-slate-800">
              <p className="text-[13px] text-slate-400">Gastos</p>
              <p className={`mt-0.5 text-base font-bold ${currentExpense > 0 ? 'text-rose-400' : 'text-white'}`}>{formatBRL(currentExpense)}</p>
            </div>
            <div>
              <p className="text-[13px] text-slate-400">Por hora</p>
              <p className="mt-0.5 text-base font-bold text-white">{formatBRL(currentPerHour)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {activeShift.isPaused ? (
              <button
                type="button"
                onClick={resumeShift}
                className="flex h-12 items-center justify-center gap-2 rounded-[14px] bg-emerald-500 text-[15px] font-bold text-on-accent active:scale-[0.98]"
              >
                <Play className="h-4 w-4 fill-current" /> Retomar
              </button>
            ) : (
              <button
                type="button"
                onClick={pauseShift}
                className="flex h-12 items-center justify-center gap-2 rounded-[14px] border border-slate-700 bg-slate-800 text-[15px] font-semibold text-white active:scale-[0.98]"
              >
                <Coffee className="h-4 w-4" /> Pausar
              </button>
            )}
            <button
              type="button"
              onClick={handleOpenEndModal}
              className="flex h-12 items-center justify-center gap-2 rounded-[14px] bg-white text-[15px] font-bold text-app active:scale-[0.98]"
            >
              <Square className="h-3.5 w-3.5 fill-current" /> Encerrar
            </button>
          </div>

          <button
            type="button"
            onClick={() => openNewTransactionModal('ganho')}
            className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-500/10 text-sm font-semibold text-emerald-400 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" /> Lançar ganho desta jornada
          </button>
        </section>
      )}

      {/* Ofertas do Copiloto: registrar ganho com 1 toque */}
      <QuickRideRegister />

      {isEndModalOpen && activeShift && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="encerrar-titulo"
            className="w-full max-w-md space-y-4 rounded-t-[24px] border border-slate-800 bg-slate-900 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[24px]"
          >
            <div className="flex items-center justify-between">
              <h3 id="encerrar-titulo" className="text-lg font-bold text-white">Encerrar jornada</h3>
              <button
                type="button"
                onClick={() => setIsEndModalOpen(false)}
                aria-label="Fechar"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {endError && (
              <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-[13px] text-rose-400">{endError}</p>
            )}

            <form onSubmit={handleConfirmEndShift} className="space-y-4">
              <div className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-950 p-3.5">
                <div>
                  <p className="text-xs text-slate-400">Odômetro no início</p>
                  <p className="text-[15px] font-bold text-white">{activeShift.startKm.toLocaleString('pt-BR')} km</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Tempo trabalhando</p>
                  <p className="text-[15px] font-bold text-emerald-400">{formatSeconds(elapsedWorkSeconds)}</p>
                </div>
              </div>

              <div>
                <label htmlFor="encerrar-km" className={label}>Odômetro agora</label>
                <div className="relative">
                  <input
                    id="encerrar-km"
                    type="text"
                    inputMode="numeric"
                    required
                    autoFocus
                    value={endKmInput}
                    onChange={(e) => setEndKmInput(odometerOnly(e.target.value))}
                    className={`${field} h-12 pr-12 font-semibold`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400">km</span>
                </div>
                <p className="mt-1.5 text-xs text-slate-400">
                  {parseDecimalInput(endKmInput) >= activeShift.startKm
                    ? `Distância da jornada: ${calculateOdometerDistance(activeShift.startKm, parseDecimalInput(endKmInput)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`
                    : 'Digite exatamente o número exibido no odômetro.'}
                </p>
              </div>

              <div>
                <label htmlFor="encerrar-obs" className={label}>
                  Como foi o dia? <span className="font-normal text-slate-400">(opcional)</span>
                </label>
                <textarea
                  id="encerrar-obs"
                  rows={2}
                  placeholder="Ex.: dinâmica alta no fim da tarde"
                  value={endNotes}
                  onChange={(e) => setEndNotes(e.target.value)}
                  className={`${field} py-2.5`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsEndModalOpen(false)}
                  className="h-12 rounded-[14px] border border-slate-700 text-[15px] font-semibold text-slate-200"
                >
                  Continuar
                </button>
                <button type="submit" className="h-12 rounded-[14px] bg-emerald-500 text-[15px] font-bold text-on-accent">
                  Salvar jornada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <section aria-label="Histórico de jornadas" className="space-y-3">
        <div className="flex items-baseline justify-between px-1">
          <h3 className="text-[15px] font-bold text-white">Jornadas anteriores</h3>
          <span className="text-[13px] text-slate-400">
            {shifts.length} {shifts.length === 1 ? 'jornada' : 'jornadas'}
          </span>
        </div>

        {shifts.length === 0 ? (
          <div className={`${card} py-10 text-center`}>
            <Clock className="mx-auto mb-2 h-8 w-8 text-slate-600" />
            <p className="text-sm text-slate-400">Suas jornadas encerradas aparecem aqui.</p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {shifts.map((s) => {
              const totals = getShiftTotals(s.id);
              const netProfit = totals.gain - totals.expense;
              const perHour = safeDivide(netProfit, s.totalWorkHours);
              return (
                <li key={s.id} className={`${card} p-4`}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-bold text-white">{formatDisplayDate(s.date)}</p>
                      <p className="text-[13px] text-slate-400">
                        {s.startTime.slice(0, 5)} – {s.endTime.slice(0, 5)} · {formatHours(s.totalWorkHours)} trabalhando
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-extrabold text-emerald-400">{formatBRL(netProfit)}</p>
                      <p className="text-xs text-slate-400">lucro · ganho {formatBRL(totals.gain)}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-x-4 gap-y-1 text-[13px] text-slate-400">
                    <span><b className="font-semibold text-white">{s.totalKm.toLocaleString('pt-BR')}</b> km</span>
                    <span><b className="font-semibold text-white">{formatBRL(perHour)}</b>/h</span>
                    <span>pausas <b className="font-semibold text-white">{formatPauses(s.totalPauseMinutes || 0)}</b></span>
                    {deleteConfirmId !== s.id && (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(s.id)}
                        aria-label={`Excluir jornada de ${formatDisplayDate(s.date)}`}
                        className="-mr-2 ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 active:bg-slate-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {s.notes && <p className="mt-2 text-[13px] italic text-slate-400">“{s.notes}”</p>}

                  {deleteConfirmId === s.id && (
                    <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-500/10 p-2.5">
                      <span className="flex-1 text-[13px] text-rose-400">Excluir esta jornada?</span>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(null)}
                        className="h-9 rounded-lg bg-slate-800 px-3 text-[13px] font-semibold text-slate-200"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          removeShift(s.id);
                          setDeleteConfirmId(null);
                        }}
                        className="h-9 rounded-lg bg-rose-600 px-3 text-[13px] font-semibold text-on-accent"
                      >
                        Excluir
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {closedShift && <ShiftSummaryModal shift={closedShift} onClose={() => setClosedShift(null)} />}
    </div>
  );
};
