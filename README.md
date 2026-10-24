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

Basta abrir `index.html` via servidor HTTP local ou GitHub Pages. Por exemplo:

```bash
python -m http.server 8080
```

Abra `http://localhost:8080`. Sem um backend configurado, a aplicação entra em **demonstração somente leitura**, com dados explicitamente fictícios e **sem links externos ativos**.

## Habilitar o banco real (Supabase NOVO)

1. Crie um projeto Supabase **novo e separado**. Não reutilize o Supabase do SIM.
2. Execute, em ordem, `supabase/migrations/001_initial.sql` e `supabase/migrations/002_individual_accounts.sql` no SQL Editor desse novo projeto.
3. Copie `config.example.js` para `config.js` e preencha somente a URL e a chave pública/anon do novo projeto. **Nunca use service_role no frontend**.
4. Crie o usuário inicial pelo painel **Authentication** do novo Supabase. Depois, ative-o e atribua `admin` manualmente no SQL Editor:

```sql
update public.cop_profiles
set active = true, role = 'admin'
where id = (select id from auth.users where email = 'ADMIN@EXEMPLO.COM');
```

5. Para GitHub Pages, configure **Settings → Secrets and variables → Actions → Variables** no repositório novo: `COP_SUPABASE_URL` e `COP_SUPABASE_ANON_KEY` (ambas são informações publicáveis, desde que o RLS esteja correto). O workflow gera `config.js` durante a publicação; não é necessário versioná-lo. Habilite GitHub Pages com fonte **GitHub Actions** em **Settings → Pages**. Não publique contatos operacionais, credenciais privadas ou arquivos reais no repositório público.
6. Publique as Edge Functions `cop-manage-users` e `cop-change-password` **no Supabase novo** e habilite JWT verificado. Elas precisam de `SUPABASE_SERVICE_ROLE_KEY` **apenas no ambiente seguro das funções**, jamais no navegador ou no GitHub.
7. No portal, o administrador abre **Usuários e senhas**, envia o arquivo CSV (`LOGIN;NOME`) ou cola a lista como tabela Markdown, valida e cria as contas. Os lotes são enviados de 20 em 20 para evitar excesso de chamadas.
8. As senhas provisórias individuais são geradas no servidor e **exibidas somente no resultado da operação, sem opção de consulta posterior**, na sessão do administrador. Distribua cada senha apenas ao titular por um meio seguro. A alteração no primeiro acesso é obrigatória. O cadastro público fica desabilitado. A base de 58 colaboradores fornecida para importação é um arquivo privado de trabalho, não é incluída no código-fonte do repositório público.

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
node --test tests/*.test.mjs
```

Os testes cobrem normalização telefônica, identificação de cluster e regras de filtro/importação. A execução real da autenticação/RLS e o fluxo de upload devem ser validados em um Supabase de homologação independente antes de produção.

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

No dashboard Supabase, mantenha `Verify JWT` habilitado para as duas funções. A origem padrão autorizada para o GitHub Pages é `https://nlsoarez.github.io`. Para outros domínios de publicação, configure `COP_ALLOWED_ORIGINS` como uma lista separada por vírgulas nos segredos das Edge Functions.

### Limitações para publicação

A infraestrutura de banco e as Edge Functions são entregues como **código e migrações**, mas ainda precisam ser implantadas e validadas no Supabase independente. Nenhuma matrícula real ou senha foi cadastrada em um banco pela simples inclusão dessa estrutura no GitHub.

**GitHub Actions:** os workflows da validação/publicação devem ser inspecionados; o último estado consultado antes dessa implementação apresentava falhas de inicialização. Não considere o portal publicado até um deploy bem-sucedido.


## Ambiente de demonstração na Vercel (24/10/2026)

Foi criado um projeto separado no time Vercel `nlsoarez's projects`, com uma implantação **estática** da interface em:

- `https://central-cop-escalonamentos.vercel.app/`

Este endereço tem dados **fictícios** e não possui Supabase configurado. O deploy da plataforma foi marcado como `READY`, porém o acesso pelo navegador pode estar sujeito à proteção Vercel Authentication e ainda requer validação funcional do proprietário.

A vinculação GitHub → Vercel falhou porque a integração de login do GitHub não está habilitada para a conta Vercel. A implantação inicial foi criada diretamente com os sete arquivos de frontend, por isso **novos commits do GitHub não entram automaticamente na Vercel** até essa conexão ser concluída.

Não foram enviados CSVs com dados de colaboradores para a implantação nem segredos de autenticação. Não usar para produção até que se crie um Supabase separado e sejam testadas as políticas RLS e as duas Edge Functions.
