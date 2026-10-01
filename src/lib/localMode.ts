export const LOCAL_MODE_STORAGE_KEY = 'rota_financeira_local_mode_v2';
export function clearLocalMode(): void {
  try {
    localStorage.removeItem(LOCAL_MODE_STORAGE_KEY);
  } catch {
    return;
  }
}
