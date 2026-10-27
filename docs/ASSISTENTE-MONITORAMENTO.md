# Assistente de escalonamentos — extensão 0.2.0

## Operação

O assistente é opcional e **inicia desativado**. Em Opções da extensão, ativar “Assistente no monitoramento”. Manter uma única aba autenticada do Central COP e uma única sessão MAX no mesmo perfil do Chrome. A integração antiga dos cartões com MAX continua disponível quando esta opção é desligada.

Na página HTTP autorizada `10.29.5.216/portal/pages/ui_monitoramento.php`, são identificadas as colunas Regra, Grupo, Cidade/UF e Tecnologia pelos cabeçalhos. Cidade e UF também podem estar em colunas separadas. Formatos aceitos no campo combinado: `Itabaiana/SE`, `Itabaiana - SE`, `Itabaiana (SE)`. Somente regras contendo a palavra Escalonamento e exatamente um N1/N2/N3 participam; SS não filtra cargo. Tecnologia precisa ser HFC, GPON, FIBRA, COAXIAL, EMPRESARIAL ou BKB.

Uma ocorrência recebe o botão de telefone e diagnóstico. Um único responsável pode ser preparado pelo clique; múltiplos exigem escolha, mostrando cargo, nível, tecnologia e abrangência. Sem correspondência, é possível focalizar o Central COP para consulta manual. Nenhum nível ou município é aproximado e nenhum responsável é escolhido automaticamente.

A preparação reconsulta o contato e sua revisão, confirma que a linha ainda está conectada e com o mesmo contexto e usa o fluxo MAX já existente. Não inicia chamada, não envia Enter, não abre outra sessão do agente e não substitui campo já ocupado. A ligação continua manual no MAX.

## Preparação administrativa

No cartão do contato, o administrador utiliza **Abrangência no monitoramento**. Confirma explicitamente cidade, UF e tecnologia para aquele registro, uma associação por linha no formato apresentado no formulário. `ALL` é permitido somente quando o responsável atende todas as tecnologias na cidade confirmada. Uma lista vazia remove a autorização de abrangência daquele contato.

Cada ocorrência original da planilha permanece independente. Vínculos não são deduzidos de cidade/região de registros legados. Contatos regionais também precisam de cidades/UF explicitamente confirmadas. Cada confirmação registra administrador, horário e a revisão completa do contato. Qualquer edição/reimportação que altere o registro torna os vínculos antigos inelegíveis até reconfirmação, mesmo se o telefone não tiver mudado.

O mesmo diálogo permite cadastrar o texto exato de Grupo, o grupo do Central COP e UFs permitidas. Correspondências iniciais: Grupo Rio de Janeiro → RJ; Grupo Espírito Santo → ES; Grupo Minas Gerais → MG; Grupo Centro-Oeste → CO; Grupo Nordeste → NE; Grupo Norte → NO; Grupo Bahia/Sergipe → BA. Variações de escrita não cadastradas não são aproximadas. As UFs restringem o grupo, mas não substituem os vínculos explícitos de cada contato.

## Contratos e segurança

- `cop_monitor_groups`: aliases e UFs autorizadas; `cop_monitor_coverage`: vínculos conferidos por contato; `cop_monitor_audit`: alterações administrativas. Leitura das tabelas é restrita aos administradores; escrita direta por usuários autenticados é revogada.
- RPC `cop_set_monitor_coverage(uuid,jsonb)`: administrador ativo, lista transacional de até 2.000 vínculos. RPC `cop_set_monitor_group(text,text,text[])`: administrador ativo; registra alterações dos aliases.
- RPC `cop_lookup_monitoring(text,text,text,text,integer,uuid,text)`: sessão ativa com senha pessoal; máximo de 100 consultas por minuto/usuário. Filtra grupo, município/UF, tecnologia explicitamente autorizada, nível exato, validade e ativo. Até 100 candidatos; excesso bloqueia a seleção em vez de truncar silenciosamente.
- A consulta inicial não retorna telefone. A seleção revalida ID, contexto e revisão para retornar um único telefone. As respostas não contêm e-mails, observações, detalhes do incidente ou tokens de sessão.
- A aba autenticada do portal recebe o contexto por `MessageChannel` e usa o próprio SDK. A extensão não acessa cookies, armazenamento Auth ou senhas. Nenhuma sessão é enviada ao monitoramento e nenhuma chamada direta a APIs NICE é feita.
- O worker aceita solicitações do monitoramento somente na origem/caminho/frame autorizados e valida separadamente o contrato legado do portal. O número enviado ao MAX vem da revalidação autenticada, nunca do DOM da ocorrência.
- A preferência booleana `monitorEnabled` é o único dado persistido pela extensão. Contatos não são armazenados em `chrome.storage`.
- As permissões acrescentadas são acesso ao portal para localizar a aba autenticada, script na página específica de monitoramento e `storage` para a opção. Não há acesso a todos os sites, histórico ou execução remota.

