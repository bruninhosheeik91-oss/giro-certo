import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { UserVehicle, FuelType } from '../types';
import { X, Plus, Bike, Car, Check, Trash2, Edit3, Star, AlertTriangle } from 'lucide-react';

const FUEL_OPTIONS: FuelType[] = [
  'Gasolina',
  'Etanol',
  'Flex',
  'Diesel',
  'GNV',
  'Elétrico',
  'Outro',
];

export const VehiclesModal: React.FC = () => {
  const {
    isVehiclesModalOpen,
    closeVehiclesModal,
    vehicles,
    addVehicle,
    updateVehicle,
    setActiveVehicleId,
    archiveVehicle,
    deleteVehicle,
  } = useApp();

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form states
  const [nickname, setNickname] = useState('');
  const [type, setType] = useState<'moto' | 'carro' | 'bicicleta'>('moto');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [plate, setPlate] = useState('');
  const [currentKm, setCurrentKm] = useState('');
  const [fuelType, setFuelType] = useState<FuelType>('Gasolina');
  const [fuelAverageKmPerLiter, setFuelAverageKmPerLiter] = useState('');
  const [refPricePerLiter, setRefPricePerLiter] = useState('');
  const [acquisitionPrice, setAcquisitionPrice] = useState('');
  const [acquisitionDate, setAcquisitionDate] = useState('');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!isVehiclesModalOpen) return null;

  const resetForm = () => {
    setNickname('');
    setType('moto');
    setBrand('');
    setModel('');
    setYear(new Date().getFullYear().toString());
    setPlate('');
    setCurrentKm('');
    setFuelType('Gasolina');
    setFuelAverageKmPerLiter('');
    setRefPricePerLiter('');
    setAcquisitionPrice('');
    setAcquisitionDate('');
    setNotes('');
    setIsActive(vehicles.length === 0);
    setFormError(null);
    setEditingId(null);
    setIsEditing(false);
  };

  const handleStartAdd = () => {
    resetForm();
    setIsEditing(true);
  };

  const handleStartEdit = (veh: UserVehicle) => {
    setEditingId(veh.id);
    setNickname(veh.nickname);
    setType(veh.type);
    setBrand(veh.brand);
    setModel(veh.model);
    setYear(veh.year);
    setPlate(veh.plate || '');
    setCurrentKm(veh.currentKm.toString());
    setFuelType(veh.fuelType);
    setFuelAverageKmPerLiter(veh.fuelAverageKmPerLiter.toString());
    setRefPricePerLiter(veh.refPricePerLiter.toString());
    setAcquisitionPrice(veh.acquisitionPrice ? veh.acquisitionPrice.toString() : '');
    setAcquisitionDate(veh.acquisitionDate || '');
    setNotes(veh.notes || '');
    setIsActive(veh.isActive);
    setFormError(null);
    setIsEditing(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!nickname.trim()) {
      setFormError('Informe um apelido ou nome para o veículo.');
      return;
    }
    if (!brand.trim() || !model.trim()) {
      setFormError('Informe a marca e o modelo.');
      return;
    }

    const km = parseInt(currentKm, 10);
    if (isNaN(km) || km < 0) {
      setFormError('Informe uma quilometragem válida.');
      return;
    }

    const avgKm = parseFloat(fuelAverageKmPerLiter.replace(',', '.'));
    const refPrice = parseFloat(refPricePerLiter.replace(',', '.'));
    const acqPrice = acquisitionPrice ? parseFloat(acquisitionPrice.replace(',', '.')) : undefined;

    const payload = {
      nickname: nickname.trim(),
      type,
      brand: brand.trim(),
      model: model.trim(),
      year: year.trim() || new Date().getFullYear().toString(),
      plate: plate.trim() || undefined,
      currentKm: km,
      fuelType,
      fuelAverageKmPerLiter: !isNaN(avgKm) && avgKm > 0 ? avgKm : type === 'moto' ? 32 : 11,
      refPricePerLiter: !isNaN(refPrice) && refPrice > 0 ? refPrice : 5.8,
      acquisitionPrice: acqPrice && !isNaN(acqPrice) ? acqPrice : undefined,
      acquisitionDate: acquisitionDate || undefined,
      notes: notes.trim() || undefined,
      isActive,
    };

    if (editingId) {
      updateVehicle(editingId, payload);
    } else {
      addVehicle(payload);
    }

    resetForm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-[#0f172a] border border-slate-800 rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Bike className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                {isEditing ? (editingId ? 'Editar Veículo' : 'Cadastrar Veículo') : 'Meus Veículos'}
              </h2>
              <p className="text-xs text-slate-400">
                {isEditing
                  ? 'Preencha os dados do veículo de trabalho'
                  : 'Gerencie motos, carros ou bicicletas'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (isEditing) {
                resetForm();
              } else {
                closeVehiclesModal();
              }
            }}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center gap-2 text-xs text-rose-300">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{formError}</span>
            </div>
          )}

          {!isEditing ? (
            /* Vehicle List View */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Veículos Cadastrados ({vehicles.length})
                </span>
                <button
                  onClick={handleStartAdd}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow transition-all active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Novo Veículo</span>
                </button>
              </div>

              {vehicles.length === 0 ? (
                <div className="text-center py-10 px-4 border border-dashed border-slate-800 rounded-xl">
                  <Bike className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-300">Nenhum veículo cadastrado</p>
                  <p className="text-xs text-slate-500 mt-1 mb-4">
                    Adicione uma moto ou carro para associar a jornadas e abastecimentos.
                  </p>
                  <button
                    onClick={handleStartAdd}
                    className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs"
                  >
                    Adicionar Veículo Agora
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {vehicles.map((v) => (
                    <div
                      key={v.id}
                      className={`p-4 rounded-xl border transition-all ${
                        v.isActive
                          ? 'bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border-emerald-500/50 shadow-md ring-1 ring-emerald-500/20'
                          : v.isArchived
                            ? 'bg-slate-900/40 border-slate-800/50 opacity-60'
                            : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              v.type === 'moto'
                                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                                : v.type === 'carro'
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {v.type === 'moto' && <Bike className="w-5 h-5" />}
                            {v.type === 'carro' && <Car className="w-5 h-5" />}
                            {v.type === 'bicicleta' && <Bike className="w-5 h-5" />}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-white tracking-tight">
                                {v.nickname}
                              </h4>
                              {v.isActive && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                  <Star className="w-2.5 h-2.5 fill-current" />
                                  Ativo
                                </span>
                              )}
                              {v.isArchived && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400">
                                  Arquivado
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-300 font-medium">
                              {v.brand} {v.model} ({v.year}) {v.plate ? `• ${v.plate}` : ''}
                            </p>
                          </div>
                        </div>

                        {/* Top quick actions */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleStartEdit(v)}
                            title="Editar veículo"
                            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {vehicles.length > 1 && (
                            <button
                              onClick={() => setDeleteConfirmId(v.id)}
                              title="Excluir veículo"
                              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Specs pills */}
                      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-800/80 text-center">
                        <div className="bg-slate-950/60 rounded-lg py-1.5 px-2">
                          <span className="text-[10px] text-slate-500 block uppercase">
                            KM Atual
                          </span>
                          <span className="text-xs font-bold text-slate-200 font-mono">
                            {v.currentKm.toLocaleString('pt-BR')} km
                          </span>
                        </div>
                        <div className="bg-slate-950/60 rounded-lg py-1.5 px-2">
                          <span className="text-[10px] text-slate-500 block uppercase">Média</span>
                          <span className="text-xs font-bold text-slate-200 font-mono">
                            {v.fuelAverageKmPerLiter} km/l
                          </span>
                        </div>
                        <div className="bg-slate-950/60 rounded-lg py-1.5 px-2">
                          <span className="text-[10px] text-slate-500 block uppercase">
                            Combustível
                          </span>
                          <span className="text-xs font-bold text-slate-200 truncate block">
                            {v.fuelType}
                          </span>
                        </div>
                      </div>

                      {v.notes && (
                        <p className="text-[11px] text-slate-400 italic mt-2 bg-slate-950/40 p-2 rounded-lg">
                          "{v.notes}"
                        </p>
                      )}

                      {/* Action buttons row */}
                      <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-800/60">
                        {!v.isActive ? (
                          <button
                            onClick={() => setActiveVehicleId(v.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-bold transition-all active:scale-95"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Definir como Veículo Ativo</span>
                          </button>
                        ) : (
                          <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            Veículo principal em uso
                          </span>
                        )}

                        <button
                          onClick={() => archiveVehicle(v.id)}
                          className="text-[11px] text-slate-400 hover:text-slate-300 underline font-medium"
                        >
                          {v.isArchived ? 'Desarquivar' : 'Arquivar'}
                        </button>
                      </div>

                      {/* Inline Delete Confirmation */}
                      {deleteConfirmId === v.id && (
                        <div className="mt-3 p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 space-y-2">
                          <p className="text-xs text-rose-300 font-semibold">
                            Tem certeza que deseja excluir o veículo "{v.nickname}"?
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                deleteVehicle(v.id);
                                setDeleteConfirmId(null);
                              }}
                              className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded"
                            >
                              Sim, excluir
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Vehicle Form View (Add / Edit) */
            <form onSubmit={handleSave} className="space-y-4">
              {/* Type Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Tipo de Veículo *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setType('moto');
                      if (!fuelAverageKmPerLiter) setFuelAverageKmPerLiter('32');
                    }}
                    className={`py-2.5 px-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                      type === 'moto'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Bike className="w-5 h-5" />
                    <span className="text-xs">Motocicleta</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setType('carro');
                      if (!fuelAverageKmPerLiter) setFuelAverageKmPerLiter('12');
                    }}
                    className={`py-2.5 px-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                      type === 'carro'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Car className="w-5 h-5" />
                    <span className="text-xs">Carro</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setType('bicicleta');
                      setFuelAverageKmPerLiter('0');
                    }}
                    className={`py-2.5 px-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                      type === 'bicicleta'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Bike className="w-5 h-5" />
                    <span className="text-xs">Bicicleta</span>
                  </button>
                </div>
              </div>

              {/* Apelido do Veículo */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Apelido do Veículo *
                </label>
                <input
                  type="text"
                  required
                  placeholder='Ex: "Fazer 250 do trampo", "Onix da família"'
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Marca & Modelo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Marca *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Yamaha, Honda, Chevrolet"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Modelo *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Fazer 250 FZ25, CG 160 Fan"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Ano & Placa */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Ano</label>
                  <input
                    type="text"
                    placeholder="Ex: 2024"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Placa (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: ABC-1D23"
                    value={plate}
                    onChange={(e) => setPlate(e.target.value.toUpperCase())}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white uppercase focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Quilometragem Atual & Combustível */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Quilometragem Atual *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="Ex: 24850"
                    value={currentKm}
                    onChange={(e) => setCurrentKm(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Tipo de Combustível
                  </label>
                  <select
                    value={fuelType}
                    onChange={(e) => setFuelType(e.target.value as FuelType)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    {FUEL_OPTIONS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Média de Consumo (km/l) & Preço de Referência (R$) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Consumo Estimado (km/l)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder={type === 'moto' ? '32.5' : '12.0'}
                    value={fuelAverageKmPerLiter}
                    onChange={(e) => setFuelAverageKmPerLiter(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Preço Ref. Litro (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 5.89"
                    value={refPricePerLiter}
                    onChange={(e) => setRefPricePerLiter(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Aquisição (Opcionais) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Valor Pago (Opcional)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 22900"
                    value={acquisitionPrice}
                    onChange={(e) => setAcquisitionPrice(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Data Aquisição (Opcional)
                  </label>
                  <input
                    type="date"
                    value={acquisitionDate}
                    onChange={(e) => setAcquisitionDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Observações
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Pneu traseiro trocado aos 20.000 km, revisão em dia..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Set Active Checkbox */}
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-slate-800"
                />
                <span className="text-xs text-slate-200 font-medium">
                  Definir como veículo ativo agora
                </span>
              </label>

              {/* Submit / Cancel Buttons */}
              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-800 text-slate-300 hover:bg-slate-800 text-xs font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md transition-all active:scale-95"
                >
                  Salvar Veículo
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
