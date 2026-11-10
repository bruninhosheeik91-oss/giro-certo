import React from 'react';
import { useApp } from '../context/AppContext';
import { ChevronDown, Shield } from 'lucide-react';
import { ProfileAvatar } from './ProfileAvatar';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const formatMonthLabel = (month: string) => {
  const [y, m] = month.split('-');
  return `${MONTHS[parseInt(m, 10) - 1] || m}/${y.slice(2)}`;
};

const formatTimer = (totalSeconds: number) => {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  return `${hrs}h${mins.toString().padStart(2, '0')}`;
};

export const Header: React.FC = () => {
  const {
    userProfile,
    activeVehicle,
    selectedMonth,
    setSelectedMonth,
    availableMonths,
    activeShift,
    elapsedWorkSeconds,
    activeTab,
    setActiveTab,
  } = useApp();

  const vehicleLine = activeVehicle?.nickname || activeVehicle?.model || '';

  return (
    <header className="safe-top sticky top-0 z-30 border-b border-slate-800/80 bg-app/95 px-4 pb-3 backdrop-blur-md">
      <div className="mx-auto flex max-w-md items-center gap-2.5">
        <img src="/icons/icon-192.png" alt="" className="h-10 w-10 flex-none rounded-xl object-cover" />
        <div className="min-w-0 flex-1">
          <h1 className="text-[17px] font-bold leading-tight tracking-tight text-white">Giro Certo</h1>
          <p className="truncate text-xs text-slate-400">{vehicleLine}</p>
        </div>

        <label className="relative flex h-11 flex-none items-center rounded-xl border border-slate-800 bg-slate-900 pl-2.5 pr-7 text-sm font-semibold text-white">
          <span className="sr-only">Mês</span>
          {formatMonthLabel(selectedMonth)}
          <ChevronDown className="pointer-events-none absolute right-2 h-4 w-4 text-slate-400" />
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Escolher mês"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {formatMonthLabel(m)}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => setActiveTab('seguranca')}
          className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-slate-800 bg-slate-900 active:scale-95 ${
            activeTab === 'seguranca' ? 'text-emerald-400' : 'text-slate-400'
          }`}
          aria-label="Segurança"
        >
          <Shield className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('perfil')}
          className={`flex-none rounded-full ring-2 active:scale-95 ${activeTab === 'perfil' ? 'ring-emerald-400' : 'ring-slate-800'}`}
          aria-label="Perfil"
        >
          <ProfileAvatar name={userProfile.name} photoUrl={userProfile.photoUrl} className="h-10 w-10 rounded-full" />
        </button>
      </div>

      {activeShift && activeTab !== 'inicio' && activeTab !== 'jornada' && (
        <button
          type="button"
          onClick={() => setActiveTab('jornada')}
          className="mx-auto mt-2.5 flex w-full max-w-md items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-left text-[13px]"
        >
          <span className={`h-2 w-2 rounded-full ${activeShift.isPaused ? 'bg-amber-400' : 'bg-emerald-400'}`} />
          <span className="text-slate-400">{activeShift.isPaused ? 'Jornada pausada' : 'Jornada em andamento'}</span>
          <span className="font-bold text-white">{formatTimer(elapsedWorkSeconds)}</span>
          <span className="ml-auto font-semibold text-emerald-400">Ver</span>
        </button>
      )}
    </header>
  );
};
