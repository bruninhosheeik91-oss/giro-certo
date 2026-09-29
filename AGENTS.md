# AGENTS.md — Giro Certo

Projeto "Giro Certo" (ex-Rota Financeira): app web mobile-first para motoristas e entregadores de
aplicativo controlarem ganhos, despesas, jornadas e lucro real.

## Stack

- React 19 (SPA, Vite 8, TypeScript 6 strict)
- Tailwind CSS 4 (`@tailwindcss/vite`)
- `lucide-react` (ícones), `motion` (animações)
- Sem router (navegação por abas via `AppContext`); sem lib de gráficos (SVG próprio)
- Persistência local: `localStorage` (chaves `rota_financeira_*_v2`) — local-first
- Sync opcional por backend: Supabase (Auth + PostgreSQL + RLS) via `@supabase/supabase-js`;
  fila offline + sync engine em `src/lib/`. Sem env vars o app roda 100% local (padrão).
- PWA (`vite-plugin-pwa`) + Android nativo via `@capacitor/*` (`android/`)

## Comandos

- `npm install` — instala dependências (sem `--legacy-peer-deps`; esbuild está alinhado com Vite 8)
- `npm run dev` — servidor Vite na porta 3000
- `npm run build` — build de produção (`dist/` + PWA)
- `npm run preview` — pré-visualização do build
- `npm run lint` — `tsc --noEmit` + ESLint (obrigatório passar antes de qualquer PR/commit)
- `npm test` — Vitest (testes de utilidades e da camada de sync)
- `npm run format` — Prettier (write) em `src/`
- `npm run clean` — remove `dist/` (funciona em Windows)
- `npm run android:sync` — build + `cap sync android`; `npm run android:open` — abre o Android Studio

## Estrutura

- `src/App.tsx` — composição raiz (AuthGate + AppProvider)
- `src/context/AppContext.tsx` — estado global, navegação por abas, CRUD, localStorage, lógica de jornada
- `src/data/mockData.ts` — seeds/dados simulados
- `src/utils/calculations.ts` — todas as fórmulas de negócio (funções puras)
- `src/lib/` — camada de sync: cliente Supabase, fila offline, sync engine, migração local → nuvem
- `src/hooks/useAuthState.ts` — estado de autenticação do AuthGate
- `src/types.ts` — tipos do domínio (Transaction é union discriminada: ganho | abastecimento | manutencao | outra_despesa)
- `src/views/` — 5 telas (Home, Transactions, Shift, Reports, Profile) + `src/components/` (modais, header, nav)

## Regras de negócio (decisões vigentes)

- **Reserva de manutenção** = soma dos km das jornadas *concluídas* no período × `maintenanceReservePerKm`.
  Reserva sugerida ≠ reserva depositada. Não descontar duas vezes do lucro.
- **Veículo oficial**: Factor 150 — apelido "Moto do Dia a Dia", ano 2024, odômetro 42.118 km.
  `veh-fazer-250` está proibido; reconciliação idempotente ao carregar do localStorage.
- **Backend**: Supabase (Auth + PostgreSQL + RLS + sync) instalado e ativo via env vars.
  Sem `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` o `AuthGate` deixa o app seguir local.
  Nunca usar service_role no cliente; RLS garante isolamento por `uid()`.
- **Fase 4B (sync)**: toda alteração passa pela fila antes de chegar à nuvem; uma op só é
  descartada depois da confirmação do servidor. Cada tabela é gravada em requisição separada,
  então a ordem importa (pais antes dos filhos) e o FK `23503` é transitório, nunca bloqueio.
  A migração local → conta é única e marcada em `user_settings.local_import_completed_at`, sempre
  enfileirada junto do dado (e sozinha quando não há dado local). Só sobe dado do usuário: nunca a
  semente de `mockData` intacta. O sinal é `markScopeTouched` mais a comparação com `mockData` —
  "só tem ID da semente" não basta, porque apagar ou editar um lançamento da demonstração também
  é dado do usuário.
- **Mobile**: PWA + Capacitor (Android) já empacotam `dist/`. Não migrar para RN/Expo.

## Sync (Fase 4B)

- `src/repositories/` — fronteira do domínio: `storageKeys` (escopo por usuário),
  `appSnapshot` (leitura/escrita/normalização), `mappers` (domínio ⇄ schema), `persistence`
  (pull/merge/fila e migração local → conta).
- `src/lib/offlineQueue.ts` — fila persistente; `src/lib/syncEngine.ts` — drain, coalescência e
  classificação de erro. `src/lib/localMode.ts` guarda a escolha do modo local.
- Migrations em `supabase/migrations/`: a `20260928000100_phase4b_hardening.sql` é idempotente
  e adiciona CHECKs, FKs, unicidade (uma jornada/veículo/pausa ativos) e as 4 políticas RLS por
  tabela. `transactions.installment_id` fica **sem** FK de propósito: fecha ciclo com
  `installments.transaction_id` e quebraria o upsert em requisições separadas.
- O Perfil expõe o status de sync; o `AppContext` expõe `syncQueue`, `retryPendingSync`,
  `signOut`, `enableCloudMode` e `ready` (trava o render durante a troca de escopo).

## Standards do repo

- TypeScript `strict`, `noUnusedLocals`, `noUnusedParameters`. Imports de ícones sem uso não passam no lint.
- Sem `as any` (use narrowing do union de `Transaction`).
- Conformidade com o padrão de tipos; formatação via Prettier.
- Não adicionar comentários desnecessários; código termina sem summary prolixo.