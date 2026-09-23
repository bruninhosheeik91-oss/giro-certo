# AGENTS.md — Giro Certo

Projeto "Giro Certo" (ex-Rota Financeira): app web mobile-first para motoristas e entregadores de
aplicativo controlarem ganhos, despesas, jornadas e lucro real.

## Stack

- React 19 (SPA, Vite 8, TypeScript 6 strict)
- Tailwind CSS 4 (`@tailwindcss/vite`)
- `lucide-react` (ícones), `motion` (animações)
- Sem router (navegação por abas via `AppContext`); sem lib de gráficos (SVG próprio)
- Persistência local: `localStorage` (chaves `rota_financeira_*_v2`) — sem backend ainda

## Comandos

- `npm install` — instala dependências (sem `--legacy-peer-deps`; esbuild está alinhado com Vite 8)
- `npm run dev` — servidor Vite na porta 3000
- `npm run build` — build de produção (`dist/`)
- `npm run preview` — pré-visualização do build
- `npm run lint` — `tsc --noEmit` + ESLint (obrigatório passar antes de qualquer PR/commit)
- `npm run format` — Prettier (write) em `src/`
- `npm run clean` — remove `dist/` (funciona em Windows)

## Estrutura

- `src/App.tsx` — composição raiz
- `src/context/AppContext.tsx` — estado global, navegação por abas, CRUD, localStorage, lógica de jornada
- `src/data/mockData.ts` — seeds/dados simulados
- `src/utils/calculations.ts` — todas as fórmulas de negócio (funções puras)
- `src/types.ts` — tipos do domínio (Transaction é union discriminada: ganho | abastecimento | manutencao | outra_despesa)
- `src/views/` — 5 telas (Home, Transactions, Shift, Reports, Profile) + `src/components/` (modais, header, nav)

## Regras de negócio (decisões vigentes)

- **Reserva de manutenção** = soma dos km das jornadas *concluídas* no período × `maintenanceReservePerKm`.
  Reserva sugerida ≠ reserva depositada. Não descontar duas vezes do lucro.
- **Veículo oficial**: Factor 150 — apelido "Moto do Dia a Dia", ano 2024, odômetro 42.118 km.
  `veh-fazer-250` está proibido; reconciliação idempotente ao carregar do localStorage.
- **Backend**: Supabase (Auth + PostgreSQL + RLS + sync) previsto na Fase 4 — ainda não instalado.
- **Mobile**: PWA + Capacitor (Android). Não migrar para RN/Expo. Não instalar Capacitor antes da Fase 3.

## Standards do repo

- TypeScript `strict`, `noUnusedLocals`, `noUnusedParameters`. Imports de ícones sem uso não passam no lint.
- Sem `as any` (use narrowing do union de `Transaction`).
- Conformidade com o padrão de tipos; formatação via Prettier.
- Não adicionar comentários desnecessários; código termina sem summary prolixo.