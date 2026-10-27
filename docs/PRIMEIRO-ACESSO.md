# Primeiro acesso por e-mail

Backend implantado e SMTP validado em 27/10/2026. A opção pública é controlada por `COP_FIRST_ACCESS_ENABLED` no build e no backend.

## Experiência

O analista informa a matrícula no botão Primeiro acesso. A caixa corporativa previamente vinculada recebe um link para definir a senha pessoal. Não é necessário distribuir senhas temporárias. Matrículas são normalizadas para maiúsculas; a senha nunca é normalizada.

O remetente autorizado é `nlsoarez@gmail.com`, autenticado diretamente em `smtp.gmail.com:465` com TLS e senha de app Google. A conta exclusiva recém-criada não foi utilizada devido ao bloqueio de verificação do Google. Resend não participa desse fluxo. Os destinatários de primeiro acesso são exclusivamente os e-mails `claro.com.br` validados na lista privada; o navegador não escolhe nem recebe o endereço de destino.

## Limites e proteção

- O fluxo atende somente contas viewer ativas com `must_change_password=true`. Não redefine contas que já possuem senha pessoal nem contas administrativas.
- `cop_account_emails` é uma tabela privada de associação matrícula/nome/e-mail. Aliases internos de Auth são preservados.
- `cop_first_access` mantém somente SHA-256 do token, validade, consumo e estado de entrega. Nenhum token bruto é persistido, retornado pela API pública ou registrado em log.
- Links expiram em 30 minutos e são de uso único. Novo link substitui o anterior; intervalo mínimo de dois minutos entre emissões.
- Solicitações têm resposta genérica para matrículas existentes e inexistentes. SMTP executa em tarefa de segundo plano com `EdgeRuntime.waitUntil`; falha de entrega não revela cadastro. Falhas do worker podem exigir nova solicitação após o intervalo.
- Limites persistidos: três solicitações por matrícula/hora, 60 solicitações globais/hora, 100 tentativas de ativação globais/hora. Aumentos exigem avaliar quotas e abuso.
- A ativação consome o token sob o mesmo lock de conta utilizado pelos resets, revoga sessões, atualiza a senha, audita e só então libera o perfil. Falhas exigem novo link e mantêm o bloqueio operacional.
- O token via fragmento `#activate=` é removido imediatamente do endereço pelo frontend. Nenhum cache de contatos ou e-mails é criado.
- Cada conta mantém no máximo um registro de token; excluir usuário remove o registro por cascade. A associação corporativa deve ser removida quando o cadastro for retirado da lista autorizada.

## Credencial

Executar pessoalmente `scripts/configure-gmail-local.ps1`. Para substituir uma credencial rejeitada, usar `-Substituir`. A entrada é oculta, validada apenas quanto à forma e protegida por Windows DPAPI para o usuário atual. Validade junto ao Google é verificada separadamente. O arquivo `.local/gmail-credential.dpapi.json` não é publicado nem versionado.

O backend utiliza `COP_GMAIL_APP_PASSWORD` e `COP_FIRST_ACCESS_ENABLED=true` exclusivamente no serviço functions. Nunca passar a senha ao build, Vercel, frontend, argumento de processo, logs ou linha de comando. Transferir somente em canal SSH autenticado, via stdin e memória, para configuração privada com permissão 600. Backups de configuração devem permanecer criptografados.

## Portão de publicação

1. Validar a autenticação SMTP sem envio. Um retorno 535/EAUTH é bloqueante; criar nova senha de app na conta correta. Não repetir automaticamente autenticações recusadas.
2. Fazer backup criptografado; aplicar a migração `20261026020000_first_access.sql`.
3. Conferir a lista privada contra matrícula e nome dos perfis/roster. Rejeitar conflitos, e-mails compartilhados e divergências. Provisionar apenas contas ausentes autorizadas com senha aleatória descartada; preservar papéis, senhas e suspensão das existentes.
4. Resetar exclusivamente `N4014011` conforme solicitação: conferir identidade e role viewer, marcar troca pendente, revogar sessões e substituir a senha antiga por aleatória descartada sob lock, com auditoria. Não fornecer ou registrar a senha aleatória.
5. Aplicar somente as mudanças do Central COP em functions, dispatcher e gateway. Validar a compatibilidade npm/nodemailer com o Edge Runtime real antes de habilitar envios. Não reiniciar outros serviços.
6. Autorizar um envio de teste com destinatário e conteúdo definidos; validar entrega na caixa corporativa. Não disparar lote aos 58 usuários automaticamente.
7. Habilitar `COP_FIRST_ACCESS_ENABLED=true` no backend e no build público somente após validação ponta a ponta. Preservar URL/API key pública existentes. Remover chave SSH temporária ao concluir.

## Validação local

Suíte completa: 117 testes em 27/10/2026, incluindo RLS/SQL real isolado, consumo único, validade, conta inativa/já ativada, falha SMTP, CORS, destinatário fixado, conferência de identidade, reset exclusivo e ordenação de revogação/liberação. Sintaxe e build estático validados. Navegador local com dados fictícios validou solicitação, confirmação genérica e abertura do formulário por fragmento.

A autenticação SMTP foi validada localmente e dentro do Edge Runtime real usando a conta antiga autorizada. Um único e-mail de teste, sem senha ou link, foi enviado para a própria conta com autorização específica; o Gmail aceitou o destinatário. Aceite SMTP não comprova chegada à caixa de entrada corporativa.

Backup criptografado anterior: `20261027T032250Z`. Estado privado da implantação: `.state/first-access-20261027-a4cfad55` na VPS. Os 58 vínculos conferiram com nomes e matrículas do roster e dos perfis. Nenhuma conta nova foi necessária. Somente `N4014011` teve senha descartada, troca pendente e sessões revogadas (zero sessões restantes). Digests confirmaram preservação dos demais perfis, hashes de senha e 1.841 contatos.

Validação pública no backend: matrícula fictícia retorna confirmação genérica; leitura anônima das tabelas privadas retorna 401; checagem SMTP com chave pública retorna 403. Nenhum token de ativação real foi emitido durante essas verificações e não houve envio de lote aos analistas.
