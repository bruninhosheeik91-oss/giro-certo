import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { NewTransactionModal } from './components/NewTransactionModal';
import { VehiclesModal } from './components/VehiclesModal';
import { MaintenanceModal } from './components/MaintenanceModal';
import { SimulatorsModal } from './components/SimulatorsModal';
import { AppsManagementModal } from './components/AppsManagementModal';
import { TransactionDetailModal } from './components/TransactionDetailModal';
import { MaintenanceReserveModal } from './components/MaintenanceReserveModal';
import { PayablesModal } from './components/PayablesModal';
import { HomeView } from './views/HomeView';
import { TransactionsView } from './views/TransactionsView';
import { ShiftView } from './views/ShiftView';
import { ReportsView } from './views/ReportsView';
import { ProfileView } from './views/ProfileView';
import { motion, AnimatePresence } from 'motion/react';
import { Bike, CheckCircle2, Plus, Smartphone, Target } from 'lucide-react';
import { SessionProvider } from './context/SessionContext';
import { formatBRLInput, parseBRLInput } from './utils/calculations';
import { TrialExpiryNotice } from './components/TrialExpiryNotice';

const MainAppContent: React.FC = () => {
  const {
    activeTab,
    toastMessage,
    ready,
    mode,
    vehicles,
    openVehiclesModal,
    userProfile,
    updateUserProfile,
    registeredApps,
    toggleRegisteredApp,
  } = useApp();
  const [firstGoal, setFirstGoal] = React.useState(() =>
    formatBRLInput(Math.round(userProfile.monthlyGoal * 100).toString()),
  );

  React.useEffect(() => {
    setFirstGoal(formatBRLInput(Math.round(userProfile.monthlyGoal * 100).toString()));
  }, [userProfile.monthlyGoal]);

  const continueFirstAccess = () => {
    const monthlyGoal = parseBRLInput(firstGoal);
    if (monthlyGoal > 0 && monthlyGoal !== userProfile.monthlyGoal) {
      updateUserProfile({ monthlyGoal });
    }
    openVehiclesModal();
  };

  // Sem esta trava, o logout/troca de conta renderiza um frame com os dados do
  // usuário anterior antes do efeito de hidratação trocar o escopo.
  if (!ready) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#090d16]">
        <div className="w-8 h-8 border-2 border-emerald-500/40 border-t-emerald-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (mode === 'cloud' && vehicles.length === 0) {
    return (
      <div className="min-h-screen w-full flex justify-center items-center bg-[#060910] px-5 text-slate-100">
        <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-[#0f172a] p-6 shadow-2xl shadow-black">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <Bike className="h-8 w-8" />
          </div>
          <h1 className="text-center text-xl font-bold text-white">Bem-vindo ao Giro Certo</h1>
          <p className="mt-2 text-center text-sm leading-relaxed text-slate-400">
            Sua conta começa limpa. Faça uma configuração rápida para acompanhar seus resultados.
          </p>

          <div className="mt-6 space-y-5 text-left">
            <section>
              <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-200">
                <Target className="h-4 w-4 text-emerald-400" />
                1. Defina sua meta mensal
              </div>
              <div className="flex items-center rounded-xl border border-slate-700 bg-slate-950/60 px-3 focus-within:border-emerald-500/60 focus-within:ring-2 focus-within:ring-emerald-500/15">
                <span className="text-sm font-semibold text-slate-500">R$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={firstGoal}
                  onChange={(event) => setFirstGoal(formatBRLInput(event.target.value))}
                  aria-label="Meta mensal"
                  placeholder="5.400,00"
                  className="w-full bg-transparent px-2 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600"
                />
              </div>
            </section>

            <section>
              <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-200">
                <Smartphone className="h-4 w-4 text-sky-400" />
                2. Selecione os aplicativos que utiliza
              </div>
              <div className="flex flex-wrap gap-2">
                {registeredApps.map((app) => (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => toggleRegisteredApp(app.id)}
                    aria-pressed={app.isActive}
                    className={`rounded-lg border px-3 py-2 text-[11px] font-bold transition active:scale-95 ${
                      app.isActive
                        ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                        : 'border-slate-700 bg-slate-900 text-slate-500'
                    }`}
                  >
                    {app.name}
                  </button>
                ))}
              </div>
            </section>

            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <Bike className="h-4 w-4 text-amber-400" />
              3. Cadastre seu primeiro veículo
            </div>
          </div>

          <button
            type="button"
            onClick={continueFirstAccess}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 transition active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Continuar para o veículo
          </button>
        </div>
        <VehiclesModal />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex justify-center bg-[#060910] text-slate-100 antialiased selection:bg-emerald-500 selection:text-slate-950">
      {/* Mobile container centered on wider viewports */}
      <div className="w-full max-w-md min-h-screen flex flex-col relative overflow-x-hidden bg-[#090d16] border-x border-slate-800/80 shadow-2xl shadow-black">
        {/* Top Header */}
        <Header />
        <TrialExpiryNotice />

        {/* Tab Content with Safe-Area bottom spacing */}
        <main className="flex-1 px-4 pt-3 pb-[calc(7.2rem+env(safe-area-inset-bottom,0px))] overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              {activeTab === 'inicio' && <HomeView />}
              {activeTab === 'lancamentos' && <TransactionsView />}
              {activeTab === 'jornada' && <ShiftView />}
              {activeTab === 'relatorios' && <ReportsView />}
              {activeTab === 'perfil' && <ProfileView />}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Global Feedback Toast Notification */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.95 }}
              className="fixed bottom-24 left-4 right-4 max-w-sm mx-auto z-50 pointer-events-none"
            >
              <div className="bg-slate-900/95 border border-emerald-500/40 text-slate-100 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <p className="text-xs font-semibold leading-snug">{toastMessage}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Action Button & Bottom Navigation */}
        <BottomNav />

        {/* Modals */}
        <NewTransactionModal />
        <VehiclesModal />
        <MaintenanceModal />
        <SimulatorsModal />
        <AppsManagementModal />
        <MaintenanceReserveModal />
        <PayablesModal />
        <DetailModalBridge />
      </div>
    </div>
  );
};

export default function App() {
  return (
    <SessionProvider>
      <AppProvider>
        <MainAppContent />
      </AppProvider>
    </SessionProvider>
  );
}

const DetailModalBridge: React.FC = () => {
  const { selectedTransaction, closeTransactionDetail } = useApp();
  return (
    <TransactionDetailModal transaction={selectedTransaction} onClose={closeTransactionDetail} />
  );
};
