# Desktop: continuidade, MAX e aparência

> Atualização posterior em 25/10/2026: o usuário relatou que a janela compacta do MAX permanecia carregando. A abertura direta foi retirada do menu lateral e do painel auxiliar. O módulo exclusivo do popup e seu teste foram removidos. A extensão e os botões dos contatos permanecem preservados. A causa do carregamento dentro do MAX não foi confirmada. A descrição de popup abaixo é o registro histórico da versão anterior.

Retirada publicada: código `84e91d6`, deployment `dpl_9wkPnSBTEddk68hTS1EpbEYwQTEx` READY, worker `cop-public-static-9f4e0b0aa0a51301`. Validação: 103 testes aprovados, sintaxe e build aprovados; módulo principal em produção confirmou ausência dos atalhos e preservação do botão dos contatos e do seletor de tema.

Atualização de 25/10/2026.

## Comportamento

- Troca de aba no desktop mantém a consulta e os campos digitados. A sessão continua sendo verificada ao retornar e a cada 30 segundos em primeiro plano. Revogação encerra o acesso e falha de verificação oculta os dados. Não houve alteração da validade de 12 horas nem das permissões do backend.
- No mobile, a proteção de segundo plano e a revalidação continuam existentes.
- NICE MAX no menu lateral abre `https://max.niceincontact.com/index.html` por gesto do usuário, solicitando popup de 360 × 820 px, limitado ao espaço disponível da tela, com `noopener,noreferrer`. O navegador controla a apresentação final e pode bloquear popups. Não há discagem automática.
- Regiões têm contornos SVG locais e estado selecionado com borda, cor e marca de confirmação. Subgrupos preservam os nomes e associações originais da base.
- Tema claro/escuro disponível no menu lateral do desktop e em **Mais** no mobile. Só a preferência visual é persistida, na chave `cop-theme`; valores desconhecidos ou armazenamento bloqueado usam o tema claro. O tema é aplicado antes da folha de estilos, sem scripts inline.

## Origem dos contornos

Fonte: [API de Malhas Geográficas do IBGE v3](https://servicodados.ibge.gov.br/api/docs/malhas?versao=3), consultada em 25/10/2026. Malha simplificada das UFs em GeoJSON, país BR, `intrarregiao=UF`, `qualidade=minima`. Os contornos foram simplificados para uso como ícones decorativos e incorporados ao módulo `src/region-maps.mjs`; não há consulta ao IBGE durante o uso do portal.

RJ, ES e MG usam seus estados. CO e NO agrupam os contornos das respectivas regiões; BA representa Bahia e Sergipe; NE usa os demais estados nordestinos. Esses desenhos não definem a abrangência operacional, que continua vindo da planilha.

## Verificação

- 104 testes aprovados, incluindo persistência de tema, destinos/dimensões do popup, mapas sem conteúdo remoto e revalidação silenciosa com revogação e falha de rede.
- Navegador local com contatos sintéticos: ciclo hidden/visible não exibiu máscara e manteve o mesmo campo e texto digitado; ação MAX entregou o endereço e os recursos corretos ao substituto local de `window.open`, sem abrir uma sessão operacional.
- Tema escuro permaneceu após recarga. Verificadas larguras de 1600, 1440, 1024, 390 e 360 px, sem rolagem horizontal; mapas visíveis e MAX oculto no mobile. Tema acessível pelo menu Mais. Nenhum erro de console observado na prévia.
- Controles nativos de botão com `aria-pressed`, estado expandido e foco visível; SVGs decorativos não duplicam o nome acessível. Botões principais no escuro mantêm texto branco em vermelho escuro. Não foi executada auditoria completa com leitor de tela.
- Nenhuma chamada ou compartilhamento de contatos reais foi realizado.

Reversão disponível para o deployment anterior `dpl_BJqir8arqcuHitvoTeEJinkL55EG`. A apresentação como janela nativa deve ser confirmada no Chrome do usuário, pois a prévia local validou o contrato da chamada de abertura.

## Publicação

Commit de código `49a4d33`, deployment `dpl_CQiGpYpLagfEVhT8Aydc1tTw5gbr`, produção READY no endereço https://central-cop-escalonamentos.vercel.app/. Worker gerado `cop-public-static-614a0ea5e9a0ec42`. HTML, CSS, módulos novos e worker retornaram HTTP 200 com o conteúdo esperado e CSP preservada. Configuração do backend e proteção das URLs individuais/previews mantidas.
