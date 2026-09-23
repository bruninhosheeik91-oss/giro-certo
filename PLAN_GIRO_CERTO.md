# PLANO DE TRANSFORMAÇÃO — "Rota Financeira" → "Giro Certo"

> Documento vivo. Origem: auditoria técnica read-only do export do Google AI Studio
> em `C:\Domnex Tech\01 - Projetos\Giro Certo` (app web mobile-first, React 19 + Vite 8 + TS + Tailwind 4).

Stack atual (confirmada na auditoria): React 19 SPA, Vite 8.3.0 (rolldown), TypeScript (não-strict),
Tailwind 4 via `@tailwindcss/vite`, `lucide-react`, `motion`. Sem router, sem lib de gráficos (SVG próprio),
sem testes, backend ou banco. Persistência: `localStorage` (6 chaves `rota_financeira_*_v2`).

---

## DECISÕES DEFINIDAS (decisões do cliente — regras vinculantes)

### 1. BACKEND — Supabase
- Backend será **Supabase**: Auth + PostgreSQL + Row Level Security (RLS) + sincronização/backup + possibilidade futura de assinatura comercial.
- Isso **não** justifica manter dependências não utilizadas hoje.
- **Fase 0**: remover `@google/genai`, `express` e `dotenv` se realmente sem uso (confirmado: não importadas em `src/`).
- Supabase será instalado depois, com o pacote oficial apropriado, na fase de backend (Fase 4).
- **Não manter Express nem Google GenAI por "uso futuro".**

### 2. MÉTRICA OFICIAL DA RESERVA DE MANUTENÇÃO
- **Fórmula oficial**: reserva sugerida = soma dos km das **jornadas concluídas no período** × valor de reserva por km (`reservePerKm`).
- **Não** usar a diferença total do odômetro do veículo (pode misturar deslocamentos pessoais).
- Regras:
  - Jornada **ativa ainda não entra** na reserva mensal definitiva.
  - Jornada **encerrada entra** no cálculo.
  - Jornada **excluída remove** sua quilometragem do cálculo.
  - **Alteração** de uma jornada **recalcula** a reserva.
  - Reserva sugerida ≠ reserva efetivamente depositada (cofrinho).
  - **Não descontar a reserva duas vezes do lucro.**
- Para os mocks atuais: alinhar os dados para gerar **exatamente R$ 200,16** de reserva sugerida **ou** documentar matematicamente quais dados simulados precisam de ajuste para chegar a esse valor **sem criar valor artificial**.

> Estado atual (auditoria): código gera R$ 186,00 (1.550 km × 0,12). 200,16 implicaria 1.668 km
> (1668 × 0,12 = 200,16). Documentação matemática a fazer na Fase 1.

### 3. VEÍCULO OFICIAL — Factor 150 ("Moto do Dia a Dia")
- Consolidar todos os dados simulados no veículo oficial:
  - Apelido: **Moto do Dia a Dia**; Marca: **Yamaha**; Modelo: **Factor 150**; Ano: **2024**; Odômetro atual: **42.118 km**.
- **Eliminar o identificador fantasma `veh-fazer-250`** (referenciado nas transações/jornadas mas inexistente no cadastro).
- **UID canônico único** para a Factor 150 em: jornadas, lançamentos, abastecimentos, manutenções, perfil, relatórios e localStorage.
- **Reconciliação defensiva** de dados antigos (idempotente):
  - Se encontrar `veh-fazer-250`, migrar a referência para o ID canônico da Factor 150.
  - **Não criar** uma Fazer 250 adicional. **Não duplicar** o veículo.
  - A migração deve ser **idempotente** (rodar várias vezes = mesmo resultado).

### 4. PLATAFORMA MOBILE
- Stack oficial: **React/Vite responsivo + PWA + Capacitor para Android**; **Android Studio** para build, testes e publicação.
- **Não migrar para React Native nem Expo.**
- Preservar arquitetura que permita **futuramente** um plugin Android nativo de leitura autorizada de notificações — **em standby, não implementar agora**.
- **Não instalar Capacitor durante as Fases 0, 1 ou 2.** Apenas manter a base compatível.

### 5. LANÇAMENTOS AVULSOS E JORNADAS — ✔ REGRA DEFINIDA
> **Acumulado da jornada é sempre DERIVADO do histórico**: `accumulatedGain`/`accumulatedExpense` da jornada são
> recalculados pela soma dos lançamentos **vinculados** (`shiftId`), nunca armazenados/adivinhados.
> Regras:
> - O acumulado é a soma das transações com `shiftId` === jornada ativa.
> - Lançamento **avulso** (sem `shiftId` ou sem jornada ativa) **não** entra no acumulado de jornada alguma.
> - Excluir um lançamento vinculado → o acumulado é recalculado (sempre coerente).
> - Alimentar/alterar lançamento vinculado → recalcula automaticamente.
> - Jornada encerrada exibe valores derivados do mesmo cálculo (fonte única = transações).
> - O campo persistido `accumulatedGain/Expense` deixa de ser a fonte de verdade (toleramos dados legados,
>   mas o valor mostrado vem sempre da soma das transações vinculadas).

