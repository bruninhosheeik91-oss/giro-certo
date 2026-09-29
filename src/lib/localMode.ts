export const LOCAL_MODE_STORAGE_KEY = 'rota_financeira_local_mode_v2';
export const LOCAL_MODE_STORAGE_VALUE = 'local';

export function hasLocalMode(): boolean {
  try {
    return localStorage.getItem(LOCAL_MODE_STORAGE_KEY) === LOCAL_MODE_STORAGE_VALUE;
  } catch {
    return false;
  }
}

export function skipLocalMode(): void {
  try {
    localStorage.setItem(LOCAL_MODE_STORAGE_KEY, LOCAL_MODE_STORAGE_VALUE);
  } catch {
    window.location.reload();
    return;
  }
  window.location.reload();
}

export function clearLocalMode(): void {
  try {
    localStorage.removeItem(LOCAL_MODE_STORAGE_KEY);
  } catch {
    return;
  }
}
