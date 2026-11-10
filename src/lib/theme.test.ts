import { describe, expect, it } from 'vitest';
import { resolveTheme } from './theme';

describe('tema', () => {
  it('modo automático usa Sol de dia e escuro à noite', () => {
    expect(resolveTheme('auto', new Date(2026, 10, 10, 9, 0))).toBe('sol');
    expect(resolveTheme('auto', new Date(2026, 10, 10, 17, 59))).toBe('sol');
    expect(resolveTheme('auto', new Date(2026, 10, 10, 18, 0))).toBe('escuro');
    expect(resolveTheme('auto', new Date(2026, 10, 10, 5, 30))).toBe('escuro');
  });

  it('modo fixo ignora o horário', () => {
    expect(resolveTheme('escuro', new Date(2026, 10, 10, 12, 0))).toBe('escuro');
    expect(resolveTheme('sol', new Date(2026, 10, 10, 23, 0))).toBe('sol');
  });
});
