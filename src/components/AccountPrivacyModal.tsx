import React, { useState } from 'react';
import {
  ArrowLeft,
  Download,
  FileText,
  Scale,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { deleteCurrentAccount, shareAccountExport } from '../lib/accountPrivacy';

type Page = 'menu' | 'privacy' | 'terms' | 'delete';

interface AccountPrivacyModalProps {
  open: boolean;
  onClose: () => void;
}

export const AccountPrivacyModal: React.FC<AccountPrivacyModalProps> = ({ open, onClose }) => {
  const app = useApp();
  const [page, setPage] = useState<Page>('menu');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!open) return null;

  const close = () => {
    setPage('menu');
    setConfirmation('');
    setMessage(null);
    onClose();
  };

  const exportData = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await shareAccountExport(app.cloudEmail, {
        profile: app.userProfile,
        vehicles: app.vehicles,
        registeredApps: app.registeredApps,
        transactions: app.transactions,
        shifts: app.shifts,
        activeShift: app.activeShift,
        financialCommitments: app.financialCommitments,
        payableInstallments: app.payableInstallments,
        maintenanceReserveLedger: app.maintenanceReserveLedger,
      });
      setMessage('Arquivo preparado com sucesso.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível exportar seus dados.');
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await deleteCurrentAccount(confirmation);
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível excluir sua conta.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="safe-bottom max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-slate-700/80 bg-[#0f172a] shadow-2xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-800 bg-[#0f172a]/95 p-4 backdrop-blur">
          {page !== 'menu' && (
            <button type="button" onClick={() => { setPage('menu'); setMessage(null); }} className="rounded-xl bg-slate-800 p-2 text-slate-300" aria-label="Voltar">
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-white">Conta e Privacidade</h2>
            <p className="text-[10px] text-slate-400">Seus dados, seus controles</p>
          </div>
          <button type="button" onClick={close} className="rounded-xl bg-slate-800 p-2 text-slate-400" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          {page === 'menu' && (
            <>
              <MenuButton icon={ShieldCheck} title="Política de Privacidade" description="Como protegemos e utilizamos seus dados" onClick={() => setPage('privacy')} />
              <MenuButton icon={Scale} title="Termos de Uso" description="Regras para utilização do Giro Certo" onClick={() => setPage('terms')} />
              <button type="button" disabled={busy} onClick={() => void exportData()} className="flex w-full items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left disabled:opacity-50">
                <Download className="h-5 w-5 text-blue-400" />
                <span className="flex-1"><strong className="block text-xs text-white">Exportar meus dados</strong><span className="text-[10px] text-slate-400">Baixe uma cópia em formato JSON</span></span>
              </button>
              {app.mode === 'cloud' && (
                <button type="button" onClick={() => setPage('delete')} className="flex w-full items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 text-left">
                  <Trash2 className="h-5 w-5 text-rose-400" />
                  <span className="flex-1"><strong className="block text-xs text-rose-200">Excluir minha conta</strong><span className="text-[10px] text-slate-400">Apaga permanentemente a conta e os dados</span></span>
                </button>
              )}
            </>
          )}

          {page === 'privacy' && <PrivacyPolicy />}
          {page === 'terms' && <TermsOfUse />}
          {page === 'delete' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-rose-500/25 bg-rose-500/5 p-4">
                <Trash2 className="h-6 w-6 text-rose-400" />
                <h3 className="mt-3 text-sm font-bold text-white">Exclusão permanente</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">Serão apagados seu perfil, veículos, jornadas, lançamentos, contas, reservas, foto e assinatura. Essa ação não pode ser desfeita.</p>
              </div>
              <button type="button" disabled={busy} onClick={() => void exportData()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-500/25 bg-blue-500/10 px-4 py-3 text-xs font-bold text-blue-200 disabled:opacity-50">
                <Download className="h-4 w-4" /> Fazer backup antes de excluir
              </button>
              <label className="block text-xs font-semibold text-slate-300">Digite <strong className="text-white">EXCLUIR</strong> para confirmar
                <input value={confirmation} onChange={(event) => setConfirmation(event.target.value.toUpperCase())} autoCapitalize="characters" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm font-bold tracking-widest text-white outline-none focus:border-rose-500" />
              </label>
              <button type="button" disabled={busy || confirmation !== 'EXCLUIR'} onClick={() => void deleteAccount()} className="w-full rounded-xl bg-rose-500 px-4 py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
                {busy ? 'Excluindo…' : 'Excluir conta permanentemente'}
              </button>
            </div>
          )}

          {message && <p role="status" className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-slate-300">{message}</p>}
        </div>
      </div>
    </div>
  );
};

const MenuButton: React.FC<{ icon: React.ElementType; title: string; description: string; onClick: () => void }> = ({ icon: Icon, title, description, onClick }) => (
  <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left">
    <Icon className="h-5 w-5 text-emerald-400" />
    <span className="flex-1"><strong className="block text-xs text-white">{title}</strong><span className="text-[10px] text-slate-400">{description}</span></span>
    <FileText className="h-4 w-4 text-slate-600" />
  </button>
);

const PrivacyPolicy: React.FC = () => (
  <article className="space-y-4 text-xs leading-relaxed text-slate-300">
    <h3 className="text-sm font-bold text-white">Política de Privacidade</h3>
    <p>Última atualização: 30 de setembro de 2026.</p>
    <Section title="Dados tratados">O Giro Certo armazena dados de cadastro, perfil, veículo, jornadas, ganhos, despesas, metas, contas, reservas e foto adicionados pelo próprio usuário.</Section>
    <Section title="Finalidade">Os dados são usados exclusivamente para autenticação, sincronização, funcionamento dos recursos financeiros e suporte ao usuário.</Section>
    <Section title="Armazenamento e segurança">A sincronização utiliza Supabase com isolamento por usuário. Informações financeiras não são vendidas nem usadas para conceder crédito.</Section>
    <Section title="Pagamentos">Quando habilitadas, assinaturas Android serão processadas pelo Google Play. O Giro Certo não armazena dados completos de cartão.</Section>
    <Section title="Seus direitos">Você pode exportar seus dados ou excluir permanentemente sua conta nesta própria tela.</Section>
  </article>
);

const TermsOfUse: React.FC = () => (
  <article className="space-y-4 text-xs leading-relaxed text-slate-300">
    <h3 className="text-sm font-bold text-white">Termos de Uso</h3>
    <p>Última atualização: 30 de setembro de 2026.</p>
    <Section title="Finalidade">O Giro Certo é uma ferramenta de organização pessoal para motoristas e entregadores. Os cálculos e simuladores são estimativas informativas.</Section>
    <Section title="Responsabilidade do usuário">O usuário é responsável pela veracidade dos lançamentos, pela segurança da conta e por suas decisões financeiras e operacionais.</Section>
    <Section title="Disponibilidade">Podemos atualizar recursos para melhorar segurança e desempenho. Sincronizações dependem da conexão com a internet e dos serviços contratados.</Section>
    <Section title="Assinaturas">Preços, período de teste, renovação e cancelamento serão apresentados antes da contratação e administrados conforme as regras da Google Play.</Section>
    <Section title="Uso adequado">Não é permitido tentar acessar dados de terceiros, explorar falhas ou utilizar o aplicativo para atividades ilegais.</Section>
  </article>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => <section><h4 className="font-bold text-slate-100">{title}</h4><p className="mt-1 text-slate-400">{children}</p></section>;
