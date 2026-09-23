import React, { useState } from 'react';
import { Transaction } from '../types';
import { useApp } from '../context/AppContext';
import {
  formatBRL,
  formatBRLInput,
  formatDisplayDate,
  parseBRLInput,
  parseDecimalInput,
} from '../utils/calculations';
import { X, Trash2, Edit2, Check, AlertTriangle } from 'lucide-react';

interface TransactionDetailModalProps {
  transaction: Transaction | null;
  onClose: () => void;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  transaction,
  onClose,
}) => {
  const { deleteTransaction, updateTransaction, vehicles, activeVehicle } = useApp();

  const [isEditing, setIsEditing] = useState(false);
  const [amountStr, setAmountStr] = useState('');
  const [description, setDescription] = useState('');
  const [currentKmStr, setCurrentKmStr] = useState('');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  if (!transaction) return null;

  const hasOdometer = transaction.type === 'abastecimento' || transaction.type === 'manutencao';
  const txVehicle = vehicles.find((v) => v.id === transaction.vehicleId) || activeVehicle;

  const handleStartEdit = () => {
    setAmountStr(formatBRLInput(String(Math.round(transaction.amount * 100))));
    setDescription(transaction.description || '');
    setCurrentKmStr(
      transaction.type === 'abastecimento' || transaction.type === 'manutencao'
        ? (transaction.currentKm?.toString() ?? '')
        : '',
    );
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    const newAmount = parseBRLInput(amountStr);
    if (newAmount <= 0) {
      setIsEditing(false);
      onClose();
      return;
    }

    if (transaction.type === 'abastecimento' || transaction.type === 'manutencao') {
      const updates: Partial<typeof transaction> = {
        amount: newAmount,
        description: description.trim() || undefined,
      };
      const newKm = currentKmStr ? Math.round(parseDecimalInput(currentKmStr)) : 0;
      const baseline = txVehicle?.odometerBaselineKm ?? txVehicle?.currentKm ?? 0;
      if (newKm > 0 && (!baseline || newKm >= baseline)) {
        updates.currentKm = newKm;
      }
      updateTransaction(transaction.id, updates);
    } else {
      updateTransaction(transaction.id, {
        amount: newAmount,
        description: description.trim() || undefined,
      });
    }
    setIsEditing(false);
    onClose();
  };

  const handleDelete = () => {
    deleteTransaction(transaction.id);
    onClose();
  };

  const isGain = transaction.type === 'ganho';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm transition-opacity">
      <div
        className="w-full max-w-md bg-[#0f172a] border border-slate-800 rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${isGain ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            <h3 className="text-sm font-bold text-white">Detalhes do Lançamento</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Main Amount Card */}
          <div
            className={`p-4 rounded-xl border text-center ${
              isGain
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-rose-500/10 border-rose-500/30'
            }`}
          >
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-400 block mb-1">
              {isGain ? 'Ganho Realizado' : 'Despesa Registrada'}
            </span>
            {isEditing ? (
              <div className="flex items-center justify-center gap-1">
                <span className="text-xl font-bold text-slate-400">R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amountStr}
                  onChange={(e) => setAmountStr(formatBRLInput(e.target.value))}
                  className="w-36 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-2xl font-bold font-mono text-center text-white focus:outline-none"
                  autoFocus
                />
              </div>
            ) : (
              <div
                className={`text-3xl font-extrabold font-mono tracking-tight ${
                  isGain ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isGain ? '+' : '-'}
                {formatBRL(transaction.amount)}
              </div>
            )}
          </div>

          {/* Details Grid */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl divide-y divide-slate-800 text-xs">
            {/* Type / Category */}
            <div className="p-3 flex items-center justify-between">
              <span className="text-slate-400 font-medium">Origem / Categoria</span>
              <span className="font-semibold text-slate-200">
                {transaction.type === 'ganho' && `Aplicativo ${transaction.app}`}
                {transaction.type === 'abastecimento' && `Combustível (${transaction.fuelType})`}
                {transaction.type === 'manutencao' && transaction.category}
                {transaction.type === 'outra_despesa' && transaction.category}
              </span>
            </div>

            {/* Date & Time */}
            <div className="p-3 flex items-center justify-between">
              <span className="text-slate-400 font-medium">Data e Horário</span>
              <span className="text-slate-200 font-medium">
                {formatDisplayDate(transaction.date)} às {transaction.time || '--:--'}
              </span>
            </div>

            {/* Fuel specific */}
            {transaction.type === 'abastecimento' && (
              <>
                <div className="p-3 flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Litros Abastecidos</span>
                  <span className="text-slate-200 font-mono font-semibold">
                    {transaction.liters} L
                  </span>
                </div>
                <div className="p-3 flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Preço por Litro</span>
                  <span className="text-slate-200 font-mono">
                    {formatBRL(transaction.pricePerLiter)}/L
                  </span>
                </div>
                {transaction.stationName && (
                  <div className="p-3 flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Posto</span>
                    <span className="text-slate-200">{transaction.stationName}</span>
                  </div>
                )}
                {transaction.currentKm && !isEditing && (
                  <div className="p-3 flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Odômetro (KM)</span>
                    <span className="text-slate-200 font-mono">
                      {transaction.currentKm.toLocaleString('pt-BR')} km
                    </span>
                  </div>
                )}
                {hasOdometer && isEditing && (
                  <div className="p-3 flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Odômetro (KM)</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={currentKmStr}
                      onChange={(e) => setCurrentKmStr(e.target.value.replace(/\D/g, ''))}
                      placeholder="Informe o KM atual"
                      className="w-32 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-right text-white focus:outline-none"
                    />
                  </div>
                )}
              </>
            )}

            {/* Maintenance specific */}
            {transaction.type === 'manutencao' && (
              <>
                {transaction.currentKm && !isEditing && (
                  <div className="p-3 flex items-center justify-between">
                    <span className="text-slate-400 font-medium">KM na Manutenção</span>
                    <span className="text-slate-200 font-mono">
                      {transaction.currentKm.toLocaleString('pt-BR')} km
                    </span>
                  </div>
                )}
                {hasOdometer && isEditing && (
                  <div className="p-3 flex items-center justify-between">
                    <span className="text-slate-400 font-medium">KM na Manutenção</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={currentKmStr}
                      onChange={(e) => setCurrentKmStr(e.target.value.replace(/\D/g, ''))}
                      placeholder="Informe o KM atual"
                      className="w-32 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-right text-white focus:outline-none"
                    />
                  </div>
                )}
                {transaction.nextMaintenanceKm && (
                  <div className="p-3 flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Próxima Troca (KM)</span>
                    <span className="text-amber-400 font-mono font-semibold">
                      {transaction.nextMaintenanceKm.toLocaleString('pt-BR')} km
                    </span>
                  </div>
                )}
              </>
            )}

            {/* Description */}
            <div className="p-3">
              <span className="text-slate-400 font-medium block mb-1">Descrição</span>
              {isEditing ? (
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Adicione uma observação..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              ) : (
                <p className="text-slate-300 italic">
                  {transaction.description || 'Nenhuma observação informada.'}
                </p>
              )}
            </div>
          </div>

          {isEditing && hasOdometer && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-[11px] text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                O odômetro nunca regride abaixo do KM base do veículo (reconciliação automática
                aplicada ao salvar).
              </span>
            </div>
          )}

          {/* Delete Confirmation prompt */}
          {isConfirmingDelete && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-2 text-center">
              <p className="text-xs text-rose-300 font-medium">
                Tem certeza que deseja excluir permanentemente este lançamento?
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 text-xs text-white font-bold hover:bg-rose-500"
                >
                  Confirmar Exclusão
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20"
                >
                  <Check className="w-4 h-4" />
                  <span>Salvar Alterações</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(true)}
                  className="py-2.5 px-3 rounded-xl border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Excluir</span>
                </button>
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Editar Lançamento</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
