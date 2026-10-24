# Central COP | Escalonamentos

Portal independente para consulta operacional de contatos e níveis de escalonamento do COP Rede.

> **Projeto novo**: não compartilha banco, autenticação, repositório ou credenciais com o SIM.

## O que a V1 oferece

- Consulta por cluster (RJ, ES, MG, CO, NE, NO, BA), área, localidade, topologia, cargo e nível.
- Pesquisa geral normalizada (inclusive sem acentos).
- Contatos gerais/regionais aparecem junto aos contatos locais aplicáveis.
- Hierarquia visual; número de telefone válido abre **WhatsApp** ao clicar.
- Copiar telefone, favoritos e pesquisas recentes no dispositivo.
- Editor de contatos para administradores, upload CSV/XLS/XLSX, pré-validação e prévia da publicação.
- Importação transacional: mesclar/adicionar (padrão), ou substituir somente clusters selecionados após confirmação.
- Banco e RLS independentes em `supabase/migrations/001_initial.sql` e `supabase/migrations/002_individual_accounts.sql`.
- Login por matrícula (F/N/L) ou e-mail de administrador, com senha individual obrigatória.
- Importação de usuários pelo administrador, senhas provisórias fortes **diferentes por pessoa**, troca obrigatória no primeiro login e redefinição individual.
- Botão NICE MAX ilustrativo **desativado** até integração autorizada e homologada.

## Iniciar a interface

Use Node.js 24 ou superior. Inicie o servidor HTTP local:

```bash
npm run dev
```

Abra `http://127.0.0.1:8087`. Sem um backend configurado, a aplicação entra em **demonstração somente leitura**, com dados explicitamente fictícios e **sem links externos ativos**.

## Habilitar o banco real (Supabase NOVO)

1. Crie um projeto Supabase **novo e separado**. Não reutilize o Supabase do SIM.
2. Execute, em ordem, `supabase/migrations/001_initial.sql`, `supabase/migrations/002_individual_accounts.sql` e `supabase/migrations/20261024053517_security_hardening.sql` no banco desse projeto novo. As funções atualizadas dependem da terceira migração e do diretório `supabase/functions/_shared`.
3. Copie `config.example.js` para `config.js` e preencha somente a URL e a chave pública/anon do novo projeto. **Nunca use service_role no frontend**.
4. Crie o usuário inicial pelo painel **Authentication** do novo Supabase. Depois, ative-o e atribua `admin` manualmente no SQL Editor:

```sql
update public.cop_profiles
set active = true, role = 'admin'
where id = (select id from auth.users where email = 'ADMIN@EXEMPLO.COM');
```

5. Publique os arquivos estáticos diretamente no projeto Vercel existente `central-cop-escalonamentos`. Inclua `config.js` somente com URL e chave pública do backend independente. Use integração Git nativa ou deploy direto. Nunca publique dados operacionais ou segredos no repositório público.
6. Publique as Edge Functions `cop-manage-users` e `cop-change-password` **no Supabase novo** e habilite JWT verificado. Elas precisam de `SUPABASE_SERVICE_ROLE_KEY` **apenas no ambiente seguro das funções**, jamais no navegador ou no GitHub.
7. No portal, o administrador abre **Usuários e senhas**, envia o arquivo CSV (`LOGIN;NOME`) ou cola a lista como tabela Markdown, valida e cria as contas. Os lotes são enviados de 20 em 20 para evitar excesso de chamadas.
8. As senhas provisórias individuais são geradas no servidor e **exibidas somente no resultado da operação, sem opção de consulta posterior**, na sessão do administrador. Distribua cada senha apenas ao titular por um meio seguro. Não há exportação de senhas em arquivo. A alteração no primeiro acesso é obrigatória. O cadastro público fica desabilitado. A base de 58 colaboradores fornecida para importação é um arquivo privado de trabalho, não é incluída no código-fonte do repositório público.

### Convenção de importação

O Excel deve ter uma coluna **Cluster** ou nome de aba exatamente igual a um dos clusters. Campos: `Cluster, Área, Cidade, Topologia, Nome, Cargo, Nível, Telefone, Observações, Abrangência` (cabeçalhos similares são aceitos). Não se infere cluster pela ordem das abas.

- Formato telefônico: 10/11 dígitos brasileiros, ou +55 seguido de DDD+número. **DDD 55 não pode ser confundido com DDI 55**.
- `Mesclar`: adiciona/atualiza pela chave lógica, nunca remove contatos.
- `Substituir clusters importados`: substitui **somente** os clusters presentes no arquivo, após prévia e confirmação. A operação é atômica no banco.
- `cop_import_batches` armazena um snapshot anterior a cada publicação, para restauração administrativa.
- Evite usar o mesmo nome para diferentes pessoas de uma mesma região sem identificador distintivo.

## Segurança

- Autenticação Supabase Auth, RLS para leitura de contatos apenas por membros ativos.
- `admin` importa, edita, desativa e restaura; `viewer` somente consulta.
- Envio de dados de telefone não ocorre no modo demonstração.
- Nenhuma credencial do NICE/MAX é solicitada nem armazenada.
- `config.js` não é versionado; use apenas chaves publicáveis e mantenha RLS habilitado.
- Faça auditoria do banco, HTTPS, políticas de senha e backups antes de inserir dados reais.

