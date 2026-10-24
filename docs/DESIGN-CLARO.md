# Identidade visual branca e vermelha — Central COP

## Referências e escolhas

Referência primária: tokens públicos do Mondrian / Claro, consultados em 24/10/2026:
https://mondrian.claro.com.br/tokens/claro-tokens-latest.custom-properties.css
https://mondrian.claro.com.br/o-mondrian

Tokens verificados: vermelho médio #DA291C, vermelho escuro #B41E13, vermelho mais escuro #83170F, neutro de texto #1F1D1D, texto secundário #525252, fundo #F8F8F8 e branco #FFFFFF. A fonte base publicada pelo Mondrian é Roboto. Tons suaves, bordas, dimensões e componentes deste portal são próprios, derivados dessas referências, sem dependência da biblioteca Mondrian e sem uso da fonte proprietária AMX.

A interface usa branco como superfície predominante, vermelho nas ações principais e seleções, cinzas neutros para hierarquia e poucos acentos semânticos: verde para WhatsApp/sucesso e âmbar para advertências. Não há tema azul nem cores diferentes por nível. Os níveis permanecem identificados por número e texto.

## Alterações

- Menu lateral branco, seleção vermelha suave e identificação do item ativo com aria-current.
- Cabeçalho mais simples, título Escalonamentos e resumo real de regiões e registros na base.
- Região como primeiro passo da consulta. Busca e filtros aparecem após a seleção, preservando a regra de não exibir contatos antes de escolher uma região.
- Subgrupos, campos, cartões, tabelas, importação, usuários, modais e login com os mesmos tokens visuais.
- Avisos de importação em bloco, com lista e confirmação abaixo, evitando a disposição horizontal anterior.
- Nomes e observações com quebra de linha, incluindo a origem do contato. Nenhuma mudança no conteúdo dos contatos.
- Navegação inferior responsiva, campos de 16 px em celular, alvos de toque de 44 px e consideração da área segura.
- Hover condicionado a mouse; animação curta de opacidade apenas em avisos/modais, com prefers-reduced-motion.
- Removido o papel application da raiz: os controles nativos mantêm a navegação normal de documentos por tecnologias assistivas.

## Skills aplicadas

Frontend UI Engineering, Emil Design Engineering, Mobile Native, Animate, Browser Testing With Devtools e Code Review And Quality. As práticas foram aplicadas ao layout e estados, aos tokens, à contenção de movimento, aos testes em navegador e à revisão do diff.

## Evidências e limites

70 testes de regressão aprovados, sintaxe e build aprovados. Navegador em viewport padrão e em 390 x 844: início sem região, expansão, cartões, desmarcação com Espaço, login, importação com quatro avisos sintéticos e gestão de usuários. A confirmação de leitura ficou abaixo da lista de avisos e a publicação permaneceu bloqueada. Sem rolagem horizontal do documento nos estados verificados; tabelas e navegação inferior têm rolagem própria quando necessária.

Contrastes calculados: branco/vermelho principal 4,87:1; vermelho escuro/fundo suave 9,17:1; texto secundário #707070/branco 4,95:1; texto #525252/branco 7,81:1. Isso verifica os pares citados, não constitui certificação completa de acessibilidade. Nenhum botão sem nome acessível foi encontrado no estado inicial consultado. Não houve teste físico com leitor de tela ou aparelho móvel; a verificação móvel usou emulação de viewport.

Uma falha de sintaxe no gerador privado dos dados fictícios foi corrigida durante a montagem do ambiente de teste; ela não estava no código do portal. Os fluxos finais foram verificados após a correção.

CSS anterior: 22.837 bytes, 5.978 com gzip. CSS no ponto de medição da revisão: aproximadamente 30 KB, 6,8 KB com gzip. Nenhuma biblioteca nova de interface foi adicionada; a fonte Google já utilizada foi trocada por Roboto.

A alteração é de apresentação. Banco, permissões, contatos, importador e autenticação permanecem com os contratos anteriores. A configuração pública do backend deve ser preservada na publicação estática, sem credenciais privadas. A reversão da interface pode usar o pacote do deployment anterior, sem alteração dos dados.

## Publicação e revisão final

Deployment `dpl_7KRwUEcUjMwquAaoQo9RLhthBKJr`, código `b20710d`, status READY no domínio principal. A configuração pública do backend foi preservada no pacote estático. Revisão aprovada para publicação: os ajustes encontrados em contraste de texto secundário e estilo do aviso de demonstração foram incorporados. Não foram alterados contratos de dados ou permissões.
