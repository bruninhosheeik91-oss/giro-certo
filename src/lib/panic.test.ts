import { describe, expect, it } from 'vitest';
import { inviteLink, inviteMessage } from './panic';

describe('botão de pânico (Telegram)', () => {
  it('monta o link de convite do bot', () => {
    expect(inviteLink('GiroCertoAlertaBot', 'abc123')).toBe('https://t.me/GiroCertoAlertaBot?start=abc123');
  });

  it('monta a mensagem de convite com nome e link', () => {
    const text = inviteMessage('Bruno', 'Ana', 'https://t.me/bot?start=x');
    expect(text).toContain('Oi, Ana!');
    expect(text).toContain('Sou Bruno');
    expect(text).toContain('https://t.me/bot?start=x');
    expect(text).toContain('Iniciar');
  });
});
