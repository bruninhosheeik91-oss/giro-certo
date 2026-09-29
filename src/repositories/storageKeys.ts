export const STORAGE_PREFIX = 'rota_financeira';

/**
 * Chaves do escopo "local" (sem conta). O escopo por usuário deriva destas com
 * o prefixo `giro_certo_user_<uid>_v4`, então nada aqui pode ser lido ou
 * gravado fora do escopo correspondente.
 */
export const STORAGE_KEYS = {
  shifts: `${STORAGE_PREFIX}_shifts_v2`,
  transactions: `${STORAGE_PREFIX}_transactions_v2`,
  profile: `${STORAGE_PREFIX}_profile_v2`,
  vehicles: `${STORAGE_PREFIX}_vehicles_v2`,
  apps: `${STORAGE_PREFIX}_apps_v2`,
  activeShift: `${STORAGE_PREFIX}_active_shift_v2`,
  selectedMonth: `${STORAGE_PREFIX}_selected_month_v2`,
  financial: 'giro_certo_financial_state_v3',
  maintenanceReserve: `${STORAGE_PREFIX}_reserve_ledger_v2`,
  userSettings: `${STORAGE_PREFIX}_user_settings_v2`,
  sync: `${STORAGE_PREFIX}_sync_v2`,
  /**
   * Marcador gravado na primeira mutação do escopo. Sem ele não dá para
   * distinguir "instalação que só abriu o app" de "usuário que editou ou apagou
   * um registro da semente", já que os IDs continuam sendo os da semente.
   */
  touched: `${STORAGE_PREFIX}_user_touched_v2`,
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export type AppStorageKey = Exclude<keyof typeof STORAGE_KEYS, 'sync' | 'touched'>;

export type ScopedStorageKeys = Record<AppStorageKey, string> & {
  sync: string;
  touched: string;
};

function encodeScope(scopeId: string): string {
  return encodeURIComponent(scopeId).replaceAll('.', '_');
}

export function getScopedStorageKeys(scopeId: string): ScopedStorageKeys {
  if (scopeId === 'local') return { ...STORAGE_KEYS };

  const prefix = `giro_certo_user_${encodeScope(scopeId)}_v4`;
  return {
    shifts: `${prefix}_shifts`,
    transactions: `${prefix}_transactions`,
    profile: `${prefix}_profile`,
    vehicles: `${prefix}_vehicles`,
    apps: `${prefix}_registered_apps`,
    activeShift: `${prefix}_active_shift`,
    selectedMonth: `${prefix}_selected_month`,
    financial: `${prefix}_financial_state`,
    maintenanceReserve: `${prefix}_maintenance_reserve_entries`,
    userSettings: `${prefix}_settings`,
    sync: `${prefix}_sync_queue`,
    touched: `${prefix}_user_touched`,
  };
}
