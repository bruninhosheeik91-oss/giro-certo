import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatBRL, parseDecimalInput } from '../utils/calculations';
import {
  Bike,
  Car,
  Smartphone,
  Bell,
  ChevronRight,
  MapPin,
  Check,
  Edit2,
  Sliders,
} from 'lucide-react';

export const ProfileView: React.FC = () => {
  const {
    userProfile,
    updateUserProfile,
    activeVehicle,
    vehicles,
    registeredApps,
    openVehiclesModal,
    openAppsModal,
  } = useApp();

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [name, setName] = useState(userProfile.name);
  const [city, setCity] = useState(userProfile.city);
  const [monthlyGoalStr, setMonthlyGoalStr] = useState(userProfile.monthlyGoal.toString());
  const [reservePerKmStr, setReservePerKmStr] = useState(
    (userProfile.maintenanceReservePerKm || 0.12).toString(),
  );

  const [minProfitPerKmStr, setMinProfitPerKmStr] = useState(
    (userProfile.rideCriteria?.minProfitPerKm ?? 0.8).toString(),
  );
  const [minProfitPerHourStr, setMinProfitPerHourStr] = useState(
    (userProfile.rideCriteria?.minProfitPerHour ?? 25.0).toString(),
  );
  const [minAcceptableValueStr, setMinAcceptableValueStr] = useState(
    (userProfile.rideCriteria?.minAcceptableValue ?? 8.0).toString(),
  );
  const [considerReturn, setConsiderReturn] = useState(
    userProfile.rideCriteria?.considerReturnDistance ?? true,
  );

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const goal = parseDecimalInput(monthlyGoalStr);
    const reserve = parseDecimalInput(reservePerKmStr);
    const minKm = parseDecimalInput(minProfitPerKmStr);
    const minHour = parseDecimalInput(minProfitPerHourStr);
    const minVal = parseDecimalInput(minAcceptableValueStr);

    updateUserProfile({
      name: name.trim() || userProfile.name,
      city: city.trim() || userProfile.city,
      monthlyGoal: !isNaN(goal) && goal > 0 ? goal : userProfile.monthlyGoal,
      maintenanceReservePerKm: !isNaN(reserve) && reserve > 0 ? reserve : 0.12,
      rideCriteria: {
        minProfitPerKm: !isNaN(minKm) && minKm > 0 ? minKm : 0.8,
        minProfitPerHour: !isNaN(minHour) && minHour > 0 ? minHour : 25.0,
        minAcceptableValue: !isNaN(minVal) && minVal > 0 ? minVal : 8.0,
        considerReturnDistance: considerReturn,
      },
    });

    setIsEditingProfile(false);
  };

  const handleToggleNotification = (key: keyof typeof userProfile.notificationPreferences) => {
    updateUserProfile({
      notificationPreferences: {
        ...userProfile.notificationPreferences,
        [key]: !userProfile.notificationPreferences[key],
      },
    });
  };

  return (
    <div className="space-y-4 pb-2">
      {/* Profile Header Card (Without PRO badge or rating as requested) */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="relative">
              <img
                src={userProfile.photoUrl}
                alt={userProfile.name}
                className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-700 shadow-md"
              />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center">
                <Check className="w-3 h-3 text-slate-950 stroke-[3]" />
              </div>
            </div>

            <div>
              <h2 className="text-base font-bold text-white tracking-tight">{userProfile.name}</h2>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-500" />
                  {userProfile.city}
                </span>
                <span>•</span>
                <span>Desde {userProfile.startDate}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsEditingProfile(!isEditingProfile)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Editar perfil"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        </div>

        {/* Edit profile inline form */}
        {isEditingProfile && (
          <form
            onSubmit={handleSaveProfile}
            className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 animate-in fade-in"
          >
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Editar Dados Principais
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Nome</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Cidade / UF
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Meta Mensal (R$)
                </label>
                <input
                  type="number"
                  value={monthlyGoalStr}
                  onChange={(e) => setMonthlyGoalStr(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Reserva/KM (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={reservePerKmStr}
                  onChange={(e) => setReservePerKmStr(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white font-mono"
                />
              </div>
            </div>

            {/* Critérios de Corrida na Edição */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <span className="text-[11px] font-bold text-slate-300 block uppercase tracking-wider">
                Critérios de Aceite de Corrida
              </span>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Mín. Lucro/KM</label>
                  <input
                    type="number"
                    step="0.05"
                    value={minProfitPerKmStr}
                    onChange={(e) => setMinProfitPerKmStr(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Mín. Lucro/Hora</label>
                  <input
                    type="number"
                    step="1"
                    value={minProfitPerHourStr}
                    onChange={(e) => setMinProfitPerHourStr(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Valor Mínimo</label>
                  <input
                    type="number"
                    step="0.5"
                    value={minAcceptableValueStr}
                    onChange={(e) => setMinAcceptableValueStr(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white font-mono"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="considerReturnEdit"
                  checked={considerReturn}
                  onChange={(e) => setConsiderReturn(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-500 bg-slate-900 border-slate-800"
                />
                <label htmlFor="considerReturnEdit" className="text-xs text-slate-300">
                  Considerar distância de retorno por padrão no simulador
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow"
              >
                Salvar Alterações
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Meus Veículos Card (Requirement 3) */}
      <div
        onClick={openVehiclesModal}
        className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 cursor-pointer shadow-md transition-all space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              {activeVehicle.type === 'moto' ? (
                <Bike className="w-5 h-5" />
              ) : (
                <Car className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Meus Veículos</h3>
              <p className="text-xs text-slate-400">
                {vehicles.length} veículo{vehicles.length > 1 ? 's' : ''} cadastrado
                {vehicles.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>

        {/* Active vehicle preview banner */}
        <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs">
          <div>
            <span className="font-bold text-white block">{activeVehicle.nickname}</span>
            <span className="text-[11px] text-slate-400">
              {activeVehicle.brand} {activeVehicle.model} ({activeVehicle.year}) •{' '}
              {activeVehicle.fuelType}
            </span>
          </div>
          <span className="font-mono font-bold text-emerald-400">
            {activeVehicle.currentKm.toLocaleString('pt-BR')} km
          </span>
        </div>
      </div>

      {/* Aplicativos Cadastrados Card (Requirement 2) */}
      <div
        onClick={openAppsModal}
        className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 cursor-pointer shadow-md transition-all space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Aplicativos Cadastrados
              </h3>
              <p className="text-xs text-slate-400">
                Gerencie plataformas de entrega e transporte de passageiros
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>

        {/* Active apps badges row */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          {registeredApps
            .filter((a) => a.isActive)
            .map((app) => (
              <span
                key={app.id}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-950 border border-slate-800 text-white flex items-center gap-1.5"
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: app.color }} />
                {app.name}
              </span>
            ))}
        </div>
      </div>

      {/* Critérios de Aceite de Corrida Card */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Critérios de Corrida</h3>
              <p className="text-xs text-slate-400">
                Parâmetros utilizados no simulador de viabilidade
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsEditingProfile(true)}
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300"
          >
            Ajustar
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block uppercase">Mínimo / KM</span>
            <span className="text-sm font-bold text-emerald-400 font-mono">
              {formatBRL(userProfile.rideCriteria?.minProfitPerKm ?? 0.8)}/km
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block uppercase">Mínimo / Hora</span>
            <span className="text-sm font-bold text-emerald-400 font-mono">
              {formatBRL(userProfile.rideCriteria?.minProfitPerHour ?? 25.0)}/h
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block uppercase">Valor Mínimo</span>
            <span className="text-sm font-bold text-slate-200 font-mono">
              {formatBRL(userProfile.rideCriteria?.minAcceptableValue ?? 8.0)}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block uppercase">Considerar Retorno</span>
            <span className="text-sm font-bold text-slate-200">
              {userProfile.rideCriteria?.considerReturnDistance ? 'Sim (Ativo)' : 'Não (Ignorar)'}
            </span>
          </div>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 shadow-md">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-slate-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Lembretes e Alertas
          </h3>
        </div>

        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-200 font-medium block">Alerta de Meta Diária</span>
              <span className="text-[10px] text-slate-400">
                Aviso quando estiver próximo de atingir a meta
              </span>
            </div>
            <input
              type="checkbox"
              checked={userProfile.notificationPreferences.dailyGoalAlert}
              onChange={() => handleToggleNotification('dailyGoalAlert')}
              className="w-4 h-4 rounded text-emerald-500 bg-slate-950 border-slate-800"
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-200 font-medium block">
                Alerta de Manutenção Preventiva
              </span>
              <span className="text-[10px] text-slate-400">
                Notificar trocas de óleo e peças próximas
              </span>
            </div>
            <input
              type="checkbox"
              checked={userProfile.notificationPreferences.maintenanceAlert}
              onChange={() => handleToggleNotification('maintenanceAlert')}
              className="w-4 h-4 rounded text-emerald-500 bg-slate-950 border-slate-800"
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-200 font-medium block">Lembrete de Abastecimento</span>
              <span className="text-[10px] text-slate-400">
                Calcular médias e sugerir abastecimento
              </span>
            </div>
            <input
              type="checkbox"
              checked={userProfile.notificationPreferences.fuelReminder}
              onChange={() => handleToggleNotification('fuelReminder')}
              className="w-4 h-4 rounded text-emerald-500 bg-slate-950 border-slate-800"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
