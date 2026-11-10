import React, { useCallback, useEffect, useState } from 'react';
import { ClipboardCopy, FileSearch, RefreshCw, Trash2 } from 'lucide-react';
import { clearCopilotLog, getCopilotLog, type CopilotLogEntry } from '../lib/rideOffer';

export const CopilotLogPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<CopilotLogEntry[]>([]);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => setEntries(await getCopilotLog()), []);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const copy = async () => {
    const text = entries
      .map((e) => `[${e.at}] ${e.event} (${e.source}) ${e.detail}${e.raw ? `\n  texto: ${e.raw}` : ''}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text || 'Registro vazio');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 p-2.5 text-left">
        <FileSearch className="h-3.5 w-3.5 text-purple-400" />
        <span className="text-xs font-bold text-slate-100">Diagnóstico das leituras</span>
        <span className="ml-auto text-[10px] text-slate-500">{open ? entries.length : ''}</span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-slate-800 p-2.5">
          <div className="flex gap-2">
            <button type="button" onClick={() => void copy()} className="flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-[10px] font-bold text-white">
              <ClipboardCopy className="h-3 w-3" /> {copied ? 'Copiado ✓' : 'Copiar registro'}
            </button>
            <button type="button" onClick={() => void refresh()} className="flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[10px] text-slate-300">
              <RefreshCw className="h-3 w-3" /> Atualizar
            </button>
            <button type="button" onClick={() => void clearCopilotLog().then(refresh)} className="flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[10px] text-slate-300">
              <Trash2 className="h-3 w-3" /> Limpar
            </button>
          </div>
          {entries.length === 0 && <p className="text-[11px] text-slate-500">Nenhuma leitura ainda. Fique online e espere uma oferta.</p>}
          {entries.map((e, i) => (
            <div key={`${e.at}-${i}`} className="rounded bg-slate-950/70 p-2 text-[10px]">
              <p className="font-bold text-slate-200">
                {e.at} · {e.event} <span className="font-normal text-slate-500">({e.source})</span>
              </p>
              {e.detail && <p className="text-emerald-300/90">{e.detail}</p>}
              {e.raw && <p className="mt-0.5 line-clamp-3 break-words text-slate-500">{e.raw}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
