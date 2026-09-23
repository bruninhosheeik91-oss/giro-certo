import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { TransactionType, FuelType, MaintenanceCategory, OtherExpenseCategory } from '../types';
import { formatBRL, formatBRLInput, parseBRLInput } from '../utils/calculations';
import { X, PlusCircle, Fuel, Wrench, Wallet, Check, Clock, Link, Unlink } from 'lucide-react';

const MAINTENANCE_CATEGORIES: MaintenanceCategory[] = [
  'Troca de óleo',
  'Pneu dianteiro',
  'Pneu traseiro',
  'Relação',
  'Freios',
  'Filtro',
  'Revisão',
  'Elétrica',
  'Motor',
  'Suspensão',
  'Lavagem',
  'Acessório',
  'Outra',
];

const OTHER_CATEGORIES: OtherExpenseCategory[] = [
  'Alimentação',
  'Estacionamento',
  'Pedágio',
  'Seguro',
  'Financiamento',
  'Aluguel do veículo',
  'IPVA',
  'Licenciamento',
  'Multa',
  'Internet',
  'Equipamentos',
  'Impostos',
  'Outra',
];

export const NewTransactionModal: React.FC = () => {
  const {
    isNewTransactionModalOpen,
    closeNewTransactionModal,
    modalDefaultType,
    addTransaction,
    vehicles,
    activeVehicle,
    registeredApps,
    activeShift,
    shifts,
  } = useApp();

  const [activeType, setActiveType] = useState<TransactionType>('ganho');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Common dates
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [description, setDescription] = useState('');

  // 1. Ganho states
  const [gainType, setGainType] = useState<'total_periodo' | 'individual'>('total_periodo');
  const [app, setApp] = useState<string>('Uber');
  const [baseAmountStr, setBaseAmountStr] = useState('');
  const [tipAmountStr, setTipAmountStr] = useState('');
  const [bonusAmountStr, setBonusAmountStr] = useState('');
  const [ridesCount, setRidesCount] = useState<string>('1');
  const [linkedShiftId, setLinkedShiftId] = useState<string>('');

  // 2. Abastecer states
  const [fuelVehicleId, setFuelVehicleId] = useState<string>('');
  const [fuelTotalStr, setFuelTotalStr] = useState('');
  const [litersStr, setLitersStr] = useState('');
  const [pricePerLiterStr, setPricePerLiterStr] = useState('');
  const [fuelType, setFuelType] = useState<FuelType>('Gasolina');
  const [fuelKmStr, setFuelKmStr] = useState('');
  const [stationName, setStationName] = useState('');
  const [fullTank, setFullTank] = useState(true);

  // 3. Manutenção states
  const [maintVehicleId, setMaintVehicleId] = useState<string>('');
  const [maintenanceCategory, setMaintenanceCategory] =
    useState<MaintenanceCategory>('Troca de óleo');
  const [servicePerformed, setServicePerformed] = useState('');
  const [partsAmountStr, setPartsAmountStr] = useState('');
  const [laborAmountStr, setLaborAmountStr] = useState('');
  const [workshop, setWorkshop] = useState('');
  const [maintKmStr, setMaintKmStr] = useState('');
  const [nextMaintenanceKmStr, setNextMaintenanceKmStr] = useState('');
  const [nextMaintenanceDate, setNextMaintenanceDate] = useState('');

  // 4. Outro states
  const [otherCategory, setOtherCategory] = useState<OtherExpenseCategory>('Alimentação');
  const [otherAmountStr, setOtherAmountStr] = useState('');
  const [otherVehicleId, setOtherVehicleId] = useState<string>('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<'Semanal' | 'Mensal' | 'Anual'>(
    'Mensal',
  );

  // Error validation states
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isNewTransactionModalOpen) {
      setActiveType(modalDefaultType || 'ganho');
      const now = new Date();
      setDate(now.toISOString().split('T')[0]);
      setTime(
        `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`,
      );

      // Reset forms
      setBaseAmountStr('');
      setTipAmountStr('');
      setBonusAmountStr('');
      setRidesCount('1');
      setDescription('');
      setErrors({});
      setShowDiscardConfirm(false);
      setIsSubmitting(false);

      // Default active vehicle and current mileage (single source of truth)
      if (activeVehicle) {
        setFuelVehicleId(activeVehicle.id);
        setMaintVehicleId(activeVehicle.id);
        setFuelKmStr(activeVehicle.currentKm.toString());
        setMaintKmStr(activeVehicle.currentKm.toString());
        setNextMaintenanceKmStr((activeVehicle.currentKm + 3000).toString());
      }

      // Default active app
      const firstActiveApp = registeredApps.find((a) => a.isActive);
      if (firstActiveApp) {
        setApp(firstActiveApp.name);
      }

      // Link to active shift if available, otherwise clear
      if (activeShift) {
        setLinkedShiftId(activeShift.shiftId);
      } else {
        setLinkedShiftId('');
      }
    }
  }, [isNewTransactionModalOpen, modalDefaultType, activeVehicle, registeredApps, activeShift]);

  if (!isNewTransactionModalOpen) return null;

  // Has unsaved edits
  const hasUnsavedEdits = Boolean(
    baseAmountStr || fuelTotalStr || partsAmountStr || otherAmountStr || description,
  );

  const handleAttemptClose = () => {
    if (hasUnsavedEdits) {
      setShowDiscardConfirm(true);
    } else {
      closeNewTransactionModal();
    }
  };

  // Reciprocal calculation for fuel: inform 2 of 3, calculate the 3rd
  const handleFuelTotalChange = (formatted: string) => {
    const clean = formatBRLInput(formatted);
    setFuelTotalStr(clean);
    const total = parseBRLInput(clean);
    const lit = parseFloat(litersStr.replace(',', '.'));
    if (total > 0 && lit > 0) {
      setPricePerLiterStr((total / lit).toFixed(2).replace('.', ','));
    }
  };

  const handleLitersChange = (val: string) => {
    setLitersStr(val);
    const lit = parseFloat(val.replace(',', '.'));
    const total = parseBRLInput(fuelTotalStr);
    const price = parseFloat(pricePerLiterStr.replace(',', '.'));

    if (lit > 0 && total > 0) {
      setPricePerLiterStr((total / lit).toFixed(2).replace('.', ','));
    } else if (lit > 0 && price > 0 && !total) {
      setFuelTotalStr(formatBRLInput((lit * price * 100).toFixed(0)));
    }
  };

  const handlePricePerLiterChange = (val: string) => {
    setPricePerLiterStr(val);
    const price = parseFloat(val.replace(',', '.'));
    const lit = parseFloat(litersStr.replace(',', '.'));
    if (price > 0 && lit > 0) {
      setFuelTotalStr(formatBRLInput((lit * price * 100).toFixed(0)));
    }
  };

  // Computed Totals
  const totalGain =
    parseBRLInput(baseAmountStr) + parseBRLInput(tipAmountStr) + parseBRLInput(bonusAmountStr);
  const totalMaintenance = parseBRLInput(partsAmountStr) + parseBRLInput(laborAmountStr);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const newErrors: Record<string, string> = {};

    if (!date) {
      newErrors.date = 'Data é obrigatória.';
    }

    if (activeType === 'ganho') {
      const base = parseBRLInput(baseAmountStr);
      const tip = parseBRLInput(tipAmountStr);
      const bonus = parseBRLInput(bonusAmountStr);
      const total = base + tip + bonus;

      if (total <= 0) {
        newErrors.baseAmount = 'O valor total do ganho deve ser maior que zero.';
      }
      const count = parseInt(ridesCount, 10);
      if (isNaN(count) || count < 1) {
        newErrors.ridesCount = 'A quantidade de corridas ou entregas deve ser no mínimo 1.';
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      setIsSubmitting(true);
      addTransaction({
        type: 'ganho',
        gainType,
        app,
        baseAmount: base,
        tipAmount: tip,
        bonusAmount: bonus,
        amount: total,
        ridesCount: count,
        shiftId: linkedShiftId || undefined,
        vehicleId: activeVehicle?.id,
        date,
        time,
        description: description.trim() || undefined,
      });
    } else if (activeType === 'abastecimento') {
      const total = parseBRLInput(fuelTotalStr);
      const lit = parseFloat(litersStr.replace(',', '.'));
      const price = parseFloat(pricePerLiterStr.replace(',', '.'));
      const selectedVeh = vehicles.find((v) => v.id === fuelVehicleId) || activeVehicle;
      const kmEntered = parseInt(fuelKmStr, 10);

      if (total <= 0) {
        newErrors.fuelTotal = 'Informe o valor total abastecido.';
      }
      if (isNaN(lit) || lit <= 0) {
        newErrors.liters = 'Informe os litros abastecidos.';
      }
      if (isNaN(kmEntered)) {
        newErrors.fuelKm = 'Informe a quilometragem atual do veículo.';
      } else if (selectedVeh && kmEntered < selectedVeh.currentKm) {
        newErrors.fuelKm = `A quilometragem não pode ser inferior à atual do veículo (${selectedVeh.currentKm.toLocaleString('pt-BR')} km).`;
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      setIsSubmitting(true);
      addTransaction({
        type: 'abastecimento',
        vehicleId: fuelVehicleId || activeVehicle.id,
        amount: total,
        liters: lit,
        pricePerLiter: !isNaN(price) && price > 0 ? price : Number((total / lit).toFixed(2)),
        fuelType,
        currentKm: kmEntered || activeVehicle.currentKm,
        stationName: stationName.trim() || undefined,
        fullTank,
        date,
        time,
        description: description.trim() || undefined,
      });
    } else if (activeType === 'manutencao') {
      const selectedVeh = vehicles.find((v) => v.id === maintVehicleId) || activeVehicle;
      const kmEntered = parseInt(maintKmStr, 10);

      if (totalMaintenance <= 0) {
        newErrors.maintTotal = 'Informe o valor de peças ou mão de obra.';
      }
      if (!servicePerformed.trim()) {
        newErrors.servicePerformed = 'Descreva brevemente o serviço realizado.';
      }
      if (isNaN(kmEntered)) {
        newErrors.maintKm = 'Informe a quilometragem atual do veículo.';
      } else if (selectedVeh && kmEntered < selectedVeh.currentKm) {
        newErrors.maintKm = `A quilometragem não pode ser inferior à atual do veículo (${selectedVeh.currentKm.toLocaleString('pt-BR')} km).`;
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      setIsSubmitting(true);
      addTransaction({
        type: 'manutencao',
        vehicleId: maintVehicleId || activeVehicle.id,
        category: maintenanceCategory,
        servicePerformed: servicePerformed.trim(),
        partsAmount: parseBRLInput(partsAmountStr),
        laborAmount: parseBRLInput(laborAmountStr),
        amount: totalMaintenance,
        workshop: workshop.trim() || undefined,
        currentKm: kmEntered || activeVehicle.currentKm,
        nextMaintenanceKm: nextMaintenanceKmStr ? parseInt(nextMaintenanceKmStr, 10) : undefined,
        nextMaintenanceDate: nextMaintenanceDate || undefined,
        date,
        time,
        description: description.trim() || undefined,
      });
    } else if (activeType === 'outra_despesa') {
      const amt = parseBRLInput(otherAmountStr);
      if (amt <= 0) {
        newErrors.otherAmount = 'Informe o valor da despesa.';
      }
      if (!description.trim()) {
        newErrors.description = 'Descreva a despesa (ex: Almoço PF, Pedágio...).';
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      setIsSubmitting(true);
      addTransaction({
        type: 'outra_despesa',
        category: otherCategory,
        amount: amt,
        vehicleId: otherVehicleId || undefined,
        isRecurring,
        frequency: isRecurring ? recurringFrequency : undefined,
        date,
        time,
        description: description.trim(),
      });
    }

    closeNewTransactionModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-[#0f172a] border border-slate-800 rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Novo Lançamento</h2>
            <p className="text-xs text-slate-400">Registre ganhos, combustível ou despesas</p>
          </div>
          <button
            type="button"
            onClick={handleAttemptClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 4 Tabs */}
        <div className="grid grid-cols-4 gap-1 p-2 bg-slate-950/70 border-b border-slate-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setActiveType('ganho');
              setErrors({});
            }}
            className={`py-2 px-1 rounded-xl flex flex-col items-center gap-1 transition-all ${
              activeType === 'ganho'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Ganho</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveType('abastecimento');
              setErrors({});
            }}
            className={`py-2 px-1 rounded-xl flex flex-col items-center gap-1 transition-all ${
              activeType === 'abastecimento'
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Fuel className="w-4 h-4" />
            <span>Abastecer</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveType('manutencao');
              setErrors({});
            }}
            className={`py-2 px-1 rounded-xl flex flex-col items-center gap-1 transition-all ${
              activeType === 'manutencao'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>Manutenção</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveType('outra_despesa');
              setErrors({});
            }}
            className={`py-2 px-1 rounded-xl flex flex-col items-center gap-1 transition-all ${
              activeType === 'outra_despesa'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Outro</span>
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Discard Confirmation Banner */}
          {showDiscardConfirm && (
            <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 space-y-2 animate-in fade-in">
              <p className="text-xs text-amber-200 font-semibold">
                Descartar alterações? Os dados preenchidos serão perdidos.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeNewTransactionModal}
                  className="px-3 py-1 bg-amber-500 text-slate-950 text-xs font-bold rounded-lg"
                >
                  Sim, descartar
                </button>
                <button
                  type="button"
                  onClick={() => setShowDiscardConfirm(false)}
                  className="px-3 py-1 bg-slate-800 text-slate-300 text-xs font-bold rounded-lg"
                >
                  Continuar editando
                </button>
              </div>
            </div>
          )}

          {/* ================= TAB 1: GANHO ================= */}
          {activeType === 'ganho' && (
            <div className="space-y-4 animate-in fade-in">
              {/* Tipo de Registro */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Tipo de Registro
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGainType('total_periodo')}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                      gainType === 'total_periodo'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    Total do Período
                  </button>
                  <button
                    type="button"
                    onClick={() => setGainType('individual')}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                      gainType === 'individual'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    Corrida / Entrega Individual
                  </button>
                </div>
              </div>

              {/* Origem (App) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Aplicativo de Origem *
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {registeredApps
                    .filter((a) => a.isActive)
                    .map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setApp(item.name)}
                        className={`py-2 px-1 text-center rounded-lg text-xs font-semibold border transition-all ${
                          app === item.name
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        {item.name}
                      </button>
                    ))}
                </div>
              </div>

              {/* Valor Principal (com máscara BRL) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Valor Principal (R$) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                    R$
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0,00"
                    value={baseAmountStr}
                    onChange={(e) => setBaseAmountStr(formatBRLInput(e.target.value))}
                    className="w-full bg-slate-950 border border-emerald-500/40 rounded-xl py-2.5 pl-11 pr-4 text-xl font-bold font-mono text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                {errors.baseAmount && (
                  <p className="text-xs text-rose-400 mt-1">{errors.baseAmount}</p>
                )}
              </div>

              {/* Gorjeta & Bônus (Opcionais) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Gorjeta (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      R$
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0,00"
                      value={tipAmountStr}
                      onChange={(e) => setTipAmountStr(formatBRLInput(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 pl-9 pr-3 text-sm font-mono text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Bônus / Promoção (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      R$
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0,00"
                      value={bonusAmountStr}
                      onChange={(e) => setBonusAmountStr(formatBRLInput(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 pl-9 pr-3 text-sm font-mono text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Total Calculado Display */}
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Valor Total do Ganho:</span>
                <span className="text-base font-extrabold text-emerald-400 font-mono">
                  {formatBRL(totalGain)}
                </span>
              </div>

              {/* Quantidade de Corridas */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Quantidade de Corridas / Entregas *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={ridesCount}
                  onChange={(e) => setRidesCount(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
                {errors.ridesCount && (
                  <p className="text-xs text-rose-400 mt-1">{errors.ridesCount}</p>
                )}
              </div>

              {/* Associação com Jornada */}
              {activeShift ? (
                <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-bold text-blue-300">
                        Jornada Ativa em Andamento
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLinkedShiftId((prev) => (prev ? '' : activeShift.shiftId))}
                      className="text-xs font-semibold text-blue-400 hover:text-blue-200 underline flex items-center gap-1"
                    >
                      {linkedShiftId ? (
                        <>
                          <Unlink className="w-3 h-3" /> Desvincular
                        </>
                      ) : (
                        <>
                          <Link className="w-3 h-3" /> Vincular
                        </>
                      )}
                    </button>
                  </div>

                  {linkedShiftId ? (
                    <div className="p-2.5 rounded-lg bg-slate-900/90 border border-blue-500/20 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-white block">
                          Turno iniciado às {activeShift.startTime.slice(0, 5)}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {activeShift.vehicleName} • Odômetro{' '}
                          {activeShift.startKm.toLocaleString('pt-BR')} km
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        ✓ Associado
                      </span>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 bg-slate-900/60 p-2 rounded-lg">
                      Lançamento avulso (não somará no ganho acumulado da jornada ativa atual).
                    </p>
                  )}
                </div>
              ) : shifts.length > 0 ? (
                <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Vincular a uma Jornada Anterior (Opcional)
                  </label>
                  <select
                    value={linkedShiftId}
                    onChange={(e) => setLinkedShiftId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Nenhuma jornada (Lançamento avulso)</option>
                    {shifts.slice(0, 5).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.date} • {s.startTime} às {s.endTime} ({s.vehicleName || 'Veículo'})
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          )}

          {/* ================= TAB 2: ABASTECER ================= */}
          {activeType === 'abastecimento' && (
            <div className="space-y-4 animate-in fade-in">
              {/* Veículo Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Veículo Abastecido *
                </label>
                <select
                  value={fuelVehicleId}
                  onChange={(e) => {
                    setFuelVehicleId(e.target.value);
                    const selected = vehicles.find((v) => v.id === e.target.value);
                    if (selected) setFuelKmStr(selected.currentKm.toString());
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nickname} ({v.brand} {v.model}) {v.isActive ? '• [Ativo]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Valor Total, Litros e Preço/Litro (Cálculo automático 2 de 3) */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">Cálculo de Combustível</span>
                  <span className="text-[11px] text-slate-500 italic">
                    Preencha 2 para calcular o 3º
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Valor Total Abastecido (R$) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                      R$
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0,00"
                      value={fuelTotalStr}
                      onChange={(e) => handleFuelTotalChange(e.target.value)}
                      className="w-full bg-slate-900 border border-rose-500/40 rounded-xl py-2 pl-9 pr-3 text-lg font-bold font-mono text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  {errors.fuelTotal && (
                    <p className="text-xs text-rose-400 mt-1">{errors.fuelTotal}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Litros Abastecidos *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 12.5"
                      value={litersStr}
                      onChange={(e) => handleLitersChange(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-sm font-mono text-white"
                    />
                    {errors.liters && <p className="text-xs text-rose-400 mt-1">{errors.liters}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Preço por Litro (R$)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 5.79"
                      value={pricePerLiterStr}
                      onChange={(e) => handlePricePerLiterChange(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-sm font-mono text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Combustível & KM */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Tipo de Combustível
                  </label>
                  <select
                    value={fuelType}
                    onChange={(e) => setFuelType(e.target.value as FuelType)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  >
                    <option value="Gasolina">Gasolina</option>
                    <option value="Etanol">Etanol</option>
                    <option value="Diesel">Diesel</option>
                    <option value="GNV">GNV</option>
                    <option value="Elétrico">Elétrico</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Quilometragem Atual
                  </label>
                  <input
                    type="number"
                    value={fuelKmStr}
                    onChange={(e) => setFuelKmStr(e.target.value)}
                    placeholder="Ex: 42118"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono"
                  />
                  {errors.fuelKm && <p className="text-xs text-rose-400 mt-1">{errors.fuelKm}</p>}
                </div>
              </div>

              {/* Posto e Tanque Cheio */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Posto (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Posto Ipiranga"
                    value={stationName}
                    onChange={(e) => setStationName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fullTank}
                      onChange={(e) => setFullTank(e.target.checked)}
                      className="w-4 h-4 rounded text-rose-500 bg-slate-900 border-slate-800"
                    />
                    <span className="text-xs text-slate-300 font-medium">Completou tanque</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 3: MANUTENÇÃO ================= */}
          {activeType === 'manutencao' && (
            <div className="space-y-4 animate-in fade-in">
              {/* Veículo & Categoria */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Veículo *
                  </label>
                  <select
                    value={maintVehicleId}
                    onChange={(e) => {
                      setMaintVehicleId(e.target.value);
                      const selected = vehicles.find((v) => v.id === e.target.value);
                      if (selected) setMaintKmStr(selected.currentKm.toString());
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.nickname}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Categoria *
                  </label>
                  <select
                    value={maintenanceCategory}
                    onChange={(e) => setMaintenanceCategory(e.target.value as MaintenanceCategory)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    {MAINTENANCE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Serviço Realizado */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Serviço Realizado *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Troca de óleo Yamalube + Filtro original"
                  value={servicePerformed}
                  onChange={(e) => setServicePerformed(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
                {errors.servicePerformed && (
                  <p className="text-xs text-rose-400 mt-1">{errors.servicePerformed}</p>
                )}
              </div>

              {/* Peças e Mão de Obra */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Valor Peças (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      R$
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0,00"
                      value={partsAmountStr}
                      onChange={(e) => setPartsAmountStr(formatBRLInput(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 pl-9 pr-3 text-sm font-mono text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Mão de Obra (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      R$
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0,00"
                      value={laborAmountStr}
                      onChange={(e) => setLaborAmountStr(formatBRLInput(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 pl-9 pr-3 text-sm font-mono text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Total Display */}
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">
                  Valor Total da Manutenção:
                </span>
                <span className="text-base font-extrabold text-amber-400 font-mono">
                  {formatBRL(totalMaintenance)}
                </span>
              </div>

              {/* Oficina & KM */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Oficina / Profissional
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Moto Speed Centro"
                    value={workshop}
                    onChange={(e) => setWorkshop(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    KM Atual
                  </label>
                  <input
                    type="number"
                    value={maintKmStr}
                    onChange={(e) => setMaintKmStr(e.target.value)}
                    placeholder="Ex: 42118"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono"
                  />
                  {errors.maintKm && <p className="text-xs text-rose-400 mt-1">{errors.maintKm}</p>}
                </div>
              </div>

              {/* Próxima Troca (KM e Data) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Próxima Troca (KM)
                  </label>
                  <input
                    type="number"
                    placeholder="Ex: 27850"
                    value={nextMaintenanceKmStr}
                    onChange={(e) => setNextMaintenanceKmStr(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Próxima Troca (Data)
                  </label>
                  <input
                    type="date"
                    value={nextMaintenanceDate}
                    onChange={(e) => setNextMaintenanceDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 4: OUTRO ================= */}
          {activeType === 'outra_despesa' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Categoria *
                  </label>
                  <select
                    value={otherCategory}
                    onChange={(e) => setOtherCategory(e.target.value as OtherExpenseCategory)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    {OTHER_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Veículo Relacionado
                  </label>
                  <select
                    value={otherVehicleId}
                    onChange={(e) => setOtherVehicleId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="">Nenhum (Geral)</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.nickname}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Valor da Despesa (R$) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                    R$
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0,00"
                    value={otherAmountStr}
                    onChange={(e) => setOtherAmountStr(formatBRLInput(e.target.value))}
                    className="w-full bg-slate-950 border border-purple-500/40 rounded-xl py-2.5 pl-11 pr-4 text-xl font-bold font-mono text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                {errors.otherAmount && (
                  <p className="text-xs text-rose-400 mt-1">{errors.otherAmount}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Descrição / Motivo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Almoço PF na rua, Pedágio Anchieta, Suporte de celular..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                />
                {errors.description && (
                  <p className="text-xs text-rose-400 mt-1">{errors.description}</p>
                )}
              </div>

              {/* Despesa recorrente */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-500 bg-slate-900 border-slate-800"
                  />
                  <span className="text-xs text-slate-200 font-medium">
                    Despesa recorrente (fixa)
                  </span>
                </label>

                {isRecurring && (
                  <div className="pt-2 pl-6">
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Frequência de Cobrança
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['Semanal', 'Mensal', 'Anual'] as const).map((freq) => (
                        <button
                          key={freq}
                          type="button"
                          onClick={() => setRecurringFrequency(freq)}
                          className={`py-1.5 rounded-lg text-xs font-medium border ${
                            recurringFrequency === freq
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          {freq}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= COMMON: DATA E HORA ================= */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Data *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Horário</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          {/* Observação comum para ganho/abastecer/manutenção */}
          {activeType !== 'outra_despesa' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Observação (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ex.: Turno da manhã, região central."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600"
              />
            </div>
          )}

          {/* Botão de Envio com Proteção Contra Duplo Clique */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm text-slate-950 shadow-lg transition-all active:scale-98 flex items-center justify-center gap-2 ${
                isSubmitting ? 'opacity-60 cursor-not-allowed' : ''
              } ${
                activeType === 'ganho'
                  ? 'bg-emerald-400 hover:bg-emerald-300 shadow-emerald-500/20'
                  : activeType === 'abastecimento'
                    ? 'bg-rose-400 hover:bg-rose-300 shadow-rose-500/20'
                    : activeType === 'manutencao'
                      ? 'bg-amber-400 hover:bg-amber-300 shadow-amber-500/20'
                      : 'bg-purple-400 hover:bg-purple-300 shadow-purple-500/20'
              }`}
            >
              <Check className="w-5 h-5 text-slate-950" />
              <span>{isSubmitting ? 'Salvando...' : 'Salvar Lançamento'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
