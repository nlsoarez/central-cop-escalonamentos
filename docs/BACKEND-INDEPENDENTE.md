# Backend independente — Central COP

## Estado em 24/10/2026

Backend próprio instalado na VPS Hostinger `1897294`, em `/opt/central-cop-escalonamentos`.

- API: `https://api-central-cop.179-198-124-8.sslip.io`.
- PostgreSQL, Auth, PostgREST, Edge Runtime e gateway exclusivos; imagens fixadas por digest.
- Banco sem porta pública. Gateway em loopback `127.0.0.1:18183` e na rede de ingresso autorizada.
- Rede `central-cop-ingress`: somente gateway e Caddy. Banco, Auth e PostgREST permanecem na rede privada da aplicação.
- Não há confiança em `X-Forwarded-For`: o limite por conta é compartilhado entre IPs e o limite de 300 tentativas/15 minutos por conexão de origem também é aplicado. O gateway é uma instância única; os contadores em memória reiniciam se ele reiniciar.
- Dez tentativas de login por conta a cada 15 minutos; respostas de credenciais incorretas genéricas. Cadastro e recuperação públicos desabilitados.
- Access tokens de 15 minutos, sessões com duração absoluta de 12 horas e revogação conferida pelo banco.
- Lista privada dos 58 analistas recuperada, validada e gravada em `cop_pending_roster`, acessível somente a administradores com sessão válida. **São registros de preparação; não são 58 contas ativas.**
- Conta administrativa adicional indicada pelo proprietário preparada; ativação exige link de uso único e senha pessoal escolhida diretamente no portal. O login do administrador e o token de ativação não são registrados neste documento público.

## Evidências

`npm test`: **51 testes aprovados**. `npm run check` e `npm run build` aprovados. Testes de navegador com fixtures cobrem ativação inicial, remoção do token da URL, carga de lista privada, geração temporária das credenciais e limpeza ao sair. Foi corrigida uma referência ausente à geração da sessão que impediria exibir o resultado do cadastro administrativo.

O script `scripts/live-backend-check.mjs` passou contra os serviços reais, com identidades fictícias: leitura anônima negada, cadastro individual, primeiro acesso, troca de senha, invalidação do JWT anterior, impedimento de elevação de privilégios, importação/restauração regional, reset, bloqueio/reativação, auditoria, limite real de login e ativação administrativa de uso único. As duas contas fictícias foram removidas; apenas o histórico de auditoria foi preservado.

O script de homologação exige diretório de contatos vazio e só elimina as próprias fixtures. Não deve ser executado como rotina após inserir contatos operacionais.

## Publicação HTTPS sem reiniciar outros serviços

A versão do Caddy existente é 2.11.4, iniciada com `caddy run` e arquivo de configuração. Com autorização específica do proprietário:

1. Foi validada uma cópia da configuração com apenas o bloco de `deploy/Caddyfile.fragment` acrescentado.
2. Foi criada a rede exclusiva de ingresso e conectados apenas gateway e Caddy.
3. Foi preservado o conteúdo anterior do Caddyfile; a escrita só ocorreu após comparação com a cópia original.
4. Foi aplicada recarga `SIGUSR1`. O PID e o horário de início do container permaneceram idênticos.
5. O certificado HTTPS e `/health` foram verificados com sucesso.

Não foram reiniciados Docker, proxy, bancos ou containers de outros projetos. O container de outro projeto anteriormente marcado unhealthy permaneceu como estava. Não houve alterações no SIM ou nos projetos Supabase gerenciados existentes.

As primeiras propostas de ingresso e de transferência da lista foram bloqueadas pela revisão automática. A execução só prosseguiu após autorização explícita do proprietário para a rede exclusiva, para a recarga por sinal e para os 58 nomes/matrículas no banco privado. Não se ativou confiança em cabeçalhos encaminhados.

## Arquivos e operação

- `deploy/compose.yaml`: cinco serviços próprios e limites de recursos/logs.
- `deploy/gateway.mjs`: rotas permitidas, CORS e limites de login.
- `deploy/edge-main/index.ts`: dispatcher restrito às três funções, validação HS256 e workers limitados a 60 segundos.
- `deploy/db-roles.sql`: senhas dos papéis internos e ownership das funções mantidas pelo Auth. Esses ajustes valem somente para o banco novo.
- `deploy/db-contract.sql`: contrato de claims usado pelo PostgREST moderno.
- `supabase/migrations/`: quatro migrações da aplicação, aplicadas no banco novo.
- `scripts/bootstrap-admin.mjs`: criação inicial controlada e emissão de link de ativação de uso único. Nunca imprime uma senha. Não altera administradores já ativados.

Use sempre o diretório e arquivo explícitos:

```sh
cd /opt/central-cop-escalonamentos
docker compose --env-file .env -f deploy/compose.yaml --project-directory . ps
```

Não execute comandos Compose nos diretórios de outros projetos. Não use `down -v`. Não reaplique as migrações iniciais já executadas. A `.env` foi gerada na VPS, tem permissão `0600` e nunca deve ir ao Git ou ao navegador. A chave pública anon é a única chave enviada ao frontend. Planeje rotação das chaves anuais antes de outubro de 2027.

