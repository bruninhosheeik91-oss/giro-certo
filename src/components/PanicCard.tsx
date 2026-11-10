import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CircleDot, PhoneCall, Send, ShieldAlert, Siren, Trash2, UserPlus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useSession } from '../context/SessionContext';
import {
  activateSilentPanic,
  addPanicContact,
  callPolice,
  formatPhone,
  isValidBrazilPhone,
  listPanicContacts,
  MAX_PANIC_CONTACTS,
  removePanicContact,
  sendPanicTest,
  type PanicContact,
} from '../lib/panic';
import { nativePanic, type PanicStatus } from '../lib/securityCamera';

const HOLD_MS = 1500;

export const PanicCard: React.FC = () => {
  const { userProfile } = useApp();
  const { mode } = useSession();
  const cloud = mode === 'cloud';
  const [contacts, setContacts] = useState<PanicContact[]>([]);
  const [status, setStatus] = useState<PanicStatus | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const timer = useRef<number | null>(null);
  const started = useRef(0);
  const driverName = userProfile.name?.trim() || 'Motorista';

  const refresh = useCallback(async () => {
    setStatus(await nativePanic.status());
    if (cloud) setContacts(await listPanicContacts().catch(() => []));
  }, [cloud]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void nativePanic.status().then(setStatus), 3000);
    return () => window.clearInterval(id);
  }, [refresh]);

  useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current);
  }, []);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setMessage('');
    try {
      await task();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Algo deu errado.');
    } finally {
      setBusy(false);
    }
  };

  const add = () =>
    run(async () => {
      if (!isValidBrazilPhone(phone)) throw new Error('Digite o WhatsApp com DDD.');
      await addPanicContact(name, phone);
      setName('');
      setPhone('');
      await refresh();
    });

  const activate = () =>
    run(async () => {
      setStatus(await activateSilentPanic(driverName));
      setMessage('Pânico silencioso ativado neste celular.');
    });

  const test = () =>
    run(async () => {
      const result = await sendPanicTest(driverName);
      setMessage(
        result.total === 0
          ? 'Cadastre ao menos um contato.'
          : `Teste enviado para ${result.sent} de ${result.total} contato(s).${result.errors.length ? ` Erro: ${result.errors[0]}` : ''}`,
      );
    });

  const cancelHold = () => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    setProgress(0);
  };

  const startHold = () => {
    if (!status?.configured || status.active) return;
    started.current = Date.now();
    timer.current = window.setInterval(() => {
      const value = Math.min(1, (Date.now() - started.current) / HOLD_MS);
      setProgress(value);
      if (value >= 1) {
        cancelHold();
        void nativePanic.trigger().then(setStatus);
      }
    }, 30);
  };

  if (!cloud) {
    return (
      <div className="rounded-2xl border border-red-500/40 bg-red-950/20 p-4 text-xs text-slate-300">
        <p className="mb-1 flex items-center gap-2 text-sm font-bold text-white">
          <Siren className="h-5 w-5 text-red-400" /> Botão de pânico
        </p>
        Para avisar seus contatos pela internet, entre na sua conta (Perfil → Ativar conta na nuvem).
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-red-500/40 bg-red-950/20 p-4">
      <div className="flex items-center gap-2">
        <Siren className="h-5 w-5 text-red-400" />
        <span className="text-sm font-bold text-white">Botão de pânico silencioso</span>
        {status?.active && (
          <span className="ml-auto animate-pulse rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
            ALERTA ATIVO
          </span>
        )}
      </div>

      {status?.active ? (
        <div className="space-y-2">
          <p className="rounded-lg bg-slate-950/60 p-2.5 text-[11px] text-slate-200">{status.status || 'Enviando…'}</p>
          <button
            type="button"
            onClick={() => void nativePanic.end().then(() => window.setTimeout(() => void refresh(), 1500))}
            className="w-full rounded-lg bg-emerald-600 py-2.5 text-xs font-bold text-white"
          >
            Estou bem · encerrar alerta
          </button>
        </div>
      ) : status?.configured ? (
        <button
          type="button"
          onPointerDown={startHold}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          onPointerCancel={cancelHold}
          onContextMenu={(e) => e.preventDefault()}
          className="relative w-full select-none overflow-hidden rounded-2xl bg-red-700 py-5 text-center text-white"
        >
          <span className="absolute inset-y-0 left-0 bg-red-400/60" style={{ width: `${progress * 100}%` }} />
          <span className="relative block text-base font-black">SEGURE PARA PEDIR AJUDA</span>
          <span className="relative mt-0.5 block text-[10px] text-red-100">
            Nada aparece na tela. Câmera grava e seus contatos recebem o WhatsApp.
          </span>
        </button>
      ) : null}

      <div className="flex items-start gap-2 rounded-lg bg-slate-950/50 p-2.5 text-[11px] text-slate-300">
        <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
        <span>
          <b className="text-white">Modo discreto:</b> com o botão flutuante ligado, <b className="text-white">segure a bolinha por 2
          segundos</b>. Nada muda na tela, sem som e sem vibração. Funciona com o Giro Certo fechado.
        </span>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-bold text-slate-300">
          Contatos que recebem o alerta no WhatsApp ({contacts.length}/{MAX_PANIC_CONTACTS})
        </p>
        {contacts.map((c) => (
          <div key={c.id} className="flex items-center gap-2 rounded-lg bg-slate-950/60 p-2 text-xs">
            <span className="flex-1 text-slate-200">
              {c.name} <span className="text-slate-500">· {formatPhone(c.phone)}</span>
            </span>
            <button type="button" onClick={() => void run(async () => { await removePanicContact(c.id); await refresh(); })} aria-label="Remover">
              <Trash2 className="h-3.5 w-3.5 text-slate-500" />
            </button>
          </div>
        ))}
        {contacts.length < MAX_PANIC_CONTACTS && (
          <div className="flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" className="w-24 rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-white" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="WhatsApp com DDD" className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-white" />
            <button type="button" disabled={busy} onClick={() => void add()} className="rounded-lg bg-slate-700 px-2.5 text-white" aria-label="Adicionar contato">
              <UserPlus className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button type="button" disabled={busy || contacts.length === 0} onClick={() => void activate()} className="flex flex-col items-center gap-1 rounded-lg bg-slate-800 py-2 text-[10px] font-bold text-white disabled:opacity-40">
          <ShieldAlert className="h-4 w-4 text-red-400" /> {status?.configured ? 'Reativar' : 'Ativar'}
        </button>
        <button type="button" disabled={busy || contacts.length === 0} onClick={() => void test()} className="flex flex-col items-center gap-1 rounded-lg bg-slate-800 py-2 text-[10px] font-bold text-white disabled:opacity-40">
          <Send className="h-4 w-4 text-blue-400" /> Enviar teste
        </button>
        <button type="button" onClick={() => void callPolice()} className="flex flex-col items-center gap-1 rounded-lg bg-slate-800 py-2 text-[10px] font-bold text-white">
          <PhoneCall className="h-4 w-4 text-amber-400" /> Ligar 190
        </button>
      </div>

      {status && !status.locationGranted && status.configured && (
        <button type="button" onClick={() => void nativePanic.requestLocation().then(setStatus)} className="w-full rounded-lg bg-amber-500/15 p-2 text-[11px] text-amber-300">
          Permita a localização para o mapa ao vivo funcionar
        </button>
      )}
      {message && <p className="text-[11px] text-amber-200">{message}</p>}
      <p className="text-[10px] text-slate-500">
        Precisa de internet (Wi-Fi ou roteador do celular). Sem conexão, o app tenta de novo a cada 15 segundos.
      </p>
    </div>
  );
};
