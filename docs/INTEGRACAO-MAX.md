# Integração de ligações externas com NICE MAX

Data da análise: 24/10/2026. Estado: levantamento concluído; discagem não implementada nem homologada. Esta documentação não constitui liberação da Claro/NICE.

Atualização: o usuário escolheu investigar uma extensão de navegador. A versão local 0.1.0 está em [extension](../extension/README.md), com preparação e preenchimento assistido, sem iniciar chamadas. O formulário real foi inspecionado; 8 testes automatizados aprovados. A instalação e o preenchimento na sessão real continuam pendentes. Essa alternativa não depende de habilitar a Agent API e não equivale à integração oficial descrita abaixo.

## Requisito confirmado

O usuário informou o acesso `https://cc.claro.com.br/`, deseja iniciar uma ligação externa a partir de um contato do Central COP e informou que não há acesso de integração liberado. O histórico identifica MAX tradicional 26.1.0, em janela separada; a versão e a origem efetiva da janela precisam de confirmação administrativa.

O usuário confirmou o fluxo de navegação: entrada em `https://cc.claro.com.br/`, portal autenticado em `https://na1.nice-incontact.com/` e janela separada do MAX em `https://max.niceincontact.com/index.html`. A origem informada do MAX é `https://max.niceincontact.com`. Esses endereços foram fornecidos pelo usuário, sem inspeção da sessão. Não usá-los automaticamente como base da API. A origem do MAX é candidata para uma eventual ponte de mensagens, que ainda depende de configuração administrativa, vínculo entre janelas e validação no ambiente autorizado.

Os endereços de navegação não identificam sozinhos o servidor da API, o tenant, a sessão do agente ou a skill de saída. Não há evidência de conexão ativa entre o portal e o MAX.

## Evidência e decisão

- [MAX POST Message Integration](https://help.nice-incontact.com/content/agent/agentapplicationadministration/max/maxpostmessageintegration.htm): páginas incorporadas por Contact Panel/Custom Workspace podem receber eventos. Os comandos documentados controlam chamadas existentes; não há comando de discagem externa listado. Não inventar `DialEvent` ou URL com telefone.
- [Using Events — Agent API](https://developer.niceincontact.com/Documentation/UsingEvents): existe exemplo de `dial-phone` autenticado com número, skill e sessão. O exemplo usa versões antigas; endpoint, autenticação e compatibilidade com a sessão do MAX precisam ser confirmados antes da implementação.
- [Agent Workspace SDK](https://help.nice-incontact.com/content/agent/agentapplicationadministration/cxoneagent/cxasdk.htm): a extensão de clique para ligar é descrita para Agent Workspace. Isso não comprova suporte ao MAX tradicional utilizado na operação.
- [Chamadas no MAX](https://help.nice-incontact.com/content/agent/max/voice/handlecalls.htm): a discagem manual requer número e, quando aplicável, seleção de skill de saída.

Decisão: manter o botão MAX desativado até existir um contrato aprovado para o ambiente. Não instalar SDK de outro cliente nem criar uma segunda sessão de agente por suposição. Copiar telefone continua disponível como ação manual independente.

## Solicitação técnica pronta para encaminhar

Destinatário sugerido: administração de telefonia/NICE da Claro. Texto apenas preparado; nenhuma mensagem foi enviada.

> Precisamos habilitar no Central COP a ação de iniciar ligação externa para um contato selecionado, mantendo o atendimento no MAX tradicional acessado por cc.claro.com.br. O portal está em https://central-cop-escalonamentos.vercel.app/. Podem confirmar a abordagem suportada para usar a sessão existente e fornecer o contrato de integração homologado? Precisamos da versão efetiva do MAX, origem da janela, tenant/região e base/versionamento da API; fluxo de autenticação autorizado e permissões mínimas; identificação e seleção das skills de saída; formato dos números e prefixos; eventos de confirmação e término; comportamento quando já existe chamada; limites e tratamento de erros. Também precisamos de ambiente/agente e destino expressamente autorizados para testes. Caso a opção seja Custom Workspace, confirmar a configuração administrativa e as origens necessárias para incorporação. Credenciais e segredos devem ser provisionados pelo canal seguro da operação, fora do chat e do repositório.

## Contrato a fechar antes de codificar a discagem

| Item | Critério de aceite |
| --- | --- |
| Sessão | Identidade do agente autenticada pelo provedor; vínculo suportado à sessão existente, sem interromper o MAX |
| Número e skill | Número validado conforme plano de discagem; skill permitida ao agente; apresentação do destino antes de confirmar |
| Autorização | Login do Central COP não concede permissão de telefonia; autorização também validada pelo NICE |
| Acionamento | Clique explícito do agente; bloquear clique duplo enquanto a solicitação estiver pendente |
| Resultado | Separar solicitação aceita, discando, conectada e encerrada; nunca exibir conectada apenas por HTTP 2xx |
| Falhas | Tratar sessão expirada, agente ocupado, skill negada, número inválido e timeout sem repetição automática de chamada |
| Indeterminação | Se a resposta se perder, orientar conferir o MAX antes de nova tentativa para evitar duplicação |
| Observabilidade | Registrar correlação e estado; não registrar tokens, senha, payload bruto ou número completo |
| Desativação | Permitir desligar integração mantendo consulta, cópia e demais funções do portal |

Se for aprovada uma ponte via `postMessage`, validar `event.origin`, `event.source` e formato das mensagens; usar origem exata no envio. Não usar `*`, não solicitar `sessioninfo` por conveniência e não tratar session token como OAuth access token. Uma aba independente não obtém referência à janela existente apenas pelo domínio.

O portal envia atualmente `X-Frame-Options: DENY`. Se a abordagem aprovada exigir incorporação, planejar rota dedicada e política `frame-ancestors` com origens confirmadas, preservando a proteção das demais páginas. Não alterar cabeçalhos antes de definir esse contrato.

## Homologação prevista

1. Validar os cenários de erro com serviço simulado, sem telefonia real.
2. Validar autenticação e vínculo com sessão existente no ambiente autorizado.
3. Fazer ligação somente para destino liberado e confirmar os estados observados no MAX.
4. Verificar clique duplo, perda de resposta e chamada já em andamento sem gerar ligações adicionais.
5. Habilitar o botão apenas após aceite da operação; documentar reversão.

Nenhuma chamada, coleta de token ou alteração no NICE foi executada nesta etapa.
