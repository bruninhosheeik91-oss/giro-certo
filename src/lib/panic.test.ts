import { describe, expect, it } from 'vitest';
import { buildPanicMessage, normalizeBrazilPhone } from './panic';

describe('botão de pânico', () => {
  it('normaliza telefones brasileiros para o WhatsApp', () => {
    expect(normalizeBrazilPhone('(16) 99123-4567')).toBe('5516991234567');
    expect(normalizeBrazilPhone('+55 16 99123-4567')).toBe('5516991234567');
    expect(normalizeBrazilPhone('016 99123-4567')).toBe('5516991234567');
  });

  it('monta a mensagem com link do mapa', () => {
    const position = { coords: { latitude: -21.177, longitude: -47.81 } } as GeolocationPosition;
    const text = buildPanicMessage(position, new Date(2026, 10, 10, 22, 5));
    expect(text).toContain('https://maps.google.com/?q=-21.177000,-47.810000');
    expect(text).toContain('22:05');
  });

  it('avisa quando não há localização', () => {
    expect(buildPanicMessage(null)).toContain('Não consegui pegar minha localização');
  });
});
