# PLANO DE TRANSFORMAÇÃO — "Rota Financeira" → "Giro Certo"

> Documento vivo. Origem: auditoria técnica read-only do export do Google AI Studio
> em `C:\Domnex Tech\01 - Projetos\Giro Certo` (app web mobile-first, React 19 + Vite 8 + TS + Tailwind 4).

Stack atual: React 19 SPA, Vite 8.3.0, TypeScript strict, Tailwind 4, Supabase Auth/PostgreSQL/RLS,
persistência local-first com fila offline, PWA e Capacitor 8 para Android.

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
>
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

### FASE 2.5 — Contas e Parcelas

**Objetivo**: controlar compromissos financeiros sem transformar valores pendentes em despesas realizadas e sem poluir a navegação principal.

- [x] Tipos suportados: conta única, conta recorrente, compra parcelada, financiamento de veículo, empréstimo e consórcio.
- [x] Schema local versionado (`giro_certo_financial_state_v3`) com migração e reconciliação idempotentes.
- [x] Geração de vencimentos mensais com datas civis e ajuste correto dos dias 29, 30 e 31.
- [x] Histórico inicial de parcelas já pagas sem criar despesas retroativas.
- [x] Pagamento idempotente: marcar uma parcela como paga cria exatamente uma despesa vinculada; editar sincroniza valor/data; excluir ou reabrir remove o vínculo e reabre a parcela.
- [x] Alterações de contrato preservam parcelas pagas e afetam apenas parcelas futuras.
- [x] Resumo por mês: pendente, pago, atrasos, próxima conta e estimativa diária de cobertura sem alterar a meta original.
- [x] Detalhe de contratos: X/Y parcelas, percentual, total previsto, total pago, saldo aberto, próximo vencimento, previsão de término e histórico.
- [x] UX compacta: um card na Home, uma entrada no Perfil, modal dedicado e nenhuma nova aba inferior.
- [x] Cobertura automatizada de domínio e fluxo RTL completo de cadastro → pagamento → uma única despesa.
- **Verificável**: 34 testes passando; `npm run lint` e `npm run build` verdes. Issue #1.

### FASE 3 — PWA + Capacitor (Android)

> ✔ Decisão 4: React/Vite responsivo + PWA + Capacitor; Android Studio para build/publicação.
> **Identidade visual**: na fase Capacitor, gerar o launcher icon, adaptive icon, foreground, background,
> round icon e o ícone da Play Store (512×512) a partir do arquivo de maior qualidade em
> `public/branding/giro-certo-icon-original.png` (1254×1254 — original do cliente, mantido intacto).
> Derivados já gerados: `public/favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png` (180),
> `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-192.png`, `icon-maskable-512.png`.

- [x] Manifest web app + ícones + **service worker** com atualização automática.
- [x] Instalar Capacitor (@capacitor/core, cli, android). **[Decisão 4]**
- [x] Configuração Android, minSdk 24, targetSdk 36, tema, splash e ícones.
- [x] Gerar e inspecionar APK debug; roteiro de dispositivo em `docs/TESTE_APK.md`.
- [ ] Deixar ponto de extensão previsto para plugin nativo de leitura de notificações (**standby**, sem implementar).
- **Verificável**: Lighthouse PWA ≥ 90; `npm run build && npx cap sync android` OK; APK abre no emulador.

### FASE 4 — Backend Supabase (auth, sync, backup)

> ✔ Decisão 1: Supabase Auth + PostgreSQL + RLS + sincronização/backup + base para assinatura comercial futura.

- [x] Pacote oficial do Supabase no front; sem express/genai/dotenv.
- [x] Schema PostgreSQL para todas as entidades do domínio.
- [x] **Supabase Auth** por email/senha e recuperação via deep link.
- [x] **RLS** com quatro políticas por tabela e isolamento por usuário.
- [x] **Sync/backup** local-first, bidirecional, com fila offline e migração de escopo.
- [ ] (Opcional/avaliar) assinatura comercial: pagamentos/webhooks — apenas arquitetura preparada.
- **Verificável**: fluxo de login; dados sincronizam entre dois dispositivos; RLS bloqueia leitura cruzada.

