import React from 'react';
import { useApp } from '../context/AppContext';
import { Home, Receipt, Timer, BarChart3, User, Plus } from 'lucide-react';

interface NavItem {
  id: 'inicio' | 'lancamentos' | 'jornada' | 'relatorios' | 'perfil';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hasBadge?: boolean;
}

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab, openNewTransactionModal, activeShift } = useApp();

  const navItems: NavItem[] = [
    { id: 'inicio', label: 'Início', icon: Home },
    { id: 'lancamentos', label: 'Lançamentos', icon: Receipt },
    { id: 'jornada', label: 'Jornada', icon: Timer, hasBadge: !!activeShift },
    { id: 'relatorios', label: 'Relatórios', icon: BarChart3 },
    { id: 'perfil', label: 'Perfil', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#090d16]/95 backdrop-blur-xl border-t border-slate-800/90 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="max-w-md mx-auto px-2 py-1.5 flex items-center justify-between relative">
        {/* Left items: Início, Lançamentos */}
        <div className="flex items-center">
          {navItems.slice(0, 2).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center w-16 py-1 rounded-xl transition-all duration-200 active:scale-90 ${
                  isActive ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Floating Action Button (FAB) "+" */}
        <div className="relative -top-4 flex justify-center">
          <button
            onClick={() => openNewTransactionModal()}
            className="w-13 h-13 rounded-full bg-gradient-to-tr from-emerald-500 via-teal-500 to-emerald-400 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-105 active:scale-95 transition-all border-4 border-[#090d16]"
            title="Adicionar novo lançamento"
          >
            <Plus className="w-6 h-6 stroke-[3]" />
          </button>
        </div>

        {/* Right items: Jornada, Relatórios, Perfil */}
        <div className="flex items-center">
          {navItems.slice(2).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center w-16 py-1 rounded-xl transition-all duration-200 active:scale-90 ${
                  isActive ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                  {item.hasBadge && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse ring-2 ring-[#090d16]" />
                  )}
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
