# Evolução mobile e PWA — Central COP

Implementação: 25/10/2026. Frontend existente, sem alterações de banco, RLS, prazo absoluto de sessão, VPS, senhas ou GitHub Actions.

## Sessão e privacidade

A revisão identificou dois caminhos que confundiam indisponibilidade com saída: `store.session()` retornava null para qualquer erro do Auth e o verificador periódico limpava todo o estado após qualquer exceção. Ambos foram corrigidos.

O cliente continua com `persistSession: true` e `autoRefreshToken: true`. A recuperação consulta `getSession()` para deixar o SDK recuperar/renovar o token; autoriza somente após `getUser()`, `cop_session_valid()` e perfil ativo. Não há validação baseada apenas no token armazenado. O servidor continua impondo 12 horas e revogação/bloqueio/troca obrigatória.

Eventos visibilitychange, pageshow de BFCache e online acionam recuperação deduplicada. Falhas temporárias ocultam os dados e exibem reconexão; não removem a sessão persistida. O retorno exige validação e recarga dos dados operacionais. A verificação periódica não recria a interface a cada 30 segundos quando nada muda.

Estado da consulta: view e filtros em sessionStorage por usuário, sem listas de contatos ou tokens duplicados; favorece a restauração de uma aba recuperada pelo sistema. Favoritos e recentes mantêm a separação por conta já existente. Um novo contexto/instalação pode não compartilhar o estado de outra aba. Rascunhos do editor de contato são mantidos somente em memória ao suspender, sem guardar senhas.

Logout manual limpa imediatamente os dados da interface, invalida respostas em andamento e remove somente as chaves locais da sessão desse backend, inclusive se a requisição de logout falhar. Sem rede, a revogação remota não pode ser garantida naquele instante; isso não altera o limite e as regras do servidor.

## PWA

- Manifest com nome completo/curto, standalone, escopo raiz, cor Claro e ícones PNG 192/512, maskable 512 e Apple 180.
- Ícones gerados de geometria pelo script `scripts/generate-pwa-icons.mjs`, sem imagens externas ou novas dependências.
- Instalação Android aparece apenas quando o navegador entrega beforeinstallprompt. Não há instalação simulada.
- iPhone/iPad recebe orientação para Safari → Compartilhar → Adicionar à Tela de Início; orientação some em standalone.
- A splash usa os recursos e o comportamento suportados pelo sistema; não há promessa de tela de abertura idêntica em todas as versões do iOS/Android.
- Cada build gera uma revisão do Service Worker com hash dos arquivos públicos, permitindo detectar mudanças mesmo quando só módulos/CSS mudam. sw.js e manifest têm revalidação explícita.
- Atualização pendente oferece botão; ativação exige clique e bloqueia quando houver edição/importação em andamento. A recarga recupera a sessão pelo SDK e revalida acesso.

Lista exclusiva do cache: offline.html, styles.css, quatro ícones e manifest. Nenhuma resposta API, config.js, HTML autenticado, token, senha, perfil, usuário ou contato operacional é incluído. Navegação usa rede, com fallback para uma página estática indisponível quando a rede falha. Não há consulta operacional offline.

CSP preservada, acrescentando somente manifest-src 'self' e worker-src 'self'. Nenhuma origem externa nova foi liberada.

## Cartões e ações

Mobile até 760 px: número abre `tel:+55...`, Ligar abre o mesmo discador, WhatsApp mantém wa.me, Compartilhar usa vCard quando canShare(files) permite, senão texto. Na ausência da API, o próprio botão oferece cópia; caso o compartilhamento falhe, uma nova ação explícita de Copiar informações é oferecida. Cancelamento não dispara cópia nem outro aplicativo.

vCard 3.0 inclui FN/N, cargo, telefone e metadados operacionais disponíveis. Há escape de quebras/; /, /barra e dobra de linha por bytes UTF-8. Dados da fonte não entram no texto nem no arquivo. Nenhuma ligação é iniciada automaticamente e nenhum destinatário de compartilhamento é escolhido pelo portal.

Origem, número de linha e abrangência técnica são filtrados só na apresentação. O campo notes original e as ferramentas administrativas de rastreamento não foram alterados. Observações operacionais e e-mail continuam visíveis quando presentes.

