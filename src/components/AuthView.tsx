import React, { useEffect, useRef, useState } from 'react';
import {
  Mail,
  Lock,
  User,
  Loader2,
  ArrowLeft,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import type { UseAuthState } from '../hooks/useAuthState';
import { useKeyboardInset } from '../hooks/useKeyboardInset';

export type AuthViewProps = {
  auth: UseAuthState;
};

type AuthFormMode = 'login' | 'cadastro' | 'recuperacao' | 'nova-senha';

const SUBTITLES: Record<AuthFormMode, string> = {
  login: 'Controle seus ganhos, despesas e lucro real',
  cadastro: 'Comece a controlar seus ganhos hoje',
  recuperacao: 'Enviaremos um link para o seu e-mail',
  'nova-senha': 'Escolha uma senha nova para sua conta',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD_LENGTH = 6;

const Field: React.FC<{
  id: string;
  label: string;
  type: string;
  placeholder: string;
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  inputMode?: 'text' | 'email' | 'tel' | 'url' | 'numeric' | 'decimal' | 'search';
  enterKeyHint?: 'next' | 'done' | 'send' | 'go';
  autoFocus?: boolean;
  required?: boolean;
  invalid?: boolean;
  trailing?: React.ReactNode;
  onEnter?: () => void;
}> = ({
  id,
  label,
  type,
  placeholder,
  icon,
  value,
  onChange,
  autoComplete,
  inputMode,
  enterKeyHint,
  autoFocus,
  required,
  invalid,
  trailing,
  onEnter,
}) => (
  <div>
    <label htmlFor={id} className="block text-[11px] font-medium text-slate-400 ml-1">
      {label}
    </label>
    <div className="mt-1 relative">
      <span
        className={`absolute left-3 top-1/2 -translate-y-1/2 ${
          invalid ? 'text-rose-400' : 'text-slate-500'
        }`}
        aria-hidden="true"
      >
        {icon}
      </span>
      <input
        id={id}
        name={id}
        type={type}
        placeholder={placeholder}
        value={value}
        autoComplete={autoComplete}
        inputMode={inputMode}
        enterKeyHint={enterKeyHint}
        autoFocus={autoFocus}
        required={required}
        aria-invalid={invalid || undefined}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && onEnter) {
            event.preventDefault();
            onEnter();
          }
        }}
        className={`w-full bg-slate-900/80 border rounded-xl pl-10 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-colors ${
          trailing ? 'pr-11' : 'pr-3'
        } ${
          invalid
            ? 'border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/30'
            : 'border-slate-700/80 focus:border-emerald-500/60 focus:ring-emerald-500/40'
        }`}
      />
      {trailing && (
        <span className="absolute right-1.5 top-1/2 -translate-y-1/2">{trailing}</span>
      )}
    </div>
  </div>
);

