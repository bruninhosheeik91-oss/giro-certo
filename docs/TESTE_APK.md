# Roteiro de teste do APK — Giro Certo

## Instalação

1. Gere e sincronize o projeto: `npm run android:sync`.
2. Abra com `npm run android:open` e instale o APK debug em um Android 7 ou superior.
3. Confirme nome “Giro Certo”, ícone, splash e ausência de corte por notch/barra de navegação.

## Fluxos obrigatórios

- Abrir sem internet e escolher modo local.
- Criar, editar e excluir ganho e despesa.
- Iniciar/pausar/finalizar jornada e validar quilômetros e totais.
- Cadastrar conta de 36 parcelas e confirmar que não limita em 12.
- Registrar abastecimento e conferir consumo em km/L.
- Depositar e resgatar no cofrinho de manutenção.
- Entrar com e-mail/senha e aguardar o status “Sincronizado”.
- Fechar e reabrir o app; sessão e dados devem permanecer.
- Solicitar recuperação de senha, abrir o link no aparelho e concluir a troca.
- Ativar modo avião, criar dados, reconectar e confirmar envio sem duplicidade.
- Testar rotação, teclado aberto e botão voltar em formulários/modais.

## Critérios de aceite

- Nenhum crash, tela branca ou perda de dados.
- Teclado não cobre o campo ativo nem o botão principal.
- Dados da conta não aparecem depois do logout em outra conta.
- Fila offline chega a zero após a reconexão.
- Deep link `tech.domnex.girocerto://login-callback` abre o aplicativo.

Anote modelo do aparelho, versão do Android, versão/commit do APK e evidências dos erros.
