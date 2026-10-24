# Importação do modelo de escalonamento em blocos

O frontend aceita o modelo com abas regionais, cabeçalhos repetidos por nível e células mescladas. A leitura do Excel ocorre no navegador, com coordenadas absolutas e os intervalos de mesclagem do SheetJS. CSV e tabelas simples continuam usando o parser existente.

- O nível explícito da coluna prevalece sobre o título do bloco. Divergências aparecem como aviso, sem corrigir o conteúdo da fonte silenciosamente.
- O contexto da área e o mercado/topologia são preservados. Nomes das abas identificam o cluster; a ordem das abas não participa da decisão.
- A referência de cidades de MG é associada pelo nome da área. O proprietário confirmou que CENTRAL corresponde a Cluster Metropolitana BH. Não há aproximação de grafia ou associação automática de cidades ausentes.
- Cidades explicitamente limitadas no mercado de MG prevalecem sobre a lista completa da área.
- Mesclas verticais distribuem o mesmo responsável somente pelas linhas incluídas no intervalo de mesclagem. Não existe preenchimento indiscriminado de células vazias.
- Duas pessoas na mesma linha só são separadas quando nomes, e-mails e telefones têm a mesma quantidade. Casos ambíguos bloqueiam a publicação. Telefones adicionais de uma única pessoa ficam nas observações.
- Repetições idênticas no mesmo contexto são consolidadas com aviso. Divergências no mesmo contato/abrangência bloqueiam a publicação.
- A aba de organograma visual é informada como não importada. A tabela de cidades é referência, não lista de contatos.

A prévia informa o resultado por aba, avisos e inconsistências, permite buscar registros por pessoa, cidade, área ou aba e exige confirmação de leitura dos avisos. Os números representam registros de contato e abrangência, não pessoas únicas. A gravação continua transacional e exige a confirmação final do administrador.

## Validação

65 testes automatizados aprovados, incluindo regressões do modelo, formatos simples, consulta, permissões e gateway HTTP. Verificação de sintaxe e build estático aprovados. Fluxo da interface verificado em navegador com arquivo sintético e backend local simulado sem gravação.

A planilha fornecida pelo proprietário foi lida localmente com a mesma versão de SheetJS do portal. Resultado: 1.838 registros de contato e abrangência, sete abas de contatos, zero erros bloqueantes e zero duplicidades pendentes. A carga completa também passou pelo RPC de publicação num PostgreSQL descartável local, com as migrações do projeto. Nenhum contato foi gravado no backend de produção durante a validação.

A prévia alerta sobre cidades de MG sem contato local explícito, divergência de nível, pessoas agrupadas, repetições consolidadas e organograma visual. Esses avisos devem ser conferidos pelo administrador; aceitar o arquivo não atesta a exatidão operacional da fonte.

O arquivo original e as extrações locais não fazem parte do build ou do Git. O build usa lista explícita de arquivos públicos. Não houve alteração no banco, autenticação, proxy ou infraestrutura. Para reversão da interface, pode-se restaurar o deployment de produção anterior pela Vercel; os dados do diretório não mudam com essa reversão.