## Verificação e limites conhecidos

Suíte completa com 123 testes, incluindo os 11 testes anteriores do MAX. PostgreSQL isolado verifica RLS, ausência de abrangência implícita, UF/tecnologia/nível, múltiplos responsáveis, alterações de contato, validade e usuário comum impedido de confirmar vínculos. Testes de mensagens verificam origem/frame, login pendente e revalidação antes de chamar o contrato MAX.

Homologação visual com dados fictícios confirmou: seleção explícita entre dois responsáveis, preparação apenas no MAX simulado, bloqueio após alteração do contato, linha sem cidade bloqueada, linha sem escalonamento sem botão e substituição de página sem duplicação. Editor administrativo abriu e confirmou vínculos no store simulado. Nenhuma ligação ou envio a MAX operacional foi realizado.

**DOM real ainda pendente:** a tentativa de acesso à página interna não respondeu neste computador. A coluna Cidade/UF também precisa estar concluída no sistema de origem. A extensão fica desativada por padrão e não deve ser liberada operacionalmente antes dessa homologação e da conferência das abrangências reais.

## Implantação e reversão

Aplicar a migração aditiva `20261027010000_monitoring_assistant.sql` com backup criptografado; recarregar schema PostgREST sem reiniciar serviços. Nenhum vínculo operacional é criado automaticamente. Publicar portal com a ponte autenticada e o editor; não modificar o fluxo de login ou primeiro acesso.

Distribuir a pasta/ZIP `extension` 0.2.0. O usuário precisa recarregar a extensão e aceitar as permissões exibidas pelo Chrome. Desativar a opção remove os controles do monitoramento e preserva o MAX legado. Voltar ao ZIP anterior também preserva banco e vínculos; não remover dados em uma reversão de frontend.

Migração aplicada em 27/10/2026: backup criptografado `20261027T043448Z`, estado privado `.state/monitoring-20261027-6e1e4026`. Permaneceram 1.841 contatos, sete aliases iniciais e zero abrangências operacionais confirmadas. Digests de contatos, perfis e hashes de senha idênticos antes/depois. Nenhum serviço reiniciado. Chamadas anônimas à consulta, à cobertura e à auditoria retornaram 401.

Portal publicado no deployment `dpl_DvAhrtie2Uf1AC6Vv99rCTxEGFb4`, estado READY, código `fbd5681e6cae7499fbc80c5b73b09f3e0dccca09`. App, store, módulo monitoring e worker retornaram hashes idênticos ao build; primeiro acesso continuou habilitado e CORS HTTPS retornou 204. Reversão de frontend: `dpl_CXpN1t3Q9ZoPNT4bteNkBuiwfcAV` (preservar tabelas e vínculos).

Pacote local `output/central-cop-assistente-0.2.0.zip`: 12 arquivos, manifest 0.2.0, SHA-256 `CD13F6F95FBFF93BB558DF75D49EC4307EF4A00FED6FEDAB4DC33EE33A5E0052`. Não foi instalado/recarregado no Chrome operacional nesta entrega. Prévia fictícia: `output/monitoramento-homologacao.png`. A chave temporária foi revogada e o par local descartado; as quatro chaves originais foram comparadas e preservadas.

Fontes oficiais: [mensagens do Chrome](https://developer.chrome.com/docs/extensions/develop/concepts/messaging), [padrões de URL](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns). Seletores do monitoramento não foram presumidos a partir de código proprietário: a implementação lê cabeçalhos e aguarda homologação no DOM real.
