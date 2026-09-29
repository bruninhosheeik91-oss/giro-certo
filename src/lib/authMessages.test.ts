import { describe, expect, it } from 'vitest';
import { translateAuthError } from './authMessages';

describe('mensagens de erro do Supabase em português', () => {
  it('traduz os erros de credenciais', () => {
    expect(translateAuthError('Invalid login credentials', 'fallback')).toBe(
      'E-mail ou senha incorretos.',
    );
  });

  it('traduz e-mail não confirmado e e-mail já cadastrado', () => {
    expect(translateAuthError('Email not confirmed', 'fallback')).toBe(
      'Confirme seu e-mail antes de entrar.',
    );
    expect(translateAuthError('User already registered', 'fallback')).toBe(
      'Este e-mail já está cadastrado. Tente entrar.',
    );
  });

  it('traduz senha curta e senha igual à anterior', () => {
    expect(translateAuthError('Password should be at least 6 characters.', 'fallback')).toBe(
      'A senha deve ter pelo menos 6 caracteres.',
    );
    expect(translateAuthError('New password should be different from the old password.', 'x')).toBe(
      'A nova senha deve ser diferente da atual.',
    );
  });

  it('traduz rate limit e falha de rede', () => {
    expect(translateAuthError('Too many requests', 'fallback')).toContain('Muitas tentativas');
    expect(translateAuthError('TypeError: Failed to fetch', 'fallback')).toContain(
      'Falha de conexão',
    );
  });

  it('traduz link expirado', () => {
    expect(translateAuthError('Token has expired or is invalid', 'fallback')).toContain(
      'O link expirou',
    );
  });

  it('usa o fallback quando a mensagem vem vazia', () => {
    expect(translateAuthError('   ', 'Não foi possível entrar.')).toBe('Não foi possível entrar.');
  });

  it('mantém a mensagem original quando não reconhece o erro', () => {
    expect(translateAuthError('erro raro do servidor', 'fallback')).toBe('erro raro do servidor');
  });
});
