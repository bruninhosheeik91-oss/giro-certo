import React from 'react';
import { useApp } from '../context/AppContext';
import { MaintenanceTransaction } from '../types';
import { calculateVehiclePartsHealth, formatBRL } from '../utils/calculations';
import { X, Wrench, Bike, Plus, ShieldAlert } from 'lucide-react';

export const MaintenanceModal: React.FC = () => {
  const {
    isMaintenanceModalOpen,
    closeMaintenanceModal,
    activeVehicle,
    transactions,
    openNewTransactionModal,
    selectedMonth,
  } = useApp();

  if (!isMaintenanceModalOpen) return null;

  const currentKm = activeVehicle.currentKm || 24850;
  const partsHealth = calculateVehiclePartsHealth(currentKm);

  // Month & Year maintenance costs
  const [currentYear] = selectedMonth.split('-');
  const maintenanceTransactions = transactions.filter(
    (t): t is MaintenanceTransaction => t.type === 'manutencao',
  );

  const monthCost = maintenanceTransactions
    .filter((t) => t.date.startsWith(selectedMonth))
    .reduce((acc, t) => acc + t.amount, 0);

  const yearCost = maintenanceTransactions
    .filter((t) => t.date.startsWith(currentYear))
    .reduce((acc, t) => acc + t.amount, 0);

  // Urgent alerts
  const urgentAlerts = partsHealth.filter(
    (p) => p.status === 'Troca próxima' || p.status === 'Atrasada' || p.status === 'Atenção',
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-[#0f172a] border border-slate-800 rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Manutenção Preventiva
              </h2>
              <p className="text-xs text-slate-400">
                {activeVehicle.nickname} ({activeVehicle.brand} {activeVehicle.model})
              </p>
            </div>
          </div>
          <button
            onClick={closeMaintenanceModal}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* Active Vehicle & Total Costs Header Card */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/20 border border-slate-800 shadow-md">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bike className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Odômetro Atual
                </span>
              </div>
              <span className="text-sm font-bold text-amber-400 font-mono">
                {currentKm.toLocaleString('pt-BR')} km
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800/80">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-medium block">
                  Custo no Mês ({selectedMonth})
                </span>
                <span className="text-sm font-bold text-white font-mono">
                  {formatBRL(monthCost)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-medium block">
                  Custo no Ano ({currentYear})
                </span>
                <span className="text-sm font-bold text-amber-400 font-mono">
                  {formatBRL(yearCost)}
                </span>
              </div>
            </div>
          </div>

          {/* Urgent Maintenance Notice */}
          {urgentAlerts.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>Atenção Preventiva Requerida</span>
              </div>
              {urgentAlerts.map((alert) => (
                <div
                  key={alert.partKey}
                  className="text-xs text-amber-200/90 pl-6 flex items-center justify-between"
                >
                  <span>
                    • <strong>{alert.label}</strong>: faltam{' '}
                    {alert.remainingKm > 0 ? `${alert.remainingKm} km` : 'KM atingido!'}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      alert.status === 'Atrasada'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : alert.status === 'Troca próxima'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                    }`}
                  >
                    {alert.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Parts Health Cards List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Vida Útil Estimada das Peças
              </h3>
              <button
                onClick={() => {
                  closeMaintenanceModal();
                  openNewTransactionModal('manutencao');
                }}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Lançar Serviço
              </button>
            </div>

            <div className="space-y-2.5">
              {partsHealth.map((part) => {
                let badgeClass = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
                let barClass = 'bg-emerald-500';

                if (part.status === 'Atrasada') {
                  badgeClass = 'bg-rose-500/20 text-rose-400 border-rose-500/30';
                  barClass = 'bg-rose-500';
                } else if (part.status === 'Troca próxima') {
                  badgeClass = 'bg-orange-500/20 text-orange-400 border-orange-500/30';
                  barClass = 'bg-orange-500';
                } else if (part.status === 'Atenção') {
                  badgeClass = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
                  barClass = 'bg-amber-500';
                }

                return (
                  <div
                    key={part.partKey}
                    className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 hover:border-slate-700 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wrench className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs font-bold text-white tracking-tight">
                          {part.label}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}`}
                      >
                        {part.status}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${barClass}`}
                          style={{ width: `${part.progressPercent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                        <span>Última: {part.lastChangeKm.toLocaleString('pt-BR')} km</span>
                        <span>
                          Faltam:{' '}
                          <strong
                            className={
                              part.remainingKm <= 800
                                ? 'text-amber-400 font-bold'
                                : 'text-slate-200'
                            }
                          >
                            {part.remainingKm > 0
                              ? `${part.remainingKm.toLocaleString('pt-BR')} km`
                              : 'Troca Vencida!'}
                          </strong>
                        </span>
                        <span>Meta: {part.nextChangeKm.toLocaleString('pt-BR')} km</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* History of Services Performed */}
          <div className="space-y-2.5 pt-2">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Histórico Recente de Manutenções
            </h3>

            {maintenanceTransactions.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">
                Nenhum serviço registrado ainda.
              </p>
            ) : (
              <div className="space-y-2">
                {maintenanceTransactions.slice(0, 5).map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-white block">
                        {m.servicePerformed || m.description || m.category}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {m.date} • {m.workshop ? `${m.workshop} • ` : ''}
                        {m.currentKm ? `${m.currentKm} km` : ''}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-rose-400">
                      -{formatBRL(m.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <button
            onClick={closeMaintenanceModal}
            className="px-4 py-2 rounded-xl border border-slate-800 text-xs font-bold text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Fechar
          </button>
          <button
            onClick={() => {
              closeMaintenanceModal();
              openNewTransactionModal('manutencao');
            }}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Registrar Manutenção</span>
          </button>
        </div>
      </div>
    </div>
  );
};
