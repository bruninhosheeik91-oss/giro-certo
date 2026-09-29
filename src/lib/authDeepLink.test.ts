import { afterEach, describe, expect, it } from 'vitest';
import {
  consumeRecoveryPending,
  markRecoveryPending,
  parseAuthLink,
  NATIVE_AUTH_HOST,
  NATIVE_AUTH_SCHEME,
} from './authDeepLink';

describe('deep link de autenticação (Capacitor)', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('usa o esquema do appId como retorno no Android', () => {
    expect(NATIVE_AUTH_SCHEME).toBe('tech.domnex.girocerto');
    expect(NATIVE_AUTH_HOST).toBe('login-callback');
  });

  it('reconhece o link de recuperação com code na query', () => {
    expect(parseAuthLink('tech.domnex.girocerto://login-callback?type=recovery&code=abc')).toEqual({
      kind: 'recovery',
      code: 'abc',
    });
  });

  it('distingue confirmação de cadastro de recuperação', () => {
    expect(parseAuthLink('tech.domnex.girocerto://login-callback?code=abc')).toEqual({
      kind: 'confirm',
      code: 'abc',
    });
    expect(parseAuthLink('https://app.example.com/?code=abc')).toEqual({
      kind: 'confirm',
      code: 'abc',
    });
  });

  it('avisa quando o link de recuperação não tem code para trocar', () => {
    expect(parseAuthLink('https://app.example.com/#access_token=token&type=recovery')).toEqual({
      kind: 'error',
      message: 'Este link de recuperação não é válido para este app.',
    });
  });

  it('reporta erro do servidor preservando o texto para tradução', () => {
    expect(
      parseAuthLink('https://app.example.com/?error=access_denied&error_description=Token+expired'),
    ).toEqual({ kind: 'error', message: 'Token expired' });
  });

  it('ignora URL sem parâmetro de autenticação', () => {
    expect(parseAuthLink('https://app.example.com/')).toBeNull();
    expect(parseAuthLink('não é uma url')).toBeNull();
  });

  it('marca a recuperação pendente uma única vez', () => {
    markRecoveryPending();
    expect(consumeRecoveryPending()).toBe(true);
    expect(consumeRecoveryPending()).toBe(false);
  });
});
