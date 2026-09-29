import { useCallback, useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import {
  getAuthRedirectUrl,
  clearRecoveryRedirect,
  isRecoveryRedirect,
} from '../lib/authRedirects';
import {
  consumeRecoveryPending,
  markRecoveryPending,
  parseAuthLink,
} from '../lib/authDeepLink';
import {
  getSupabaseClient,
  isSupabaseConfigured,
  type AuthSession,
  type EmailError,
} from '../lib/auth';
import { translateAuthError } from '../lib/authMessages';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';
export type AuthMode = 'local' | 'cloud';

export interface UseAuthState {
  status: AuthStatus;
  loading: boolean;
  session: AuthSession;
  userId: string | null;
  email: string | null;
  mode: AuthMode;
  configured: boolean;
  isSupabaseConfigured: boolean;
  isRecovery: boolean;
  recovery: boolean;
  signIn: (email: string, password: string) => Promise<EmailError | null>;
  signUp: (
    email: string,
    password: string,
    name: string,
  ) => Promise<{ error: EmailError | null; needsEmailConfirmation: boolean }>;
  resetPassword: (email: string) => Promise<EmailError | null>;
  updatePassword: (password: string) => Promise<EmailError | null>;
  handleAuthUrl: (url: string) => Promise<void>;
  linkError: string | null;
  signOut: () => Promise<void>;
}

/** Converte o erro do Supabase em mensagem legível, sempre em português. */
function toEmailError(error: unknown, fallback: string): EmailError | null {
  if (!error) return null;
  if (error instanceof Error) return { message: translateAuthError(error.message, fallback) };
  if (typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return { message: translateAuthError(message, fallback) };
  }
  return { message: fallback };
}

export function useAuthState(): UseAuthState {
  const configured = isSupabaseConfigured();
  const [status, setStatus] = useState<AuthStatus>(configured ? 'loading' : 'signedOut');
  const [session, setSession] = useState<AuthSession>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [isRecovery, setIsRecovery] = useState<boolean>(() => configured && isRecoveryRedirect());

  /**
   * Consome a URL de retorno do Supabase.
   *
   * No navegador o `detectSessionInUrl` do `supabase-js` já troca o código
   * durante a inicialização. No app nativo não dá: o WebView carrega o
   * `index.html` e ignora a query do deep link, então a troca é feita aqui.
   */
  const handleAuthUrl = useCallback(async (url: string) => {
    const client = getSupabaseClient();
    if (!client) return;

    const link = parseAuthLink(url);
    if (!link) return;

    if (link.kind === 'error') {
      setLinkError(translateAuthError(link.message, 'O link recebido não pôde ser usado.'));
      clearRecoveryRedirect();
      return;
    }

    const { error } = await client.auth.exchangeCodeForSession(link.code);
    clearRecoveryRedirect();
    if (error) {
      setLinkError(
        translateAuthError(error.message, 'O link expirou. Peça um novo e tente de novo.'),
      );
      return;
    }

    setLinkError(null);
    if (link.kind === 'recovery' || consumeRecoveryPending()) {
      setIsRecovery(true);
    }
  }, []);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      setStatus('signedOut');
      setSession(null);
      return;
    }

    let cancelled = false;
    const recoveryRedirect = isRecoveryRedirect();

    const applySession = (nextSession: AuthSession) => {
      if (cancelled) return;
      setSession(nextSession);
      setStatus(nextSession ? 'signedIn' : 'signedOut');
    };

    void client.auth
      .getSession()
      .then(({ data }) => {
        applySession(data.session);
        if (recoveryRedirect && data.session) setIsRecovery(true);
      })
      .catch(() => {
        applySession(null);
      });

    const { data: subscription } = client.auth.onAuthStateChange((event, nextSession) => {
      if (cancelled) return;
      if (event === 'PASSWORD_RECOVERY') setIsRecovery(true);
      if (event === 'SIGNED_OUT') setIsRecovery(false);
      applySession(nextSession);
    });

    return () => {
      cancelled = true;
      void subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!configured || typeof window === 'undefined') return;

    let remove: (() => void) | undefined;
    let cancelled = false;

    // Abertura a frio: o evento `appUrlOpen` só dispara quando o app já estava
    // aberto, então o link que o abriu precisa ser lido da tela inicial.
    void CapacitorApp.getLaunchUrl()
      .then((result) => {
        if (!cancelled && result?.url) void handleAuthUrl(result.url);
      })
      .catch(() => {
        // Sem plugin nativo não há deep link; a URL da página é lida abaixo.
      });

    if (parseAuthLink(window.location.href)) void handleAuthUrl(window.location.href);

    void CapacitorApp.addListener('appUrlOpen', ({ url }) => {
      void handleAuthUrl(url);
    })
      .then((listenerHandle) => {
        remove = () => void listenerHandle.remove();
      })
      .catch(() => {
        // Navegador: sem deep link nativo.
      });

    return () => {
      cancelled = true;
      remove?.();
    };
  }, [configured, handleAuthUrl]);

  const signIn = useCallback(async (email: string, password: string) => {
    const client = getSupabaseClient();
    if (!client) return { message: 'Backend não configurado.' };
    try {
      const { error } = await client.auth.signInWithPassword({ email, password });
      return toEmailError(error, 'Não foi possível entrar.');
    } catch (error) {
      return toEmailError(error, 'Não foi possível entrar.');
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const client = getSupabaseClient();
    if (!client) {
      return { error: { message: 'Backend não configurado.' }, needsEmailConfirmation: false };
    }
    try {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: getAuthRedirectUrl(),
        },
      });
      return {
        error: toEmailError(error, 'Não foi possível criar a conta.'),
        needsEmailConfirmation: data.session === null && !error,
      };
    } catch (error) {
      return {
        error: toEmailError(error, 'Não foi possível criar a conta.'),
        needsEmailConfirmation: false,
      };
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const client = getSupabaseClient();
    if (!client) return { message: 'Backend não configurado.' };
    try {
      // O e-mail chega depois, em outro app: a marca permite reconhecer o
      // retorno como recuperação e abrir a tela de nova senha.
      markRecoveryPending();
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: getAuthRedirectUrl(),
      });
      if (error) return toEmailError(error, 'Não foi possível enviar o link de recuperação.');
      return null;
    } catch (error) {
      return toEmailError(error, 'Não foi possível enviar o link de recuperação.');
    }
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const client = getSupabaseClient();
    if (!client) return { message: 'Backend não configurado.' };
    try {
      const { error } = await client.auth.updateUser({ password });
      if (error) return toEmailError(error, 'Não foi possível atualizar a senha.');
      setIsRecovery(false);
      clearRecoveryRedirect();
      return null;
    } catch (error) {
      return toEmailError(error, 'Não foi possível atualizar a senha.');
    }
  }, []);

  const signOut = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) return;
    try {
      await client.auth.signOut({ scope: 'local' });
    } catch {
      return;
    }
    setSession(null);
    setIsRecovery(false);
    setStatus('signedOut');
    setLinkError(null);
    clearRecoveryRedirect();
  }, []);

  const userId = session?.user.id ?? null;
  const email = session?.user.email ?? null;
  const mode: AuthMode = session ? 'cloud' : 'local';

  return {
    status,
    loading: configured && status === 'loading',
    session,
    userId,
    email,
    mode,
    configured,
    isSupabaseConfigured: configured,
    isRecovery,
    recovery: isRecovery,
    signIn,
    signUp,
    resetPassword,
    updatePassword,
    handleAuthUrl,
    linkError,
    signOut,
  };
}
