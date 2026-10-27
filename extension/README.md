# Central COP — Assistente MAX 0.2.1

A versão 0.2.1 coloca o telefone SVG ao lado do rótulo da regra e abre a escolha em menu flutuante. Não há alteração de permissões ou do fluxo de chamadas.

Extensão local para Chrome/Edge, Manifest V3. Preserva a preparação de telefone no MAX e acrescenta um assistente opcional para o monitoramento. Não é uma integração oficial NICE e não realiza chamadas. A nova função inicia desativada e aguarda homologação no ambiente interno; o preenchimento legado já foi validado pelo usuário.

## Novo assistente do monitoramento

Nas Opções da extensão, marque **Ativar assistente no monitoramento** e recarregue a página interna autorizada. Mantenha uma única aba autenticada do Central COP e uma única sessão MAX no mesmo perfil do Chrome. A versão 0.2.0 precisa ser recarregada no gerenciador de extensões; o Chrome pode solicitar confirmação das novas permissões.

O botão de telefone aparece junto às regras de Escalonamento N1/N2/N3 e usa Grupo, Cidade/UF e Tecnologia. Um responsável pode ser preparado pelo clique; múltiplos abrem opções. A abrangência de cada contato precisa ter sido confirmada pelo administrador no Central COP. Cidade/UF ausente, grupo desconhecido ou nenhum contato compatível impedem envio. O contato e a linha são conferidos novamente antes da preparação. O clique final em Chamada continua manual.

Permissões adicionais: localizar a aba do Central COP, executar o script apenas na página `http://10.29.5.216/portal/pages/ui_monitoramento.php` e salvar a preferência booleana de ativação. Nenhum contato ou sessão é persistido pela extensão. Não lê cookies, senhas nem tokens. Desativar a opção remove os novos controles e preserva os botões MAX do portal.

Detalhes de configuração, limites e homologação: [documentação do assistente](../docs/ASSISTENTE-MONITORAMENTO.md).

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
- Permissões de host: MAX e Central COP, para localizar as abas autorizadas. O script adicional fica restrito à página interna descrita acima. Não solicita acesso a todos os sites nem permissão geral de histórico/abas.
- Lê o telefone do link WhatsApp do cartão somente para preparar a ação; transfere apenas número e horário entre componentes locais da extensão. A agenda não é copiada em lote.
- Sem leitura de cookies, tokens, senhas, armazenamento da sessão ou chamadas à API NICE. Somente a preferência de ativação é persistida; sem contatos em armazenamento local, telemetria ou servidor adicional.
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