---

## ROADMAP POR FASES

Cada fase termina com entrega verificável (lint + build passando; testes quando existirem).
Pontos onde há decisão em aberto marcados como **[DECIDIR]**.

---

### FASE 0 — Higiene técnica (preparar o terreno)
**Objetivo**: base limpa, instalável sem flags, tipada e com identidade "Giro Certo".
- [ ] Renomear identidade: `package.json` name `react-example` → `giro-certo`; título/descrição em `index.html`; `metadata.json`.
- [ ] Resolver de verdade o conflito do npm: alinhar `esbuild` para `^0.27.0 || ^0.28.0` (peer exigido por Vite 8) e instalar **sem** `--legacy-peer-deps`.
- [ ] Remover deps mortas: `@google/genai`, `express`, `dotenv` (+ `@types/express`). **[Decisão 1]**
- [ ] Remover imports mortos detectados: `formatHours` (Header/ShiftView/ReportsView), `calculateWorkHours`, etc.
- [ ] `tsconfig.json`: ativar `strict`, `noUnusedLocals`, `noUnusedParameters` e corrigir todos os erros de tipo resultantes.
- [ ] `vite.config.ts`: trocar `__dirname` por `import.meta.dirname` (encerra aviso `configLoader: native`).
- [ ] Adicionar **ESLint** (+ react hooks) e **Prettier**; script `lint` passa a rodar `tsc` + `eslint`.
- [ ] Corrigir script `clean` para Windows (`rm -rf` não funciona; usar `node -e` com `fs.rmSync`).
- [ ] `git init` + commit inicial limpo (`.gitignore` já existe).
- [ ] Criar/atualizar `AGENTS.md` com comandos do projeto.
- **Verificável**: `npm install` limpo sem flags; `npm run lint` e `npm run build` passando; repo git com commit inicial.

### FASE 1 — Correção de dados e bugs de domínio
**Objetivo**: dados simulados fiéis às decisões 2 e 3; corrigir contradições.
- [x] Veículo oficial: renovar `INITIAL_VEHICLES` (Moto do Dia a Dia / Yamaha / Factor 150 / 2024 / 42.118 km) com ID canônico.
- [x] Migrar `veh-fazer-250` → ID canônico em todas as transações/jornadas; reconciliação idempotente no `AppContext` ao carregar localStorage. **[Decisão 3]**
- [x] Reserva: implementar fórmula oficial (km de jornadas concluídas × `reservePerKm`); jornadas ativa/excluída/alterada sob as regras da **Decisão 2**; não descontar reserva duas vezes do lucro.
- [x] Mocks de reserva: alinhar para **exatamente R$ 200,16** sem valor artificial (2026-09: 1.668 km × 0,12, corrente de odômetro 40.450 → 42.118).
- [x] Corrigir `createdAt` dos mocks (epoch 2024 → datas 2026-09).
- [x] Jornada: `endKm`/`startKm` com decimais (`parseFloat`), não `parseInt`.
- [x] Manutenção preventiva: `calculateVehiclePartsHealth` passará a consumir as transações de manutenção (não km fixo 24.000).
- [x] Unificar stats de aplicativo (ReportsView/charts) na função única `calculatePeriodSummary`.
- [x] Alinhar lançamentos avulsos/jornadas conforme **Decisão 5** (acumulado derivado via `getShiftTotals`).
- **Verificável**: tela Início mostra reserva sugerida R$ 200,16 no mês mockado; nenhuma referência a `veh-fazer-250` no código; odômetro coerente (42.118 km). ✔ lint + build passando.

### FASE 2 — Funcionalidades essenciais apontadas pela auditoria
**Objetivo**: fechar lacunas de produto que bloqueiam o uso real diário.
- [x] **Consumo real km/l**: módulo tanque-cheio→tanque-cheio em Relatórios (aba "Consumo km/L") usando `calculateFuelConsumption`; ciclos confirmados + ciclo aberto + custo/km.
- [x] **Edição de lançamento**: `TransactionDetailModal` ativado pela lista (clique no cartão) e montado em `App.tsx`; edição de valor/descrição e odômetro (com piso do `odometerBaselineKm`).
- [x] **Cofrinho de reserva**: modal com depósito, resgate (valida saldo) e histórico do `maintenanceReserveLedger`; saldo derivado (`calculateReserveBalance`), separado da reserva sugerida (lucro disponível).
- [x] **Seleção de mês dinâmica** no Header (`availableMonths` + setas `goToPreviousMonth`/`goToNextMonth`).
- [x] **Deleção segura**: rollback do odômetro ao excluir/editar lançamento via efeito de reconciliação idempotente (`reconcileVehicleOdometer`) — nunca regride abaixo do piso.
- [x] Validações harmonizadas de entrada monetária: `parseBRLInput`/`formatBRLInput` (campos BRL) e `parseDecimalInput` (km, litros, taxas) nos modais/simuladores/perfil.
- [x] **Testes Vitest + RTL**: configurados (Vitest 5 + jsdom + Testing Library); 18 testes cobrindo `calculations.ts` (BRL, consumo, shift totals, reserva, odômetro, simulador de corrida).
- **Verificável**: fluxos de abastecimento→consumo, edição de lançamento e cofrinho completos. ✔ `npm test`, `npm run lint` e `npm run build` passando.

