import { describe, expect, it } from 'vitest';
import { formatPhone, isValidBrazilPhone, normalizeBrazilPhone } from './panic';

describe('botão de pânico', () => {
  it('normaliza telefones brasileiros para o WhatsApp', () => {
    expect(normalizeBrazilPhone('(16) 99123-4567')).toBe('5516991234567');
    expect(normalizeBrazilPhone('+55 16 99123-4567')).toBe('5516991234567');
    expect(normalizeBrazilPhone('016 99123-4567')).toBe('5516991234567');
  });

  it('valida celular e fixo com DDD', () => {
    expect(isValidBrazilPhone('16 99123-4567')).toBe(true);
    expect(isValidBrazilPhone('16 3333-4444')).toBe(true);
    expect(isValidBrazilPhone('99123-4567')).toBe(false);
  });

  it('formata para exibição', () => {
    expect(formatPhone('5516991234567')).toBe('(16) 99123-4567');
  });
});