#### FASE 4B — Integração Supabase ponta a ponta (auth, fila, migração, integridade)

> Fase executada sobre o schema e o cliente já instalados na Fase 4. Objetivo: nenhuma entidade
> pode permanecer apenas no localStorage, e nenhum dado local pode ser perdido na virada para conta.

**SQL e integridade** (`supabase/migrations/20260928000100_phase4b_hardening.sql`)

- [x] Triggers de `updated_at` recriados de forma idempotente em todas as 12 tabelas.
- [x] Normalização prévia dos dados antes das restrições: órfãos de abastecimento/manutenção,
      jornadas abertas duplicadas, veículos ativos duplicados, `entry_type` fora do domínio,
      pausa com `end_at < start_at`, meses não normalizados.
- [x] CHECKs: `entry_type`, `reference_month`, `selected_month`, pausa, `km_start`, `km_end`.
- [x] FKs: `transactions.commitment_id` (SET NULL) e detalhes de abastecimento/manutenção
      (CASCADE a partir da transação-mãe).
- [x] `transactions.installment_id` **sem** FK de propósito: fecha ciclo com
      `installments.transaction_id` e inviabilizaria o upsert em requisições separadas.
      A integridade vem de `reconcileFinancialState` e da preservação das parcelas pagas.
- [x] Índices de leitura e unicidade: uma jornada aberta, um veículo ativo, uma pausa aberta
      por usuário/jornada.
- [x] RLS `ENABLE` + 4 políticas por tabela recriadas idempotentemente; `profiles` usa `id`
      como coluna de dono, as demais `user_id`.
- [x] Aplicar no projeto Supabase; migrations local/remoto alinhadas e `db lint --linked` sem erros.
- [ ] Executar o roteiro de duas contas reais em `docs/TESTE_DUAS_CONTAS.md`.

**Fila offline e sync** (`src/lib/offlineQueue.ts`, `src/lib/syncEngine.ts`)

- [x] Tentativas limitadas (`MAX_SYNC_ATTEMPTS = 5`) com backoff exponencial e teto de 5 min.
- [x] `removeMany`, `retry`, `retryBlocked` e `stats` — o que falhou nunca é descartado antes
      da confirmação da nuvem.
- [x] Reenfileirar a mesma entidade zera tentativas, erro e backoff (op bloqueada revive).
- [x] Coalescência por entidade: `upsert` + `delete` colapsa na intenção final do usuário.
- [x] Pais antes dos filhos dentro do lote (`TABLE_ORDER`), porque cada tabela é gravada em uma
      requisição separada e o Postgres valida a FK no `INSERT`.
- [x] `23503` classificado como transitório: o filho espera o pai em vez de bloquear e perder dado.
- [x] Gravação da fila em lote (`enqueueMany`), evitando uma serialização por linha.

**Migração local → conta** (`src/repositories/persistence.ts`)

- [x] `importLocalScopeOnce` lê o escopo `local`, normaliza com `normalizeAppSnapshot` e enfileira
      via os mesmos mappers do app (nenhum payload cloud paralelo).
- [x] Idempotência: IDs derivados deterministicamente de (usuário, entidade) e marcador
      `user_settings.local_import_completed_at` lido da nuvem — outro dispositivo não reimporta.
- [x] A marca é enfileirada junto com os dados (e sozinha quando não há dado local), então o
      servidor registra que a migração acabou; um carimbo só no cache local repetiria a
      checagem em toda sessão.
- [x] Só importa dado do usuário, não a semente: `hasPersistedLocalData` compara com
      `mockData`, evitando subir a demonstração de uma instalação nova. Três sinais:
      `markScopeTouched` (gravado na primeira mutação), linha fora da semente **ou linha da
      semente a menos** (usuário apagou um lançamento), e financeiro/perfil divergentes.
- [x] Preservação de parcelas pagas, status e vínculo com a transação que quitou.
- [x] Execução no primeiro sync de `AppContext`, com nova leitura da nuvem após o import.

**Cobertura de CRUD**

