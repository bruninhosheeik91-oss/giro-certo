# Teste de isolamento e sincronização com duas contas

## Pré-requisitos

- As três migrations estão aplicadas no projeto Supabase.
- Duas contas diferentes estão cadastradas e com e-mail confirmado.
- Nunca use `service_role` neste teste; use somente a chave pública do projeto.

## Verificação automática de RLS

No PowerShell, dentro do projeto:

```powershell
$env:VITE_SUPABASE_URL="https://SEU_PROJECT_REF.supabase.co"
$env:VITE_SUPABASE_ANON_KEY="SUA_CHAVE_PUBLICA"
$env:RLS_USER_A_EMAIL="conta-a@exemplo.com"
$env:RLS_USER_A_PASSWORD="SENHA_TEMPORARIA_A"
$env:RLS_USER_B_EMAIL="conta-b@exemplo.com"
$env:RLS_USER_B_PASSWORD="SENHA_TEMPORARIA_B"
npm run verify:rls
```

Resultado esperado: `RLS OK`. O script cria dois veículos temporários, confirma que cada conta
enxerga somente o próprio registro, bloqueia alteração/inserção cruzada e remove os dados de teste.

Depois, limpe as senhas da sessão:

```powershell
Remove-Item Env:RLS_USER_A_PASSWORD, Env:RLS_USER_B_PASSWORD
```

## Sincronização entre dois dispositivos

1. Entre com a mesma conta no dispositivo A e no B.
2. No A, crie um ganho com uma descrição fácil de reconhecer e aguarde “Sincronizado”.
3. No B, reabra o app ou renove a sessão e confirme que o ganho apareceu uma única vez.
4. Deixe o B sem internet, edite o ganho e crie uma despesa. Confirme a indicação de itens pendentes.
5. Reconecte o B, toque em “Tentar novamente” se necessário e aguarde “Sincronizado”.
6. No A, renove a sessão e confira a edição e a despesa, sem duplicidade.
7. Saia da conta nos dois aparelhos e confirme que dados de uma conta não aparecem na outra.

Registre aparelho, versão do APK, data, resultado e qualquer mensagem de erro.
