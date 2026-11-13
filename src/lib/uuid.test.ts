import { describe, expect, it } from 'vitest';

describe('deterministicUuid sem sinal', () => {
  it('nunca gera hex negativo', async () => {
    const { deterministicUuid, isPostgresUuid } = await import('./uuid');
    for (let i = 0; i < 2000; i += 1) {
      expect(isPostgresUuid(deterministicUuid(`active-pause:${i}`))).toBe(true);
    }
  });
});