- [x] Exclusão de jornada (`removeShift`): cascata de pausas, desvincula os lançamentos em vez de
      apagá-los e recalcula a reserva sugerida, cuja fórmula soma os km das jornadas concluídas.
- [x] Exclusão de movimentação do cofrinho (`removeMaintenanceReserveEntry`): o saldo é derivado
      do livro-razão, então remover a linha é o caminho para desfazer depósito ou resgate errado.

**Conta e isolamento**

- [x] Modo local persistido como escolha explícita; "Ativar conta na nuvem" reentra no login.
- [x] Logout sincroniza antes de sair e troca o escopo de chaves por usuário.
- [x] `ready` no contexto trava o render até a hidratação do escopo — sem frame com os dados do
      usuário anterior.
- [x] Refresh de token (`TOKEN_REFRESHED`) dispara sync, para a fila não parar em token expirado.

**Interface**

- [x] `SyncStatusRow` discreto no Perfil: Offline, Sincronizando, Erro com contagem, "Sincronizado"
      visível por 4 s e fila pendente — sem spinner permanente nem contagem contínua.
- [x] `AccountRow` com e-mail da conta, sair e ativação de nuvem a partir do modo local.

**Verificável**

- [x] `npm run lint` (tsc + ESLint) verde.
- [x] `npm test` verde — 96 testes, incluindo migração idempotente, marcador de conclusão, edição
      da semente, parcelas pagas, isolamento entre usuários, backoff, bloqueio, coalescência e
      ordem de FK.
- [x] `npm run build` verde (PWA gerado).
- [ ] E2E em dois dispositivos com a mesma conta: perda zero de dados e RLS bloqueando a leitura
      cruzada (exige o projeto Supabase com as migrations aplicadas).

### FASE 5 — Testes, qualidade e release

- [x] **Vitest + React Testing Library**: configurado (Vitest 5 + jsdom + `@testing-library/react`); iniciado por `calculations.ts` (funções puras — maior risco de regressão).
- [x] Primeiro fluxo RTL de formulário/modal: Contas e Parcelas (cadastro → pagamento → uma única despesa).
- [ ] Ampliar cobertura: fluxos de jornada, relatório e reserva.
- [ ] E2E (Playwright) para fluxos principais: lançamento, jornada, relatório, reserva.
- [ ] Code-splitting com `React.lazy` para derrubar chunk de 533 kB (meta < 200 kB gzip por rota).
- [ ] Acessibilidade e dados de teste (Android Studio/Firebase Test Lab se aplicável).
- **Verificável**: `npm test` verde; build com chunks pequenos; release vesti eldo para Play Store (AAB).

---

## MATRIZ DE DECISÕES (resumo executivo)

| #   | Tema             | Decisão                                                                                                 | Fase que depende          |
| --- | ---------------- | ------------------------------------------------------------------------------------------------------- | ------------------------- |
| 1   | Backend          | Supabase (Auth + PG + RLS + sync). Remover `@google/genai`, `express`, `dotenv`                         | 0 (remoção) / 4 (install) |
| 2   | Reserva          | km de jornadas concluídas × taxa; regras de ativa/excluída/alterada; meta R$ 200,16 (ou doc matemática) | 1                         |
| 3   | Veículo          | Factor 150 "Moto do Dia a Dia" (2024, 42.118 km); matar `veh-fazer-250`; migração idempotente           | 1                         |
| 4   | Mobile           | PWA + Capacitor (Android); Android Studio; sem RN/Expo; plugin notificações em standby                  | 3                         |
| 5   | Avulsos/jornadas | Acumulado sempre **derivado** das transações vinculadas; avulso não soma; excluir/alimentar recalcula   | 1                         |

---

## NÃO-ESCOPO (fora deste plano por decisão explícita)

- Migração para React Native ou Expo. **[Decisão 4]**
- Manutenção de Express/Google GenAI sem uso atual. **[Decisão 1]**
- Implementação do plugin nativo de leitura de notificações agora (apenas ponto de extensão). **[Decisão 4]**
- Instalação do Capacitor antes da Fase 3. **[Decisão 4]**
