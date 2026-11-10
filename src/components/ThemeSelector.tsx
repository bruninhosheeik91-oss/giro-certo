import React, { useEffect, useState } from 'react';
import { Moon, Sun, SunMoon } from 'lucide-react';
import { readThemeMode, resolveTheme, setThemeMode, THEME_EVENT, type ThemeMode } from '../lib/theme';

const OPTIONS: { id: ThemeMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'auto', label: 'Automático', icon: SunMoon },
  { id: 'sol', label: 'Modo Sol', icon: Sun },
  { id: 'escuro', label: 'Escuro', icon: Moon },
];

export const ThemeSelector: React.FC = () => {
  const [mode, setMode] = useState<ThemeMode>(readThemeMode);

  useEffect(() => {
    const sync = () => setMode(readThemeMode());
    window.addEventListener(THEME_EVENT, sync);
    return () => window.removeEventListener(THEME_EVENT, sync);
  }, []);

  const choose = (next: ThemeMode) => {
    setThemeMode(next);
    setMode(next);
  };

  return (
    <section aria-label="Aparência" className="space-y-3 rounded-[20px] border border-slate-800/70 bg-slate-900 p-4">
      <div>
        <h3 className="text-[15px] font-bold text-white">Aparência</h3>
        <p className="text-[13px] text-slate-400">
          {mode === 'auto'
            ? `Modo Sol das 6h às 18h e escuro à noite. Agora: ${resolveTheme('auto') === 'sol' ? 'Modo Sol' : 'escuro'}.`
            : mode === 'sol'
              ? 'Tela clara de alto contraste, para ler sob o sol.'
              : 'Tela escura, confortável à noite.'}
        </p>
      </div>
      <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-2">
        {OPTIONS.map(({ id, label, icon: Icon }) => {
          const active = mode === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => choose(id)}
              className={`flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl border text-[13px] font-semibold active:scale-95 ${
                active ? 'border-emerald-400 bg-emerald-500/10 text-emerald-400' : 'border-slate-800 bg-slate-800/50 text-slate-300'
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          );
        })}
      </div>
    </section>
  );
};
