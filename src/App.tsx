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
import { Bike, CheckCircle2, Plus } from 'lucide-react';
import { SessionProvider } from './context/SessionContext';
import { SubscriptionAccessGate } from './components/SubscriptionAccessGate';

const MainAppContent: React.FC = () => {
  const { activeTab, toastMessage, ready, mode, vehicles, openVehiclesModal } = useApp();

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
        <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-[#0f172a] p-7 text-center shadow-2xl shadow-black">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <Bike className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-bold text-white">Cadastre seu primeiro veículo</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Sua conta está pronta e começa limpa. Adicione a moto, o carro ou a bicicleta que você
            usa para trabalhar.
          </p>
          <button
            type="button"
            onClick={openVehiclesModal}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 transition active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Cadastrar veículo
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
      <SubscriptionAccessGate>
        <AppProvider>
          <MainAppContent />
        </AppProvider>
      </SubscriptionAccessGate>
    </SessionProvider>
  );
}

const DetailModalBridge: React.FC = () => {
  const { selectedTransaction, closeTransactionDetail } = useApp();
  return (
    <TransactionDetailModal transaction={selectedTransaction} onClose={closeTransactionDetail} />
  );
};
