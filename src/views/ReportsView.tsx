import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { ANNUAL_SUMMARY_MOCK } from '../data/mockData';
import {
  formatBRL,
  formatPercent,
  filterTransactionsByPeriod,
  calculatePeriodSummary,
} from '../utils/calculations';
import { Award, Trophy } from 'lucide-react';

export const ReportsView: React.FC = () => {
  const { transactions, selectedMonth, registeredApps } = useApp();
  const [viewMode, setViewMode] = useState<'mensal' | 'apps' | 'anual'>('mensal');
  const [periodFilter, setPeriodFilter] = useState<'hoje' | 'semana' | 'mes' | 'ano'>('mes');

  // Month filtered transactions
  const filteredTxs = useMemo(() => {
    return filterTransactionsByPeriod(
      transactions,
      periodFilter,
      undefined,
      undefined,
      `${selectedMonth}-15`,
    );
  }, [transactions, periodFilter, selectedMonth]);

  // Unified period summary (app stats sourced from single calculation function)
  const periodSummary = useMemo(() => {
    return calculatePeriodSummary(filteredTxs, [], 5400, 0.12);
  }, [filteredTxs]);

  // App color lookup (presentation-only; totals come from periodSummary.appStats)
  const appStats = useMemo(() => {
    const colorFor = (name: string) => {
      const registered = registeredApps.find(
        (a) => a.name.toLowerCase() === name.toLowerCase(),
      );
      return registered?.color || '#64748B';
    };
    return periodSummary.appStats.map((s) => ({ ...s, color: colorFor(s.name) }));
  }, [periodSummary, registeredApps]);

  return (
    <div className="space-y-4 pb-2">
      {/* View Switcher Bar */}
      <div className="grid grid-cols-3 p-1 bg-slate-900 border border-slate-800 rounded-2xl text-xs font-semibold">
        <button
          onClick={() => setViewMode('mensal')}
          className={`py-2 px-2 rounded-xl transition-all ${
            viewMode === 'mensal'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Visão Mensal
        </button>

        <button
          onClick={() => setViewMode('apps')}
          className={`py-2 px-2 rounded-xl transition-all ${
            viewMode === 'apps'
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-sm font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Por Aplicativo
        </button>

        <button
          onClick={() => setViewMode('anual')}
          className={`py-2 px-2 rounded-xl transition-all ${
            viewMode === 'anual'
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-sm font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Comparativo Anual
        </button>
      </div>

      {/* ================= 1. VISÃO MENSAL ================= */}
      {viewMode === 'mensal' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Period selector */}
          <div className="flex items-center justify-between bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
            <span className="text-xs font-semibold text-slate-400">Filtrar Período:</span>
            <div className="flex items-center gap-1">
              {(['hoje', 'semana', 'mes', 'ano'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriodFilter(p)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                    periodFilter === p
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Month Overview Summary Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Balanço do Período ({periodFilter.toUpperCase()})
            </h3>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 block uppercase">
                  Faturamento Bruto
                </span>
                <span className="text-sm font-bold text-emerald-400 font-mono">
                  {formatBRL(periodSummary.ganhoBruto)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 block uppercase">Lançamentos</span>
                <span className="text-sm font-bold text-slate-200 font-mono">
                  {filteredTxs.length} registros
                </span>
              </div>
            </div>
          </div>

          {/* Detailed Category Expense Breakdown */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Despesas por Categoria
            </h3>

            {filteredTxs.filter((t) => t.type !== 'ganho').length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">Nenhuma despesa no período.</p>
            ) : (
              <div className="space-y-2">
                {Array.from(
                  new Set(
                    filteredTxs
                      .filter((t) => t.type !== 'ganho')
                      .map((t) =>
                        t.type === 'outra_despesa'
                          ? t.category
                          : t.type === 'abastecimento'
                            ? 'Combustível'
                            : 'Manutenção',
                      ),
                  ),
                ).map((catName) => {
                  const catTxs = filteredTxs.filter(
                    (t) =>
                      (t.type === 'outra_despesa'
                        ? t.category
                        : t.type === 'abastecimento'
                          ? 'Combustível'
                          : 'Manutenção') === catName,
                  );
                  const catTotal = catTxs.reduce((sum, t) => sum + t.amount, 0);

                  return (
                    <div
                      key={catName}
                      className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs"
                    >
                      <span className="text-slate-300 font-medium">{catName}</span>
                      <span className="text-rose-400 font-bold font-mono">
                        -{formatBRL(catTotal)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= 2. POR APLICATIVO (Requirement 10) ================= */}
      {viewMode === 'apps' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Best App Award Banner */}
          {appStats.length > 0 && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 to-slate-900 border border-emerald-500/30 flex items-center justify-between shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                    App Mais Rentável do Mês
                  </span>
                  <h3 className="text-base font-extrabold text-white">
                    {appStats[0].name} ({formatPercent(appStats[0].percentage)})
                  </h3>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 block">Total ganho</span>
                <span className="text-sm font-bold text-emerald-400 font-mono">
                  {formatBRL(appStats[0].total)}
                </span>
              </div>
            </div>
          )}

          {/* App List Breakdown */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3.5 shadow-md">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Desempenho por Plataforma
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                Total: {formatBRL(periodSummary.ganhoBruto)}
              </span>
            </div>

            <div className="space-y-3">
              {appStats.map((app) => (
                <div
                  key={app.name}
                  className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2 hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-3.5 h-3.5 rounded-full"
                        style={{ backgroundColor: app.color }}
                      />
                      <span className="text-sm font-bold text-white tracking-tight">
                        {app.name}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-bold text-emerald-400 font-mono">
                        {formatBRL(app.total)}
                      </span>
                    </div>
                  </div>

                  {/* Percentage Bar */}
                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${app.percentage}%`,
                        backgroundColor: app.color || '#10B981',
                      }}
                    />
                  </div>

                  {/* Metrics Row */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 border-t border-slate-800/60">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block">Fatia</span>
                      <span className="font-bold text-white font-mono">
                        {formatPercent(app.percentage)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block">Corridas</span>
                      <span className="font-bold text-white font-mono">{app.rides}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block">
                        Média / Corrida
                      </span>
                      <span className="font-bold text-emerald-400 font-mono">
                        {formatBRL(app.avgPerRide)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= 3. COMPARATIVO ANUAL (Requirement 9) ================= */}
      {viewMode === 'anual' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Annual Highlights Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 border border-purple-500/30 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">
                  Crescimento Anual Consolidado
                </span>
                <h3 className="text-base font-extrabold text-white">+14,8% em 2026 vs 2025</h3>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Alta Lucratividade
            </span>
          </div>

          {/* Annual Comparison Cards */}
          <div className="space-y-3">
            {ANNUAL_SUMMARY_MOCK.map((yr) => (
              <div
                key={yr.year}
                className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 shadow-md hover:border-slate-700 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-extrabold text-white font-mono">
                      Ano {yr.year}
                    </span>
                    {yr.year === '2026' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        Ano Atual
                      </span>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block uppercase">
                      Lucro Disponível
                    </span>
                    <span className="text-base font-extrabold text-emerald-400 font-mono">
                      {formatBRL(yr.lucroDisponivel)}
                    </span>
                  </div>
                </div>

                {/* Main Annual KPIs Grid */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-[9px] text-slate-400 uppercase block">Ganho Bruto</span>
                    <span className="font-bold text-white font-mono text-[11px]">
                      {formatBRL(yr.ganhoBruto)}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-[9px] text-slate-400 uppercase block">Despesas</span>
                    <span className="font-bold text-rose-400 font-mono text-[11px]">
                      -{formatBRL(yr.totalDespesas)}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-[9px] text-slate-400 uppercase block">
                      Reserva Poupança
                    </span>
                    <span className="font-bold text-teal-400 font-mono text-[11px]">
                      {formatBRL(yr.reservaManutencao)}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-[9px] text-slate-400 uppercase block">
                      Horas Trabalhadas
                    </span>
                    <span className="font-bold text-slate-200 font-mono text-[11px]">
                      {yr.horasTrabalhadas}h
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-[9px] text-slate-400 uppercase block">Quilometragem</span>
                    <span className="font-bold text-slate-200 font-mono text-[11px]">
                      {yr.quilometrosRodados.toLocaleString('pt-BR')} km
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-[9px] text-slate-400 uppercase block">Ganho / Hora</span>
                    <span className="font-bold text-blue-400 font-mono text-[11px]">
                      {formatBRL(yr.ganhoPorHora)}/h
                    </span>
                  </div>
                </div>

                {/* Best vs Worst Month */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/80 text-slate-300">
                  <span>
                    🏆 Melhor mês: <strong>{yr.melhorMes.mes}</strong> (
                    {formatBRL(yr.melhorMes.lucro)})
                  </span>
                  <span>
                    ⚠️ Pior mês: <strong>{yr.piorMes.mes}</strong> ({formatBRL(yr.piorMes.lucro)})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
