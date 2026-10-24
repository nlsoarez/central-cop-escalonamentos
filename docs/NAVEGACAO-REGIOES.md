# Navegação da consulta por região e subgrupo

A consulta operacional começa sem região selecionada. Nesse estado, a pesquisa fica desativada e nenhuma lista de contatos ou favoritos laterais é renderizada. A tela orienta o usuário a escolher uma região.

Selecionar uma região mostra os seus subgrupos como botões, abaixo dos botões de região, usando os nomes existentes na planilha. Selecionar um subgrupo filtra a consulta e mantém os gestores gerais aplicáveis à região. O botão Todos os subgrupos retorna à visão da região inteira. Clicar novamente na região ativa a desmarca, recolhendo subgrupos e contatos.

Ao trocar a região ou o subgrupo, os filtros dependentes são limpos. Cidade, topologia, cargo e nível mostram opções compatíveis com o contexto atual. O diretório completo mantém sua consulta global própria.

Os botões indicam seleção/expansão para tecnologias assistivas. O foco é preservado após a atualização da tela. O CSS permite quebra dos nomes longos e dispõe os subgrupos em uma coluna em telas estreitas.

Validação: 70 testes aprovados, verificação de sintaxe e build estático aprovados. Fluxo verificado no navegador com dados sintéticos: início vazio, seleção de RJ, seleção de Baixada Fluminense, troca para MG com Enter e desmarcação com Espaço. A seleção inclui os gestores regionais aplicáveis e mantém o foco no botão. Nenhum erro no console. A disposição móvel possui regras responsivas; esta verificação funcional usou o viewport padrão do navegador.

A alteração é somente no frontend, sem migração ou alteração dos contatos do banco.

Publicação: deployment `dpl_J7rWmfkJtH5PhwnZXqkKPCAMmekj`, código `527b6bd`, status READY no domínio principal. A configuração pública do backend foi preservada no pacote estático, sem expor credenciais privadas.
