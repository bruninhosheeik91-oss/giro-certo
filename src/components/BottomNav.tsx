import React from 'react';
import { useApp } from '../context/AppContext';
import { BarChart3, Home, ListOrdered, Plus, Timer } from 'lucide-react';

type TabId = 'inicio' | 'lancamentos' | 'jornada' | 'relatorios';

interface NavItem {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  hasBadge?: boolean;
}

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab, openNewTransactionModal, activeShift } = useApp();

  const left: NavItem[] = [
    { id: 'inicio', label: 'Início', icon: Home },
    { id: 'lancamentos', label: 'Extrato', icon: ListOrdered },
  ];
  const right: NavItem[] = [
    { id: 'jornada', label: 'Jornada', icon: Timer, hasBadge: !!activeShift },
    { id: 'relatorios', label: 'Relatórios', icon: BarChart3 },
  ];

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => setActiveTab(item.id)}
        aria-current={isActive ? 'page' : undefined}
        className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl py-1 text-xs font-semibold active:scale-95 ${
          isActive ? 'text-emerald-400' : 'text-slate-400'
        }`}
      >
        <span className="relative">
          <Icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.4 : 2} />
          {item.hasBadge && (
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-app" />
          )}
        </span>
        {item.label}
      </button>
    );
  };

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800/90 bg-app/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 items-center px-2 pt-1.5">
        {left.map(renderItem)}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => openNewTransactionModal()}
            aria-label="Novo lançamento"
            className="-mt-5 flex h-14 w-14 items-center justify-center rounded-[18px] border-4 border-app bg-emerald-500 text-on-accent shadow-lg shadow-emerald-500/25 active:scale-95"
          >
            <Plus className="h-6 w-6" strokeWidth={2.8} />
          </button>
        </div>
        {right.map(renderItem)}
      </div>
    </nav>
  );
};
