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
  MaintenanceReserveEntry,
  OdometerRecord,
  FinancialCommitment,
  FinancialCommitmentStatus,
  FinancialState,
  PayableInstallment,
  PayablesSummary,
} from '../types';
import {
  INITIAL_TRANSACTIONS,
  INITIAL_SHIFTS,
  INITIAL_USER_PROFILE,
  INITIAL_VEHICLES,
  INITIAL_REGISTERED_APPS,
} from '../data/mockData';
import {
  calculatePeriodSummary,
  calculateShiftTotals,
  calculateReserveBalance,
  reconcileVehicleOdometer,
  formatBRL,
} from '../utils/calculations';
import {
  addMonthsClamped,
  calculatePayablesSummary,
  generatePayableSchedule,
  isInstallmentPaid,
  mergeCommitmentSchedule,
  migrateFinancialState,
  reconcileFinancialState,
  removeTransactionWithFinancialReconciliation,
  reopenInstallment,
  settleInstallment,
} from '../utils/payables';

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

export type FinancialCommitmentInput = Omit<
  FinancialCommitment,
  'id' | 'status' | 'createdAt' | 'updatedAt' | 'dueDay'
> & {
  initialPaidInstallments?: number;
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

  // Financial commitments, bills and installments
  financialCommitments: FinancialCommitment[];
  payableInstallments: PayableInstallment[];
  payablesSummary: PayablesSummary;
  addFinancialCommitment: (input: FinancialCommitmentInput) => string | null;
  updateFinancialCommitment: (id: string, updates: Partial<FinancialCommitmentInput>) => boolean;
  setFinancialCommitmentStatus: (id: string, status: FinancialCommitmentStatus) => void;
  removeFinancialCommitment: (id: string) => void;
  payInstallment: (installmentId: string, amount: number, paidAt: string) => boolean;
  reopenPayableInstallment: (installmentId: string) => boolean;

  // Transaction detail/edit modal
  selectedTransaction: Transaction | null;
  openTransactionDetail: (id: string) => void;
  closeTransactionDetail: () => void;

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
  getShiftTotals: (shiftId: string) => { gain: number; expense: number };

  // Profile & Settings
  userProfile: UserProfile;
  updateUserProfile: (updates: Partial<UserProfile>) => void;
  depositMaintenanceReserve: (amount: number, description?: string) => void;
  withdrawMaintenanceReserve: (amount: number, description?: string) => boolean;
  adjustMaintenanceReserve: (amount: number, description?: string) => void;
  maintenanceReserveLedger: MaintenanceReserveEntry[];
  maintenanceReserveBalance: number;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  availableMonths: string[];
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;

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

  isReserveModalOpen: boolean;
  openReserveModal: () => void;
  closeReserveModal: () => void;

  isPayablesModalOpen: boolean;
  openPayablesModal: () => void;
  closePayablesModal: () => void;

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
const LOCAL_STORAGE_MONTH_KEY = 'rota_financeira_selected_month_v2';
const LOCAL_STORAGE_RESERVE_KEY = 'rota_financeira_reserve_ledger_v2';
const LOCAL_STORAGE_FINANCIAL_KEY = 'giro_certo_financial_state_v3';

const CANONICAL_VEHICLE_ID = 'veh-factor-150';
const LEGACY_VEHICLE_ID = 'veh-fazer-250';
const CANONICAL_VEHICLE_NAME = 'Moto do Dia a Dia';

function reconcileTransactions(list: Transaction[]): Transaction[] {
  return list.map((t) =>
    t.vehicleId === LEGACY_VEHICLE_ID ? { ...t, vehicleId: CANONICAL_VEHICLE_ID } : t,
  );
}

function reconcileShifts(list: Shift[]): Shift[] {
  return list.map((s) =>
    s.vehicleId === LEGACY_VEHICLE_ID
      ? { ...s, vehicleId: CANONICAL_VEHICLE_ID, vehicleName: CANONICAL_VEHICLE_NAME }
      : s,
  );
}

function reconcileActiveShift(state: ActiveShiftState): ActiveShiftState {
  if (state.vehicleId === LEGACY_VEHICLE_ID) {
    return { ...state, vehicleId: CANONICAL_VEHICLE_ID, vehicleName: CANONICAL_VEHICLE_NAME };
  }
  return state;
}

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<
    'inicio' | 'lancamentos' | 'jornada' | 'relatorios' | 'perfil'
  >('inicio');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_MONTH_KEY);
      if (saved && /^\d{4}-\d{2}$/.test(saved)) return saved;
    } catch (e) {
      console.error(e);
    }
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  });

  // Vehicles state
  const [vehicles, setVehicles] = useState<UserVehicle[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_VEHICLES_KEY);
      if (saved) {
        const parsed: UserVehicle[] = JSON.parse(saved);
        const hasFactor = parsed.some((v) => v.model?.includes('Factor 150'));
        if (!hasFactor) {
          return INITIAL_VEHICLES.map((v) => ({
            ...v,
            odometerBaselineKm: v.odometerBaselineKm ?? v.currentKm,
          }));
        }
        return parsed.map((v) => {
          const baseline = v.odometerBaselineKm ?? v.currentKm;
          const base: UserVehicle = {
            ...v,
            odometerBaselineKm: baseline,
          };
          if (base.isActive && base.model?.includes('Factor 150') && base.currentKm < 42118) {
            return {
              ...base,
              currentKm: 42118,
              odometerBaselineKm: Math.max(baseline, 42118),
            };
          }
          return base;
        });
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_VEHICLES.map((v) => ({
      ...v,
      odometerBaselineKm: v.odometerBaselineKm ?? v.currentKm,
    }));
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
      if (saved) return reconcileTransactions(JSON.parse(saved));
    } catch (e) {
      console.error(e);
    }
    return INITIAL_TRANSACTIONS;
  });

  const [financialState, setFinancialState] = useState<FinancialState>(() => {
    try {
      return migrateFinancialState(localStorage.getItem(LOCAL_STORAGE_FINANCIAL_KEY));
    } catch (e) {
      console.error(e);
      return migrateFinancialState(null);
    }
  });

  const financialCommitments = financialState.commitments;
  const payableInstallments = financialState.installments;

  // Shifts state
  const [shifts, setShifts] = useState<Shift[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_SHIFTS_KEY);
      if (saved) return reconcileShifts(JSON.parse(saved));
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
      if (saved) {
        const parsed: ActiveShiftState = JSON.parse(saved);
        return reconcileActiveShift(parsed);
      }
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
  const [isReserveModalOpen, setIsReserveModalOpen] = useState(false);
  const [isPayablesModalOpen, setIsPayablesModalOpen] = useState(false);

  // Transaction detail modal
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const selectedTransaction = useMemo(
    () => transactions.find((t) => t.id === selectedTransactionId) || null,
    [transactions, selectedTransactionId],
  );

  // Cofrinho de manutenção: ledger (Fase 2)
  const [maintenanceReserveLedger, setMaintenanceReserveLedger] = useState<
    MaintenanceReserveEntry[]
  >(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_RESERVE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    // Migração idempotente do valor escalar legado (profile.maintenanceReserveSaved)
    try {
      const savedProfile = localStorage.getItem(LOCAL_STORAGE_PROFILE_KEY);
      const parsedProfile = savedProfile ? JSON.parse(savedProfile) : null;
      const legacy = Number(parsedProfile?.maintenanceReserveSaved) || 0;
      const initial =
        legacy > 0 ? legacy : Number(INITIAL_USER_PROFILE.maintenanceReserveSaved) || 0;
      if (initial > 0) {
        return [
          {
            id: `reserve-migrated`,
            type: 'deposito' as const,
            amount: Math.round(initial * 100) / 100,
            date: new Date().toISOString().split('T')[0],
            description: 'Saldo inicial migrado do perfil',
            createdAt: Date.now(),
          },
        ];
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const maintenanceReserveBalance = useMemo(() => {
    if (maintenanceReserveLedger.length > 0) {
      return calculateReserveBalance(maintenanceReserveLedger);
    }
    return Math.round(Number(userProfile.maintenanceReserveSaved || 0) * 100) / 100;
  }, [maintenanceReserveLedger, userProfile.maintenanceReserveSaved]);

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

  useEffect(() => {
    try {
      if (selectedMonth && /^\d{4}-\d{2}$/.test(selectedMonth)) {
        localStorage.setItem(LOCAL_STORAGE_MONTH_KEY, selectedMonth);
      }
    } catch (e) {
      console.error(e);
    }
  }, [selectedMonth]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_RESERVE_KEY, JSON.stringify(maintenanceReserveLedger));
    } catch (e) {
      console.error(e);
    }
  }, [maintenanceReserveLedger]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_FINANCIAL_KEY, JSON.stringify(financialState));
    } catch (e) {
      console.error(e);
    }
  }, [financialState]);

  useEffect(() => {
    setFinancialState((previous) => {
      const reconciled = reconcileFinancialState(previous, transactions);
      return JSON.stringify(reconciled) === JSON.stringify(previous) ? previous : reconciled;
    });
  }, [transactions]);

  useEffect(() => {
    const throughMonth = addMonthsClamped(`${selectedMonth}-01`, 12).slice(0, 7);
    setFinancialState((previous) => {
      const knownIds = new Set(previous.installments.map((installment) => installment.id));
      const missing = previous.commitments
        .filter((commitment) => commitment.type === 'conta_recorrente')
        .flatMap((commitment) => generatePayableSchedule(commitment, throughMonth))
        .filter((installment) => !knownIds.has(installment.id));
      if (missing.length === 0) return previous;
      return reconcileFinancialState(
        { ...previous, installments: [...previous.installments, ...missing] },
        transactions,
      );
    });
  }, [selectedMonth, transactions]);

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
      odometerBaselineKm: vehData.currentKm,
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
          // Leitura manual do odômetro também eleva o piso de reconciliação (nunca regride)
          const raisedKm = typeof updates.currentKm === 'number' && updates.currentKm > v.currentKm;
          return {
            ...v,
            ...updates,
            odometerBaselineKm: raisedKm
              ? Math.max(v.odometerBaselineKm ?? v.currentKm, updates.currentKm as number)
              : v.odometerBaselineKm,
          };
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

    const shiftedTxs = transactions.filter((t) => t.shiftId === activeShift.shiftId);
    const accumulatedGain = shiftedTxs
      .filter((t) => t.type === 'ganho')
      .reduce((sum, t) => sum + t.amount, 0);
    const accumulatedExpense = shiftedTxs
      .filter((t) => t.type !== 'ganho')
      .reduce((sum, t) => sum + t.amount, 0);

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
      accumulatedGain,
      accumulatedExpense,
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
    const nextTransactions = transactions.map((transaction) =>
      transaction.id === id
        ? ({ ...transaction, ...updated, id, updatedAt: Date.now() } as Transaction)
        : transaction,
    );
    setTransactions(nextTransactions);
    setFinancialState((previous) => reconcileFinancialState(previous, nextTransactions));
    showToast('Lançamento atualizado.');
  };

  const deleteTransaction = (id: string) => {
    const result = removeTransactionWithFinancialReconciliation(financialState, transactions, id);
    setTransactions(result.transactions);
    setFinancialState(result.financialState);
    if (selectedTransactionId === id) setSelectedTransactionId(null);
    showToast(
      result.financialState.installments.some(
        (installment) =>
          installment.id === transactions.find((t) => t.id === id)?.payableInstallmentId,
      )
        ? 'Lançamento excluído e parcela reaberta.'
        : 'Lançamento excluído.',
    );
  };

  // Transaction detail modal
  const openTransactionDetail = (id: string) => setSelectedTransactionId(id);
  const closeTransactionDetail = () => setSelectedTransactionId(null);

  const addFinancialCommitment = (input: FinancialCommitmentInput): string | null => {
    const installmentAmount = Math.round((Number(input.installmentAmount) || 0) * 100) / 100;
    const dueParts = input.firstDueDate.split('-').map(Number);
    if (!input.title.trim() || installmentAmount <= 0 || dueParts.length !== 3 || !dueParts[2]) {
      showToast('Preencha nome, valor e primeiro vencimento da conta.');
      return null;
    }

    const now = Date.now();
    const id = `payable-${now}-${Math.random().toString(36).slice(2, 7)}`;
    const isRecurring = input.type === 'conta_recorrente';
    const isSingle = input.type === 'conta_unica';
    const commitment: FinancialCommitment = {
      id,
      title: input.title.trim(),
      type: input.type,
      category: input.category,
      creditor: input.creditor?.trim() || undefined,
      vehicleId: input.vehicleId,
      installmentAmount,
      totalInstallments: isRecurring
        ? undefined
        : isSingle
          ? 1
          : Math.max(1, Math.floor(input.totalInstallments || 1)),
      firstDueDate: input.firstDueDate,
      dueDay: dueParts[2],
      endDate: isRecurring ? input.endDate : undefined,
      notes: input.notes?.trim() || undefined,
      status: 'ativo',
      createdAt: now,
    };
    const throughMonth = addMonthsClamped(`${selectedMonth}-01`, 12).slice(0, 7);
    const installments = generatePayableSchedule(
      commitment,
      throughMonth,
      input.initialPaidInstallments,
      now,
    );
    setFinancialState((previous) =>
      reconcileFinancialState(
        {
          ...previous,
          commitments: [commitment, ...previous.commitments],
          installments: [...previous.installments, ...installments],
        },
        transactions,
      ),
    );
    showToast('Conta cadastrada com sucesso.');
    return id;
  };

  const updateFinancialCommitment = (
    id: string,
    updates: Partial<FinancialCommitmentInput>,
  ): boolean => {
    const current = financialCommitments.find((commitment) => commitment.id === id);
    if (!current) return false;
    const { initialPaidInstallments: ignoredInitialPaidInstallments, ...domainUpdates } = updates;
    void ignoredInitialPaidInstallments;
    const nextFirstDueDate = domainUpdates.firstDueDate ?? current.firstDueDate;
    const dueDay = Number(nextFirstDueDate.split('-')[2]) || current.dueDay;
    const nextCommitment: FinancialCommitment = {
      ...current,
      ...domainUpdates,
      title: domainUpdates.title?.trim() || current.title,
      installmentAmount:
        Math.round(
          (Number(domainUpdates.installmentAmount ?? current.installmentAmount) || 0) * 100,
        ) / 100,
      firstDueDate: nextFirstDueDate,
      dueDay,
      creditor:
        domainUpdates.creditor === undefined
          ? current.creditor
          : domainUpdates.creditor.trim() || undefined,
      notes:
        domainUpdates.notes === undefined ? current.notes : domainUpdates.notes.trim() || undefined,
      updatedAt: Date.now(),
    };
    if (nextCommitment.installmentAmount <= 0) {
      showToast('O valor da parcela precisa ser maior que zero.');
      return false;
    }

    const related = payableInstallments.filter(
      (installment) => installment.commitmentId === current.id,
    );
    const highestPaidNumber = related.reduce(
      (highest, installment) =>
        isInstallmentPaid(installment, transactions)
          ? Math.max(highest, installment.number)
          : highest,
      0,
    );
    if (
      nextCommitment.type !== 'conta_recorrente' &&
      (nextCommitment.totalInstallments || 1) < highestPaidNumber
    ) {
      showToast(`O contrato já possui a parcela ${highestPaidNumber} paga.`);
      return false;
    }

    const throughMonth = addMonthsClamped(`${selectedMonth}-01`, 12).slice(0, 7);
    const rebuilt = mergeCommitmentSchedule(nextCommitment, related, transactions, throughMonth);
    setFinancialState((previous) =>
      reconcileFinancialState(
        {
          ...previous,
          commitments: previous.commitments.map((commitment) =>
            commitment.id === id ? nextCommitment : commitment,
          ),
          installments: [
            ...previous.installments.filter((installment) => installment.commitmentId !== id),
            ...rebuilt,
          ],
        },
        transactions,
      ),
    );
    showToast('Conta atualizada. O histórico pago foi preservado.');
    return true;
  };

  const setFinancialCommitmentStatus = (id: string, status: FinancialCommitmentStatus) => {
    setFinancialState((previous) => ({
      ...previous,
      commitments: previous.commitments.map((commitment) =>
        commitment.id === id ? { ...commitment, status, updatedAt: Date.now() } : commitment,
      ),
    }));
    showToast(
      status === 'pausado'
        ? 'Conta pausada.'
        : status === 'cancelado'
          ? 'Conta cancelada. O histórico foi preservado.'
          : 'Conta reativada.',
    );
  };

  const removeFinancialCommitment = (id: string) => {
    const related = payableInstallments.filter((installment) => installment.commitmentId === id);
    const hasPayments = related.some((installment) => isInstallmentPaid(installment, transactions));
    if (hasPayments) {
      setFinancialCommitmentStatus(id, 'cancelado');
      return;
    }
    setFinancialState((previous) => ({
      ...previous,
      commitments: previous.commitments.filter((commitment) => commitment.id !== id),
      installments: previous.installments.filter((installment) => installment.commitmentId !== id),
    }));
    showToast('Conta removida.');
  };

  const payInstallment = (installmentId: string, amount: number, paidAt: string): boolean => {
    const now = new Date();
    const paidTime = `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;
    const result = settleInstallment(
      financialState,
      transactions,
      installmentId,
      amount,
      paidAt,
      paidTime,
    );
    if (!result.changed) {
      showToast('Esta parcela já foi paga ou possui dados inválidos.');
      return false;
    }
    setTransactions(result.transactions);
    setFinancialState(result.financialState);
    showToast('Pagamento registrado e despesa criada.');
    return true;
  };

  const reopenPayableInstallment = (installmentId: string): boolean => {
    const result = reopenInstallment(financialState, transactions, installmentId);
    if (!result.changed) {
      showToast('Não foi possível reabrir esta parcela.');
      return false;
    }
    setTransactions(result.transactions);
    setFinancialState(result.financialState);
    showToast('Pagamento reaberto e despesa vinculada removida.');
    return true;
  };

  const updateUserProfile = (updates: Partial<UserProfile>) => {
    setUserProfile((prev) => ({ ...prev, ...updates }));
    showToast('Perfil atualizado com sucesso.');
  };

  const depositMaintenanceReserve = (amount: number, description?: string) => {
    const amt = Math.round((Number(amount) || 0) * 100) / 100;
    if (amt <= 0) {
      showToast('Informe um valor positivo para guardar.');
      return;
    }
    setMaintenanceReserveLedger((prev) => [
      ...prev,
      {
        id: `reserve-${Date.now()}`,
        type: 'deposito' as const,
        amount: amt,
        date: new Date().toISOString().split('T')[0],
        description,
        createdAt: Date.now(),
      },
    ]);
    showToast(`${formatBRL(amt)} guardado na reserva de manutenção!`);
  };

  const withdrawMaintenanceReserve = (amount: number, description?: string): boolean => {
    const amt = Math.round((Number(amount) || 0) * 100) / 100;
    if (amt <= 0) {
      showToast('Informe um valor positivo para resgatar.');
      return false;
    }
    const currentBalance = maintenanceReserveBalance;
    if (amt > currentBalance) {
      showToast(`Saldo insuficiente: ${formatBRL(currentBalance)} disponível no cofrinho.`);
      return false;
    }
    setMaintenanceReserveLedger((prev) => [
      ...prev,
      {
        id: `reserve-${Date.now()}`,
        type: 'resgate' as const,
        amount: amt,
        date: new Date().toISOString().split('T')[0],
        description,
        createdAt: Date.now(),
      },
    ]);
    showToast(`${formatBRL(amt)} resgatados da reserva de manutenção.`);
    return true;
  };

  const adjustMaintenanceReserve = (amount: number, description?: string) => {
    const amt = Math.round((Number(amount) || 0) * 100) / 100;
    if (!isFinite(amt) || amt === 0) {
      showToast('Informe um ajuste diferente de zero.');
      return;
    }
    setMaintenanceReserveLedger((prev) => [
      ...prev,
      {
        id: `reserve-${Date.now()}`,
        type: 'ajuste' as const,
        amount: amt,
        date: new Date().toISOString().split('T')[0],
        description,
        createdAt: Date.now(),
      },
    ]);
    showToast(`Cofrinho de manutenção ${amt > 0 ? 'ajustado para cima' : 'ajustado para baixo'}.`);
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

  const openReserveModal = () => setIsReserveModalOpen(true);
  const closeReserveModal = () => setIsReserveModalOpen(false);

  const openPayablesModal = () => setIsPayablesModalOpen(true);
  const closePayablesModal = () => setIsPayablesModalOpen(false);

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

  const payablesSummary = useMemo(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${(now.getMonth() + 1)
      .toString()
      .padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    return calculatePayablesSummary(
      financialCommitments,
      payableInstallments,
      transactions,
      selectedMonth,
      monthSummary.lucroDisponivel,
      today,
    );
  }, [
    financialCommitments,
    payableInstallments,
    transactions,
    selectedMonth,
    monthSummary.lucroDisponivel,
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

  // Derived shift totals (Decision 5: accumulated is always derived from linked transactions)
  const getShiftTotals = (shiftId: string): { gain: number; expense: number } => {
    return calculateShiftTotals(transactions, shiftId);
  };

  // Meses disponíveis derivados dos dados + mês atual (pt-BR, ordenados do mais novo para o mais antigo)
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    for (const t of transactions) {
      if (t.date && typeof t.date === 'string' && t.date.length >= 7) {
        months.add(t.date.slice(0, 7));
      }
    }
    for (const s of shifts) {
      if (s.date && typeof s.date === 'string' && s.date.length >= 7) {
        months.add(s.date.slice(0, 7));
      }
    }
    for (const installment of payableInstallments) {
      if (installment.referenceMonth) months.add(installment.referenceMonth);
      if (installment.paidAt && installment.paidAt.length >= 7) {
        months.add(installment.paidAt.slice(0, 7));
      }
    }
    const now = new Date();
    months.add(`${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`);
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [transactions, shifts, payableInstallments]);

  const goToPreviousMonth = () => {
    setSelectedMonth((current) => {
      const idx = availableMonths.indexOf(current);
      if (idx < 0) return current;
      const prev = availableMonths[Math.min(availableMonths.length - 1, idx + 1)];
      return prev ?? current;
    });
  };

  const goToNextMonth = () => {
    setSelectedMonth((current) => {
      const idx = availableMonths.indexOf(current);
      if (idx <= 0) return current;
      return availableMonths[idx - 1] ?? current;
    });
  };

  // Reconciliação idempotente do odômetro: maior leitura cronologicamente válida, nunca abaixo do piso inicial.
  useEffect(() => {
    setVehicles((prevVehicles) =>
      prevVehicles.map((v) => {
        const baseline = v.odometerBaselineKm ?? v.currentKm;
        const records: OdometerRecord[] = [];

        for (const t of transactions) {
          if (t.vehicleId !== v.id) continue;
          if (t.type === 'abastecimento' && typeof t.currentKm === 'number' && t.currentKm > 0) {
            records.push({
              date: t.date,
              time: t.time,
              km: t.currentKm,
              source: 'abastecimento',
              sourceId: t.id,
            });
          }
          if (t.type === 'manutencao' && typeof t.currentKm === 'number' && t.currentKm > 0) {
            records.push({
              date: t.date,
              time: t.time,
              km: t.currentKm,
              source: 'manutencao',
              sourceId: t.id,
            });
          }
        }
        for (const s of shifts) {
          if (s.vehicleId !== v.id) continue;
          if (typeof s.startKm === 'number' && s.startKm > 0) {
            records.push({
              date: s.date,
              time: s.startTime,
              km: s.startKm,
              source: 'jornada-inicio',
              sourceId: s.id,
            });
          }
          if (typeof s.endKm === 'number' && s.endKm > 0) {
            records.push({
              date: s.date,
              time: s.endTime,
              km: s.endKm,
              source: 'jornada-fim',
              sourceId: s.id,
            });
          }
        }
        if (activeShift && activeShift.vehicleId === v.id && activeShift.startKm > 0) {
          records.push({
            date: activeShift.date,
            time: activeShift.startTime,
            km: activeShift.startKm,
            source: 'jornada-ativa',
            sourceId: activeShift.shiftId,
          });
        }

        const reconciled = reconcileVehicleOdometer(records, baseline);
        const nextKm = Math.max(baseline, reconciled.currentKm);
        if (nextKm !== v.currentKm) {
          return { ...v, currentKm: nextKm };
        }
        return v;
      }),
    );
  }, [transactions, shifts, activeShift]);

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        transactions,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        financialCommitments,
        payableInstallments,
        payablesSummary,
        addFinancialCommitment,
        updateFinancialCommitment,
        setFinancialCommitmentStatus,
        removeFinancialCommitment,
        payInstallment,
        reopenPayableInstallment,
        selectedTransaction,
        openTransactionDetail,
        closeTransactionDetail,
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
        getShiftTotals,
        userProfile,
        updateUserProfile,
        depositMaintenanceReserve,
        withdrawMaintenanceReserve,
        adjustMaintenanceReserve,
        maintenanceReserveLedger,
        maintenanceReserveBalance,
        selectedMonth,
        setSelectedMonth,
        availableMonths,
        goToPreviousMonth,
        goToNextMonth,
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
        isReserveModalOpen,
        openReserveModal,
        closeReserveModal,
        isPayablesModalOpen,
        openPayablesModal,
        closePayablesModal,
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