## Backup e recuperação

`central-cop-backup.timer` executa a cada hora, com pequeno atraso aleatório. Ele chama somente `deploy/backup.sh`, com `pg_dump` do banco próprio e cópia da configuração própria.

Os arquivos usam AES-256-GCM, nonce aleatório e autenticação do conteúdo. Uma alteração no arquivo causa falha de autenticação. O programa não aceita arquivo de destino já existente. O banco foi descriptografado e restaurado com sucesso em um banco descartável criado na mesma instância exclusiva; esse banco de teste e o arquivo temporário descriptografado foram removidos.

Cópias criptografadas foram transferidas para a área privada local `.local/backups`, fora da VPS e ignorada pelo Git. A chave de recuperação também tem cópia privada separada em `.local/recovery/backend-backup.key`. Esses caminhos não são conteúdo público de deploy. A disponibilidade em outro computador depende da sincronização/guarda efetiva feita pelo proprietário; não se afirma que a sincronização do OneDrive foi verificada.

Com o timer horário, o RPO pretendido é de até uma hora, sujeito ao sucesso das execuções. O tempo de restauração foi verificado apenas com uma base pequena de homologação; não há RTO operacional acordado. Ainda é necessário definir retenção e acompanhamento de falhas; não foi programada exclusão automática de backups sem essa definição.

## Ativação e cadastro dos analistas

O administrador abre o link privado de uso único, define senha de 12–128 caracteres e entra com seu login. O token é retirado da URL pelo frontend, armazenado no banco somente como hash, expira em uma hora e deixa de funcionar após o primeiro uso.

Em **Usuários e senhas → Carregar lista dos analistas**, o administrador confere os 58 registros e usa **Criar contas individuais**. A criação é enviada em lotes de 20, preserva contas existentes e mostra as senhas provisórias apenas nessa sessão. Não há exportação para arquivo nem consulta posterior das senhas. A distribuição deve ser individual; cada analista troca sua senha no primeiro acesso.

Os contatos operacionais reais de escalonamento ainda precisam ser fornecidos/importados. Nenhuma relação hierárquica real foi inventada; os exemplos de demonstração não foram gravados no banco.

## Fontes verificadas

- [Supabase self-hosting](https://supabase.com/docs/guides/self-hosting/docker)
- [Configuração Auth](https://supabase.com/docs/guides/self-hosting/auth/config)
- [Caddy: sinais e recarga](https://caddyserver.com/docs/command-line#signals)

O relatório anterior `STATUS-2026-10-24.md` descreve o estado anterior à instalação. Este documento registra a etapa posterior; credenciais, nomes e matrículas reais não fazem parte dele.

## Verificação final da publicação

Frontend conectado à API própria publicado diretamente na Vercel, sem GitHub Actions: deployment `dpl_Hja1fbFNr2EJCv7EdLxhJQeFzRbg`, status `READY`, código do commit `7377bb6` (commits documentais posteriores não alteram o código implantado). Endereço principal: https://central-cop-escalonamentos.vercel.app/.

Após autorização explícita do proprietário, foi aplicada a proteção padrão `prod_deployment_urls_and_all_previews`: o domínio principal mostra o login próprio; previews e URLs individuais de deploy continuam exigindo a proteção Vercel. A mudança inicial sem essa autorização foi rejeitada pela revisão automática, assim como a tentativa de criar um link de compartilhamento para validação; não se contornaram essas rejeições.

No Chromium, a página principal retornou HTTP 200, exibiu login por matrícula, comunicou-se com a API por HTTPS/CORS e mostrou erro genérico para um usuário fictício inexistente. Não houve erros JavaScript nem exibição de contatos demonstrativos. A resposta de login inválido gerou o erro HTTP esperado, distinto de erro de runtime.

Estado final verificado no banco: **1 administrador preparado, 58 analistas na lista privada, 0 contas de analistas geradas e 0 contatos operacionais**. O proprietário recebeu fluxo privado de ativação de uso único, com validade de uma hora; seu token e login não estão neste documento. A ativação e a geração das senhas na sessão administrativa são ações do proprietário, para que senhas não sejam armazenadas em arquivos ou logs durante a implantação.

Um backup contendo o administrador e os 58 registros foi criptografado, transferido à área privada local e restaurado com sucesso em banco descartável: 1 perfil, 58 analistas preparados e 0 contatos. O banco de verificação e os arquivos temporários descriptografados foram removidos.

A chave SSH temporária autorizada foi retirada ao concluir. A API Hostinger confirmou **as quatro chaves originais restantes**. A chave privada temporária e a cópia local de trabalho da lista de analistas também foram retiradas. As cópias criptografadas de recuperação permanecem na área privada ignorada pelo Git.

Liberação operacional ainda exige ativação do administrador, criação/distribuição individual das credenciais dos analistas e importação/conferência das planilhas reais de escalonamento. Não há dados de contatos reais para validar cobertura ou hierarquia operacional. Retenção de backups, alertas de falha e homologação nos navegadores corporativos continuam como ajustes operacionais a definir.
