import { getSupabaseClient } from './auth';

export interface AccountExportData {
  profile: unknown;
  vehicles: unknown[];
  registeredApps: unknown[];
  transactions: unknown[];
  shifts: unknown[];
  activeShift: unknown;
  financialCommitments: unknown[];
  payableInstallments: unknown[];
  maintenanceReserveLedger: unknown[];
}

export function buildAccountExport(email: string | null, data: AccountExportData) {
  return {
    application: 'Giro Certo',
    exportedAt: new Date().toISOString(),
    account: { email },
    data,
  };
}

export async function shareAccountExport(email: string | null, data: AccountExportData) {
  const exportData = buildAccountExport(email, data);
  const content = JSON.stringify(exportData, null, 2);
  const date = new Date().toISOString().slice(0, 10);
  const file = new File([content], `giro-certo-dados-${date}.json`, {
    type: 'application/json',
  });

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title: 'Meus dados do Giro Certo', files: [file] });
    return;
  }

  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function deleteCurrentAccount(confirmation: string): Promise<void> {
  if (confirmation !== 'EXCLUIR') throw new Error('Digite EXCLUIR para confirmar.');
  const client = getSupabaseClient();
  if (!client) throw new Error('A exclusão exige uma conta conectada à nuvem.');

  const { data: sessionData } = await client.auth.getSession();
  const userId = sessionData.session?.user.id;

  const { error } = await client.rpc('delete_my_account', { p_confirmation: confirmation });
  if (error) throw new Error(error.message || 'Não foi possível excluir a conta.');
  if (userId) {
    const prefix = `giro_certo_user_${encodeURIComponent(userId).replaceAll('.', '_')}_v4`;
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(prefix)) localStorage.removeItem(key);
    }
  }
  await client.auth.signOut({ scope: 'local' });
}