Mobile oculta MAX, o item NICE e seu acesso pela navegação, mantendo Consultar, Diretório, Favoritos, Recentes e Mais; Mais preserva acesso administrativo autorizado. Desktop mantém a estrutura anterior, incluindo telefone WhatsApp e botão-placeholder que a extensão instalada reconhece. A extensão não precisa de novas permissões. Não foi feita ligação real nem homologação NICE nesta entrega.

## Arquivos principais

Criados: manifest.webmanifest, sw.js, offline.html, quatro ícones, src/contact-actions.mjs, src/session-lifecycle.mjs, src/pwa.mjs, scripts/generate-pwa-icons.mjs e testes mobile/PWA.

Alterados: src/store.mjs, src/app.mjs, assets/styles.css, index.html, scripts/build.mjs, scripts/serve.mjs, vercel.json, package.json e testes de build/store.

## Validações executadas

- 98 testes automatizados aprovados, incluindo segurança anterior, negação de acesso, prazo de sessão no banco isolado, recuperação/renovação, transporte temporário, logout offline, corridas com logout, vCard e cache.
- npm run check e npm run build aprovados; build inclui os arquivos PWA e revisão gerada do worker.
- Navegador com dados sintéticos: falha de rede oculta contatos; reconexão restaura RJ e a pesquisa anterior sem formulário de login; simulação de revogação retorna ao login.
- Compartilhamento com API nativa simulada exibe vCard correta. Não equivale a abrir o compartilhamento nativo de um telefone real.
- Worker ativado no navegador de teste; inspeção mostrou exclusivamente os sete caminhos estáticos permitidos no cache.
- 360×800, 390×844 e 430×932: sem overflow horizontal, sem MAX visível, ações com pelo menos 44 px. Também verificadas larguras 768 (tablet) e 1440 (desktop).
- Links tel/wa.me inspecionados e normalização testada, incluindo DDD 55. Nenhum número foi chamado e nenhum WhatsApp real foi enviado.
- Evidências com dados fictícios: output/mobile/viewport-360.png, viewport-390.png, viewport-430.png, viewport-768.png e viewport-1440.png.

## Testes reais pendentes — Android e iPhone

O usuário informou disponibilidade de ambos. Não há acesso automatizado aos aparelhos físicos nesta sessão. Instalação real, suspensão pelo sistema, bloqueio de tela, discador, compartilhamento e atualização instalada permanecem pendentes até execução nos aparelhos. Emulação de largura não foi apresentada como teste nativo.

Para cada aparelho:

1. Abrir a URL principal; Android/Chrome: usar a instalação quando oferecida, ou a opção do navegador. iPhone/Safari: Compartilhar → Adicionar à Tela de Início.
2. Abrir pelo ícone e realizar o login. A instalação pode ter armazenamento separado do navegador; um primeiro login próprio é esperado.
3. Selecionar região/subgrupo e pesquisar. Alternar para WhatsApp, voltar, bloquear/desbloquear a tela e voltar novamente. A consulta deve ser recuperada enquanto a sessão estiver válida; uma validação breve pode aparecer.
4. Tocar no telefone e em Ligar: conferir o número no discador e cancelar, sem necessidade de efetuar chamada.
5. Compartilhar um contato autorizado: confirmar vCard quando suportado, ou texto; cancelar deve voltar sem mensagens enviadas.
6. Desconectar a rede: contatos e administração não devem permanecer visíveis. Reconectar e tentar novamente sem perder autenticação válida.
7. Sair manualmente: confirmar retorno ao login e ausência de dados privados. Sessão revogada, conta bloqueada ou limite absoluto devem continuar impedindo acesso.
8. Quando houver uma próxima versão, confirmar Atualizar aplicativo e verificar que a versão nova abre e recupera a sessão válida.

## Fontes oficiais

- [Supabase getSession](https://supabase.com/docs/reference/javascript/auth-getsession): recuperação com renovação; não substitui verificação de usuário no servidor.
- [Supabase auto-refresh](https://supabase.com/docs/reference/javascript/auth-startautorefresh): o SDK já gerencia visibilidade no navegador; não foi instalado um segundo mecanismo de refresh.
- [Instalação PWA](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Trigger_install_prompt): dependência de suporte do navegador.
- [Cache PWA](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Caching): cache explícito e limitado.
- [Web Share](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share) e [canShare](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/canShare): gesto do usuário e detecção de suporte a arquivos.
