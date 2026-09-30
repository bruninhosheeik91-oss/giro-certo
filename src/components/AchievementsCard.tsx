import React, { useEffect, useMemo } from 'react';
import { Award, CheckCircle2, LockKeyhole, Trophy } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { calculateReserveBalance } from '../utils/calculations';
import { showGoalNotification } from '../lib/nativeCoach';

type Achievement = { id: string; title: string; description: string; unlocked: boolean };

export const AchievementsCard: React.FC = () => {
  const {
    shifts,
    transactions,
    monthSummary,
    userProfile,
    maintenanceReserveLedger,
    cloudUserId,
    showToast,
  } = useApp();

  const achievements = useMemo<Achievement[]>(() => {
    const activityDays = new Set(transactions.map((transaction) => transaction.date)).size;
    const today = new Date();
    const isBeforeMonthEnd = today.getDate() < new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const reserveIds = new Set(maintenanceReserveLedger.map((entry) => entry.reserveId ?? 'default'));
    const completedReserve = [...reserveIds].some((reserveId) => {
      const entries = maintenanceReserveLedger.filter((entry) => (entry.reserveId ?? 'default') === reserveId);
      const goal = entries.find((entry) => (entry.goalAmount ?? 0) > 0)?.goalAmount ?? 0;
      return goal > 0 && calculateReserveBalance(entries) >= goal;
    });

    return [
      { id: 'first-shift', title: 'Primeiro Giro', description: 'Concluiu a primeira jornada.', unlocked: shifts.length > 0 },
      { id: 'monthly-goal', title: 'Meta Alcançada', description: 'Chegou a 100% da meta mensal.', unlocked: monthSummary.progressoMeta >= 100 },
      { id: 'seven-days', title: 'Constância', description: 'Registrou atividade em 7 dias diferentes.', unlocked: activityDays >= 7 },
      { id: 'hourly-target', title: 'Hora Valiosa', description: 'Superou o critério mínimo de lucro por hora.', unlocked: monthSummary.hourlyMetricsReady && monthSummary.lucroPorHora >= userProfile.rideCriteria.minProfitPerHour },
      { id: 'best-day', title: 'Dia de Destaque', description: 'Registrou um melhor dia com lucro positivo.', unlocked: (monthSummary.melhorDia?.lucro ?? 0) > 0 },
      { id: 'first-reserve', title: 'Futuro Protegido', description: 'Criou sua primeira Reserva Financeira.', unlocked: maintenanceReserveLedger.length > 0 },
      { id: 'reserve-goal', title: 'Reserva Completa', description: 'Alcançou a meta de uma reserva.', unlocked: completedReserve },
      { id: 'early-goal', title: 'Meta Antecipada', description: 'Superou a meta antes do fim do mês.', unlocked: monthSummary.progressoMeta >= 100 && isBeforeMonthEnd },
    ];
  }, [maintenanceReserveLedger, monthSummary, shifts.length, transactions, userProfile.rideCriteria.minProfitPerHour]);

  const storageKey = `giro_certo_achievements_${cloudUserId ?? 'local'}_v1`;

  useEffect(() => {
    const unlockedNow = achievements.filter((achievement) => achievement.unlocked).map((achievement) => achievement.id);
    let saved: string[] = [];
    try { saved = JSON.parse(localStorage.getItem(storageKey) ?? '[]') as string[]; } catch { saved = []; }
    const newlyUnlocked = achievements.filter((achievement) => achievement.unlocked && !saved.includes(achievement.id));
    if (newlyUnlocked.length === 0) return;
    localStorage.setItem(storageKey, JSON.stringify([...new Set([...saved, ...unlockedNow])]));
    const latest = newlyUnlocked[newlyUnlocked.length - 1];
    if (!latest) return;
    showToast(`Conquista desbloqueada: ${latest.title}!`);
    if (userProfile.notificationPreferences.dailyGoalAlert) {
      void showGoalNotification(`Giro Certo · ${latest.title}`, latest.description).catch(() => undefined);
    }
  }, [achievements, showToast, storageKey, userProfile.notificationPreferences.dailyGoalAlert]);

  const unlockedCount = achievements.filter((achievement) => achievement.unlocked).length;

  return (
    <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Conquistas</h3>
        </div>
        <span className="text-[10px] font-bold text-amber-300">{unlockedCount}/{achievements.length}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {achievements.map((achievement) => (
          <div key={achievement.id} className={`p-2.5 rounded-xl border ${achievement.unlocked ? 'bg-amber-500/10 border-amber-500/25' : 'bg-slate-950/50 border-slate-800 opacity-60'}`}>
            <div className="flex items-center gap-1.5 mb-1">
              {achievement.unlocked ? <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" /> : <LockKeyhole className="w-3.5 h-3.5 text-slate-500" />}
              <span className={`text-[10px] font-bold ${achievement.unlocked ? 'text-amber-200' : 'text-slate-400'}`}>{achievement.title}</span>
            </div>
            <p className="text-[9px] leading-snug text-slate-400">{achievement.description}</p>
          </div>
        ))}
      </div>
      {unlockedCount === achievements.length && (
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-emerald-300"><Award className="w-3.5 h-3.5" /> Todas as conquistas desbloqueadas!</div>
      )}
    </div>
  );
};
