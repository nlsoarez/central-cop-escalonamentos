# Central COP — Assistente MAX 0.1.6

Extensão local para Chrome/Edge, Manifest V3. Protótipo com testes automatizados. A versão 0.1.0 foi instalada pelo usuário e os botões apareceram no portal, mas a comunicação com o MAX falhou mesmo após reabertura da janela. A versão 0.1.1 acrescenta diagnóstico por etapa e indicador visível de carregamento no MAX; precisa ser recarregada no gerenciador de extensões. Preenchimento real ainda não validado. Não é uma integração oficial NICE e não realiza chamadas.

## Instalação no Chrome

1. Abra `chrome://extensions` e ative **Modo do desenvolvedor**.
2. Clique em **Carregar sem compactação** e selecione esta pasta `extension`, onde está `manifest.json`. Se recebeu o ZIP, extraia primeiro e selecione a pasta extraída.
3. Recarregue o Central COP e a janela do MAX. Ambos devem estar no mesmo perfil do Chrome.

No Edge, use `edge://extensions`. A instalação depende de a política do navegador da operação permitir extensões locais. O assistente não contorna bloqueios administrativos.

## Uso

1. Entre normalmente no Central COP e no MAX; mantenha apenas uma janela MAX aberta.
2. No contato desejado, clique em **Ligar no MAX**. O botão aparece apenas com a extensão instalada e telefone válido; demonstração não é habilitada. O envio bem-sucedido não acrescenta mensagem ao cartão. Erros continuam visíveis; se a janela não puder receber foco, aparece orientação para abri-la manualmente.
3. No MAX, confira o telefone no painel do assistente. O campo recebe imediatamente **DDD + espaço + número + espaço final**, sem `+55`. Exemplo entre aspas para tornar o espaço final explícito: `"21 991212107 "`.
4. Clique em **Preencher campo**. A extensão abre **Novo** automaticamente, caso o formulário ainda esteja fechado, espera até dois segundos pelo campo e preenche. Não é necessário escolher o formato.
5. Se o formulário já estiver aberto, o assistente usa o campo vazio existente. Não sobrescreve texto, não alterna um diálogo em outro contexto e não repete o clique em Novo enquanto aguarda.
   Após focar o campo, a versão 0.1.5 envia eventos de Espaço (`keydown` e `keyup`) junto à atualização do texto, para notificar o mecanismo de sugestões do MAX. O espaço final continua único. O usuário relatou que uma tecla real atualiza a opção Chamada; a eficácia dos eventos sintéticos nesse mecanismo ainda precisa ser confirmada no MAX real. Nenhum Enter ou clique em Chamada é enviado.
6. Confira o número e a skill na interface do MAX e faça a ligação manualmente. A extensão não aciona Ligar, Enter, transferência ou encerramento.

O telefone pendente expira em até 60 segundos. **Fechar** cancela a preparação, mas não apaga um campo que você já preencheu. Para remover esse número, limpe manualmente no MAX.

## Acesso e dados

- Script do portal: apenas `https://central-cop-escalonamentos.vercel.app/*`.
- Script do MAX: apenas `https://max.niceincontact.com/index.html`, janela principal.
- Permissão de host: somente `https://max.niceincontact.com/*`, para localizar a janela MAX e enviar a preparação. Não solicita acesso a todos os sites nem permissão geral de histórico/abas.
- Lê o telefone do link WhatsApp do cartão somente para preparar a ação; transfere apenas número e horário entre componentes locais da extensão. A agenda não é copiada em lote.
- Sem leitura de cookies, tokens, senhas, armazenamento da sessão ou chamadas à API NICE. Sem armazenamento persistente, telemetria ou servidor próprio.
- Mensagens externas de sites/extensões não são expostas. O worker valida extensão de origem, domínio e frame do portal.
- Erros genéricos não incluem dados de sessão. Nenhum número é gravado em log.

## Validação executada e limites

O formulário real foi inspecionado, sem digitar telefone ou efetuar chamada: diálogo `.advanced-address-book-ui`, estado `new`, contexto `none`, mídia `call`, campo de busca com rótulo `Número de telefone ou termo de busca`. A seleção falha se houver zero ou vários campos compatíveis, campo oculto, bloqueado ou preenchido. Mudanças no DOM do MAX podem exigir atualização.

`node --test tests/max-extension.test.mjs` (na raiz do repositório): 11 testes de contrato, restrição de origem/permissões, roteamento, concorrência, diagnóstico e execução do script de preenchimento em DOM simulado. Incluem abertura de Novo uma única vez, espera limitada, preservação de campo ocupado e formatação nacional preservando DDD 55. Esses testes não substituem a validação no Chrome com a extensão instalada.

Teste real pendente: instalar, recarregar os dois sites, selecionar um contato autorizado, conferir o painel e testar apenas o preenchimento. Não clicar em Ligar. Validar que o número permanece aceito pelo MAX e limpar o campo ao concluir. Nenhuma instalação, preenchimento real ou ligação foi executado durante o desenvolvimento inicial.

Para remover: abra a página de extensões, escolha **Remover** e recarregue portal/MAX. Não há alterações no backend ou no ambiente NICE a reverter.

## Fontes técnicas

- [Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Mensagens entre componentes](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)
- [Permissões e API de abas](https://developer.chrome.com/docs/extensions/reference/api/tabs)
- [Service workers e código local](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/basics)
