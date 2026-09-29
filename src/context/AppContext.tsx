import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
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
  UserSettings,
} from '../types';
import { useSession, type SessionContextValue } from './SessionContext';
import { getScopedStorageKeys } from '../repositories/storageKeys';
import {
  readAppSnapshot,
  writeAppSnapshot,
  normalizeAppSnapshot,
  snapshotFromValues,
  withReserveSeed,
  markScopeTouched,
  type AppSnapshot,
} from '../repositories/appSnapshot';
import { createOfflineQueue, OFFLINE_QUEUE_KEY } from '../lib/offlineQueue';
import {
  createCloudRepository,
  enqueueDelete,
  importLocalScopeOnce,
  mergeCloudSnapshot,
  queueSnapshotUpserts,
} from '../repositories/persistence';
import { flushQueue, supabaseGateway } from '../lib/syncEngine';
import { createUuid } from '../lib/uuid';
import { clearLocalMode } from '../lib/localMode';
import { getSupabaseClient } from '../lib/auth';
import { activePauseId } from '../repositories/mappers';
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

export type SyncStatus =
  | { state: 'idle'; error?: undefined }
  | { state: 'syncing'; error?: undefined }
  | { state: 'offline'; error?: string }
  | { state: 'error'; error?: string };

export interface SyncQueueSummary {
  pending: number;
  blocked: number;
}

interface AppContextType {
  mode: 'local' | 'cloud';
  cloudUserId: string | null;
  cloudEmail: string | null;
  syncStatus: SyncStatus;
  lastSyncedAt: number | null;
  syncQueue: SyncQueueSummary;
  ready: boolean;
  syncNow: () => Promise<void>;
  retryPendingSync: () => Promise<void>;
  signOut: () => Promise<void>;
  enableCloudMode: () => void;

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
  removeShift: (id: string) => void;
  elapsedShiftSeconds: number;
  elapsedWorkSeconds: number;
  elapsedPausedSeconds: number;
  getShiftTotals: (shiftId: string) => { gain: number; expense: number };

  // Profile & Settings
  userProfile: UserProfile;
  updateUserProfile: (updates: Partial<UserProfile>) => void;
  depositMaintenanceReserve: (amount: number, description?: string) => void;
  withdrawMaintenanceReserve: (amount: number, description?: string) => boolean;
  removeMaintenanceReserveEntry: (id: string) => void;
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
const SYNC_BATCH_SIZE = 20;
const SYNC_INTERVAL_MS = 60_000;

function syncErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return 'Não foi possível sincronizar.';
}

function useAppSession(): SessionContextValue {
  try {
    return useSession();
  } catch {
    return {
      configured: false,
      loading: false,
      session: null,
      userId: null,
      email: null,
      mode: 'local',
      signOut: async () => undefined,
    };
  }
}

