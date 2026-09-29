import { afterEach, describe, expect, it } from 'vitest';
import {
  clearRecoveryRedirect,
  getAuthRedirectUrl,
  getRecoveryCode,
  isRecoveryRedirect,
} from './authRedirects';

describe('auth redirects', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('prioritizes an explicit redirect URL', () => {
    expect(getAuthRedirectUrl('  https://app.example.com/account  ')).toBe(
      'https://app.example.com/account',
    );
  });

  it('recognizes recovery parameters in search and hash URLs', () => {
    expect(isRecoveryRedirect('https://app.example.com/?type=recovery&code=query-code')).toBe(true);
    expect(isRecoveryRedirect('https://app.example.com/#access_token=token&type=recovery')).toBe(
      true,
    );
    expect(isRecoveryRedirect('https://app.example.com/?code=login-code')).toBe(false);
  });

  it('reads a recovery code from the query or hash', () => {
    expect(getRecoveryCode('https://app.example.com/?type=recovery&code=query-code')).toBe(
      'query-code',
    );
    expect(getRecoveryCode('https://app.example.com/#type=recovery&code=hash-code')).toBe(
      'hash-code',
    );
  });

  it('removes recovery parameters without discarding unrelated URL state', () => {
    window.history.replaceState(
      {},
      '',
      '/account?mode=focus&type=recovery&code=secret#section=profile&access_token=token',
    );

    clearRecoveryRedirect();

    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe(
      '/account?mode=focus#section=profile',
    );
  });
});
