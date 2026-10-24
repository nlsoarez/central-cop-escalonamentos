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
- Banco e RLS independentes em `supabase/migrations/001_initial.sql`.
- Botão NICE MAX ilustrativo **desativado** até integração autorizada e homologada.

## Iniciar a interface

Basta abrir `index.html` via servidor HTTP local ou GitHub Pages. Por exemplo:

```bash
python -m http.server 8080
```

Abra `http://localhost:8080`. Sem um backend configurado, a aplicação entra em **demonstração somente leitura**, com dados explicitamente fictícios e **sem links externos ativos**.

## Habilitar o banco real (Supabase NOVO)

1. Crie um projeto Supabase **novo e separado**. Não reutilize o Supabase do SIM.
2. Execute `supabase/migrations/001_initial.sql` no SQL Editor desse novo projeto.
3. Copie `config.example.js` para `config.js` e preencha somente a URL e a chave pública/anon do novo projeto. **Nunca use service_role no frontend**.
4. Crie o usuário inicial pelo painel **Authentication** do novo Supabase. Depois, ative-o e atribua `admin` manualmente no SQL Editor:

```sql
update public.cop_profiles
set active = true, role = 'admin'
where id = (select id from auth.users where email = 'ADMIN@EXEMPLO.COM');
```

5. Para GitHub Pages, configure as mesmas constantes públicas em `config.js`. Não publique contatos operacionais, credenciais privadas ou arquivos reais no repositório público.
6. O cadastro é fechado; novos usuários devem ser provisionados pela administração do Supabase. Não existe criação pública de contas no site.

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