function localTimeFromEpoch(epoch: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(epoch));
}

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const session = useAppSession();
  const mode = session.mode;
  const cloudUserId = mode === 'cloud' ? session.userId : null;
  const scopeId = cloudUserId ?? 'local';
  const storageKeys = useMemo(() => getScopedStorageKeys(scopeId), [scopeId]);
  const initialSnapshot = useMemo(
    () => withReserveSeed(readAppSnapshot(storageKeys, mode, cloudUserId), mode),
    [cloudUserId, mode, storageKeys],
  );

  const [activeTab, setActiveTab] = useState<
    'inicio' | 'lancamentos' | 'jornada' | 'relatorios' | 'perfil'
  >('inicio');
  const [selectedMonth, setSelectedMonthState] = useState<string>(() => initialSnapshot.selectedMonth);
  const [userSettings, setUserSettings] = useState<UserSettings>(() => initialSnapshot.settings);
  const [vehicles, setVehicles] = useState<UserVehicle[]>(() => initialSnapshot.vehicles);
  const [registeredApps, setRegisteredApps] = useState<RegisteredApp[]>(
    () => initialSnapshot.registeredApps,
  );
  const [transactions, setTransactions] = useState<Transaction[]>(() => initialSnapshot.transactions);
  const [financialState, setFinancialState] = useState<FinancialState>(
    () => initialSnapshot.financialState,
  );
  const [shifts, setShifts] = useState<Shift[]>(() => initialSnapshot.shifts);
  const [userProfile, setUserProfile] = useState<UserProfile>(() => initialSnapshot.profile);
  const [activeShift, setActiveShift] = useState<ActiveShiftState | null>(
    () => initialSnapshot.activeShift,
  );
  const [maintenanceReserveLedger, setMaintenanceReserveLedger] = useState<
    MaintenanceReserveEntry[]
  >(() => initialSnapshot.maintenanceReserve);

  const [isNewTransactionModalOpen, setIsNewTransactionModalOpen] = useState(false);
  const [modalDefaultType, setModalDefaultType] = useState<TransactionType>('ganho');
  const [isVehiclesModalOpen, setIsVehiclesModalOpen] = useState(false);
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
  const [isSimulatorsModalOpen, setIsSimulatorsModalOpen] = useState(false);
  const [isAppsModalOpen, setIsAppsModalOpen] = useState(false);
  const [isReserveModalOpen, setIsReserveModalOpen] = useState(false);
  const [isPayablesModalOpen, setIsPayablesModalOpen] = useState(false);

  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const selectedTransaction = useMemo(
    () => transactions.find((t) => t.id === selectedTransactionId) || null,
    [transactions, selectedTransactionId],
  );

  const financialCommitments = financialState.commitments;
  const payableInstallments = financialState.installments;
  const activeVehicle = useMemo<UserVehicle>(
    () => vehicles.find((vehicle) => vehicle.isActive) || vehicles[0] || initialSnapshot.vehicles[0]!,
    [initialSnapshot.vehicles, vehicles],
  );

  const queue = useMemo(
    () => createOfflineQueue(storageKeys.sync as typeof OFFLINE_QUEUE_KEY),
    [storageKeys],
  );
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const cloudRepository = useMemo(() => {
    if (mode !== 'cloud' || !cloudUserId) return null;
    try {
      return createCloudRepository(cloudUserId);
    } catch {
      return null;
    }
  }, [cloudUserId, mode]);

  const [hydratedScope, setHydratedScope] = useState(scopeId);
  const [initialSyncComplete, setInitialSyncComplete] = useState(mode === 'local');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() =>
    mode === 'cloud' ? { state: 'syncing' } : { state: 'idle' },
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [syncQueue, setSyncQueue] = useState<SyncQueueSummary>({ pending: 0, blocked: 0 });
  const [mutationRevision, setMutationRevision] = useState(0);
  const mutationRevisionRef = useRef(0);
  const lastSyncedMutationRef = useRef(0);
  const lastQueuedMutationRef = useRef(0);
  const scopeVersionRef = useRef(0);
  const activeScopeVersionRef = useRef(0);
  const scopeHydratedRef = useRef(mode === 'local');
  const initialSyncCompleteRef = useRef(mode === 'local');
  const syncInFlightRef = useRef<Promise<void> | null>(null);
  const snapshotRef = useRef<AppSnapshot>(initialSnapshot);

  const markMutation = useCallback(() => {
    const nextRevision = mutationRevisionRef.current + 1;
    mutationRevisionRef.current = nextRevision;
    setMutationRevision(nextRevision);
    markScopeTouched(storageKeys);
  }, [storageKeys]);

  const applySnapshot = useCallback(
    (nextSnapshot: AppSnapshot) => {
      const normalized = normalizeAppSnapshot(nextSnapshot, cloudUserId);
      const nextSettings = {
        ...normalized.settings,
        selectedMonth: normalized.selectedMonth,
      };
      setSelectedMonthState(normalized.selectedMonth);
      setUserSettings(nextSettings);
      setVehicles(normalized.vehicles);
      setRegisteredApps(normalized.registeredApps);
      setTransactions(normalized.transactions);
      setFinancialState(normalized.financialState);
      setShifts(normalized.shifts);
      setUserProfile(normalized.profile);
      setActiveShift(normalized.activeShift);
      setMaintenanceReserveLedger(normalized.maintenanceReserve);
      setSelectedTransactionId(null);
      snapshotRef.current = normalized;
    },
    [cloudUserId],
  );

  const enqueueCloudDelete = useCallback(
    (table: Parameters<typeof enqueueDelete>[1], id: string) => {
      if (mode === 'cloud' && cloudUserId) enqueueDelete(queueRef.current, table, id);
    },
    [cloudUserId, mode],
  );

  useEffect(() => {
    const version = scopeVersionRef.current + 1;
    scopeVersionRef.current = version;
    activeScopeVersionRef.current = version;
    scopeHydratedRef.current = false;
    let cancelled = false;
    const cache = withReserveSeed(readAppSnapshot(storageKeys, mode, cloudUserId), mode);
    if (cancelled) return;
    applySnapshot(cache);
    scopeHydratedRef.current = true;
    setHydratedScope(scopeId);
    initialSyncCompleteRef.current = mode === 'local';
    setInitialSyncComplete(mode === 'local');
    mutationRevisionRef.current = 0;
    setMutationRevision(0);
    lastSyncedMutationRef.current = 0;
    lastQueuedMutationRef.current = 0;
    setLastSyncedAt(null);
    setSyncQueue({ pending: 0, blocked: 0 });
    setSyncStatus(mode === 'cloud' ? { state: 'syncing' } : { state: 'idle' });
    return () => {
      cancelled = true;
    };
  }, [applySnapshot, cloudUserId, mode, scopeId, storageKeys]);

  const currentSnapshot = useMemo<AppSnapshot>(
    () =>
      snapshotFromValues({
        profile: userProfile,
        vehicles,
        registeredApps,
        transactions,
        shifts,
        activeShift,
        maintenanceReserve: maintenanceReserveLedger,
        financialState,
        selectedMonth,
        settings: { ...userSettings, selectedMonth },
      }),
    [
      activeShift,
      financialState,
      maintenanceReserveLedger,
      registeredApps,
      selectedMonth,
      shifts,
      transactions,
      userProfile,
      userSettings,
      vehicles,
    ],
  );
  snapshotRef.current = currentSnapshot;

  useEffect(() => {
    if (
      mode !== 'cloud' ||
      !cloudUserId ||
      !scopeHydratedRef.current ||
      !initialSyncComplete ||
      mutationRevision === 0 ||
      mutationRevision === lastQueuedMutationRef.current
    ) {
      return;
    }
    queueSnapshotUpserts(currentSnapshot, queue, cloudUserId);
    lastQueuedMutationRef.current = mutationRevision;
  }, [cloudUserId, currentSnapshot, initialSyncComplete, mode, mutationRevision, queue]);

  const setSelectedMonth = useCallback(
    (month: string) => {
      if (month === selectedMonth) return;
      setSelectedMonthState(month);
      setUserSettings((previous) => ({
        ...previous,
        selectedMonth: month,
        updatedAt: Date.now(),
      }));
      markMutation();
    },
    [markMutation, selectedMonth],
  );

  const syncNow = useCallback(async (): Promise<void> => {
    if (mode !== 'cloud' || !cloudUserId || !scopeHydratedRef.current) return;
    if (syncInFlightRef.current) {
      await syncInFlightRef.current;
      return;
    }

    const version = activeScopeVersionRef.current;
    const run = async (): Promise<void> => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        if (version === activeScopeVersionRef.current) {
          const stats = queueRef.current.stats();
          setSyncQueue({ pending: stats.pending, blocked: stats.blocked });
          setSyncStatus({ state: 'offline' });
        }
        return;
      }
      if (!cloudRepository) {
        if (version === activeScopeVersionRef.current) {
          setSyncStatus({ state: 'error', error: 'Supabase não está configurado.' });
        }
        return;
      }
      if (version === activeScopeVersionRef.current) setSyncStatus({ state: 'syncing' });

      const queue = queueRef.current;
      let failed = 0;
      try {
        if (!initialSyncCompleteRef.current) {
          if (mutationRevisionRef.current > 0) {
            queueSnapshotUpserts(snapshotRef.current, queue, cloudUserId);
            lastQueuedMutationRef.current = mutationRevisionRef.current;
          }
          const cloud = await cloudRepository.pull();
          if (version !== activeScopeVersionRef.current) return;
          const merged = mergeCloudSnapshot(snapshotRef.current, cloud, queue, cloudUserId);
          applySnapshot(merged);
          snapshotRef.current = merged;
          writeAppSnapshot(storageKeys, merged);
          initialSyncCompleteRef.current = true;
          if (version === activeScopeVersionRef.current) setInitialSyncComplete(true);
          if (mutationRevisionRef.current > 0) {
            queueSnapshotUpserts(merged, queue, cloudUserId);
            lastQueuedMutationRef.current = mutationRevisionRef.current;
          }
        }

        while (true) {
          const result = await flushQueue(queue, supabaseGateway(), SYNC_BATCH_SIZE);
          failed += result.failed;
          if (result.flushed === 0) break;
        }

        if (version !== activeScopeVersionRef.current) return;
        const cloud = await cloudRepository.pull();
        if (version !== activeScopeVersionRef.current) return;

        // Migração local → conta depois do primeiro pull: a marca de conclusão
        // pode ter vindo de outro dispositivo da mesma conta.
        const localScopeKeys = getScopedStorageKeys('local');
        let importedLocal = false;
        if (!cloud.settings.localImportCompletedAt) {
          const outcome = importLocalScopeOnce(localScopeKeys, cloud, queue, cloudUserId);
          importedLocal = !outcome.alreadyImported;
          const stamped: AppSnapshot = {
            ...snapshotRef.current,
            settings: {
              ...snapshotRef.current.settings,
              localImportCompletedAt: new Date(outcome.completedAt).toISOString(),
              updatedAt: Math.max(snapshotRef.current.settings.updatedAt ?? 0, outcome.completedAt),
            },
          };
          snapshotRef.current = stamped;
          applySnapshot(stamped);
          writeAppSnapshot(storageKeys, stamped);
          // A marca foi enfileirada junto com os dados, então o drain precisa
          // acontecer mesmo sem dado local: é ela que fecha a migração.
          while (true) {
            const result = await flushQueue(queue, supabaseGateway(), SYNC_BATCH_SIZE);
            failed += result.failed;
            if (result.flushed === 0) break;
          }
          if (version !== activeScopeVersionRef.current) return;
        }

        // O pull anterior ao import não enxerga as linhas subidas agora, então
        // a re-leitura é obrigatória para o merge final.
        const finalCloud = importedLocal ? await cloudRepository.pull() : cloud;
        if (version !== activeScopeVersionRef.current) return;
        const merged = mergeCloudSnapshot(snapshotRef.current, finalCloud, queue, cloudUserId);
        const stats = queue.stats();
        if (failed === 0 && stats.blocked === 0) {
          lastSyncedMutationRef.current = mutationRevisionRef.current;
        }
        applySnapshot(merged);
        snapshotRef.current = merged;
        writeAppSnapshot(storageKeys, merged);
        if (version !== activeScopeVersionRef.current) return;
        if (version === activeScopeVersionRef.current) {
          setSyncQueue({ pending: stats.pending, blocked: stats.blocked });
        }
        if (failed === 0 && stats.blocked === 0) {
          setLastSyncedAt(Date.now());
          setSyncStatus({ state: 'idle' });
        } else {
          setSyncStatus({
            state: 'error',
            error: stats.blocked
              ? 'Algumas alterações não puderam ser enviadas.'
              : 'A fila contém operações pendentes.',
          });
        }
      } catch (error) {
        if (version !== activeScopeVersionRef.current) return;
        writeAppSnapshot(storageKeys, snapshotRef.current);
        const stats = queue.stats();
        if (version === activeScopeVersionRef.current) {
          setSyncQueue({ pending: stats.pending, blocked: stats.blocked });
        }
        const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
        setSyncStatus({
          state: offline ? 'offline' : 'error',
          error: syncErrorMessage(error),
        });
      }
    };

    const promise = run();
    syncInFlightRef.current = promise;
    try {
      await promise;
    } finally {
      if (syncInFlightRef.current === promise) syncInFlightRef.current = null;
    }
  }, [applySnapshot, cloudRepository, cloudUserId, mode, storageKeys]);

  useEffect(() => {
    if (hydratedScope !== scopeId || !scopeHydratedRef.current) return;
    if (mode === 'cloud' && !initialSyncComplete) return;
    writeAppSnapshot(storageKeys, currentSnapshot);
  }, [currentSnapshot, hydratedScope, initialSyncComplete, mode, scopeId, storageKeys]);

  useEffect(() => {
    if (mode !== 'cloud' || !cloudUserId || hydratedScope !== scopeId) return;
    void syncNow();
  }, [cloudUserId, hydratedScope, mode, scopeId, syncNow]);

  useEffect(() => {
    if (mode !== 'cloud') return;
    const handleOnline = () => {
      void syncNow();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [mode, syncNow]);

  const retryPendingSync = useCallback(async (): Promise<void> => {
    if (mode !== 'cloud') return;
    queueRef.current.retryBlocked();
    setSyncQueue(queueRef.current.stats());
    await syncNow();
  }, [mode, syncNow]);

  const signOut = useCallback(async (): Promise<void> => {
    if (mode === 'cloud') await syncNow();
    await session.signOut();
  }, [mode, session, syncNow]);

  const enableCloudMode = useCallback(() => {
    clearLocalMode();
    window.location.reload();
  }, []);

  useEffect(() => {
    if (mode !== 'cloud' || !cloudUserId) return;
    const interval = window.setInterval(() => {
      void syncNow();
    }, SYNC_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [cloudUserId, mode, syncNow]);

  // O intervalo acima só roda a cada 60s: uma mudança deauthentication por
  // token expirado pode parar de atualizar a fila sem ninguém perceber.
  useEffect(() => {
    if (mode !== 'cloud') return;
    const client = getSupabaseClient();
    if (!client) return;
    const { data } = client.auth.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') void syncNow();
    });
    return () => {
      void data.subscription.unsubscribe();
    };
  }, [mode, syncNow]);

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

  useEffect(() => {
    setFinancialState((previous) => {
      const reconciled = reconcileFinancialState(previous, transactions);
      return JSON.stringify(reconciled) === JSON.stringify(previous) ? previous : reconciled;
    });
  }, [transactions]);

  useEffect(() => {
    const throughMonth = addMonthsClamped(`${selectedMonth}-01`, 12).slice(0, 7);
    setFinancialState((previous) => {
      const knownNumbers = new Set(
        previous.installments.map((installment) => `${installment.commitmentId}:${installment.number}`),
      );
      const missing = previous.commitments
        .filter((commitment) => commitment.type === 'conta_recorrente')
        .flatMap((commitment) => generatePayableSchedule(commitment, throughMonth))
        .filter(
          (installment) => !knownNumbers.has(`${installment.commitmentId}:${installment.number}`),
        )
        .map((installment) =>
          mode === 'cloud'
            ? { ...installment, id: createUuid(), updatedAt: installment.createdAt }
            : installment,
        );
      if (missing.length === 0) return previous;
      return reconcileFinancialState(
        { ...previous, installments: [...previous.installments, ...missing] },
        transactions,
      );
    });
  }, [mode, selectedMonth, transactions]);

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

  const newEntityId = (prefix: string): string =>
    mode === 'cloud' && cloudUserId ? createUuid() : `${prefix}-${Date.now()}`;

  const addVehicle = (vehData: Omit<UserVehicle, 'id'>) => {
    const now = Date.now();
    const newVeh: UserVehicle = {
      ...vehData,
      id: newEntityId('veh'),
      odometerBaselineKm: vehData.currentKm,
      createdAt: vehData.createdAt ?? now,
      updatedAt: now,
    };
    setVehicles((prev) => {
      if (newVeh.isActive) {
        return [
          newVeh,
          ...prev.map((vehicle) => ({ ...vehicle, isActive: false, updatedAt: now })),
        ];
      }
      return [newVeh, ...prev];
    });
    markMutation();
    showToast(`Veículo "${newVeh.nickname}" cadastrado com sucesso!`);
  };

  const updateVehicle = (id: string, updates: Partial<UserVehicle>) => {
    if (!vehicles.some((vehicle) => vehicle.id === id)) return;
    const now = Date.now();
    setVehicles((prev) =>
      prev.map((vehicle) => {
        if (vehicle.id === id) {
          const raisedKm =
            typeof updates.currentKm === 'number' && updates.currentKm > vehicle.currentKm;
          return {
            ...vehicle,
            ...updates,
            odometerBaselineKm: raisedKm
              ? Math.max(vehicle.odometerBaselineKm ?? vehicle.currentKm, updates.currentKm as number)
              : vehicle.odometerBaselineKm,
            updatedAt: now,
          };
        }
        if (updates.isActive && vehicle.id !== id) {
          return { ...vehicle, isActive: false, updatedAt: now };
        }
        return vehicle;
      }),
    );
    markMutation();
    showToast('Veículo atualizado.');
  };

  const setActiveVehicleId = (id: string) => {
    const selected = vehicles.find((vehicle) => vehicle.id === id);
    if (!selected) return;
    const now = Date.now();
    setVehicles((prev) =>
      prev.map((vehicle) => ({
        ...vehicle,
        isActive: vehicle.id === id,
        updatedAt: vehicle.isActive === (vehicle.id === id) ? vehicle.updatedAt : now,
      })),
    );
    markMutation();
    showToast(`Veículo ativo alterado para "${selected.nickname}".`);
  };

  const archiveVehicle = (id: string) => {
    if (!vehicles.some((vehicle) => vehicle.id === id)) return;
    const now = Date.now();
    setVehicles((prev) =>
      prev.map((vehicle) =>
        vehicle.id === id
          ? { ...vehicle, isArchived: !vehicle.isArchived, isActive: false, updatedAt: now }
          : vehicle,
      ),
    );
    markMutation();
    showToast('Status do veículo alterado.');
  };

  const deleteVehicle = (id: string) => {
    if (!vehicles.some((vehicle) => vehicle.id === id)) return;
    enqueueCloudDelete('vehicles', id);
    const now = Date.now();
    setVehicles((prev) => {
      const remaining = prev
        .filter((vehicle) => vehicle.id !== id)
        .map((vehicle) => ({ ...vehicle }));
      if (remaining.length > 0 && !remaining.some((vehicle) => vehicle.isActive) && remaining[0]) {
        remaining[0] = { ...remaining[0], isActive: true, updatedAt: now };
      }
      return remaining;
    });
    markMutation();
    showToast('Veículo excluído.');
  };

  const addRegisteredApp = (appData: Omit<RegisteredApp, 'id'>) => {
    const now = Date.now();
    const newApp: RegisteredApp = {
      ...appData,
      id: newEntityId('app'),
      createdAt: appData.createdAt ?? now,
      updatedAt: now,
    };
    setRegisteredApps((prev) => [...prev, newApp]);
    markMutation();
    showToast(`Aplicativo "${newApp.name}" cadastrado!`);
  };

  const updateRegisteredApp = (id: string, updates: Partial<RegisteredApp>) => {
    if (!registeredApps.some((app) => app.id === id)) return;
    const now = Date.now();
    setRegisteredApps((prev) =>
      prev.map((app) => (app.id === id ? { ...app, ...updates, updatedAt: now } : app)),
    );
    markMutation();
    showToast('Aplicativo atualizado.');
  };

  const toggleRegisteredApp = (id: string) => {
    if (!registeredApps.some((app) => app.id === id)) return;
    const now = Date.now();
    setRegisteredApps((prev) =>
      prev.map((app) => (app.id === id ? { ...app, isActive: !app.isActive, updatedAt: now } : app)),
    );
    markMutation();
  };

  const deleteRegisteredApp = (id: string) => {
    if (!registeredApps.some((app) => app.id === id)) return;
    enqueueCloudDelete('registered_apps', id);
    setRegisteredApps((prev) => prev.filter((app) => app.id !== id));
    markMutation();
    showToast('Aplicativo removido.');
  };

  const startShift = (vehicleId: string, startKm: number, activeApps: string[], notes?: string) => {
    const currentVeh = vehicles.find((vehicle) => vehicle.id === vehicleId) || activeVehicle;
    if (startKm < currentVeh.currentKm) {
      showToast(
        `A quilometragem inicial não pode ser inferior à atual (${currentVeh.currentKm.toLocaleString('pt-BR')} km).`,
      );
      return;
    }

    const now = new Date();
    const nowEpoch = now.getTime();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    const dateStr = now.toISOString().split('T')[0];

    if (startKm > currentVeh.currentKm) {
      updateVehicle(currentVeh.id, { currentKm: startKm });
    }

    const newShiftState: ActiveShiftState = {
      isActive: true,
      isPaused: false,
      shiftId: newEntityId('shift'),
      vehicleId: currentVeh.id,
      vehicleName: currentVeh.nickname,
      date: dateStr,
      startTime: timeStr,
      startEpoch: nowEpoch,
      startKm,
      currentKm: startKm,
      totalPausedSeconds: 0,
      accumulatedGain: 0,
      accumulatedExpense: 0,
      activeApps,
      notes,
      createdAt: nowEpoch,
      updatedAt: nowEpoch,
    };

    setActiveShift(newShiftState);
    markMutation();
    showToast('Jornada iniciada! Bom trabalho e dirija com segurança.');
  };

  const pauseShift = () => {
    if (!activeShift || activeShift.isPaused) return;
    const now = Date.now();
    const pauseId =
      activeShift.pauseId ?? (cloudUserId ? activePauseId(activeShift.shiftId, cloudUserId) : undefined);
    setActiveShift({
      ...activeShift,
      isPaused: true,
      pauseStartEpoch: now,
      pauseId,
      updatedAt: now,
    });
    markMutation();
    showToast('Jornada pausada. Cronômetro de trabalho congelado.');
  };

  const resumeShift = () => {
    if (!activeShift || (!activeShift.isPaused && !activeShift.pauseId)) return;
    const now = Date.now();
    const pauseId =
      activeShift.pauseId ?? (cloudUserId ? activePauseId(activeShift.shiftId, cloudUserId) : undefined);
    if (pauseId) enqueueCloudDelete('shift_pauses', pauseId);
    const additionalPaused =
      activeShift.isPaused && activeShift.pauseStartEpoch
        ? Math.floor((now - activeShift.pauseStartEpoch) / 1000)
        : 0;

    setActiveShift({
      ...activeShift,
      isPaused: false,
      pauseStartEpoch: undefined,
      pauseId: undefined,
      totalPausedSeconds: activeShift.totalPausedSeconds + additionalPaused,
      updatedAt: now,
    });
    markMutation();
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
    const nowEpoch = now.getTime();
    const endTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const totalElapsedHours = Math.max(0.05, Number((elapsedShiftSeconds / 3600).toFixed(2)));
    const totalWorkHours = Math.max(0.05, Number((elapsedWorkSeconds / 3600).toFixed(2)));
    const totalPauseMinutes = Math.round(elapsedPausedSeconds / 60);
    const totalKm = Math.max(0, endKm - activeShift.startKm);

    const shiftedTxs = transactions.filter((transaction) => transaction.shiftId === activeShift.shiftId);
    const accumulatedGain = shiftedTxs
      .filter((transaction) => transaction.type === 'ganho')
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const accumulatedExpense = shiftedTxs
      .filter((transaction) => transaction.type !== 'ganho')
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    const currentVeh = vehicles.find((vehicle) => vehicle.id === activeShift.vehicleId) || activeVehicle;
    if (endKm > (currentVeh.currentKm || 0)) {
      updateVehicle(activeShift.vehicleId, { currentKm: endKm });
    }

    const openPauseId =
      activeShift.isPaused && activeShift.pauseStartEpoch !== undefined
        ? activeShift.pauseId ??
          (cloudUserId ? activePauseId(activeShift.shiftId, cloudUserId) : `p-${nowEpoch}`)
        : undefined;
    const pauses =
      totalPauseMinutes > 0
        ? [
            openPauseId
              ? {
                  id: openPauseId,
                  startTime: localTimeFromEpoch(activeShift.pauseStartEpoch as number),
                  endTime: endTimeStr,
                  durationMinutes: totalPauseMinutes,
                  reason: 'Pausa realizada na jornada',
                }
              : {
                  id: newEntityId('p'),
                  startTime: '00:00',
                  durationMinutes: totalPauseMinutes,
                  reason: 'Pausas realizadas na jornada',
                },
          ]
        : [];

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
      pauses,
      createdAt: activeShift.createdAt ?? nowEpoch,
      updatedAt: nowEpoch,
    };

    setShifts((prev) => [completedShift, ...prev]);
    setActiveShift(null);
    markMutation();
    showToast('Jornada finalizada e gravada no histórico com sucesso!');
    return completedShift;
  };

  const addTransaction = (newTxData: TransactionInput) => {
    const now = Date.now();
    const fullTx = {
      ...newTxData,
      id: newEntityId('tx'),
      createdAt: typeof newTxData.createdAt === 'number' ? newTxData.createdAt : now,
      updatedAt: now,
    } as Transaction;

    if ('currentKm' in fullTx) {
      const txKm = Number(fullTx.currentKm);
      const targetVehId = fullTx.vehicleId || activeVehicle?.id;
      const targetVeh = vehicles.find((vehicle) => vehicle.id === targetVehId) || activeVehicle;
      if (targetVeh && txKm > targetVeh.currentKm) {
        updateVehicle(targetVeh.id, { currentKm: txKm });
      }
    }

    setTransactions((previous) => [fullTx, ...previous]);
    markMutation();
    showToast(`${fullTx.type === 'ganho' ? 'Ganho' : 'Despesa'} registrado(a) com sucesso!`);
  };

  const updateTransaction = (id: string, updated: Partial<Transaction>) => {
    const current = transactions.find((transaction) => transaction.id === id);
    if (!current) return;
    const nextType = updated.type ?? current.type;
    if (mode === 'cloud' && current.type !== nextType) {
      if (current.type === 'abastecimento') enqueueCloudDelete('fuel_records', current.id);
      if (current.type === 'manutencao') enqueueCloudDelete('maintenance_records', current.id);
    }
    const now = Date.now();
    const nextTransactions = transactions.map((transaction) =>
      transaction.id === id
        ? ({
            ...transaction,
            ...updated,
            id: transaction.id,
            createdAt: transaction.createdAt,
            updatedAt: now,
          } as Transaction)
        : transaction,
    );
    setTransactions(nextTransactions);
    setFinancialState((previous) => reconcileFinancialState(previous, nextTransactions));
    markMutation();
    showToast('Lançamento atualizado.');
  };

  const deleteTransaction = (id: string) => {
    const current = transactions.find((transaction) => transaction.id === id);
    if (!current) return;
    const result = removeTransactionWithFinancialReconciliation(financialState, transactions, id);
    if (!result.changed) return;
    if (mode === 'cloud') {
      enqueueCloudDelete('transactions', current.id);
      if (current.type === 'abastecimento') enqueueCloudDelete('fuel_records', current.id);
      if (current.type === 'manutencao') enqueueCloudDelete('maintenance_records', current.id);
    }
    setTransactions(result.transactions);
    setFinancialState(result.financialState);
    if (selectedTransactionId === id) setSelectedTransactionId(null);
    markMutation();
    showToast(
      result.financialState.installments.some(
        (installment) => installment.id === current.payableInstallmentId,
      )
        ? 'Lançamento excluído e parcela reaberta.'
        : 'Lançamento excluído.',
    );
  };

  // Transaction detail modal
  const openTransactionDetail = (id: string) => setSelectedTransactionId(id);
  const closeTransactionDetail = () => setSelectedTransactionId(null);

  /**
   * Exclui uma jornada concluída.
   *
   * A reserva sugerida é a soma dos km das jornadas concluídas, então remover a
   * jornada precisa remover a quilometragem junto. As pausas vão por cascata e
   * os lançamentos vinculados são apenas desvinculados, nunca apagados: o
   * motorista continua tendo o ganho que registrou.
   */
  const removeShift = (id: string) => {
    const current = shifts.find((shift) => shift.id === id);
    if (!current) return;
    if (activeShift?.shiftId === id) {
      showToast('Finalize a jornada antes de excluir.');
      return;
    }
    if (mode === 'cloud') {
      for (const pause of current.pauses) enqueueCloudDelete('shift_pauses', pause.id);
      enqueueCloudDelete('shifts', current.id);
    }
    setShifts((previous) => previous.filter((shift) => shift.id !== id));
    setTransactions((previous) =>
      previous.map((transaction) =>
        transaction.shiftId === id ? { ...transaction, shiftId: undefined } : transaction,
      ),
    );
    markMutation();
    showToast('Jornada excluída e reserva recalculada.');
  };

  const addFinancialCommitment = (input: FinancialCommitmentInput): string | null => {
    const installmentAmount = Math.round((Number(input.installmentAmount) || 0) * 100) / 100;
    const dueParts = input.firstDueDate.split('-').map(Number);
    if (!input.title.trim() || installmentAmount <= 0 || dueParts.length !== 3 || !dueParts[2]) {
      showToast('Preencha nome, valor e primeiro vencimento da conta.');
      return null;
    }

    const now = Date.now();
    const id = newEntityId('payable');
    const isRecurring = input.type === 'conta_recorrente';
    const isSingle = input.type === 'conta_unica';
    if (isRecurring && input.endDate && input.endDate < input.firstDueDate) {
      showToast('A data final não pode ser anterior ao primeiro vencimento.');
      return null;
    }
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
      updatedAt: now,
    };
    const throughMonth = addMonthsClamped(`${selectedMonth}-01`, 12).slice(0, 7);
    const generatedInstallments = generatePayableSchedule(
      commitment,
      throughMonth,
      input.initialPaidInstallments,
      now,
    );
    const installments =
      mode === 'cloud'
        ? generatedInstallments.map((installment) => ({
            ...installment,
            id: createUuid(),
            updatedAt: now,
          }))
        : generatedInstallments;
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
    markMutation();
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
    const nextEndDate =
      domainUpdates.endDate === undefined ? current.endDate : domainUpdates.endDate;
    if (
      (domainUpdates.type ?? current.type) === 'conta_recorrente' &&
      nextEndDate &&
      nextEndDate < nextFirstDueDate
    ) {
      showToast('A data final não pode ser anterior ao primeiro vencimento.');
      return false;
    }
    const now = Date.now();
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
      endDate:
        (domainUpdates.type ?? current.type) === 'conta_recorrente' ? nextEndDate : undefined,
      creditor:
        domainUpdates.creditor === undefined
          ? current.creditor
          : domainUpdates.creditor.trim() || undefined,
      notes:
        domainUpdates.notes === undefined ? current.notes : domainUpdates.notes.trim() || undefined,
      createdAt: current.createdAt,
      updatedAt: now,
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
    const rebuiltBase = mergeCommitmentSchedule(
      nextCommitment,
      related,
      transactions,
      throughMonth,
      now,
    );
    const rebuilt =
      mode === 'cloud'
        ? rebuiltBase.map((installment) => {
            const existing = related.find((candidate) => candidate.id === installment.id);
            return existing
              ? {
                  ...installment,
                  id: existing.id,
                  createdAt: existing.createdAt,
                  updatedAt: existing.updatedAt ?? now,
                }
              : { ...installment, id: createUuid(), updatedAt: now };
          })
        : rebuiltBase;
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
    markMutation();
    showToast('Conta atualizada. O histórico pago foi preservado.');
    return true;
  };

  const setFinancialCommitmentStatus = (id: string, status: FinancialCommitmentStatus) => {
    const current = financialCommitments.find((commitment) => commitment.id === id);
    if (!current) return;
    const now = Date.now();
    setFinancialState((previous) => ({
      ...previous,
      commitments: previous.commitments.map((commitment) =>
        commitment.id === id
          ? { ...commitment, status, createdAt: commitment.createdAt, updatedAt: now }
          : commitment,
      ),
    }));
    if (current.status !== status) markMutation();
    showToast(
      status === 'pausado'
        ? 'Conta pausada.'
        : status === 'cancelado'
          ? 'Conta cancelada. O histórico foi preservado.'
          : 'Conta reativada.',
    );
  };

  const removeFinancialCommitment = (id: string) => {
    const current = financialCommitments.find((commitment) => commitment.id === id);
    if (!current) return;
    const related = payableInstallments.filter((installment) => installment.commitmentId === id);
    const hasPayments = related.some((installment) => isInstallmentPaid(installment, transactions));
    if (hasPayments) {
      setFinancialCommitmentStatus(id, 'cancelado');
      return;
    }
    if (mode === 'cloud') {
      enqueueCloudDelete('commitments', current.id);
      for (const installment of related) enqueueCloudDelete('installments', installment.id);
    }
    setFinancialState((previous) => ({
      ...previous,
      commitments: previous.commitments.filter((commitment) => commitment.id !== id),
      installments: previous.installments.filter((installment) => installment.commitmentId !== id),
    }));
    markMutation();
    showToast('Conta removida.');
  };

  const payInstallment = (installmentId: string, amount: number, paidAt: string): boolean => {
    const now = new Date();
    const nowEpoch = now.getTime();
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
      nowEpoch,
    );
    if (!result.changed) {
      showToast('Esta parcela já foi paga ou possui dados inválidos.');
      return false;
    }

    let nextTransactions = result.transactions;
    let nextFinancialState = result.financialState;
    if (mode === 'cloud') {
      const generatedPayment = nextTransactions.find(
        (transaction) => transaction.payableInstallmentId === installmentId,
      );
      if (generatedPayment) {
        const cloudId = createUuid();
        nextTransactions = nextTransactions.map((transaction) =>
          transaction.id === generatedPayment.id
            ? ({ ...transaction, id: cloudId, createdAt: nowEpoch, updatedAt: nowEpoch } as Transaction)
            : transaction,
        );
        nextFinancialState = {
          ...nextFinancialState,
          installments: nextFinancialState.installments.map((installment) =>
            installment.id === installmentId
              ? { ...installment, transactionId: cloudId, updatedAt: nowEpoch }
              : installment,
          ),
        };
      }
    }
    setTransactions(nextTransactions);
    setFinancialState(nextFinancialState);
    markMutation();
    showToast('Pagamento registrado e despesa criada.');
    return true;
  };

  const reopenPayableInstallment = (installmentId: string): boolean => {
    const installment = financialState.installments.find((item) => item.id === installmentId);
    const linkedTransaction = installment
      ? transactions.find(
          (transaction) =>
            transaction.id === installment.transactionId ||
            transaction.payableInstallmentId === installment.id,
        )
      : undefined;
    const result = reopenInstallment(financialState, transactions, installmentId, Date.now());
    if (!result.changed) {
      showToast('Não foi possível reabrir esta parcela.');
      return false;
    }
    if (mode === 'cloud' && linkedTransaction) {
      enqueueCloudDelete('transactions', linkedTransaction.id);
      if (linkedTransaction.type === 'abastecimento') {
        enqueueCloudDelete('fuel_records', linkedTransaction.id);
      }
      if (linkedTransaction.type === 'manutencao') {
        enqueueCloudDelete('maintenance_records', linkedTransaction.id);
      }
    }
    setTransactions(result.transactions);
    setFinancialState(result.financialState);
    markMutation();
    showToast('Pagamento reaberto e despesa vinculada removida.');
    return true;
  };

  const updateUserProfile = (updates: Partial<UserProfile>) => {
    const now = Date.now();
    setUserProfile((previous) => ({
      ...previous,
      ...updates,
      createdAt: previous.createdAt,
      updatedAt: now,
    }));
    markMutation();
    showToast('Perfil atualizado com sucesso.');
  };

  const depositMaintenanceReserve = (amount: number, description?: string) => {
    const amt = Math.round((Number(amount) || 0) * 100) / 100;
    if (amt <= 0) {
      showToast('Informe um valor positivo para guardar.');
      return;
    }
    const now = Date.now();
    setMaintenanceReserveLedger((previous) => [
      ...previous,
      {
        id: newEntityId('reserve'),
        type: 'deposito' as const,
        amount: amt,
        date: new Date(now).toISOString().split('T')[0],
        description,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    markMutation();
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
    const now = Date.now();
    setMaintenanceReserveLedger((previous) => [
      ...previous,
      {
        id: newEntityId('reserve'),
        type: 'resgate' as const,
        amount: amt,
        date: new Date(now).toISOString().split('T')[0],
        description,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    markMutation();
    showToast(`${formatBRL(amt)} resgatados da reserva de manutenção.`);
    return true;
  };

  /**
   * Exclui um lançamento do cofrinho.
   *
   * O saldo é recalculado a partir do livro-razão, então remover a linha é o
   * caminho honesto para desfazer um depósito ou resgate errado.
   */
  const removeMaintenanceReserveEntry = (id: string) => {
    setMaintenanceReserveLedger((previous) =>
      previous.some((entry) => entry.id === id) ? previous.filter((entry) => entry.id !== id) : previous,
    );
    enqueueCloudDelete('maintenance_reserve_entries', id);
    markMutation();
    showToast('Lançamento do cofrinho excluído.');
  };

  const adjustMaintenanceReserve = (amount: number, description?: string) => {
    const amt = Math.round((Number(amount) || 0) * 100) / 100;
    if (!isFinite(amt) || amt === 0) {
      showToast('Informe um ajuste diferente de zero.');
      return;
    }
    const now = Date.now();
    setMaintenanceReserveLedger((previous) => [
      ...previous,
      {
        id: newEntityId('reserve'),
        type: 'ajuste' as const,
        amount: amt,
        date: new Date(now).toISOString().split('T')[0],
        description,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    markMutation();
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
    const index = availableMonths.indexOf(selectedMonth);
    if (index < 0) return;
    const previous = availableMonths[Math.min(availableMonths.length - 1, index + 1)];
    if (previous) setSelectedMonth(previous);
  };

  const goToNextMonth = () => {
    const index = availableMonths.indexOf(selectedMonth);
    if (index <= 0) return;
    const next = availableMonths[index - 1];
    if (next) setSelectedMonth(next);
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
        mode,
        cloudUserId,
        cloudEmail: session.email,
        syncStatus,
        lastSyncedAt,
        syncQueue,
        ready: hydratedScope === scopeId && scopeHydratedRef.current,
        syncNow,
        retryPendingSync,
        signOut,
        enableCloudMode,
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
        removeShift,
        elapsedShiftSeconds,
        elapsedWorkSeconds,
        elapsedPausedSeconds,
        getShiftTotals,
        userProfile,
        updateUserProfile,
        depositMaintenanceReserve,
        withdrawMaintenanceReserve,
        removeMaintenanceReserveEntry,
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
