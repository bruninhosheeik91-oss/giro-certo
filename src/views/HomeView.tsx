import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  formatBRL,
  formatHours,
  formatPercent,
  parseDecimalInput,
  calculateMonthlyGoalProjection,
} from '../utils/calculations';
import {
  Bike,
  Calculator,
  CalendarClock,
  Car,
  Check,
  ChevronRight,
  Clock,
  Edit2,
  Fuel,
  MapPin,
  Pause,
  PiggyBank,
  Play,
  Plus,
  Radar,
  TrendingUp,
  Volume2,
  Wrench,
} from 'lucide-react';
import { getCoachVoicePreferences, showGoalNotification, speakGoalCoach } from '../lib/nativeCoach';
import { getRideAnalyzerEnabled, isRideOfferNativeAvailable } from '../lib/rideOffer';
import { useTargetBar } from '../hooks/useTargetBar';

const MONTH_FULL = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const card = 'rounded-[20px] bg-slate-900 border border-slate-800/70';

function useMinuteTick(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function formatElapsed(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds / 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
}

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
}

const ProgressBar: React.FC<{ value: number }> = ({ value }) => (
  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
    <div
      className="h-full rounded-full bg-emerald-400 transition-all duration-700"
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
);

export const HomeView: React.FC = () => {
  const {
    monthSummary,
    todaySummary,
    userProfile,
    updateUserProfile,
    activeVehicle,
    activeShift,
    transactions,
    shifts,
    maintenanceReserveBalance,
    openNewTransactionModal,
    openVehiclesModal,
    openMaintenanceModal,
    openSimulatorsModal,
    openReserveModal,
    openPayablesModal,
    payablesSummary,
    setActiveTab,
    selectedMonth,
    getShiftTotals,
    pauseShift,
    resumeShift,
  } = useApp();
  const { bar } = useTargetBar();
  const now = useMinuteTick();
  const native = isRideOfferNativeAvailable();
  const [copilotOn, setCopilotOn] = useState(false);

  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [newGoalInput, setNewGoalInput] = useState(userProfile.monthlyGoal.toString());

  useEffect(() => {
    if (!native) return;
    const check = () => void getRideAnalyzerEnabled().then(setCopilotOn).catch(() => undefined);
    check();
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [native]);

  const goalProjection = calculateMonthlyGoalProjection(
    selectedMonth,
    monthSummary.lucroDisponivel,
    userProfile.monthlyGoal,
  );
  const {
    targetRemaining,
    dailyRequired,
    daysRemaining,
    dayOfMonth,
    daysInMonth,
    paceDifference,
    periodState,
    status: goalStatus,
    projectedMonthProfit,
  } = goalProjection;

  const firstName = userProfile.name?.trim().split(/\s+/)[0] || 'motorista';
  const isNewUser = transactions.length === 0 && shifts.length === 0;
  const dailyGoal = daysInMonth > 0 ? userProfile.monthlyGoal / daysInMonth : 0;
  const todayProfit = todaySummary.lucroDisponivel;
  const todayProgress = dailyGoal > 0 ? (todayProfit / dailyGoal) * 100 : 0;
  const shiftTotals = activeShift ? getShiftTotals(activeShift.shiftId) : null;
  const shiftElapsed = activeShift
    ? (now - activeShift.startEpoch) / 1000 -
      activeShift.totalPausedSeconds -
      (activeShift.isPaused && activeShift.pauseStartEpoch ? (now - activeShift.pauseStartEpoch) / 1000 : 0)
    : 0;
  const [year, month] = selectedMonth.split('-').map(Number);
  const monthName = `${MONTH_FULL[month - 1] ?? ''}${year !== new Date().getFullYear() ? ` de ${year}` : ''}`;

  const goalCoach = useMemo(() => {
    if (periodState === 'past') {
      return { title: 'Mês encerrado', message: `O resultado final foi ${formatBRL(monthSummary.lucroDisponivel)}. Use este histórico para planejar a próxima meta.` };
    }
    if (periodState === 'future') {
      return { title: 'Planejamento pronto', message: `Sua meta de ${formatBRL(userProfile.monthlyGoal)} será acompanhada durante os ${daysInMonth} dias deste mês.` };
    }
    if (targetRemaining <= 0) {
      return { title: `Meta alcançada, ${firstName}!`, message: `Você superou a meta em ${formatBRL(Math.abs(targetRemaining))}. Que tal guardar parte nas Reservas?` };
    }
    if (monthSummary.ganhoBruto === 0 && monthSummary.totalDespesas === 0) {
      return { title: 'Mês começando', message: `Para chegar a ${formatBRL(userProfile.monthlyGoal)}, mire em cerca de ${formatBRL(dailyRequired)} por dia trabalhado.` };
    }
    if (monthSummary.progressoMeta >= 85) {
      return { title: 'Falta muito pouco!', message: `Você já fez ${formatPercent(monthSummary.progressoMeta)} da meta. Faltam ${formatBRL(targetRemaining)}.` };
    }
    if (paceDifference >= 0) {
      return { title: 'No ritmo certo', message: `Você está ${formatBRL(paceDifference)} acima do ritmo esperado. Continue assim!` };
    }
    if (daysRemaining === 0) {
      return { title: 'Último dia do mês', message: `Faltam ${formatBRL(targetRemaining)} para a meta. Faça o melhor hoje, sem aceitar corrida que dá prejuízo.` };
    }
    return { title: 'Bora recuperar o ritmo', message: `Com ${formatBRL(dailyRequired)} por dia nos próximos ${daysRemaining} dias, você volta para o caminho da meta.` };
  }, [dailyRequired, daysInMonth, daysRemaining, firstName, monthSummary.ganhoBruto, monthSummary.lucroDisponivel, monthSummary.progressoMeta, monthSummary.totalDespesas, paceDifference, periodState, targetRemaining, userProfile.monthlyGoal]);

  useEffect(() => {
    const preferences = getCoachVoicePreferences();
    if (!preferences.greetingEnabled || activeShift || periodState !== 'current' || isNewUser) return;
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    const key = `giro_certo_spoken_greeting_${today}`;
    if (localStorage.getItem(key)) return;
    const monthlyContext = `Sua meta mensal é ${formatBRL(userProfile.monthlyGoal)}. Até agora, você acumulou ${formatBRL(monthSummary.lucroDisponivel)}.`;
    const encouragement = targetRemaining <= 0
      ? `${monthlyContext} Parabéns! A meta do mês foi alcançada.`
      : daysRemaining === 0
        ? `${monthlyContext} Faltam ${formatBRL(targetRemaining)} e hoje é o último dia do mês. Faça o seu melhor sem aceitar corridas que dão prejuízo.`
        : paceDifference >= 0
          ? `${monthlyContext} Faltam ${formatBRL(targetRemaining)}. Você está no ritmo certo. Cada giro conta!`
          : `${monthlyContext} Faltam ${formatBRL(targetRemaining)}. A média necessária nos próximos ${daysRemaining} dias é de ${formatBRL(dailyRequired)} por dia. Não desista!`;
    const timer = window.setTimeout(() => {
      void speakGoalCoach(`${greeting()}, ${firstName}! ${encouragement}`)
        .then(() => localStorage.setItem(key, 'spoken'))
        .catch(() => undefined);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [activeShift, dailyRequired, daysRemaining, firstName, isNewUser, monthSummary.lucroDisponivel, paceDifference, periodState, targetRemaining, userProfile.monthlyGoal]);

  useEffect(() => {
    if (!userProfile.notificationPreferences.dailyGoalAlert || periodState !== 'current' || isNewUser) return;
    const today = new Date().toISOString().slice(0, 10);
    const key = `giro_certo_goal_coach_${today}_${goalCoach.title}`;
    if (localStorage.getItem(key)) return;
    void showGoalNotification(`Giro Certo · ${goalCoach.title}`, goalCoach.message)
      .then(() => localStorage.setItem(key, 'sent'))
      .catch(() => undefined);
  }, [goalCoach, isNewUser, periodState, userProfile.notificationPreferences.dailyGoalAlert]);

  const handleSaveGoal = () => {
    const val = parseDecimalInput(newGoalInput);
    if (!isNaN(val) && val > 0) updateUserProfile({ monthlyGoal: val });
    setIsEditingGoal(false);
  };

  const quickActions = [
    { label: 'Ganho', icon: Plus, tone: 'text-emerald-400', onClick: () => openNewTransactionModal('ganho') },
    { label: 'Abastecer', icon: Fuel, tone: 'text-sky-400', onClick: () => openNewTransactionModal('abastecimento') },
    { label: 'Manutenção', icon: Wrench, tone: 'text-slate-200', onClick: openMaintenanceModal },
    { label: 'Simular', icon: Calculator, tone: 'text-slate-200', onClick: openSimulatorsModal },
  ];

  return (
    <div className="space-y-4 pb-2">
      {/* Hoje: jornada em andamento, primeiros passos ou resumo do dia */}
      {activeShift ? (
        <section aria-label="Jornada de hoje" className={`${card} space-y-4 p-5`}>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              {!activeShift.isPaused && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              )}
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${activeShift.isPaused ? 'bg-amber-400' : 'bg-emerald-400'}`} />
            </span>
            <span className="text-sm font-semibold text-white">
              {activeShift.isPaused ? 'Jornada pausada' : 'Jornada em andamento'}
            </span>
            <span className="ml-auto text-sm text-slate-400">
              {formatElapsed(shiftElapsed)} · desde {activeShift.startTime.slice(0, 5)}
            </span>
          </div>
          <div>
            <p className="text-sm text-slate-400">Lucro de hoje</p>
            <p className="mt-1 text-[40px] font-extrabold leading-none tracking-tight text-emerald-400">
              {formatBRL(todayProfit)}
            </p>
            <p className="mt-2 text-[13px] text-slate-400">
              Ganho {formatBRL(todaySummary.ganhoBruto)} · Gastos {formatBRL(todaySummary.totalDespesas)}
              {shiftTotals && shiftTotals.gain !== todaySummary.ganhoBruto ? ` · Jornada ${formatBRL(shiftTotals.gain)}` : ''}
            </p>
          </div>
          {dailyGoal > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-[13px]">
                <span className="text-slate-400">Meta do dia {formatBRL(dailyGoal)}</span>
                <span className="font-bold text-emerald-400">
                  {Math.round(todayProgress)}%{todayProgress >= 100 ? ' ✓' : ''}
                </span>
              </div>
              <ProgressBar value={todayProgress} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={activeShift.isPaused ? resumeShift : pauseShift}
              className="flex h-12 items-center justify-center gap-2 rounded-[14px] border border-slate-700 bg-slate-800 text-[15px] font-semibold text-white active:scale-[0.98]"
            >
              {activeShift.isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              {activeShift.isPaused ? 'Retomar' : 'Pausar'}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('jornada')}
              className="h-12 rounded-[14px] bg-white text-[15px] font-bold text-app active:scale-[0.98]"
            >
              Encerrar jornada
            </button>
          </div>
        </section>
      ) : isNewUser ? (
        <section aria-label="Primeiros passos" className={`${card} space-y-4 p-5`}>
          <div>
            <p className="text-sm text-slate-400">{greeting()}, {firstName}</p>
            <h2 className="mt-1 text-2xl font-extrabold leading-tight tracking-tight text-white">
              Vamos para a sua primeira jornada?
            </h2>
          </div>
          <ul className="space-y-2.5">
            {[
              { done: true, label: 'Veículo cadastrado', detail: activeVehicle.nickname },
              { done: userProfile.monthlyGoal > 0, label: 'Meta definida', detail: `${formatBRL(userProfile.monthlyGoal)}/mês` },
              { done: false, label: 'Iniciar a primeira jornada', detail: '' },
            ].map((step, index) => (
              <li key={step.label} className="flex items-center gap-3">
                {step.done ? (
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </span>
                ) : (
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full border-2 border-slate-700 text-[13px] font-bold text-slate-400">
                    {index + 1}
                  </span>
                )}
                <span className={`text-[15px] ${step.done ? 'text-white' : 'font-semibold text-white'}`}>
                  {step.label}
                  {step.detail && <span className="text-slate-400"> · {step.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setActiveTab('jornada')}
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-emerald-500 text-base font-bold text-on-accent active:scale-[0.98]"
          >
            <Play className="h-4 w-4 fill-current" /> Iniciar jornada
          </button>
          {userProfile.monthlyGoal > 0 && (
            <p className="text-[13px] leading-relaxed text-slate-400">
              Para chegar a {formatBRL(userProfile.monthlyGoal)} no mês, mire em cerca de{' '}
              <b className="text-white">{formatBRL(dailyRequired)} por dia</b> trabalhado.
            </p>
          )}
        </section>
      ) : (
        <section aria-label="Hoje" className={`${card} space-y-4 p-5`}>
          <div className="flex items-baseline justify-between">
            <p className="text-sm text-slate-400">{greeting()}, {firstName}</p>
            <p className="text-[13px] text-slate-400">Hoje</p>
          </div>
          <div>
            <p className="text-sm text-slate-400">Lucro de hoje</p>
            <p className={`mt-1 text-[34px] font-extrabold leading-none tracking-tight ${todayProfit > 0 ? 'text-emerald-400' : 'text-white'}`}>
              {formatBRL(todayProfit)}
            </p>
            {dailyGoal > 0 && (
              <p className="mt-2 text-[13px] text-slate-400">Meta do dia {formatBRL(dailyGoal)}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('jornada')}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-emerald-500 text-[15px] font-bold text-on-accent active:scale-[0.98]"
          >
            <Play className="h-4 w-4 fill-current" /> Iniciar jornada
          </button>
        </section>
      )}

      {/* Copiloto / régua de aceite */}
      <button
        type="button"
        onClick={openSimulatorsModal}
        className="flex w-full items-center gap-3 rounded-2xl bg-sky-500/10 px-4 py-3.5 text-left active:scale-[0.99]"
      >
        <Radar className="h-[22px] w-[22px] flex-none text-sky-400" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-white">
            {native ? (copilotOn ? 'Copiloto ativo' : 'Copiloto desligado') : 'Régua de aceite'}
          </span>
          <span className="block text-[13px] text-slate-400">
            Aceite acima de <b className="text-white">{formatBRL(bar.minGrossPerKm)}/km</b> · mín. {formatBRL(bar.minFare)}
          </span>
        </span>
        <ChevronRight className="h-[18px] w-[18px] flex-none text-slate-400" />
      </button>

      {/* Ações rápidas */}
      <nav aria-label="Ações rápidas" className="grid grid-cols-4 gap-2">
        {quickActions.map(({ label, icon: Icon, tone, onClick }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            className="flex h-[76px] flex-col items-center justify-center gap-2 rounded-2xl border border-slate-800/70 bg-slate-900 text-[13px] font-semibold text-white active:scale-95"
          >
            <span className={`flex h-8 w-8 items-center justify-center rounded-[10px] bg-slate-800 ${tone}`}>
              <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
            </span>
            {label}
          </button>
        ))}
      </nav>

      {/* Mês */}
      <section aria-label="Resultado do mês" className={`${card} space-y-4 p-5`}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-bold text-white">{monthName}</h2>
          <div className="flex items-center gap-1">
            <span className="text-[13px] text-slate-400">
              {periodState === 'current' ? `Dia ${dayOfMonth} de ${daysInMonth} · ${goalStatus}` : goalStatus}
            </span>
            <button
              type="button"
              onClick={() => setIsEditingGoal(!isEditingGoal)}
              aria-label="Ajustar meta mensal"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 active:bg-slate-800"
            >
              <Edit2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {isEditingGoal ? (
          <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 p-2">
            <label htmlFor="meta-mensal" className="pl-1 text-sm font-semibold text-slate-400">Meta R$</label>
            <input
              id="meta-mensal"
              type="number"
              inputMode="decimal"
              value={newGoalInput}
              onChange={(e) => setNewGoalInput(e.target.value)}
              className="w-full bg-transparent text-base font-bold text-white focus:outline-none"
            />
            <button type="button" onClick={handleSaveGoal} className="h-10 rounded-lg bg-emerald-500 px-4 text-sm font-bold text-on-accent">
              Salvar
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-slate-400">Lucro do mês</p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-[28px] font-extrabold tracking-tight text-white">{formatBRL(monthSummary.lucroDisponivel)}</span>
              <span className="text-sm text-slate-400">de {formatBRL(userProfile.monthlyGoal)}</span>
            </p>
          </div>
        )}

        <div className="space-y-2">
          <ProgressBar value={monthSummary.progressoMeta} />
          <div className="flex justify-between text-[13px] text-slate-400">
            <span>{formatPercent(monthSummary.progressoMeta)} da meta</span>
            <span>
              {targetRemaining > 0 ? `Faltam ${formatBRL(targetRemaining)}` : 'Meta batida ✓'}
            </span>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-2xl bg-slate-800/60 p-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white">{goalCoach.title}</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-slate-400">{goalCoach.message}</p>
            {periodState === 'current' && targetRemaining > 0 && (
              <p className="mt-1.5 text-xs text-slate-400">
                Projeção de fechamento: <b className="text-white">{formatBRL(projectedMonthProfit)}</b>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void speakGoalCoach(`${goalCoach.title}. ${goalCoach.message}`)}
            aria-label="Ouvir mensagem"
            className="flex h-10 w-10 flex-none items-center justify-center rounded-xl text-slate-400 active:bg-slate-800"
          >
            <Volume2 className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="grid grid-cols-3 border-t border-slate-800 pt-4">
          <div>
            <p className="text-[13px] text-slate-400">Ganho</p>
            <p className="mt-1 text-base font-bold text-white">{formatBRL(monthSummary.ganhoBruto)}</p>
          </div>
          <div className="border-l border-slate-800 pl-3">
            <p className="text-[13px] text-slate-400">Gastos</p>
            <p className="mt-1 text-base font-bold text-rose-400">{formatBRL(monthSummary.totalDespesas)}</p>
          </div>
          <div className="border-l border-slate-800 pl-3">
            <p className="text-[13px] text-slate-400">Lucro/hora</p>
            <p className="mt-1 text-base font-bold text-white">
              {monthSummary.hourlyMetricsReady ? formatBRL(monthSummary.lucroPorHora) : '—'}
            </p>
          </div>
        </div>
      </section>

      {/* Desempenho do mês */}
      <section aria-label="Desempenho do mês" className={`${card} grid grid-cols-2`}>
        {[
          { icon: Clock, label: 'Horas trabalhadas', value: formatHours(monthSummary.horasTrabalhadas) },
          { icon: MapPin, label: 'Km rodados', value: `${monthSummary.quilometrosRodados.toLocaleString('pt-BR')} km` },
          {
            icon: TrendingUp,
            label: 'Ganho por hora',
            value: monthSummary.hourlyMetricsReady ? formatBRL(monthSummary.ganhoPorHora) : '—',
          },
          { icon: TrendingUp, label: 'Lucro por km', value: formatBRL(monthSummary.lucroPorKm) },
        ].map(({ icon: Icon, label, value }, i) => (
          <div
            key={label}
            className={`p-4 ${i % 2 === 1 ? 'border-l border-slate-800' : ''} ${i >= 2 ? 'border-t border-slate-800' : ''}`}
          >
            <p className="flex items-center gap-1.5 text-[13px] text-slate-400">
              <Icon className="h-3.5 w-3.5" /> {label}
            </p>
            <p className="mt-1 text-[17px] font-bold text-white">{value}</p>
          </div>
        ))}
      </section>

      {/* Organização */}
      <section aria-label="Organização" className={`${card} overflow-hidden`}>
        {[
          {
            icon: CalendarClock,
            tone: 'text-sky-400',
            title: 'Contas do mês',
            detail:
              payablesSummary.overdueCount > 0
                ? `${payablesSummary.overdueCount} atrasada${payablesSummary.overdueCount > 1 ? 's' : ''} · ${formatBRL(payablesSummary.pendingAmount)} pendente`
                : payablesSummary.nextDue
                  ? `Próximo vencimento ${new Date(`${payablesSummary.nextDue.dueDate}T12:00:00`).toLocaleDateString('pt-BR')} · ${formatBRL(payablesSummary.pendingAmount)}`
                  : 'Nenhum vencimento pendente',
            alert: payablesSummary.overdueCount > 0,
            onClick: openPayablesModal,
          },
          {
            icon: PiggyBank,
            tone: 'text-emerald-400',
            title: 'Reservas',
            detail: `${formatBRL(maintenanceReserveBalance)} guardados · sugerido ${formatBRL(monthSummary.reservaManutencao)}`,
            alert: false,
            onClick: openReserveModal,
          },
          {
            icon: activeVehicle.type === 'moto' ? Bike : Car,
            tone: 'text-slate-200',
            title: activeVehicle.nickname,
            detail: `${activeVehicle.currentKm.toLocaleString('pt-BR')} km · trocar ou editar veículo`,
            alert: false,
            onClick: openVehiclesModal,
          },
        ].map(({ icon: Icon, tone, title, detail, alert, onClick }, i) => (
          <button
            key={title}
            type="button"
            onClick={onClick}
            className={`flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-800/60 ${i > 0 ? 'border-t border-slate-800' : ''}`}
          >
            <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-slate-800 ${tone}`}>
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-white">{title}</span>
              <span className={`block truncate text-[13px] ${alert ? 'font-semibold text-rose-400' : 'text-slate-400'}`}>{detail}</span>
            </span>
            <ChevronRight className="h-[18px] w-[18px] flex-none text-slate-400" />
          </button>
        ))}
      </section>
    </div>
  );
};
