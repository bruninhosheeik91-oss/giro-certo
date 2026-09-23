import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { RegisteredApp } from '../types';
import {
  X,
  Plus,
  Trash2,
  Edit3,
  Check,
  Car,
  Bike,
  Package,
  Zap,
  Navigation,
  ShoppingBag,
  AlertTriangle,
} from 'lucide-react';

const PRESET_COLORS = [
  '#000000', // Uber
  '#F8A000', // 99
  '#EA1D2C', // iFood
  '#FF6600', // Lalamove
  '#FF441F', // Rappi
  '#0284C7', // Borzo
  '#10B981', // Particular / Green
  '#8B5CF6', // Purple
  '#64748B', // Slate
];

const PRESET_ICONS = [
  { id: 'car', label: 'Carro', icon: Car },
  { id: 'bike', label: 'Moto/Bike', icon: Bike },
  { id: 'package', label: 'Pacote', icon: Package },
  { id: 'shopping-bag', label: 'Comida', icon: ShoppingBag },
  { id: 'navigation', label: 'GPS', icon: Navigation },
  { id: 'zap', label: 'Express', icon: Zap },
];

export const AppsManagementModal: React.FC = () => {
  const {
    isAppsModalOpen,
    closeAppsModal,
    registeredApps,
    addRegisteredApp,
    updateRegisteredApp,
    toggleRegisteredApp,
    deleteRegisteredApp,
  } = useApp();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [color, setColor] = useState('#000000');
  const [icon, setIcon] = useState('car');
  const [isActive, setIsActive] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isAppsModalOpen) return null;

  const resetForm = () => {
    setName('');
    setColor('#000000');
    setIcon('car');
    setIsActive(true);
    setEditingId(null);
    setIsFormOpen(false);
    setErrorMsg(null);
  };

  const handleStartAdd = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleStartEdit = (app: RegisteredApp) => {
    setEditingId(app.id);
    setName(app.name);
    setColor(app.color);
    setIcon(app.icon);
    setIsActive(app.isActive);
    setErrorMsg(null);
    setIsFormOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg('Por favor, informe o nome do aplicativo.');
      return;
    }

    if (editingId) {
      updateRegisteredApp(editingId, {
        name: name.trim(),
        color,
        icon,
        isActive,
      });
    } else {
      addRegisteredApp({
        name: name.trim(),
        color,
        icon,
        isActive,
      });
    }

    resetForm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-[#0f172a] border border-slate-800 rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              {isFormOpen
                ? editingId
                  ? 'Editar Aplicativo'
                  : 'Cadastrar Aplicativo'
                : 'Aplicativos Cadastrados'}
            </h2>
            <p className="text-xs text-slate-400">
              Personalize plataformas para registrar seus ganhos
            </p>
          </div>
          <button
            onClick={() => {
              if (isFormOpen) resetForm();
              else closeAppsModal();
            }}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center gap-2 text-xs text-rose-300">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!isFormOpen ? (
            /* App List */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Plataformas ({registeredApps.length})
                </span>
                <button
                  onClick={handleStartAdd}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow transition-all active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Novo App</span>
                </button>
              </div>

              <div className="space-y-2">
                {registeredApps.map((app) => (
                  <div
                    key={app.id}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                      app.isActive
                        ? 'bg-slate-900/90 border-slate-800'
                        : 'bg-slate-900/40 border-slate-800/40 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-sm"
                        style={{ backgroundColor: app.color }}
                      >
                        {app.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{app.name}</span>
                          <span
                            className={`px-2 py-0.2 rounded-full text-[10px] font-semibold ${
                              app.isActive
                                ? 'text-emerald-400 bg-emerald-500/10'
                                : 'text-slate-500 bg-slate-800'
                            }`}
                          >
                            {app.isActive ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Toggle active button */}
                      <button
                        onClick={() => toggleRegisteredApp(app.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                          app.isActive
                            ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                            : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25'
                        }`}
                      >
                        {app.isActive ? 'Desativar' : 'Ativar'}
                      </button>

                      <button
                        onClick={() => handleStartEdit(app)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {registeredApps.length > 1 && (
                        <button
                          onClick={() => setDeleteConfirmId(app.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Inline Delete Dialog */}
                    {deleteConfirmId === app.id && (
                      <div className="absolute inset-x-4 p-3 bg-slate-900 border border-rose-500/50 rounded-xl shadow-xl z-10 flex items-center justify-between">
                        <span className="text-xs text-rose-300 font-semibold">
                          Excluir "{app.name}"?
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              deleteRegisteredApp(app.id);
                              setDeleteConfirmId(null);
                            }}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded"
                          >
                            Excluir
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-2.5 py-1 bg-slate-800 text-slate-300 text-xs rounded"
                          >
                            Voltar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Form View */
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nome do Aplicativo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Uber, 99, iFood, Borzo..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Color Picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Cor da Identidade
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${
                        color === c
                          ? 'border-white scale-110 shadow-md'
                          : 'border-transparent opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c }}
                    >
                      {color === c && <Check className="w-4 h-4 text-white drop-shadow" />}
                    </button>
                  ))}
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-8 h-8 rounded-full cursor-pointer bg-transparent border-0"
                    title="Escolher cor personalizada"
                  />
                </div>
              </div>

              {/* Icon selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Ícone Representativo
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {PRESET_ICONS.map((item) => {
                    const IconComponent = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setIcon(item.id)}
                        className={`p-2 rounded-xl border flex flex-col items-center justify-center transition-all ${
                          icon === item.id
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <IconComponent className="w-5 h-5" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Toggle */}
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-slate-800"
                />
                <span className="text-xs text-slate-200 font-medium">
                  Ativo para seleção de novos ganhos
                </span>
              </label>

              {/* Actions */}
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
                  Salvar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
