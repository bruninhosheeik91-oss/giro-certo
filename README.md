# Giro Certo

Aplicativo web (mobile-first) para **motoristas e entregadores de aplicativo**
controlarem ganhos, despesas, jornadas de trabalho e **lucro real**. Substitui
a tradicional "planilha do motorista" por algo rápido, privado e que roda no
bolso — inclusive offline (PWA) e como app Android nativo (Capacitor).

## Tecnologias

- **React 19 + TypeScript (strict) + Vite** — SPA mobile-first, navegação por abas
- **Tailwind CSS 4** — estilos via utilitários (`@tailwindcss/vite`)
- **lucide-react** (ícones) e **motion** (animações)
- **vite-plugin-pwa** — manifest + Service Worker (instalável, offline)
- **Capacitor 8** — empacotamento Android nativo (WebView)
- **localStorage** — toda a persistência fica **no dispositivo** (local-first, por padrão)

## Rodar localmente

```bash
npm install
npm run dev     # http://localhost:3000
```

Para testar o build de produção (PWA incluído):

```bash
npm run build
npm run preview  # http://localhost:3000 (ou a porta exibida)
```

> O projeto usa HMR desabilitado por padrão (`DISABLE_HMR`) apenas para
> ambientes de agentes/CI; em desenvolvimento normal o HMR funciona normalmente.

## Testes, lint e build

```bash
npm run lint    # tsc --noEmit + ESLint (obrigatório antes de qualquer PR)
npm test        # Vitest (testes de utilidades/fórmulas de negócio)
npm run build   # build de produção em dist/
```

## Android (Capacitor)

Requisitos: Node 22+, JDK 17 e **Android Studio** com SDK (recomendado
`compileSdk`/`targetSdk` 36 e `minSdk` 24).

```bash
npm run android:sync   # build + cap sync android (copia dist/ para o app nativo)
npm run android:open   # abre o projeto no Android Studio
npm run android:run    # compila e instala no dispositivo/emulador conectado
```

Para regenerar os ícones/launcher do Android a partir de `assets/`:

```bash
npm run android:assets
```

O bundle Android fica em `android/`. Para publicar, abra o projeto no Android
Studio e use **Build → Generate Signed Bundle / APK**.

## PWA / instalação

O `vite-plugin-pwa` gera o manifest e o Service Worker durante o `build`
(`registerType: 'autoUpdate'`), com precache apenas dos assets essenciais —
recursos de branding pesados e fontes são carregados sob demanda. No Android
o app roda dentro do Capacitor WebView como app nativo; no iOS/Safari pode ser
adicionado à tela inicial por "Adicionar à Tela Inicial".

## Privacidade e dados

Por padrão todos os dados (compromissos financeiros, parcelas, jornadas,
transações) ficam **somente no armazenamento local do dispositivo**
(`localStorage`) e o app funciona 100% offline.

A sincronização em nuvem é **opcional e desligada por padrão**: só é ativada
quando as variáveis `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` existem no
`.env`. Sem as variáveis, o `AuthGate` deixa o app seguir local sem
autenticação.

### Como a nuvem entra em cena

- **Escolha explícita.** O modo local continua disponível ("Continuar no modo
  local"). Depois de entrar, o Perfil mostra o status em uma linha discreta
  (Offline, Sincronizando, Erro, Sincronizado) e o botão "Ativar conta na
  nuvem" traz o login de volta.
- **Migração única.** Ao entrar na conta pela primeira vez, o escopo local é
  enfileirado uma única vez e marcado em `user_settings.local_import_completed_at`
  — a marca viaja na própria fila, então o servidor registra a conclusão. Só sobe
  dado criado ou alterado pelo usuário (uma instalação que só abriu o app não
  importa a demonstração) e outro dispositivo da mesma conta não reimporta.
- **Fila offline.** Toda alteração passa por uma fila persistente, com tentativas
  limitadas, backoff exponencial e coalescência por entidade. Nada é descartado
  antes da confirmação da nuvem; o que não pôde ser enviado aparece como pendente
  no Perfil, com "Tentar novamente".
- **Ordem e chaves.** As chaves são isoladas por usuário
  (`giro_certo_user_<uid>_v4_*`), e o logout sincroniza antes de trocar de escopo.
  O Postgres aplica RLS por `uid()`, então um usuário não lê nem escreve dados de
  outro.

Aplicar o backend exige rodar as migrations em `supabase/migrations/` no projeto
Supabase — a da Fase 4B adiciona integridade referencial, unicidade e as políticas
RLS completas.
