import React, { useEffect, useState } from 'react';
import { Crown, ShieldCheck, Users } from 'lucide-react';
import { getSupabaseClient } from '../lib/auth';
import { useSession } from '../context/SessionContext';

type Overview = {
  totalUsers: number;
  newUsers30d: number;
  activeSubscriptions: number;
  trialUsers: number;
  expiredUsers: number;
};

export const AdminOverviewCard: React.FC = () => {
  const { mode, userId } = useSession();
  const [overview, setOverview] = useState<Overview | null>(null);

  useEffect(() => {
    if (mode !== 'cloud' || !userId) return;
    const client = getSupabaseClient();
    if (!client) return;
    let active = true;
    void client.rpc('is_giro_certo_admin').then(async ({ data: isAdmin }) => {
      if (!active || !isAdmin) return;
      const { data } = await client.rpc('get_admin_overview');
      if (active && data && typeof data === 'object' && !Array.isArray(data)) {
        setOverview(data as unknown as Overview);
      }
    });
    return () => { active = false; };
  }, [mode, userId]);

  if (!overview) return null;
  const metrics = [
    ['Usuários', overview.totalUsers],
    ['Novos 30 dias', overview.newUsers30d],
    ['Em teste', overview.trialUsers],
    ['Assinantes', overview.activeSubscriptions],
  ] as const;

  return (
    <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-violet-950/40 border border-violet-500/30 space-y-3 shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Crown className="w-4 h-4 text-violet-300" /><h3 className="text-xs font-bold text-white uppercase tracking-wider">Painel do Proprietário</h3></div>
        <span className="px-2 py-1 rounded-lg bg-violet-500/15 border border-violet-500/30 text-[9px] font-bold text-violet-200">OWNER</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {metrics.map(([label, value]) => <div key={label} className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800"><span className="text-[9px] uppercase text-slate-500 block">{label}</span><span className="text-lg font-bold font-mono text-white">{value}</span></div>)}
      </div>
      <div className="flex items-center justify-between text-[10px] text-slate-400"><span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Acesso validado pelo Supabase</span><span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {overview.expiredUsers} expirados</span></div>
      <p className="text-[10px] text-slate-500">O painel web completo será liberado em uma etapa separada. Nenhum dado financeiro pessoal é exibido aqui.</p>
    </div>
  );
};
