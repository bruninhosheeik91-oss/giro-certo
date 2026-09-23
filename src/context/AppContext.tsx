import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import {
  Transaction,
  Shift,
  UserProfile,
  UserVehicle,
  RegisteredApp,
  TransactionType,
  PeriodSummary,
  ActiveShiftState,
} from '../types';
import {
  INITIAL_TRANSACTIONS,
  INITIAL_SHIFTS,
  INITIAL_USER_PROFILE,
  INITIAL_VEHICLES,
  INITIAL_REGISTERED_APPS,
} from '../data/mockData';
import { calculatePeriodSummary } from '../utils/calculations';

export type TransactionInput = {
  type: TransactionType;
  date: string;
  time: string;
  amount: number;
  description?: string;
  vehicleId?: string;
  shiftId?: string;
  [key: string]: unknown;
};

interface AppContextType {
  // Navigation
  activeTab: 'inicio' | 'lancamentos' | 'jornada' | 'relatorios' | 'perfil';
  setActiveTab: (tab: 'inicio' | 'lancamentos' | 'jornada' | 'relatorios' | 'perfil') => void;

  // Transactions
  transactions: Transaction[];
  addTransaction: (tx: TransactionInput) => void;
  updateTransaction: (id: string, updated: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;

  // Vehicles
  vehicles: UserVehicle[];
  activeVehicle: UserVehicle;
  addVehicle: (veh: Omit<UserVehicle, 'id'>) => void;
  updateVehicle: (id: string, updates: Partial<UserVehicle>) => void;
  setActiveVehicleId: (id: string) => void;
  archiveVehicle: (id: string) => void;
  deleteVehicle: (id: string) => void;

  // Registered Apps
  registeredApps: RegisteredApp[];
  addRegisteredApp: (app: Omit<RegisteredApp, 'id'>) => void;
  updateRegisteredApp: (id: string, updates: Partial<RegisteredApp>) => void;
  toggleRegisteredApp: (id: string) => void;
  deleteRegisteredApp: (id: string) => void;

  // Shifts
  shifts: Shift[];
  activeShift: ActiveShiftState | null;
  startShift: (vehicleId: string, startKm: number, activeApps: string[], notes?: string) => void;
  pauseShift: () => void;
  resumeShift: () => void;
  endShift: (endKm: number, notes?: string) => Shift;
  elapsedShiftSeconds: number; // Total corrido
  elapsedWorkSeconds: number; // Efetivamente trabalhado
  elapsedPausedSeconds: number; // Pausado

  // Profile & Settings
  userProfile: UserProfile;
  updateUserProfile: (updates: Partial<UserProfile>) => void;
  depositMaintenanceReserve: (amount: number) => void;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;

  // Calculations & Summaries
  monthSummary: PeriodSummary;
  todaySummary: PeriodSummary;
  prevMonthSummary: PeriodSummary;

  // Modals & UI
  isNewTransactionModalOpen: boolean;
  modalDefaultType: TransactionType;
  openNewTransactionModal: (type?: TransactionType) => void;
  closeNewTransactionModal: () => void;

  isVehiclesModalOpen: boolean;
  openVehiclesModal: () => void;
  closeVehiclesModal: () => void;

  isMaintenanceModalOpen: boolean;
  openMaintenanceModal: () => void;
  closeMaintenanceModal: () => void;

  isSimulatorsModalOpen: boolean;
  openSimulatorsModal: () => void;
  closeSimulatorsModal: () => void;

  isAppsModalOpen: boolean;
  openAppsModal: () => void;
  closeAppsModal: () => void;

  // Feedback Toast
  toastMessage: string | null;
  showToast: (msg: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_TX_KEY = 'rota_financeira_transactions_v2';
const LOCAL_STORAGE_SHIFTS_KEY = 'rota_financeira_shifts_v2';
const LOCAL_STORAGE_PROFILE_KEY = 'rota_financeira_profile_v2';
const LOCAL_STORAGE_VEHICLES_KEY = 'rota_financeira_vehicles_v2';
const LOCAL_STORAGE_APPS_KEY = 'rota_financeira_apps_v2';
const LOCAL_STORAGE_ACTIVE_SHIFT_KEY = 'rota_financeira_active_shift_v2';

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<
    'inicio' | 'lancamentos' | 'jornada' | 'relatorios' | 'perfil'
  >('inicio');
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-09');

  // Vehicles state
  const [vehicles, setVehicles] = useState<UserVehicle[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_VEHICLES_KEY);
      if (saved) {
        const parsed: UserVehicle[] = JSON.parse(saved);
        const hasFactor = parsed.some((v) => v.model?.includes('Factor 150'));
        if (!hasFactor) {
          return INITIAL_VEHICLES;
        }
        return parsed.map((v) => {
          if (v.isActive && v.model?.includes('Factor 150') && v.currentKm < 42118) {
            return { ...v, currentKm: 42118 };
          }
          return v;
        });
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_VEHICLES;
  });

  const activeVehicle = useMemo(() => {
    return vehicles.find((v) => v.isActive) || vehicles[0] || INITIAL_VEHICLES[0];
  }, [vehicles]);

  // Registered Apps state
  const [registeredApps, setRegisteredApps] = useState<RegisteredApp[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_APPS_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_REGISTERED_APPS;
  });