export const AuthView: React.FC<AuthViewProps> = ({ auth }) => {
  const [mode, setMode] = useState<AuthFormMode>(() => (auth.isRecovery ? 'nova-senha' : 'login'));
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(() => auth.linkError);
  const [notice, setNotice] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const keyboardInset = useKeyboardInset();

  const isUpdatingPassword = auth.isRecovery || mode === 'nova-senha';
  const isRequestingRecovery = mode === 'recuperacao';
  const isSignUp = mode === 'cadastro';

  // A recuperação chega por deep link depois do app já estar aberto, então o
  // modo precisa acompanhar o hook em vez de ficar preso ao primeiro render.
  useEffect(() => {
    if (auth.isRecovery) {
      setMode('nova-senha');
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setError(null);
      setNotice(null);
      setFieldError(null);
    }
  }, [auth.isRecovery]);

  // Link inválido ou expirado: a mensagem vem do Supabase já traduzida.
  useEffect(() => {
    if (auth.linkError) setError(auth.linkError);
  }, [auth.linkError]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    if (notice) noticeRef.current?.focus();
  }, [notice]);

  const changeMode = (nextMode: AuthFormMode) => {
    setMode(nextMode);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setError(null);
    setNotice(null);
    setFieldError(null);
  };

  const focusById = (id: string) => {
    document.getElementById(id)?.focus();
  };

  const validate = (): string | null => {
    if (isUpdatingPassword) {
      if (!password) {
        focusById('auth-password');
        return 'Informe uma nova senha.';
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        focusById('auth-password');
        return `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
      }
      if (password !== confirmPassword) {
        focusById('auth-confirm-password');
        return 'As senhas não coincidem.';
      }
      return null;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      focusById('auth-email');
      return 'Informe seu e-mail.';
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      focusById('auth-email');
      return 'E-mail inválido. Confira o endereço digitado.';
    }
    if (isRequestingRecovery) return null;

    if (isSignUp && !name.trim()) {
      focusById('auth-name');
      return 'Informe seu nome.';
    }
    if (!password) {
      focusById('auth-password');
      return 'Informe sua senha.';
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      focusById('auth-password');
      return `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    }
    if (isSignUp && password !== confirmPassword) {
      focusById('auth-confirm-password');
      return 'As senhas não coincidem.';
    }
    return null;
  };

  const submitLabel = isUpdatingPassword
    ? 'Salvar nova senha'
    : isRequestingRecovery
      ? 'Enviar link'
      : isSignUp
        ? 'Criar conta'
        : 'Entrar';

  const busyLabel = isUpdatingPassword
    ? 'Salvando…'
    : isRequestingRecovery
      ? 'Enviando…'
      : isSignUp
        ? 'Criando conta…'
        : 'Entrando…';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      setFieldError(validationError);
      setNotice(null);
      return;
    }

    setBusy(true);
    setError(null);
    setFieldError(null);
    setNotice(null);
    try {
      if (isUpdatingPassword) {
        const result = await auth.updatePassword(password);
        if (result) {
          setError(result.message);
          setFieldError(result.message);
        } else {
          setNotice('Senha atualizada. Você já pode entrar com a nova senha.');
        }
        return;
      }

      if (isRequestingRecovery) {
        const result = await auth.resetPassword(email.trim());
        if (result) {
          setError(result.message);
          setFieldError(result.message);
        } else {
          setNotice('Se o e-mail estiver cadastrado, o link de recuperação foi enviado.');
        }
        return;
      }

      if (isSignUp) {
        const result = await auth.signUp(email.trim(), password, name.trim());
        if (result.error) {
          setError(result.error.message);
          setFieldError(result.error.message);
        } else if (result.needsEmailConfirmation) {
          setNotice('Conta criada. Confirme o e-mail que enviamos para ativar o acesso.');
        } else {
          setNotice('Conta criada. Verificando sua entrada…');
        }
        return;
      }

      const result = await auth.signIn(email.trim(), password);
      if (result) {
        setError(result.message);
        setFieldError(result.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const passwordType = showPassword ? 'text' : 'password';
  const passwordToggle = (
    <button
      type="button"
      onClick={() => setShowPassword((value) => !value)}
      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
      aria-pressed={showPassword}
      className="p-2 rounded-lg text-slate-500 hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
    >
      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );

  const emailField = (
    <Field
      id="auth-email"
      label="E-mail"
      type="email"
      placeholder="voce@email.com"
      icon={<Mail className="w-4 h-4" />}
      value={email}
      autoComplete="email"
      inputMode="email"
      enterKeyHint={isRequestingRecovery ? 'send' : 'next'}
      required
      autoFocus={!isSignUp}
      invalid={Boolean(fieldError) && !email.trim()}
      onChange={(value) => {
        setEmail(value);
        if (fieldError) setFieldError(null);
      }}
      onEnter={() => focusById(isRequestingRecovery ? '' : 'auth-password')}
    />
  );

  const passwordField = (
    <Field
      id="auth-password"
      label={isUpdatingPassword ? 'Nova senha' : 'Senha'}
      type={passwordType}
      placeholder="Mínimo 6 caracteres"
      icon={<Lock className="w-4 h-4" />}
      value={password}
      autoComplete={isSignUp || isUpdatingPassword ? 'new-password' : 'current-password'}
      enterKeyHint="next"
      required
      invalid={Boolean(fieldError) && !password}
      trailing={passwordToggle}
      onChange={(value) => {
        setPassword(value);
        if (fieldError) setFieldError(null);
      }}
      onEnter={() => focusById(isSignUp || isUpdatingPassword ? 'auth-confirm-password' : '')}
    />
  );

  const confirmField = (isSignUp: boolean) => (
    <Field
      id="auth-confirm-password"
      label={isSignUp ? 'Confirmar senha' : 'Confirmar nova senha'}
      type={passwordType}
      placeholder="Repita a senha"
      icon={<Lock className="w-4 h-4" />}
      value={confirmPassword}
      autoComplete="new-password"
      enterKeyHint="done"
      required
      invalid={Boolean(fieldError) && Boolean(confirmPassword) && password !== confirmPassword}
      onChange={(value) => {
        setConfirmPassword(value);
        if (fieldError) setFieldError(null);
      }}
    />
  );

  return (
    <div
      className="min-h-[100dvh] w-full bg-[#090d16] flex items-start sm:items-center justify-center overflow-y-auto"
      style={{
        paddingTop: 'max(1.5rem, env(safe-area-inset-top, 0px))',
        paddingBottom: `max(1.5rem, env(safe-area-inset-bottom, 0px))`,
        paddingLeft: 'max(1.25rem, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(1.25rem, env(safe-area-inset-right, 0px))',
        // O teclado cobre a viewport no navegador móvel; sem esta folga o campo
        // em foco fica atrás dele.
        marginBottom: keyboardInset,
      }}
    >
      <main className="w-full max-w-xs py-4">
        <div className="flex flex-col items-center text-center">
          <img
            src="/icons/icon-192.png"
            alt=""
            width={64}
            height={64}
            className="w-16 h-16 rounded-2xl object-cover shadow-lg shadow-emerald-500/25"
          />
          <h1 className="text-xl font-bold text-white tracking-tight mt-3">Giro Certo</h1>
          <p className="text-xs text-slate-400 mt-1">{SUBTITLES[mode]}</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-7 space-y-3" noValidate>
          {isUpdatingPassword ? (
            <>
              {passwordField}
              {confirmField(false)}
            </>
          ) : isRequestingRecovery ? (
            emailField
          ) : (
            <>
              {isSignUp && (
                <Field
                  id="auth-name"
                  label="Nome"
                  type="text"
                  placeholder="Como podemos te chamar"
                  icon={<User className="w-4 h-4" />}
                  value={name}
                  autoComplete="name"
                  enterKeyHint="next"
                  required
                  autoFocus
                  invalid={Boolean(fieldError) && !name.trim()}
                  onChange={(value) => {
                    setName(value);
                    if (fieldError) setFieldError(null);
                  }}
                  onEnter={() => focusById('auth-email')}
                />
              )}
              {emailField}
              {passwordField}
              {isSignUp && confirmField(true)}
            </>
          )}

          <div aria-live="polite" className="empty:hidden">
            {error && (
              <p
                ref={errorRef}
                tabIndex={-1}
                role="alert"
                className="flex items-start gap-1.5 text-[11px] text-rose-300 outline-none"
              >
                <AlertCircle className="w-3.5 h-3.5 mt-px flex-shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </p>
            )}
            {notice && (
              <p
                ref={noticeRef}
                tabIndex={-1}
                role="status"
                className="flex items-start gap-1.5 text-[11px] text-emerald-300 outline-none"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mt-px flex-shrink-0" aria-hidden="true" />
                <span>{notice}</span>
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={busy}
            aria-busy={busy}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 text-sm font-bold py-3 rounded-xl transition-colors inline-flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 focus:ring-offset-2 focus:ring-offset-[#090d16]"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {busy ? busyLabel : submitLabel}
          </button>
        </form>

        <div className="mt-5 text-center space-y-2">
          {!isUpdatingPassword && !isRequestingRecovery && (
            <button
              type="button"
              onClick={() => changeMode(isSignUp ? 'login' : 'cadastro')}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 rounded"
            >
              {isSignUp ? 'Já tenho conta' : 'Criar uma conta'}
            </button>
          )}
          {!isUpdatingPassword && !isRequestingRecovery && !isSignUp && (
            <button
              type="button"
              onClick={() => changeMode('recuperacao')}
              className="block text-[11px] text-slate-400 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 rounded mx-auto"
            >
              Esqueci minha senha
            </button>
          )}
          {isRequestingRecovery && (
            <button
              type="button"
              onClick={() => changeMode('login')}
              className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 rounded"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> Voltar ao login
            </button>
          )}
        </div>

        <p className="mt-8 text-center text-[10px] tracking-wide text-slate-600">
          Desenvolvido por <span className="font-semibold text-sky-400">Domnex Tech</span>
        </p>

      </main>
    </div>
  );
};
