# Importação do modelo de escalonamento em blocos

O frontend aceita o modelo com abas regionais, cabeçalhos repetidos por nível e células mescladas. A leitura do Excel ocorre no navegador, com coordenadas absolutas e os intervalos de mesclagem do SheetJS. CSV e tabelas simples continuam usando o parser existente.

- O nível explícito da coluna prevalece sobre o título do bloco. Divergências aparecem como aviso, sem corrigir o conteúdo da fonte silenciosamente.
- O contexto da área e o mercado/topologia são preservados. Nomes das abas identificam o cluster; a ordem das abas não participa da decisão.
- A referência de cidades de MG é associada pelo nome da área. O proprietário confirmou que CENTRAL corresponde a Cluster Metropolitana BH. Não há aproximação de grafia ou associação automática de cidades ausentes.
- Cidades explicitamente limitadas no mercado de MG prevalecem sobre a lista completa da área.
- Mesclas verticais distribuem o mesmo responsável somente pelas linhas incluídas no intervalo de mesclagem. Não existe preenchimento indiscriminado de células vazias.
- Duas pessoas na mesma linha só são separadas quando nomes, e-mails e telefones têm a mesma quantidade. Casos ambíguos bloqueiam a publicação. Telefones adicionais de uma única pessoa ficam nas observações.
- Cada ocorrência da planilha é preservada, inclusive linhas idênticas e o mesmo gestor em diferentes abrangências. Uma ocorrência não é consolidada por nome ou telefone. A coluna interna source_occurrence distingue linhas iguais no banco e torna a reimportação do mesmo arquivo idempotente.
- A aba de organograma visual é informada como não importada. A tabela de cidades é referência, não lista de contatos.

A prévia informa o resultado por aba, avisos e inconsistências, permite buscar registros por pessoa, cidade, área ou aba e exige confirmação de leitura dos avisos. Os números representam registros de contato e abrangência, não pessoas únicas. A gravação continua transacional e exige a confirmação final do administrador.

## Validação

68 testes automatizados aprovados, incluindo regressões do modelo, formatos simples, consulta, permissões e gateway HTTP. Verificação de sintaxe e build estático aprovados. Fluxo da interface verificado em navegador com arquivo sintético e backend local simulado sem gravação.

A planilha fornecida pelo proprietário foi lida localmente com a mesma versão de SheetJS do portal. Resultado: 1.841 registros de contato e abrangência, sete abas de contatos, zero erros bloqueantes e zero duplicidades pendentes. A carga completa também passou pelo RPC de publicação num PostgreSQL descartável local, com as migrações do projeto. Nenhum contato foi gravado no backend de produção durante a validação.

A prévia alerta sobre cidades de MG sem contato local explícito, divergência de nível, pessoas agrupadas e organograma visual. Esses avisos devem ser conferidos pelo administrador; aceitar o arquivo não atesta a exatidão operacional da fonte.

O arquivo original e as extrações locais não fazem parte do build ou do Git. O build usa lista explícita de arquivos públicos. A correção posterior de ocorrências inclui uma migração aditiva no banco para preservar linhas repetidas. Autenticação, proxy e infraestrutura permanecem iguais. Para reversão da interface, pode-se restaurar o deployment de produção anterior pela Vercel; os dados do diretório não mudam com essa reversão.

## Publicação

Interface publicada na Vercel em `dpl_6T3u9dMeAS6e3y93WiqQ2PwpA1WD`, código `473c611`, como pacote estático com a configuração pública do backend preservada do deployment anterior. O primeiro empacotamento disparou um build sem as variáveis públicas e entrou em demonstração; a conferência no navegador detectou o problema. O rollback para além do último deployment foi recusado pelo limite do plano Vercel. A correção foi publicar o pacote estático configurado, sem mudar o plano ou as proteções. A configuração contém somente URL e chave anon, nunca chave de serviço.

O build agora rejeita `VERCEL_ENV=production` sem URL e chave públicas, para que um build incompleto não publique demonstração em produção. Builds locais sem configuração continuam permitindo demonstração. A infraestrutura e os contatos de produção não foram alterados.


## Ocorrências da fonte

A identidade de importação inclui cluster, área, cidade, topologia/mercado, nome, cargo, nível e número da ocorrência dentro desse mesmo contexto. O mesmo gestor em contextos diferentes tem registros independentes. Linhas iguais também são independentes. A numeração de ocorrências é estável ao reimportar o mesmo conteúdo, evitando criar novas cópias a cada upload. A aba e linha originais ficam nas observações e na prévia.

A migração 20261024080000_source_occurrences.sql adiciona source_occurrence com padrão 1, amplia a chave única e atualiza publicação/restauração. A aplicação é transacional e não exclui contatos. Snapshots antigos sem a coluna são restaurados como ocorrência 1. Testes cobrem três linhas iguais, telefones diferentes em ocorrências separadas, reimportação sem acréscimos e restauração de snapshots novos e antigos.

Validação local com a planilha real: 1.841 registros, zero erros bloqueantes, cinco avisos e zero chaves de ocorrência duplicadas. A carga completa passou no PostgreSQL descartável. Após autorização do proprietário, a migração foi aplicada na VPS com backup criptografado prévio. Contagem de contatos preservada: 0 antes e 0 depois. Schema com source_occurrence e função de publicação atualizada confirmados. RLS continua habilitada e os serviços permaneceram saudáveis, sem reinício. Nenhum contato da planilha foi enviado ou gravado em produção.
