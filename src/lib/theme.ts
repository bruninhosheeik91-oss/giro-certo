export type ThemeMode = 'auto' | 'escuro' | 'sol';
export type ResolvedTheme = 'escuro' | 'sol';

const KEY = 'giro_certo_theme_v1';
const EVENT = 'giro-certo-theme';
const DAY_START = 6;
const DAY_END = 18;

export function readThemeMode(): ThemeMode {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'escuro' || value === 'sol' || value === 'auto' ? value : 'auto';
  } catch {
    return 'auto';
  }
}

export function resolveTheme(mode: ThemeMode, now = new Date()): ResolvedTheme {
  if (mode !== 'auto') return mode;
  const hour = now.getHours();
  return hour >= DAY_START && hour < DAY_END ? 'sol' : 'escuro';
}

export function applyTheme(mode = readThemeMode()): ResolvedTheme {
  const resolved = resolveTheme(mode);
  const root = document.documentElement;
  if (resolved === 'sol') root.setAttribute('data-theme', 'sol');
  else root.removeAttribute('data-theme');
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute('content', resolved === 'sol' ? '#eef2f6' : '#090d16');
  return resolved;
}

export function setThemeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* preferência só local */
  }
  applyTheme(mode);
  window.dispatchEvent(new Event(EVENT));
}

/** Aplica o tema agora e reavalia o modo automático a cada 5 min e ao voltar ao app. */
export function startThemeWatcher(): () => void {
  applyTheme();
  const tick = () => applyTheme();
  const timer = window.setInterval(tick, 5 * 60 * 1000);
  const onVisible = () => {
    if (document.visibilityState === 'visible') tick();
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}

export const THEME_EVENT = EVENT;