  // Transactions state
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_TX_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_TRANSACTIONS;
  });

  // Shifts state
  const [shifts, setShifts] = useState<Shift[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_SHIFTS_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_SHIFTS;
  });

  // User Profile
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_PROFILE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...INITIAL_USER_PROFILE,
          ...parsed,
          rideCriteria: {
            ...INITIAL_USER_PROFILE.rideCriteria,
            ...(parsed.rideCriteria || {}),
          },
        };
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_USER_PROFILE;
  });

  // Active shift
  const [activeShift, setActiveShift] = useState<ActiveShiftState | null>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_ACTIVE_SHIFT_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return null;
  });

  // Modals
  const [isNewTransactionModalOpen, setIsNewTransactionModalOpen] = useState(false);
  const [modalDefaultType, setModalDefaultType] = useState<TransactionType>('ganho');
  const [isVehiclesModalOpen, setIsVehiclesModalOpen] = useState(false);
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
  const [isSimulatorsModalOpen, setIsSimulatorsModalOpen] = useState(false);
  const [isAppsModalOpen, setIsAppsModalOpen] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 3500);
  };

  // Local storage persistence
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_TX_KEY, JSON.stringify(transactions));
    } catch (e) {
      console.error(e);
    }
  }, [transactions]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_SHIFTS_KEY, JSON.stringify(shifts));
    } catch (e) {
      console.error(e);
    }
  }, [shifts]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(userProfile));
    } catch (e) {
      console.error(e);
    }
  }, [userProfile]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_VEHICLES_KEY, JSON.stringify(vehicles));
    } catch (e) {
      console.error(e);
    }
  }, [vehicles]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_APPS_KEY, JSON.stringify(registeredApps));
    } catch (e) {
      console.error(e);
    }
  }, [registeredApps]);

  useEffect(() => {
    try {
      if (activeShift) {
        localStorage.setItem(LOCAL_STORAGE_ACTIVE_SHIFT_KEY, JSON.stringify(activeShift));
      } else {
        localStorage.removeItem(LOCAL_STORAGE_ACTIVE_SHIFT_KEY);
      }
    } catch (e) {
      console.error(e);
    }
  }, [activeShift]);

  // Real-time ticker for shift timings
  const [elapsedShiftSeconds, setElapsedShiftSeconds] = useState(0);
  const [elapsedWorkSeconds, setElapsedWorkSeconds] = useState(0);
  const [elapsedPausedSeconds, setElapsedPausedSeconds] = useState(0);

  useEffect(() => {
    if (!activeShift) {
      setElapsedShiftSeconds(0);
      setElapsedWorkSeconds(0);
      setElapsedPausedSeconds(0);
      return;
    }

    const calculateTimes = () => {
      const now = Date.now();
      const totalSec = Math.max(0, Math.floor((now - activeShift.startEpoch) / 1000));
      let pausedSec = activeShift.totalPausedSeconds;
      if (activeShift.isPaused && activeShift.pauseStartEpoch) {
        pausedSec += Math.floor((now - activeShift.pauseStartEpoch) / 1000);
      }
      const workSec = Math.max(0, totalSec - pausedSec);

      setElapsedShiftSeconds(totalSec);
      setElapsedWorkSeconds(workSec);
      setElapsedPausedSeconds(pausedSec);
    };

    calculateTimes();
    const interval = setInterval(calculateTimes, 1000);
    return () => clearInterval(interval);
  }, [activeShift]);

  // Vehicle Actions
  const addVehicle = (vehData: Omit<UserVehicle, 'id'>) => {
    const newId = `veh-${Date.now()}`;
    const newVeh: UserVehicle = {
      ...vehData,
      id: newId,
    };
    setVehicles((prev) => {
      if (newVeh.isActive) {
        return [newVeh, ...prev.map((v) => ({ ...v, isActive: false }))];
      }
      return [newVeh, ...prev];
    });
    showToast(`Veículo "${newVeh.nickname}" cadastrado com sucesso!`);
  };

  const updateVehicle = (id: string, updates: Partial<UserVehicle>) => {
    setVehicles((prev) =>
      prev.map((v) => {
        if (v.id === id) {
          return { ...v, ...updates };
        }
        if (updates.isActive && v.id !== id) {
          return { ...v, isActive: false };
        }
        return v;
      }),
    );
    showToast('Veículo atualizado.');
  };

  const setActiveVehicleId = (id: string) => {
    setVehicles((prev) =>
      prev.map((v) => ({
        ...v,
        isActive: v.id === id,
      })),
    );
    const selected = vehicles.find((v) => v.id === id);
    showToast(`Veículo ativo alterado para "${selected?.nickname || 'veículo selecionado'}".`);
  };

  const archiveVehicle = (id: string) => {
    setVehicles((prev) =>
      prev.map((v) => (v.id === id ? { ...v, isArchived: !v.isArchived, isActive: false } : v)),
    );
    showToast('Status do veículo alterado.');
  };

  const deleteVehicle = (id: string) => {
    setVehicles((prev) => {
      const remaining = prev.filter((v) => v.id !== id);
      if (remaining.length > 0 && !remaining.some((v) => v.isActive)) {
        remaining[0].isActive = true;
      }
      return remaining;
    });
    showToast('Veículo excluído.');
  };

  // Registered Apps Actions
  const addRegisteredApp = (appData: Omit<RegisteredApp, 'id'>) => {
    const newApp: RegisteredApp = {
      ...appData,
      id: `app-${Date.now()}`,
    };
    setRegisteredApps((prev) => [...prev, newApp]);
    showToast(`Aplicativo "${newApp.name}" cadastrado!`);
  };

  const updateRegisteredApp = (id: string, updates: Partial<RegisteredApp>) => {
    setRegisteredApps((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));
    showToast('Aplicativo atualizado.');
  };

  const toggleRegisteredApp = (id: string) => {
    setRegisteredApps((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isActive: !a.isActive } : a)),
    );
  };

  const deleteRegisteredApp = (id: string) => {
    setRegisteredApps((prev) => prev.filter((a) => a.id !== id));
    showToast('Aplicativo removido.');
  };

  // Shift Actions
  const startShift = (vehicleId: string, startKm: number, activeApps: string[], notes?: string) => {
    const currentVeh = vehicles.find((v) => v.id === vehicleId) || activeVehicle;
    if (startKm < currentVeh.currentKm) {
      showToast(
        `A quilometragem inicial não pode ser inferior à atual (${currentVeh.currentKm.toLocaleString('pt-BR')} km).`,
      );
      return;
    }

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    const dateStr = now.toISOString().split('T')[0];

    // If start km is higher than current odometer, update vehicle
    if (startKm > currentVeh.currentKm) {
      updateVehicle(currentVeh.id, { currentKm: startKm });
    }

    const newShiftState: ActiveShiftState = {
      isActive: true,
      isPaused: false,
      shiftId: `shift-${Date.now()}`,
      vehicleId: currentVeh.id,
      vehicleName: currentVeh.nickname,
      date: dateStr,
      startTime: timeStr,
      startEpoch: Date.now(),
      startKm,
      currentKm: startKm,
      totalPausedSeconds: 0,
      accumulatedGain: 0,
      accumulatedExpense: 0,
      activeApps,
      notes,
    };

    setActiveShift(newShiftState);
    showToast('Jornada iniciada! Bom trabalho e dirija com segurança.');
  };

  const pauseShift = () => {
    if (!activeShift || activeShift.isPaused) return;
    setActiveShift({
      ...activeShift,
      isPaused: true,
      pauseStartEpoch: Date.now(),
    });
    showToast('Jornada pausada. Cronômetro de trabalho congelado.');
  };

  const resumeShift = () => {
    if (!activeShift || !activeShift.isPaused) return;
    const additionalPaused = activeShift.pauseStartEpoch
      ? Math.floor((Date.now() - activeShift.pauseStartEpoch) / 1000)
      : 0;

    setActiveShift({
      ...activeShift,
      isPaused: false,
      pauseStartEpoch: undefined,
      totalPausedSeconds: activeShift.totalPausedSeconds + additionalPaused,
    });
    showToast('Jornada retomada!');
  };

  const endShift = (endKm: number, notes?: string): Shift => {
    if (!activeShift) {
      throw new Error('Nenhuma jornada ativa');
    }

    if (endKm < activeShift.startKm) {
      showToast(
        `A quilometragem final não pode ser menor que a inicial (${activeShift.startKm.toLocaleString('pt-BR')} km).`,
      );
      throw new Error(
        `A quilometragem final não pode ser menor que a inicial (${activeShift.startKm.toLocaleString('pt-BR')} km).`,
      );
    }

    const now = new Date();
    const endTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    // Total elapsed hours
    const totalElapsedHours = Math.max(0.05, Number((elapsedShiftSeconds / 3600).toFixed(2)));
    // Total worked hours (elapsed - pause)
    const totalWorkHours = Math.max(0.05, Number((elapsedWorkSeconds / 3600).toFixed(2)));
    const totalPauseMinutes = Math.round(elapsedPausedSeconds / 60);
    const totalKm = Math.max(0, endKm - activeShift.startKm);

    // Update vehicle km if greater
    const currentVeh = vehicles.find((v) => v.id === activeShift.vehicleId) || activeVehicle;
    if (endKm > (currentVeh.currentKm || 0)) {
      updateVehicle(activeShift.vehicleId, { currentKm: endKm });
    }

    const completedShift: Shift = {
      id: activeShift.shiftId,
      vehicleId: activeShift.vehicleId,
      vehicleName: activeShift.vehicleName,
      date: activeShift.date,
      startTime: activeShift.startTime.slice(0, 5),
      endTime: endTimeStr,
      startKm: activeShift.startKm,
      endKm,
      totalKm,
      totalPauseMinutes,
      totalWorkHours,
      totalElapsedHours,
      accumulatedGain: activeShift.accumulatedGain,
      accumulatedExpense: activeShift.accumulatedExpense,
      status: 'completed',
      notes: notes || activeShift.notes,
      activeApps: activeShift.activeApps,
      pauses:
        totalPauseMinutes > 0
          ? [
              {
                id: `p-${Date.now()}`,
                startTime: '00:00',
                durationMinutes: totalPauseMinutes,
                reason: 'Pausas realizadas na jornada',
              },
            ]
          : [],
    };

    setShifts((prev) => [completedShift, ...prev]);
    setActiveShift(null);
    showToast('Jornada finalizada e gravada no histórico com sucesso!');
    return completedShift;
  };

  // Transaction Actions
  const addTransaction = (newTxData: TransactionInput) => {
    const id = `tx-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const fullTx = {
      ...newTxData,
      id,
      createdAt: Date.now(),
    } as Transaction;

    // If shift is active and tx is associated, accumulate into current shift
    if (activeShift && (!fullTx.shiftId || fullTx.shiftId === activeShift.shiftId)) {
      if (fullTx.type === 'ganho') {
        setActiveShift((prev) =>
          prev ? { ...prev, accumulatedGain: prev.accumulatedGain + fullTx.amount } : null,
        );
      } else {
        setActiveShift((prev) =>
          prev ? { ...prev, accumulatedExpense: prev.accumulatedExpense + fullTx.amount } : null,
        );
      }
    }

    // If transaction updates vehicle km, sync with vehicle
    if ('currentKm' in fullTx) {
      const txKm = Number(fullTx.currentKm);
      const targetVehId = fullTx.vehicleId || activeVehicle?.id;
      const targetVeh = vehicles.find((v) => v.id === targetVehId) || activeVehicle;
      if (targetVeh && txKm > targetVeh.currentKm) {
        updateVehicle(targetVeh.id, { currentKm: txKm });
      }
    }

    setTransactions((prev) => [fullTx, ...prev]);
    showToast(`${fullTx.type === 'ganho' ? 'Ganho' : 'Despesa'} registrado(a) com sucesso!`);
  };

  const updateTransaction = (id: string, updated: Partial<Transaction>) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? ({ ...t, ...updated } as Transaction) : t)),
    );
    showToast('Lançamento atualizado.');
  };

  const deleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    showToast('Lançamento excluído.');
  };

  const updateUserProfile = (updates: Partial<UserProfile>) => {
    setUserProfile((prev) => ({ ...prev, ...updates }));
    showToast('Perfil atualizado com sucesso.');
  };

  const depositMaintenanceReserve = (amount: number) => {
    if (amount <= 0) return;
    setUserProfile((prev) => ({
      ...prev,
      maintenanceReserveSaved: (prev.maintenanceReserveSaved || 0) + amount,
    }));
    showToast(`R$ ${amount.toFixed(2).replace('.', ',')} guardado na reserva de manutenção!`);
  };

  // Modal handlers
  const openNewTransactionModal = (type: TransactionType = 'ganho') => {
    setModalDefaultType(type);
    setIsNewTransactionModalOpen(true);
  };
  const closeNewTransactionModal = () => setIsNewTransactionModalOpen(false);

  const openVehiclesModal = () => setIsVehiclesModalOpen(true);
  const closeVehiclesModal = () => setIsVehiclesModalOpen(false);

  const openMaintenanceModal = () => setIsMaintenanceModalOpen(true);
  const closeMaintenanceModal = () => setIsMaintenanceModalOpen(false);

  const openSimulatorsModal = () => setIsSimulatorsModalOpen(true);
  const closeSimulatorsModal = () => setIsSimulatorsModalOpen(false);

  const openAppsModal = () => setIsAppsModalOpen(true);
  const closeAppsModal = () => setIsAppsModalOpen(false);

  // Month filtered data
  const monthTransactions = useMemo(() => {
    return transactions.filter((t) => t.date.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  const monthShifts = useMemo(() => {
    return shifts.filter((s) => s.date.startsWith(selectedMonth));
  }, [shifts, selectedMonth]);

  const monthSummary = useMemo(() => {
    return calculatePeriodSummary(
      monthTransactions,
      monthShifts,
      userProfile.monthlyGoal,
      userProfile.maintenanceReservePerKm || 0.12,
    );
  }, [
    monthTransactions,
    monthShifts,
    userProfile.monthlyGoal,
    userProfile.maintenanceReservePerKm,
  ]);

  // Previous month summary
  const prevMonthSummary = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevMonthStr = `${prevDate.getFullYear()}-${(prevDate.getMonth() + 1).toString().padStart(2, '0')}`;
    const prevTx = transactions.filter((t) => t.date.startsWith(prevMonthStr));
    const prevSh = shifts.filter((s) => s.date.startsWith(prevMonthStr));
    return calculatePeriodSummary(
      prevTx,
      prevSh,
      userProfile.monthlyGoal,
      userProfile.maintenanceReservePerKm || 0.12,
    );
  }, [
    transactions,
    shifts,
    selectedMonth,
    userProfile.monthlyGoal,
    userProfile.maintenanceReservePerKm,
  ]);

  // Today summary
  const todaySummary = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayTx = transactions.filter((t) => t.date === today);
    const todayShifts = shifts.filter((s) => s.date === today);
    return calculatePeriodSummary(
      todayTx,
      todayShifts,
      userProfile.monthlyGoal / 30,
      userProfile.maintenanceReservePerKm || 0.12,
    );
  }, [transactions, shifts, userProfile.monthlyGoal, userProfile.maintenanceReservePerKm]);

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        transactions,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        vehicles,
        activeVehicle,
        addVehicle,
        updateVehicle,
        setActiveVehicleId,
        archiveVehicle,
        deleteVehicle,
        registeredApps,
        addRegisteredApp,
        updateRegisteredApp,
        toggleRegisteredApp,
        deleteRegisteredApp,
        shifts,
        activeShift,
        startShift,
        pauseShift,
        resumeShift,
        endShift,
        elapsedShiftSeconds,
        elapsedWorkSeconds,
        elapsedPausedSeconds,
        userProfile,
        updateUserProfile,
        depositMaintenanceReserve,
        selectedMonth,
        setSelectedMonth,
        monthSummary,
        todaySummary,
        prevMonthSummary,
        isNewTransactionModalOpen,
        modalDefaultType,
        openNewTransactionModal,
        closeNewTransactionModal,
        isVehiclesModalOpen,
        openVehiclesModal,
        closeVehiclesModal,
        isMaintenanceModalOpen,
        openMaintenanceModal,
        closeMaintenanceModal,
        isSimulatorsModalOpen,
        openSimulatorsModal,
        closeSimulatorsModal,
        isAppsModalOpen,
        openAppsModal,
        closeAppsModal,
        toastMessage,
        showToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