## Testes

```bash
npm ci --ignore-scripts
npm test
npm run check
npm run build
```

A suíte inclui regras puras, handlers das Edge Functions com SDK simulado e migrações/RLS/importações em PostgreSQL embarcado. O provedor real de autenticação, gateway e upload precisam de homologação no backend independente. Consulte `docs/STATUS-2026-10-24.md` para evidências, limitações e cenários de navegador.

## Contas por matrícula

- Login: matrícula informada pelo gestor, por exemplo `N5000001` (sem dados reais no código).
- Senha: **individual e aleatória**, gerada com `crypto.getRandomValues`; não existe senha padrão compartilhada.
- Identidade interna: o Supabase Auth usa o alias `matricula@users.central-cop.invalid`, exclusivamente como chave de autenticação. **Não é um e-mail real**, não recebe mensagens nem permite recuperação por e-mail.
- Primeiro login: o backend mantém `must_change_password=true`, bloqueando a leitura de contatos via RLS até a troca da senha inicial.
- Troca: o usuário informa senha provisória atual e define outra com pelo menos **12 caracteres**. O servidor verifica a senha anterior e só então libera o acesso.
- Recuperação: o administrador pode gerar nova senha provisória para um usuário comum. A senha anterior deixa de funcionar e uma nova troca pessoal será exigida.
- Suspensão: o administrador pode ativar/desativar contas comuns, sem remover o histórico.
- Proteção: criação/reset exige sessão JWT ativa de **admin**; `service_role` fica restrita ao ambiente das Edge Functions. A UI não concede privilégios.
- **Não coloque a base real de matrículas e nomes no repositório público.** Guarde a planilha de importação em canal interno seguro ou use a caixa de colagem no painel do administrador.

### Publicar as funções

Instale/autorize o Supabase CLI no projeto independente, vincule somente o novo project ref e execute:

```bash
supabase functions deploy cop-manage-users
supabase functions deploy cop-change-password
```

No dashboard Supabase, mantenha `Verify JWT` habilitado para as duas funções. Configure `COP_ALLOWED_ORIGINS` com `https://central-cop-escalonamentos.vercel.app`; acrescente outros domínios autorizados separados por vírgulas.

### Limitações para publicação

A infraestrutura de banco e as Edge Functions são entregues como **código e migrações**, mas ainda precisam ser implantadas e validadas no Supabase independente. Nenhuma matrícula real ou senha foi cadastrada em um banco pela simples inclusão dessa estrutura no GitHub.

**Publicação sem GitHub Actions:** execute os testes localmente e publique pela integração Git nativa da Vercel ou por deploy direto no projeto existente. Não crie workflows.


## Implantação inicial na Vercel — histórico (24/10/2026)

Foi criado um projeto separado no time Vercel `nlsoarez's projects`, com uma implantação **estática** da interface em:

- `https://central-cop-escalonamentos.vercel.app/`

Este endereço tem dados **fictícios** e não possui Supabase configurado. O deploy da plataforma foi marcado como `READY`, porém o acesso pelo navegador pode estar sujeito à proteção Vercel Authentication e ainda requer validação funcional do proprietário.

A vinculação GitHub → Vercel falhou porque a integração de login do GitHub não está habilitada para a conta Vercel. A implantação inicial foi criada diretamente com os sete arquivos de frontend, por isso **novos commits do GitHub não entram automaticamente na Vercel** até essa conexão ser concluída.

Não foram enviados CSVs com dados de colaboradores para a implantação nem segredos de autenticação. Não usar para produção até que se crie um Supabase separado e sejam testadas as políticas RLS e as duas Edge Functions.


## Preparação atual

O [relatório da implantação do backend](docs/BACKEND-INDEPENDENTE.md) registra o estado mais recente: stack exclusiva instalada na VPS, API HTTPS, 51 testes locais aprovados, homologação real de autenticação e backup/restauração verificados. A lista dos 58 analistas está preparada em tabela privada, e o administrador inicial aguarda ativação. As 58 contas individuais ainda precisam ser criadas na sessão administrativa para que suas senhas sejam mostradas somente ao administrador. Os contatos operacionais reais ainda precisam ser importados. O [relatório inicial](docs/STATUS-2026-10-24.md) é histórico.

O build usa uma lista de arquivos públicos em `scripts/build.mjs`. `npm run build` gera `dist/`; URL/chave pública opcionais vêm de `COP_SUPABASE_URL` e `COP_SUPABASE_ANON_KEY`. Nunca informe chave service_role ou secret. A Vercel usa `vercel.json`, sem GitHub Actions.

Sessões são conferidas no banco e têm duração absoluta de 12 horas. Bloqueio/reset/troca revogam sessões. A troca de senha exige novo login. O gateway próprio limita o login a dez tentativas por conta/15 minutos e 300 por origem/15 minutos, com mensagens genéricas. A troca e a gestão também têm limites compartilhados no banco.
