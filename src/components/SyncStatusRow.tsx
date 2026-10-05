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
      <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-slate-400">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
        Modo local — dados só neste dispositivo
      </div>
    );
  }

  if (syncStatus.state === 'syncing') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-slate-400">
        <RefreshCw className="w-3 h-3 animate-spin" />
        Sincronizando
        {syncQueue.pending > 0 && <span className="text-slate-500">· {syncQueue.pending}</span>}
      </div>
    );
  }

  if (syncStatus.state === 'offline') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-amber-400">
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
      <div className="flex items-center gap-2 px-3 py-2 text-[11px]">
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
    );
  }

  if (showSynced) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-emerald-400">
        <Check className="w-3 h-3" />
        Sincronizado
      </div>
    );
  }

  if (hasPending) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-slate-400">
        <Cloud className="w-3 h-3" />
        {syncQueue.pending} alteração{syncQueue.pending > 1 ? 'ões' : 'ão'} na fila
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-slate-500">
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
        className="w-full flex items-center gap-2 px-3 py-2.5 text-[11px] text-slate-300 hover:text-white"
      >
        <Cloud className="w-3.5 h-3.5 text-emerald-400" />
        Ativar conta na nuvem
        <ChevronHint />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2.5 text-[11px]">
      <div className="min-w-0 flex-1">
        <span className="block text-slate-500 uppercase tracking-wider text-[9px]">Conta</span>
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
