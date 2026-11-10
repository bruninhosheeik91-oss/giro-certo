import React, { useEffect, useRef, useState } from 'react';
import { PhoneCall, Siren, UserRound } from 'lucide-react';
import {
  callPolice,
  readEmergencyContact,
  saveEmergencyContact,
  triggerPanic,
  type EmergencyContact,
  type PanicResult,
} from '../lib/panic';

const HOLD_MS = 1000;

export const PanicCard: React.FC = () => {
  const [contact, setContact] = useState<EmergencyContact | null>(readEmergencyContact);
  const [editing, setEditing] = useState(!readEmergencyContact());
  const [name, setName] = useState(contact?.name ?? '');
  const [phone, setPhone] = useState(contact?.phone ?? '');
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PanicResult | null>(null);
  const timer = useRef<number | null>(null);
  const started = useRef(0);

  useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current);
  }, []);

  const save = () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) return;
    const next = { name: name.trim() || 'Contato de confiança', phone: phone.trim() };
    saveEmergencyContact(next);
    setContact(next);
    setEditing(false);
  };

  const fire = async () => {
    if (!contact) return;
    setBusy(true);
    try {
      setResult(await triggerPanic(contact));
    } finally {
      setBusy(false);
    }
  };

  const startHold = () => {
    if (busy || !contact) return;
    started.current = Date.now();
    timer.current = window.setInterval(() => {
      const value = Math.min(1, (Date.now() - started.current) / HOLD_MS);
      setProgress(value);
      if (value >= 1) {
        cancelHold();
        if ('vibrate' in navigator) navigator.vibrate?.(200);
        void fire();
      }
    }, 30);
  };

  const cancelHold = () => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    setProgress(0);
  };

  return (
    <div className="space-y-3 rounded-2xl border border-red-500/40 bg-red-950/20 p-4">
      <div className="flex items-center gap-2">
        <Siren className="h-5 w-5 text-red-400" />
        <span className="text-sm font-bold text-white">Botão de pânico</span>
      </div>

      {editing || !contact ? (
        <div className="space-y-2">
          <p className="text-[11px] text-slate-400">Contato que vai receber sua localização no WhatsApp:</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome (ex.: Esposa, Irmão)"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="WhatsApp com DDD (ex.: 16 99123-4567)"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          />
          <button
            type="button"
            onClick={save}
            disabled={phone.replace(/\D/g, '').length < 10}
            className="w-full rounded-lg bg-red-600 py-2.5 text-xs font-bold text-white disabled:opacity-40"
          >
            Salvar contato
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            onPointerDown={startHold}
            onPointerUp={cancelHold}
            onPointerLeave={cancelHold}
            onPointerCancel={cancelHold}
            onContextMenu={(e) => e.preventDefault()}
            disabled={busy}
            className="relative w-full select-none overflow-hidden rounded-2xl bg-red-600 py-6 text-center text-white active:scale-[0.98] disabled:opacity-60"
          >
            <span
              className="absolute inset-y-0 left-0 bg-red-400/60 transition-none"
              style={{ width: `${progress * 100}%` }}
            />
            <span className="relative block text-lg font-black tracking-wide">
              {busy ? 'ENVIANDO…' : 'SEGURE PARA PEDIR AJUDA'}
            </span>
            <span className="relative mt-1 block text-[11px] text-red-100">
              Grava a câmera e abre o WhatsApp de {contact.name} com sua localização
            </span>
          </button>

          {result && (
            <p className="rounded-lg bg-slate-950/60 p-2.5 text-[11px] text-slate-300">
              {result.recording ? '🎥 Câmera gravando' : '⚠️ Câmera não iniciou'} ·{' '}
              {result.location ? '📍 Localização incluída' : '⚠️ Sem localização (ative o GPS)'} ·{' '}
              {result.opened === 'whatsapp'
                ? 'toque em ENVIAR no WhatsApp'
                : result.opened === 'sms'
                  ? 'toque em ENVIAR no SMS'
                  : 'não foi possível abrir WhatsApp/SMS'}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void callPolice()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-800 py-2 text-xs font-bold text-white"
            >
              <PhoneCall className="h-3.5 w-3.5" /> Ligar 190
            </button>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-800 py-2 text-xs text-slate-300"
            >
              <UserRound className="h-3.5 w-3.5" /> {contact.name}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
