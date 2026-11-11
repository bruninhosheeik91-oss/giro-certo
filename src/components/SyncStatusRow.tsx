import React, { useEffect, useState } from 'react';
import { CloudOff, RefreshCw, LogOut, Check, Cloud, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';

const SYNCED_VISIBLE_MS = 4000;

/**
 * Status de sincronização em uma linha discreta.
 *
 * A regra éoposta à do dashboard: nada de spinner ou contagem contínua quando
 * está tudo certo. "Sincronizado" aparece por alguns segundos depois de uma
 * sincronização bem-sucedida e some sozinho.
 */
const TABLE_LABEL: Record<string, string> = {
  transactions: 'Lançamento',
  shifts: 'Jornada',
  vehicles: 'Veículo',
  user_settings: 'Perfil e apps',
  commitments: 'Conta do mês',
  installments: 'Parcela',
  fuel_records: 'Abastecimento',
  shift_pauses: 'Pausa da jornada',
};

export const SyncStatusRow: React.FC = () => {
  const { mode, syncStatus, syncQueue, retryPendingSync } = useApp();
  const [showSynced, setShowSynced] = useState(false);

  const isCloud = mode === 'cloud';
  const idle = syncStatus.state === 'idle';
  const hasPending = syncQueue.pending > 0;
  const justSynced = idle && !hasPending;

  useEffect(() => {
    if (!justSynced) {
      setShowSynced(false);
      return;
    }
    setShowSynced(true);
    const timer = window.setTimeout(() => setShowSynced(false), SYNCED_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [justSynced, syncQueue.blocked]);

  if (!isCloud) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
        Modo local — dados só neste dispositivo
      </div>
    );
  }

  if (syncStatus.state === 'syncing') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400">
        <RefreshCw className="w-3 h-3 animate-spin" />
        Sincronizando
        {syncQueue.pending > 0 && <span className="text-slate-500">· {syncQueue.pending}</span>}
      </div>
    );
  }

  if (syncStatus.state === 'offline') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-amber-400">
        <CloudOff className="w-3 h-3" />
        Offline
        {syncQueue.pending > 0 && (
          <span className="text-amber-500/70">
            · {syncQueue.pending} pendente{syncQueue.pending > 1 ? 's' : ''}
          </span>
        )}
      </div>
    );
  }

  if (syncQueue.blocked > 0 || syncStatus.state === 'error') {
    return (
      <>
      <div className="flex items-center gap-2 px-3 py-2 text-xs">
        <AlertTriangle className="w-3 h-3 text-rose-400" />
        <span className="text-rose-300">
          {syncQueue.blocked > 0
            ? syncQueue.blocked > 1
              ? `${syncQueue.blocked} alterações não enviadas`
              : '1 alteração não enviada'
            : 'Falha ao sincronizar'}
        </span>
        <button
          type="button"
          onClick={() => void retryPendingSync()}
          className="ml-auto font-semibold text-rose-200 underline underline-offset-2 hover:text-white"
        >
          Tentar novamente
        </button>
      </div>
      {syncQueue.blockedDetails && syncQueue.blockedDetails.length > 0 && (
        <details className="px-3 pb-2 text-[11px] text-slate-400">
          <summary className="cursor-pointer text-slate-300">Ver motivo</summary>
          <ul className="mt-1 space-y-1">
            {syncQueue.blockedDetails.map((d, i) => (
              <li key={i} className="break-words">
                <span className="font-semibold text-slate-300">{TABLE_LABEL[d.table] || d.table}:</span> {d.error}
              </li>
            ))}
          </ul>
        </details>
      )}
      </>
    );
  }

  if (showSynced) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-emerald-400">
        <Check className="w-3 h-3" />
        Sincronizado
      </div>
    );
  }

  if (hasPending) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400">
        <Cloud className="w-3 h-3" />
        {syncQueue.pending} alteração{syncQueue.pending > 1 ? 'ões' : 'ão'} na fila
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60" />
      Sincronizado
    </div>
  );
};

export const AccountRow: React.FC = () => {
  const { mode, cloudEmail, enableCloudMode, signOut } = useApp();
  const [busy, setBusy] = useState(false);

  if (mode !== 'cloud') {
    return (
      <button
        type="button"
        onClick={enableCloudMode}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-slate-300 hover:text-white"
      >
        <Cloud className="w-3.5 h-3.5 text-emerald-400" />
        Ativar conta na nuvem
        <ChevronHint />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2.5 text-xs">
      <div className="min-w-0 flex-1">
        <span className="block text-slate-500 uppercase tracking-wider text-[11px]">Conta</span>
        <span className="block text-slate-300 truncate">{cloudEmail ?? 'Conectado'}</span>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void signOut().finally(() => setBusy(false));
        }}
        className="flex items-center gap-1.5 text-slate-400 hover:text-rose-300 disabled:opacity-50"
      >
        <LogOut className="w-3.5 h-3.5" />
        Sair
      </button>
    </div>
  );
};

const ChevronHint: React.FC = () => <span className="ml-auto text-slate-600">›</span>;
