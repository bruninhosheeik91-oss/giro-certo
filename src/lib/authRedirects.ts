import { resolveAuthRedirectUrl } from './authDeepLink';

const RECOVERY_PARAMETERS = [
  'code',
  'type',
  'error',
  'error_code',
  'error_description',
  'token_hash',
  'token_type',
  'access_token',
  'refresh_token',
  'expires_in',
  'expires_at',
  'provider_token',
  'provider_refresh_token',
];

function nonEmpty(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function browserLocation(): Location | undefined {
  return typeof window === 'undefined' ? undefined : window.location;
}

function parseUrl(href: string): URL | null {
  try {
    const base = browserLocation()?.origin;
    return new URL(href, base && base !== 'null' ? base : 'http://localhost');
  } catch {
    return null;
  }
}

function hashParameters(url: URL): URLSearchParams {
  const hash = url.hash.replace(/^#\??/, '');
  return new URLSearchParams(hash);
}

export function getAuthRedirectUrl(override?: string): string | undefined {
  const explicitOverride = nonEmpty(override);
  if (explicitOverride) return explicitOverride;
  return resolveAuthRedirectUrl();
}

export function isRecoveryRedirect(href?: string): boolean {
  const value = href ?? browserLocation()?.href;
  if (!value) return false;
  const url = parseUrl(value);
  if (!url) return false;
  return (
    url.searchParams.get('type')?.toLowerCase() === 'recovery' ||
    hashParameters(url).get('type')?.toLowerCase() === 'recovery'
  );
}

export function getRecoveryCode(href?: string): string | undefined {
  const value = href ?? browserLocation()?.href;
  if (!value) return undefined;
  const url = parseUrl(value);
  if (!url) return undefined;
  return url.searchParams.get('code') ?? hashParameters(url).get('code') ?? undefined;
}

export function clearRecoveryRedirect(): void {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  const url = parseUrl(window.location.href);
  if (!url) return;
  for (const parameter of RECOVERY_PARAMETERS) url.searchParams.delete(parameter);
  const remainingHash = new URLSearchParams(hashParameters(url));
  for (const parameter of RECOVERY_PARAMETERS) remainingHash.delete(parameter);
  const hash = remainingHash.toString();
  url.hash = hash ? `#${hash}` : '';
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  try {
    window.history.replaceState({}, document.title, nextUrl);
  } catch {
    return;
  }
}

export const getRedirectUrl = getAuthRedirectUrl;
export const getPasswordRecoveryRedirectUrl = getAuthRedirectUrl;
export const isRecoveryUrl = isRecoveryRedirect;
