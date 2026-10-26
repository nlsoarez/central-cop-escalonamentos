# Atualizações de contatos — 26/10/2026

## Contrato e privacidade

**Informar alteração** no cartão abre um formulário com motivo e descrição de 10 a 2.000 caracteres. Motivos: mudança de dados, saída da função, saída da empresa ou outra informação. Nome, região e localidades do contato são copiados pelo servidor; o solicitante é obtido da sessão autenticada.

**Atualizações**, no menu lateral ou no menu Mais do mobile, permite acompanhar as solicitações. Usuários comuns só leem as próprias; administradores leem todas. O administrador pode abrir a edição do contato e concluir a análise com uma resposta de até 1.000 caracteres. A conclusão e o relato não modificam automaticamente o contato. O usuário acompanha o retorno dentro do portal; não há mensagens externas ou notificações por terceiros.

Tabela privada: `cop_contact_reports`, com RLS e sem escrita direta por `authenticated`. RPCs:

- `cop_submit_contact_report(uuid,text,text)` exige sessão ativa, senha pessoal e contato acessível; limita a 10 envios por usuário por janela de uma hora.
- `cop_review_contact_report(uuid,text)` exige administrador ativo, impede revisão duplicada e registra responsável e horário.

Retornos de falha: validação, falta de permissão, contato indisponível, limite de envio ou análise já concluída. O formulário mantém o texto em memória na falha e na revalidação de sessão; logout e mudança de papel descartam os dados privados. Erros ao carregar relatos não impedem a consulta de contatos. A lista mostra até 200 solicitações, priorizando as abertas. A exclusão de um contato preserva o relato e seu contexto original.

## Matrícula e administração

A autenticação já convertia a matrícula para um alias sem distinção de caixa. A normalização agora usa o mesmo contrato do provisionamento (`accountAlias`) e o campo apresenta a matrícula normalizada ao perder o foco. A senha permanece exatamente como digitada. Não se presume que todo erro de autenticação seja causado por caixa da matrícula.

Promoções administrativas pontuais são executadas por operador com `deploy/promote-admin.sql`: exige matrícula e nome exatos, uma conta ativa e um administrador responsável identificado. Não altera senha nem a exigência de troca pendente, não reativa contas e não publica uma API de elevação de privilégios. A alteração é registrada em `cop_user_audit`. Identidades reais da solicitação ficam apenas no procedimento privado de implantação.

## Interface e verificação

No mobile, Ligar e WhatsApp têm larguras iguais, altura mínima de 56 px, ícones distintos e cores específicas. O botão Ligar mantém `tel:+55…`; WhatsApp continua abrindo o destino escolhido pelo usuário. Nenhuma chamada foi realizada nos testes.

Testes de banco incluem anonimato, leitura restrita, impossibilidade de revisão por leitor, escrita direta bloqueada, validação, limite, sessão inválida, ausência de alteração do contato e promoção com identidade correta, auditada e idempotente. Testes de apresentação escapam HTML dos relatos e respostas. Testes de login verificam caixas diferentes e preservação exata da senha.

Prévia com dados fictícios verificou envio pelo leitor, análise administrativa, retorno ao leitor, troca de papel sem dados residuais e layouts de 360, 390, 430, 768 e 1440 px sem overflow ou erros de console. Capturas em `output/reports/`. Nenhum relato operacional foi criado nesta etapa.

## Implantação

Aplicar primeiro `20261026010000_contact_reports.sql` exclusivamente no banco do Central COP, com backup criptografado antes. Recarregar o esquema do PostgREST por NOTIFY; não é necessário reiniciar serviços. Depois publicar o frontend no projeto Vercel existente. A reversão do frontend mantém os relatos privados no banco para preservar dados. Não excluir relatos durante reversão.

## Resultado publicado

- 108 testes aprovados, sintaxe e build aprovados.
- Migração aplicada no banco exclusivo do Central COP. Backup criptografado de banco e configuração: `20261026T194537Z`; estado privado da implantação: `.state/improvements-20261026-b8ae201a`.
- A conta solicitada foi conferida por matrícula e nome e promovida a administradora; conta ativa e exigência de senha pessoal preservadas. Uma ocorrência `promote_admin` registrada no histórico privado. Nenhuma senha foi lida ou alterada.
- Os 1.841 contatos permaneceram idênticos antes e depois da migração, verificados por digest de todas as linhas. Nenhum relato operacional criado pelos testes. Nenhum serviço reiniciado.
- Acesso anônimo aos relatos retornou HTTP 401 em produção. Privilégios de leitura anônima e inserção direta por leitores confirmados como ausentes.
- Chave temporária revogada e par local removido; as quatro chaves originais foram comparadas e preservadas.
- Código principal `30de15e`, rótulo de auditoria `54aefa2`; deployment `dpl_DJr6eLjHM6vf9NZQPRPymYTn6MYT` READY, worker `cop-public-static-a8af1e2a8d7b2746` no domínio principal. App, store, módulo de relatos e CSS em produção retornaram HTTP 200 e hashes SHA-256 idênticos aos locais.
- Reversão de frontend: `dpl_4J8Jnabu4heaAUXZCCj2aZ5qskyP`. Preservar o banco e os relatos em caso de reversão; não retirar a promoção solicitada sem autorização específica.