### FASE 3 — PWA + Capacitor (Android)
> ✔ Decisão 4: React/Vite responsivo + PWA + Capacitor; Android Studio para build/publicação.
> **Identidade visual**: na fase Capacitor, gerar o launcher icon, adaptive icon, foreground, background,
> round icon e o ícone da Play Store (512×512) a partir do arquivo de maior qualidade em
> `public/branding/giro-certo-icon-original.png` (1254×1254 — original do cliente, mantido intacto).
> Derivados já gerados: `public/favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png` (180),
> `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-192.png`, `icon-maskable-512.png`.
- [ ] Manifest web app + ícones + **service worker** (offline-first para dados locais até a Fase 4).
- [ ] Instalar Capacitor (@capacitor/core, cli, android) — **somente nesta fase**. **[Decisão 4]**
- [ ] Configuração Android (`npx cap add android`), minSDK/tema, splash, ícones.
- [ ] Gerar APK debug e validar em Android Studio/emulador.
- [ ] Deixar ponto de extensão previsto para plugin nativo de leitura de notificações (**standby**, sem implementar).
- **Verificável**: Lighthouse PWA ≥ 90; `npm run build && npx cap sync android` OK; APK abre no emulador.

### FASE 4 — Backend Supabase (auth, sync, backup)
> ✔ Decisão 1: Supabase Auth + PostgreSQL + RLS + sincronização/backup + base para assinatura comercial futura.
- [ ] Instalar pacote oficial de Supabase no front (a partir daqui), conforme Decisão 1 (**não** manter express/genai/dotenv).
- [ ] Projeto Supabase: schema PostgreSQL (usuário, veículos, apps, transações, jornadas, perfil, reserva).
- [ ] **Supabase Auth** (email/senha; avaliar OAuth Google como opção).
- [ ] **RLS**: políticas por usuário (row ownership); jornada das regras de reserva no SQL de seed/report.
- [ ] **Sync/backup**: modelo offline-first — localStorage continua primário; sincroniza bidirecionalmente; migração de schema local versionada (hoje só sufixo `_v2`, sem validação de shape).
- [ ] (Opcional/avaliar) assinatura comercial: pagamentos/webhooks — apenas arquitetura preparada.
- **Verificável**: fluxo de login; dados sincronizam entre dois dispositivos; RLS bloqueia leitura cruzada.

### FASE 5 — Testes, qualidade e release
- [x] **Vitest + React Testing Library**: configurado (Vitest 5 + jsdom + `@testing-library/react`); iniciado por `calculations.ts` (funções puras — maior risco de regressão).
- [ ] Ampliar cobertura: formulários/modais (RTL) e fluxos de jornaada/relatório/reserva.
- [ ] E2E (Playwright) para fluxos principais: lançamento, jornada, relatório, reserva.
- [ ] Code-splitting com `React.lazy` para derrubar chunk de 533 kB (meta < 200 kB gzip por rota).
- [ ] Acessibilidade e dados de teste (Android Studio/Firebase Test Lab se aplicável).
- **Verificável**: `npm test` verde; build com chunks pequenos; release vesti eldo para Play Store (AAB).

---

## MATRIZ DE DECISÕES (resumo executivo)

| # | Tema | Decisão | Fase que depende |
|---|---|---|---|
| 1 | Backend | Supabase (Auth + PG + RLS + sync). Remover `@google/genai`, `express`, `dotenv` | 0 (remoção) / 4 (install) |
| 2 | Reserva | km de jornadas concluídas × taxa; regras de ativa/excluída/alterada; meta R$ 200,16 (ou doc matemática) | 1 |
| 3 | Veículo | Factor 150 "Moto do Dia a Dia" (2024, 42.118 km); matar `veh-fazer-250`; migração idempotente | 1 |
| 4 | Mobile | PWA + Capacitor (Android); Android Studio; sem RN/Expo; plugin notificações em standby | 3 |
| 5 | Avulsos/jornadas | Acumulado sempre **derivado** das transações vinculadas; avulso não soma; excluir/alimentar recalcula | 1 |

---

## NÃO-ESCOPO (fora deste plano por decisão explícita)
- Migração para React Native ou Expo. **[Decisão 4]**
- Manutenção de Express/Google GenAI sem uso atual. **[Decisão 1]**
- Implementação do plugin nativo de leitura de notificações agora (apenas ponto de extensão). **[Decisão 4]**
- Instalação do Capacitor antes da Fase 3. **[Decisão 4]**