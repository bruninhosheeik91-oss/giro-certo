import React from 'react';
import { useApp } from '../context/AppContext';
import { Car, Bike } from 'lucide-react';

export const Header: React.FC = () => {
  const {
    userProfile,
    activeVehicle,
    selectedMonth,
    setSelectedMonth,
    activeShift,
    elapsedWorkSeconds,
    setActiveTab,
  } = useApp();

  const months = [
    { value: '2026-09', label: 'Set/26' },
    { value: '2026-08', label: 'Ago/26' },
    { value: '2026-07', label: 'Jul/26' },
  ];

  const formatTimer = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <header className="sticky top-0 z-30 bg-[#090d16]/95 backdrop-blur-md border-b border-slate-800/80 px-4 py-3">
      <div className="max-w-md mx-auto flex items-center justify-between gap-2">
        {/* Brand & Active Vehicle Info */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
            <span className="font-extrabold text-sm tracking-tighter">GC</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-bold tracking-tight text-white">Giro Certo</h1>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              {activeVehicle?.type === 'moto' ? (
                <Bike className="w-3 h-3 text-emerald-400" />
              ) : (
                <Car className="w-3 h-3 text-emerald-400" />
              )}
              <span className="truncate max-w-[130px] font-medium">
                {activeVehicle?.nickname || activeVehicle?.model}
              </span>
            </p>
          </div>
        </div>

        {/* Right side controls: Month Selector, Profile Avatar */}
        <div className="flex items-center gap-2">
          {/* Month Selector */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-xs bg-slate-900 border border-slate-700/80 text-slate-200 rounded-lg px-2.5 py-1.5 font-medium focus:outline-none focus:border-emerald-500 transition-colors"
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>

          {/* User Avatar */}
          <button
            onClick={() => setActiveTab('perfil')}
            className="relative rounded-full ring-2 ring-emerald-500/40 hover:ring-emerald-500 transition-all active:scale-95"
            title="Ver perfil"
          >
            <img
              src={userProfile.photoUrl}
              alt={userProfile.name}
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-full object-cover"
            />
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#090d16]" />
          </button>
        </div>
      </div>

      {/* Active Shift Mini Ticker Bar (if running) */}
      {activeShift && (
        <div
          onClick={() => setActiveTab('jornada')}
          className="mt-2.5 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-emerald-500/30 flex items-center justify-between cursor-pointer hover:border-emerald-500/60 transition-colors"
        >
          <div className="flex items-center gap-2 text-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-slate-300 font-medium">
              {activeShift.isPaused ? 'Turno pausado' : 'Turno em andamento'}:
            </span>
            <span className="font-mono font-bold text-white">
              {formatTimer(elapsedWorkSeconds)}
            </span>
          </div>

          <span className="text-[11px] font-bold text-emerald-400">Ver painel →</span>
        </div>
      )}
    </header>
  );
};
