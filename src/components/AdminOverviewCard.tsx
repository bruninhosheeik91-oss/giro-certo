import React, { useCallback, useEffect, useState } from 'react';
import { Ban, Crown, RefreshCw, Search, ShieldCheck, Unlock, X } from 'lucide-react';
import { getSupabaseClient } from '../lib/auth';
import { useSession } from '../context/SessionContext';

type Overview = {
  totalUsers: number;
  newUsers30d: number;
  activeUsers7d: number;
  blockedUsers: number;
};

type AdminUser = {
  id: string;
  email: string | null;
  name: string | null;
  city: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  blocked: boolean;
  blocked_reason: string | null;
  shifts_count: number;
  last_activity: string | null;
  is_admin: boolean;
};

const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
const fmtDate = (value: string | null) => (value ? dateFmt.format(new Date(value)) : '—');

/** Painel do proprietário: métricas e controle de acesso dos usuários. */
export const AdminOverviewCard: React.FC = () => {
  const { mode, userId } = useSession();
  const [isAdmin, setIsAdmin] = useState(false);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<AdminUser | null>(null);
  const [reason, setReason] = useState('');

  const loadOverview = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) return;
    const { data } = await client.rpc('get_admin_overview');
    if (data && typeof data === 'object' && !Array.isArray(data)) setOverview(data as unknown as Overview);
  }, []);

  const loadUsers = useCallback(async (term: string) => {
    const client = getSupabaseClient();
    if (!client) return;
    setLoading(true);
    setError(null);
    // RPC criada na migration 20261113170000 (ainda fora dos tipos gerados).
    const { data, error: rpcError } = await (client.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>)('admin_list_users', { p_search: term.trim() || null });
    setLoading(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setUsers(Array.isArray(data) ? (data as AdminUser[]) : []);
  }, []);

  useEffect(() => {
    if (mode !== 'cloud' || !userId) return;
    const client = getSupabaseClient();
    if (!client) return;
    let active = true;
    void client.rpc('is_giro_certo_admin').then(({ data }) => {
      if (!active || !data) return;
      setIsAdmin(true);
      void loadOverview();
    });
    return () => {
      active = false;
    };
  }, [mode, userId, loadOverview]);

  useEffect(() => {
    if (!panelOpen) return;
    const timer = window.setTimeout(() => void loadUsers(search), 300);
    return () => window.clearTimeout(timer);
  }, [panelOpen, search, loadUsers]);

  const applyBlock = async (user: AdminUser, blocked: boolean) => {
    const client = getSupabaseClient();
    if (!client) return;
    setError(null);
    const { error: rpcError } = await (client.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ error: { message: string } | null }>)('admin_set_user_blocked', {
      p_user_id: user.id,
      p_blocked: blocked,
      p_reason: blocked ? reason : null,
    });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setConfirm(null);
    setReason('');
    setUsers((list) => list.map((u) => (u.id === user.id ? { ...u, blocked, blocked_reason: blocked ? reason || null : null } : u)));
    void loadOverview();
  };

  if (!isAdmin || !overview) return null;

  const metrics = [
    ['Usuários', overview.totalUsers],
    ['Novos 30 dias', overview.newUsers30d],
    ['Ativos 7 dias', overview.activeUsers7d],
    ['Bloqueados', overview.blockedUsers],
  ] as const;

  return (
    <div className="space-y-3 rounded-2xl border border-violet-500/30 bg-slate-900 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-violet-300" />
          <h3 className="text-[15px] font-bold text-white">Painel do Proprietário</h3>
        </div>
        <span className="rounded-lg border border-violet-500/30 bg-violet-500/15 px-2 py-1 text-[11px] font-bold text-violet-200">ADMIN</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {metrics.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
            <span className="block text-[11px] uppercase text-slate-500">{label}</span>
            <span className="font-mono text-lg font-bold text-white">{value ?? 0}</span>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setPanelOpen(true)}
        className="h-11 w-full rounded-xl bg-violet-600 text-sm font-bold text-on-accent"
      >
        Gerenciar usuários
      </button>
      <p className="flex items-center gap-1 text-[11px] text-slate-400">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Acesso validado pelo Supabase. Dados financeiros dos usuários não são exibidos.
      </p>

      {panelOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-app" role="dialog" aria-modal="true" aria-labelledby="painel-usuarios">
          <div className="safe-top flex items-center gap-2 border-b border-slate-800 px-4 pb-3 pt-3">
            <h2 id="painel-usuarios" className="flex-1 text-lg font-bold text-white">Usuários</h2>
            <button type="button" onClick={() => void loadUsers(search)} aria-label="Atualizar" className="rounded-lg p-2 text-slate-400">
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button type="button" onClick={() => setPanelOpen(false)} aria-label="Fechar" className="rounded-lg p-2 text-slate-400">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="px-4 pt-3">
            <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou e-mail"
                className="flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-slate-500"
              />
            </label>
            {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
            <p className="mt-2 text-[11px] text-slate-500">{users.length} usuário(s)</p>
          </div>
          <ul className="flex-1 space-y-2 overflow-y-auto px-4 pb-6 pt-2">
            {users.map((user) => (
              <li key={user.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">
                      {user.name || 'Sem nome'}
                      {user.is_admin && <span className="ml-1.5 text-[11px] font-semibold text-violet-300">admin</span>}
                    </p>
                    <p className="truncate text-xs text-slate-400">{user.email}</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${user.blocked ? 'bg-rose-500/15 text-rose-300' : 'bg-emerald-500/15 text-emerald-300'}`}
                  >
                    {user.blocked ? 'BLOQUEADO' : 'ATIVO'}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1 text-[11px] text-slate-400">
                  <span>Cadastro<br /><b className="text-slate-200">{fmtDate(user.created_at)}</b></span>
                  <span>Último acesso<br /><b className="text-slate-200">{fmtDate(user.last_sign_in_at)}</b></span>
                  <span>Jornadas<br /><b className="text-slate-200">{user.shifts_count}</b></span>
                </div>
                {user.city && <p className="mt-1 text-[11px] text-slate-500">{user.city}</p>}
                {user.blocked && user.blocked_reason && <p className="mt-1 text-[11px] text-rose-300">Motivo: {user.blocked_reason}</p>}
                {!user.is_admin && (
                  <button
                    type="button"
                    onClick={() => (user.blocked ? void applyBlock(user, false) : setConfirm(user))}
                    className={`mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-xs font-bold ${user.blocked ? 'bg-emerald-600 text-on-accent' : 'border border-rose-500/40 text-rose-300'}`}
                  >
                    {user.blocked ? <><Unlock className="h-3.5 w-3.5" /> Desbloquear</> : <><Ban className="h-3.5 w-3.5" /> Bloquear acesso</>}
                  </button>
                )}
              </li>
            ))}
            {!loading && users.length === 0 && <li className="py-8 text-center text-sm text-slate-500">Nenhum usuário encontrado.</li>}
          </ul>

          {confirm && (
            <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-3 sm:items-center">
              <div className="w-full max-w-md space-y-3 rounded-[24px] border border-slate-800 bg-slate-900 p-5">
                <h3 className="text-lg font-bold text-white">Bloquear {confirm.name || confirm.email}?</h3>
                <p className="text-sm text-slate-400">A pessoa continua com a conta e os dados, mas perde o Copiloto, a régua e os recursos completos até você desbloquear.</p>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Motivo (opcional)"
                  className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-[15px] text-white"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setConfirm(null)} className="h-11 rounded-xl border border-slate-700 text-sm font-semibold text-white">Cancelar</button>
                  <button type="button" onClick={() => void applyBlock(confirm, true)} className="h-11 rounded-xl bg-rose-600 text-sm font-bold text-on-accent">Bloquear</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
