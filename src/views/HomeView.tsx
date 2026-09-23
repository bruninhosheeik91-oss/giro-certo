import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatBRL, formatHours, formatPercent } from '../utils/calculations';
import {
  TrendingUp,
  DollarSign,
  Clock,
  MapPin,
  Fuel,
  Wrench,
  Plus,
  ChevronRight,
  Bike,
  Car,
  Target,
  PiggyBank,
  Calculator,
  Edit2,
} from 'lucide-react';

export const HomeView: React.FC = () => {
  const {
    monthSummary,
    userProfile,
    updateUserProfile,
    activeVehicle,
    activeShift,
    openNewTransactionModal,
    openVehiclesModal,
    openMaintenanceModal,
    openSimulatorsModal,
    depositMaintenanceReserve,
    setActiveTab,
    selectedMonth,
  } = useApp();

  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [newGoalInput, setNewGoalInput] = useState(userProfile.monthlyGoal.toString());

  // Goal projections and daily target
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthNum = now.getMonth() + 1;
  const daysInCurrentMonth = new Date(currentYear, currentMonthNum, 0).getDate();
  const currentDay = now.getDate();
  const daysRemaining = Math.max(1, daysInCurrentMonth - currentDay);

  // Remaining target for the days left in the month
  const targetRemaining = Math.max(0, userProfile.monthlyGoal - monthSummary.lucroDisponivel);
  const dailyNeeded = targetRemaining / daysRemaining;

  // Pace projection
  const dailyPace = currentDay > 0 ? monthSummary.lucroDisponivel / currentDay : 0;
  const projectedMonthProfit = dailyPace * daysInCurrentMonth;

  let goalStatus: 'No ritmo' | 'Atenção' | 'Abaixo da meta' = 'No ritmo';
  if (projectedMonthProfit < userProfile.monthlyGoal * 0.75) {
    goalStatus = 'Abaixo da meta';
  } else if (projectedMonthProfit < userProfile.monthlyGoal * 0.95) {
    goalStatus = 'Atenção';
  }

  const handleSaveGoal = () => {
    const val = parseFloat(newGoalInput.replace(',', '.'));
    if (!isNaN(val) && val > 0) {
      updateUserProfile({ monthlyGoal: val });
    }
    setIsEditingGoal(false);
  };

  return (
    <div className="space-y-4 pb-2">
      {/* Top Header Card: Active Vehicle Banner */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/30 border border-slate-800 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            {activeVehicle.type === 'moto' ? (
              <Bike className="w-5 h-5" />
            ) : (
              <Car className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Veículo Ativo
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {activeVehicle.currentKm.toLocaleString('pt-BR')} km
              </span>
            </div>
            <h3 className="text-sm font-bold text-white tracking-tight">
              {activeVehicle.nickname}
            </h3>
          </div>
        </div>

        <button
          onClick={openVehiclesModal}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
        >
          Trocar
        </button>
      </div>

      {/* Active Shift Floating Banner (if ongoing) */}
      {activeShift && (
        <div
          onClick={() => setActiveTab('jornada')}
          className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/60 to-emerald-950/60 border border-blue-500/40 shadow-lg flex items-center justify-between cursor-pointer hover:border-blue-400 transition-all"
        >
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <div>
              <p className="text-xs font-bold text-white flex items-center gap-1.5">
                Jornada em Andamento
                {activeShift.isPaused && (
                  <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 text-[10px] rounded border border-amber-500/30">
                    Pausada
                  </span>
                )}
              </p>
              <p className="text-[11px] text-slate-300 font-mono">
                Início: {activeShift.startTime} • Ganho acumulado:{' '}
                {formatBRL(activeShift.accumulatedGain)}
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>
      )}

      {/* Main Financial Hero Card: Lucro Líquido & Lucro Disponível */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Lucro Real do Mês ({selectedMonth})
            </span>
          </div>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
            {formatPercent(monthSummary.progressoMeta)} da meta
          </span>
        </div>

        {/* Big Available Profit */}
        <div>
          <span className="text-xs text-slate-400 block font-medium">
            Lucro Disponível (Livre no Bolso):
          </span>
          <div className="flex items-baseline gap-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-emerald-400 font-mono">
              {formatBRL(monthSummary.lucroDisponivel)}
            </h1>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Ganho Bruto ({formatBRL(monthSummary.ganhoBruto)}) – Despesas (
            {formatBRL(monthSummary.totalDespesas)}) – Reserva Sugerida (
            {formatBRL(monthSummary.reservaManutencao)})
          </p>
        </div>

        {/* 3 Metric Pills */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-center">
          <div className="bg-slate-950/60 p-2 rounded-xl">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">
              Ganho Bruto
            </span>
            <span className="text-xs font-bold text-slate-200 font-mono">
              {formatBRL(monthSummary.ganhoBruto)}
            </span>
          </div>
          <div className="bg-slate-950/60 p-2 rounded-xl">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">
              Despesas
            </span>
            <span className="text-xs font-bold text-rose-400 font-mono">
              -{formatBRL(monthSummary.totalDespesas)}
            </span>
          </div>
          <div className="bg-slate-950/60 p-2 rounded-xl">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">
              Lucro / Hora
            </span>
            <span className="text-xs font-bold text-emerald-400 font-mono">
              {formatBRL(monthSummary.lucroPorHora)}/h
            </span>
          </div>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-4 gap-2">
        <button
          onClick={() => openNewTransactionModal('ganho')}
          className="p-3 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 flex flex-col items-center gap-1.5 transition-all active:scale-95 text-center"
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Plus className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-bold text-emerald-400 leading-tight">Ganho</span>
        </button>

        <button
          onClick={() => openNewTransactionModal('abastecimento')}
          className="p-3 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 flex flex-col items-center gap-1.5 transition-all active:scale-95 text-center"
        >
          <div className="w-8 h-8 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-400">
            <Fuel className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-bold text-rose-400 leading-tight">Abastecer</span>
        </button>

        <button
          onClick={openMaintenanceModal}
          className="p-3 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 flex flex-col items-center gap-1.5 transition-all active:scale-95 text-center"
        >
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
            <Wrench className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-bold text-amber-400 leading-tight">Manutenção</span>
        </button>

        <button
          onClick={openSimulatorsModal}
          className="p-3 rounded-2xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 flex flex-col items-center gap-1.5 transition-all active:scale-95 text-center"
        >
          <div className="w-8 h-8 rounded-xl bg-teal-500/20 flex items-center justify-center text-teal-400">
            <Calculator className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-bold text-teal-400 leading-tight">Simuladores</span>
        </button>
      </div>

      {/* Requirement 8: Meta Mensal Aprimorada Card */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Meta Mensal de Lucro
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                goalStatus === 'No ritmo'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : goalStatus === 'Atenção'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
              }`}
            >
              {goalStatus}
            </span>
            <button
              onClick={() => setIsEditingGoal(!isEditingGoal)}
              className="text-slate-400 hover:text-white p-1"
              title="Ajustar meta"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Goal Edit inline */}
        {isEditingGoal ? (
          <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
            <span className="text-xs font-bold text-slate-400">R$</span>
            <input
              type="number"
              value={newGoalInput}
              onChange={(e) => setNewGoalInput(e.target.value)}
              className="w-full bg-transparent text-sm font-bold text-white font-mono focus:outline-none"
            />
            <button
              onClick={handleSaveGoal}
              className="px-2.5 py-1 bg-emerald-500 text-slate-950 text-xs font-bold rounded-lg"
            >
              Salvar
            </button>
          </div>
        ) : (
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-bold text-white font-mono">
              {formatBRL(monthSummary.lucroDisponivel)}
              <span className="text-xs font-normal text-slate-400">
                {' '}
                / {formatBRL(userProfile.monthlyGoal)}
              </span>
            </span>
            <span className="text-xs font-bold text-blue-400 font-mono">
              Faltam {formatBRL(targetRemaining)}
            </span>
          </div>
        )}

        {/* Progress Bar */}
        <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full transition-all duration-700"
            style={{ width: `${Math.min(100, Math.max(0, monthSummary.progressoMeta))}%` }}
          />
        </div>

        {/* Daily Target & Projection Row */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-center">
          <div className="bg-slate-950/50 rounded-lg p-2">
            <span className="text-[10px] text-slate-400 block uppercase">Dias Restantes</span>
            <span className="text-xs font-bold text-slate-200 font-mono">{daysRemaining} dias</span>
          </div>
          <div className="bg-slate-950/50 rounded-lg p-2">
            <span className="text-[10px] text-slate-400 block uppercase">Meta Diária</span>
            <span className="text-xs font-bold text-blue-400 font-mono">
              {formatBRL(dailyNeeded)}/dia
            </span>
          </div>
          <div className="bg-slate-950/50 rounded-lg p-2">
            <span className="text-[10px] text-slate-400 block uppercase">Projeção Mês</span>
            <span className="text-xs font-bold text-emerald-400 font-mono">
              {formatBRL(projectedMonthProfit)}
            </span>
          </div>
        </div>
      </div>

      {/* Requirement 7: Reserva para Manutenção (Cofrinho) */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950/30 border border-slate-800 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <PiggyBank className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Reserva para Manutenção
              </h3>
              <p className="text-[10px] text-slate-400">
                Poupança preventiva sugerida por KM rodado
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-teal-400">
            R$ {(userProfile.maintenanceReservePerKm || 0.12).toFixed(2).replace('.', ',')}/km
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">
              Sugerido no Mês ({monthSummary.quilometrosRodados.toLocaleString('pt-BR')} km)
            </span>
            <span className="text-sm font-bold text-slate-200 font-mono">
              {formatBRL(monthSummary.reservaManutencao)}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">
              Guardado no Cofrinho
            </span>
            <span className="text-sm font-bold text-teal-400 font-mono">
              {formatBRL(userProfile.maintenanceReserveSaved || 0)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => depositMaintenanceReserve(50)}
            className="w-full py-2 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-300 text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Guardar +R$ 50,00 na Reserva</span>
          </button>
        </div>
      </div>

      {/* Operational Stats: Horas, KM, Ganho/Hora, Ganho/KM */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Horas Trabalhadas</span>
            <Clock className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <p className="text-base font-bold text-white font-mono">
            {formatHours(monthSummary.horasTrabalhadas)}
          </p>
          <span className="text-[10px] text-slate-500">Líquido de pausas</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Quilômetros Rodados</span>
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <p className="text-base font-bold text-white font-mono">
            {monthSummary.quilometrosRodados.toLocaleString('pt-BR')} km
          </p>
          <span className="text-[10px] text-slate-500">Média de consumo ativa</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Ganho por Hora</span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <p className="text-base font-bold text-emerald-400 font-mono">
            {formatBRL(monthSummary.ganhoPorHora)}/h
          </p>
          <span className="text-[10px] text-slate-500">Bruto faturado / hora</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Lucro por KM</span>
            <TrendingUp className="w-3.5 h-3.5 text-teal-400" />
          </div>
          <p className="text-base font-bold text-teal-400 font-mono">
            {formatBRL(monthSummary.lucroPorKm)}/km
          </p>
          <span className="text-[10px] text-slate-500">Líquido de despesas e reserva</span>
        </div>
      </div>
    </div>
  );
};
