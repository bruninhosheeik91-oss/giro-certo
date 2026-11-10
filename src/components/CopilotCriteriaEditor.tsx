import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useTargetBar } from '../hooks/useTargetBar';
import { formatBRL, parseDecimalInput } from '../utils/calculations';
import { readManualCostPerKm, saveManualCostPerKm } from '../utils/targetBar';

interface CopilotCriteriaEditorProps {
  minRating: number;
  onMinRatingChange: (value: number) => void;
}

const field =
  'w-24 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-right text-sm font-bold text-white';

const toInput = (value: number) => (value > 0 ? value.toString().replace('.', ',') : '');

export const CopilotCriteriaEditor: React.FC<CopilotCriteriaEditorProps> = ({ minRating, onMinRatingChange }) => {
  const { userProfile, updateUserProfile } = useApp();
  const { bar } = useTargetBar();
  const criteria = userProfile.rideCriteria;
  const [open, setOpen] = useState(false);
  const [cost, setCost] = useState(() => toInput(readManualCostPerKm()));
  const [perKm, setPerKm] = useState(toInput(criteria.minProfitPerKm));
  const [perHour, setPerHour] = useState(toInput(criteria.minProfitPerHour));
  const [minFare, setMinFare] = useState(toInput(criteria.minAcceptableValue));
  const [rating, setRating] = useState(toInput(minRating));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCost(toInput(readManualCostPerKm()));
    setPerKm(toInput(criteria.minProfitPerKm));
    setPerHour(toInput(criteria.minProfitPerHour));
    setMinFare(toInput(criteria.minAcceptableValue));
    setRating(toInput(minRating));
  }, [open, criteria, minRating]);

  const autoCost = bar.costSource === 'manual' ? null : bar.costPerKm;
  const preview = useMemo(() => {
    const c = parseDecimalInput(cost) || autoCost || bar.costPerKm;
    const k = parseDecimalInput(perKm) || 0;
    return c + k;
  }, [cost, perKm, autoCost, bar.costPerKm]);

  const save = () => {
    const k = parseDecimalInput(perKm);
    const h = parseDecimalInput(perHour);
    const f = parseDecimalInput(minFare);
    const r = parseDecimalInput(rating);
    updateUserProfile({
      rideCriteria: {
        ...criteria,
        minProfitPerKm: k >= 0 ? k : criteria.minProfitPerKm,
        minProfitPerHour: h >= 0 ? h : criteria.minProfitPerHour,
        minAcceptableValue: f >= 0 ? f : criteria.minAcceptableValue,
      },
    });
    saveManualCostPerKm(parseDecimalInput(cost) || 0);
    if (r >= 1 && r <= 5) onMinRatingChange(r);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  const row = (label: string, hint: string, value: string, set: (v: string) => void, placeholder?: string) => (
    <label className="flex items-center gap-2">
      <span className="flex-1">
        <span className="block text-xs font-bold text-slate-200">{label}</span>
        <span className="block text-[11px] text-slate-500">{hint}</span>
      </span>
      <input inputMode="decimal" value={value} placeholder={placeholder} onChange={(e) => set(e.target.value)} className={field} />
    </label>
  );

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 p-2.5 text-left">
        <SlidersHorizontal className="h-3.5 w-3.5 text-blue-400" />
        <span className="text-xs font-bold text-slate-100">Meus critérios</span>
        <span className="ml-auto text-[11px] text-slate-400">
          custo {formatBRL(bar.costPerKm)}/km · lucro mín {formatBRL(criteria.minProfitPerKm)}/km
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="space-y-3 border-t border-slate-800 p-3">
          {row(
            'Custo por km (R$)',
            autoCost != null
              ? `Vazio = automático (${formatBRL(autoCost)}: combustível + reserva)`
              : 'Combustível + manutenção por km. Vazio = automático',
            cost,
            setCost,
            autoCost != null ? autoCost.toFixed(2).replace('.', ',') : 'auto',
          )}
          {row('Lucro mínimo por km (R$)', 'Quanto quer sobrar por km, já descontado o custo', perKm, setPerKm)}
          {row('Lucro mínimo por hora (R$)', 'Considera o tempo até o passageiro + viagem', perHour, setPerHour)}
          {row('Valor mínimo da corrida (R$)', 'Abaixo disso é sempre vermelho', minFare, setMinFare)}
          {row('Nota mínima do passageiro', 'De 1 a 5', rating, setRating)}

          <div className="rounded-lg bg-emerald-500/10 p-2.5 text-center text-xs text-emerald-200">
            Com esses números, o Copiloto fica verde em ofertas acima de{' '}
            <b className="text-sm text-emerald-300">{formatBRL(preview)}/km</b> (o "R$/km" que a Uber e a 99 mostram).
          </div>

          <button type="button" onClick={save} className="w-full rounded-lg bg-blue-600 py-2.5 text-xs font-bold text-on-accent">
            {saved ? 'Critérios salvos ✓' : 'Salvar critérios'}
          </button>
        </div>
      )}
    </div>
  );
};
