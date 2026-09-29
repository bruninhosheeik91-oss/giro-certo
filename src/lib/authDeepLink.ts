import { Capacitor } from '@capacitor/core';

/** Esquema do deep link do app Android, alinhado ao `appId` do Capacitor. */
export const NATIVE_AUTH_SCHEME = 'tech.domnex.girocerto';

/** Caminho de retorno usado pelo Supabase no app nativo. */
export const NATIVE_AUTH_REDIRECT = `${NATIVE_AUTH_SCHEME}://login-callback`;

/** Host permitido para o servidor — e o que o app precisa aceitar no Manifest. */
export const NATIVE_AUTH_HOST = 'login-callback';

const RECOVERY_PENDING_KEY = 'giro_certo_recovery_pending_v1';

export function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * URL de retorno da autenticação.
 *
 * No app nativo o Supabase não consegue voltar para `http://localhost`, então
 * o retorno é o deep link do próprio app. No navegador/PWA é a origem atual, o
 * que faz o link voltar para a página já aberta. `VITE_AUTH_REDIRECT_URL` tem
 * precedência para casos em que o domínio real não é o do navegador.
 */
export function resolveAuthRedirectUrl(): string | undefined {
  const override = import.meta.env.VITE_AUTH_REDIRECT_URL?.trim();
  if (override) return override;
  if (isNativePlatform()) return NATIVE_AUTH_REDIRECT;
  if (typeof window === 'undefined') return undefined;
  const origin = window.location.origin;
  if (!origin || origin === 'null') return undefined;
  return origin;
}

/** Flag que indica que o usuário pediu recuperação neste aparelho. */
export function markRecoveryPending(): void {
  try {
    localStorage.setItem(RECOVERY_PENDING_KEY, new Date().toISOString());
  } catch {
    return;
  }
}

export function consumeRecoveryPending(): boolean {
  try {
    const value = localStorage.getItem(RECOVERY_PENDING_KEY);
    if (!value) return false;
    localStorage.removeItem(RECOVERY_PENDING_KEY);
    return true;
  } catch {
    return false;
  }
}

export function hasRecoveryPending(): boolean {
  try {
    return Boolean(localStorage.getItem(RECOVERY_PENDING_KEY));
  } catch {
    return false;
  }
}

export type AuthLinkResult =
  | { kind: 'recovery'; code: string }
  | { kind: 'confirm'; code: string }
  | { kind: 'error'; message: string }
  | null;

function readParams(href: string): URLSearchParams {
  const url = new URL(href);
  const params = new URLSearchParams(url.search);
  const hash = url.hash.replace(/^#\??/, '');
  if (hash) {
    for (const [key, value] of new URLSearchParams(hash)) {
      if (!params.has(key)) params.set(key, value);
    }
  }
  return params;
}

/**
 * Interpreta a URL de retorno do Supabase.
 *
 * O fluxo é PKCE, então o servidor devolve `?code=...` e o code verifier fica
 * no armazenamento do cliente. A distinção entre recuperação e confirmação de
 * cadastro é o parâmetro `type` do link; sem ele, um cadastro novo que só
 * pediu confirmação não pode cair na tela de nova senha.
 */
export function parseAuthLink(href: string): AuthLinkResult {
  let params: URLSearchParams;
  try {
    params = readParams(href);
  } catch {
    return null;
  }

  const errorDescription =
    params.get('error_description') ?? params.get('error') ?? params.get('error_code');
  if (errorDescription) {
    return { kind: 'error', message: errorDescription.replace(/\+/g, ' ') };
  }

  const type = (params.get('type') ?? '').toLowerCase();
  const code = params.get('code');
  if (code) {
    return { kind: type === 'recovery' ? 'recovery' : 'confirm', code };
  }

  // Link de recuperação sem `code` não tem como ser trocado: o code verifier
  // não existe nesse formato. Falar isso é melhor que abrir o login em silêncio.
  if (type === 'recovery') {
    return { kind: 'error', message: 'Este link de recuperação não é válido para este app.' };
  }

  return null;
}
