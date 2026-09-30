import { describe, expect, it } from 'vitest';
import { buildAccountExport } from './accountPrivacy';

describe('account privacy', () => {
  it('gera exportação identificada sem alterar os dados', () => {
    const data = {
      profile: { name: 'Bruno' },
      vehicles: [{ id: 'v1' }],
      registeredApps: [],
      transactions: [{ id: 't1' }],
      shifts: [],
      activeShift: null,
      financialCommitments: [],
      payableInstallments: [],
      maintenanceReserveLedger: [],
    };
    const result = buildAccountExport('bruno@example.com', data);
    expect(result.application).toBe('Giro Certo');
    expect(result.account.email).toBe('bruno@example.com');
    expect(result.data).toBe(data);
    expect(Number.isNaN(Date.parse(result.exportedAt))).toBe(false);
  });
});
