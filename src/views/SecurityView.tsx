import React, { useCallback, useEffect, useState } from 'react';
import { Camera, CircleDot, Info, Mic, MicOff, ShieldCheck, Smartphone, SwitchCamera } from 'lucide-react';
import {
  getFloatingButton,
  getSecurityCameraStatus,
  openOverlaySettings,
  setFloatingButton,
  type FloatingButtonState,
  isSecurityCameraAvailable,
  requestSecurityCameraAccess,
  saveSecurityCameraSettings,
  startSecurityCamera,
  stopSecurityCamera,
  type SecurityCameraStatus,
} from '../lib/securityCamera';
import { PanicCard } from '../components/PanicCard';

const clock = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function elapsed(from: number): string {
  const total = Math.max(0, Math.floor((Date.now() - from) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h > 0 ? `${h}:` : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const SecurityView: React.FC = () => {
  const native = isSecurityCameraAvailable();
  const [status, setStatus] = useState<SecurityCameraStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);
  const [floating, setFloating] = useState<FloatingButtonState | null>(null);
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    if (!native) return;
    const [camera, bubble] = await Promise.all([getSecurityCameraStatus(), getFloatingButton()]);
    setStatus(camera);
    setFloating(bubble);
  }, [native]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      tick((v) => v + 1);
      void refresh();
    }, 1000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  if (!native) {
    return (
      <div className="p-4 text-sm text-slate-400">A câmera de segurança funciona no aplicativo Android.</div>
    );
  }
  if (!status) return null;

  const toggle = async () => {
    setBusy(true);
    try {
      if (status.recording) {
        await stopSecurityCamera();
      } else {
        const access = status.cameraGranted ? status : await requestSecurityCameraAccess();
        setStatus(access);
        if (!access.cameraGranted) {
          setNotice('Permita a câmera para gravar (Configurações do Android → Apps → Giro Certo → Permissões).');
          return;
        }
        setNotice('Iniciando a câmera…');
        await startSecurityCamera();
        window.setTimeout(async () => {
          const after = await getSecurityCameraStatus();
          setStatus(after);
          setNotice(after.recording ? '' : after.lastError || 'A câmera não iniciou. Feche outros apps que usam a câmera e tente de novo.');
        }, 3500);
        return;
      }
      setNotice('');
      window.setTimeout(() => void refresh(), 800);
    } finally {
      setBusy(false);
    }
  };

  const toggleFloating = async () => {
    if (!floating) return;
    if (!floating.canDraw) {
      await openOverlaySettings();
      return;
    }
    setFloating(await setFloatingButton(!floating.enabled));
  };

  const setLens = async (lens: 'front' | 'back') => setStatus(await saveSecurityCameraSettings(lens, status.audio));
  const setAudio = async (audio: boolean) => {
    if (audio && !status.microphoneGranted) await requestSecurityCameraAccess();
    setStatus(await saveSecurityCameraSettings(status.lens, audio));
  };

  return (
    <div className="max-w-md mx-auto space-y-4 px-4 pt-4 pb-28">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-emerald-400" />
        <h2 className="text-lg font-bold text-white">Segurança</h2>
      </div>

      <PanicCard />

      <button
        type="button"
        disabled={busy}
        onClick={() => void toggle()}
        className={`w-full rounded-3xl border p-8 text-center transition-all active:scale-[0.98] ${
          status.recording ? 'border-red-500/60 bg-red-950/40' : 'border-slate-700 bg-slate-900'
        }`}
      >
        <div
          className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full ${
            status.recording ? 'bg-red-600 animate-pulse' : 'bg-slate-800'
          }`}
        >
          <Camera className="h-10 w-10 text-white" />
        </div>
        <p className="mt-4 text-base font-bold text-white">
          {status.recording ? 'Gravando · toque para parar' : 'Toque para gravar'}
        </p>
        <p className="mt-1 font-mono text-sm text-slate-400">
          {status.recording && status.startedAt ? elapsed(status.startedAt) : 'Câmera desligada'}
        </p>
      </button>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => void setLens(status.lens === 'front' ? 'back' : 'front')}
          disabled={status.recording}
          className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 p-3 text-left disabled:opacity-50"
        >
          <SwitchCamera className="h-4 w-4 text-blue-400" />
          <span className="text-xs text-slate-200">
            Câmera <b>{status.lens === 'front' ? 'frontal (cabine)' : 'traseira'}</b>
          </span>
        </button>
        <button
          type="button"
          onClick={() => void setAudio(!status.audio)}
          disabled={status.recording}
          className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 p-3 text-left disabled:opacity-50"
        >
          {status.audio ? <Mic className="h-4 w-4 text-emerald-400" /> : <MicOff className="h-4 w-4 text-slate-500" />}
          <span className="text-xs text-slate-200">
            Áudio <b>{status.audio ? 'ligado' : 'desligado'}</b>
          </span>
        </button>
      </div>

      {notice && <p className="rounded-lg bg-blue-500/10 p-3 text-xs text-blue-200">{notice}</p>}

      {floating && (
        <button
          type="button"
          onClick={() => void toggleFloating()}
          className="flex w-full items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3 text-left"
        >
          <CircleDot className={`h-5 w-5 ${floating.enabled ? 'text-emerald-400' : 'text-slate-500'}`} />
          <span className="flex-1">
            <span className="block text-sm font-bold text-slate-100">Botão flutuante na tela</span>
            <span className="block text-[11px] text-slate-400">
              {floating.canDraw
                ? 'Bolinha do Giro Certo por cima da tela inicial e dos apps. Toque para abrir, arraste para mover.'
                : 'Toque para permitir "Sobrepor a outros apps" e depois volte aqui para ligar.'}
            </span>
          </span>
          <span
            className={`flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${
              floating.enabled ? 'bg-emerald-500 justify-end' : 'bg-slate-700 justify-start'
            }`}
          >
            <span className="h-5 w-5 rounded-full bg-white" />
          </span>
        </button>
      )}

      {status.lastError && <p className="rounded-lg bg-amber-500/10 p-3 text-xs text-amber-300">{status.lastError}</p>}
      {status.lastVideoName && (
        <p className="rounded-lg bg-slate-900 p-3 text-xs text-slate-400">
          Último vídeo: <span className="text-slate-200">{status.lastVideoName}</span> ·{' '}
          {clock.format(status.lastVideoAt)} · Galeria → Filmes/GiroCerto
        </p>
      )}

      <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-xs text-slate-400">
        <p className="flex items-start gap-2">
          <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <span>
            <b className="text-slate-200">Atalho rápido:</b> segure o ícone do Giro Certo na tela inicial e toque em{' '}
            <b className="text-slate-200">"Gravar câmera"</b>. O celular vibra 1x ao começar e 2x ao parar. Dá para
            arrastar o atalho para a tela inicial.
          </span>
        </p>
        <p className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
          <span>
            A gravação não mostra imagem na tela e continua com o celular bloqueado ou em outro app. Por regra do
            Android, aparece uma notificação discreta ("Proteção ativa") e o indicador verde de câmera. Os vídeos são
            salvos em trechos de 30 minutos na galeria.
          </span>
        </p>
        <p className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <span>
            Recomendado: um adesivo "veículo monitorado por câmera" no carro. Use as gravações só para sua segurança
            e entregue-as às autoridades quando precisar.
          </span>
        </p>
      </div>
    </div>
  );
};
