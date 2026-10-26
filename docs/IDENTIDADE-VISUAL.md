# Ícone oficial do Central COP

## Correção do fundo branco — 25/10/2026

A borda relatada era parte dos pixels do arquivo enviado, e não uma borda CSS. Foi removido o fundo externo com o modo integrado `image_gen`, skill imagegen, gerando um recorte PNG com transparência real. Arquivo final do projeto: `assets/central-cop-official.png`. Os seis derivados preservam o canal alpha e têm cantos transparentes. A prévia no painel escuro confirmou a remoção do retângulo branco. Favicon e imagens de marca receberam nova versão na URL para renovar o cache.

Prompt final utilizado:

> Use case: background-extraction. Edit target: the supplied Central COP glossy red rounded-square headset icon. Remove ONLY the white/gray background OUTSIDE the red rounded-square silhouette, including the rectangular white outer margin. Output a PNG with genuine alpha transparency outside the icon. Preserve the red icon's silhouette, glossy reflections, beveled red rim, white headset/operator symbol, white circular strokes, red waves and exact internal arrangement; do not redesign, add text, add a border or add a new shadow. White elements INSIDE the red square are part of the artwork and must remain fully opaque. Use a clean alpha edge with no white fringe, white matte, rectangular white patch or checkerboard baked into pixels. Keep this same single icon centered, with very little transparent padding, suitable for use on a dark navy header. The goal is a faithful background cutout of the existing artwork, not a new logo.

Evidência visual: `output/login/login-sem-borda-branca.png`. Os registros abaixo descrevem as versões anteriores, que ainda continham o fundo original branco.

## Ícone atual e login — atualização de 25/10/2026

O anexo **Ícone de Operações com Headset.png** substituiu a arte anterior. O arquivo original atual está em `assets/central-cop-official.png`. Todos os tamanhos derivados mantêm a imagem completa, sem acrescentar bordas, sombras ou margens; a versão maskable agora também usa a mesma imagem de 512 px, sem a margem adicional da versão anterior. Os fundos e detalhes já existentes na arte enviada foram preservados. Os elementos `<img>` da marca têm borda e sombra CSS zeradas.

O login tem painel de contexto com o datacenter no desktop, formulário dedicado e apresentação compacta no mobile. Oferece mostrar/ocultar senha e alternância de tema sem reconstruir os campos, além de botão desabilitado e indicação **Entrando…** durante o envio. A mudança de largura também preserva o formulário. A autenticação, mensagens genéricas de erro, política de sessão e permissões do backend permanecem nas mesmas funções existentes.

Verificação desta atualização: 103 testes aprovados, sintaxe e build aprovados. Navegador com respostas locais simuladas verificou carregamento, alternância de senha, envio pendente, recuperação após erro e entrada bem-sucedida; nenhuma credencial real foi usada. Layouts em 320, 360, 390, 430, 768, 1024 e 1440 px sem overflow horizontal; borda computada da marca em 0 px e nenhum erro de console. Capturas: `output/login/login-desktop.png`, `login-dark.png` e `login-mobile.png`.

Publicação atual: código `0a9bcd8`, deployment `dpl_6oR5CScsAbdd8tzQrqFwQLtek1Ru` READY, worker `cop-public-static-0d52f65937feb9c8`. Verificados no domínio principal os seis PNGs com HTTP 200 e hash idêntico ao local, além do novo login, CSS, favicon versionado e worker com CSP preservada. Reversão: `dpl_Ck3xpJfFFSnRjU2Axs99wB3C7KSk`.

## Histórico da arte anterior

Arte fornecida pelo usuário em 25/10/2026, preservada em `assets/central-cop-official.png` (1254 × 1254). Substitui o símbolo anterior de raio na identificação do projeto.

- Aba do navegador: PNGs de 32 e 48 px.
- Aplicativo/PWA: PNGs de 192 e 512 px; Apple Touch Icon de 180 px.
- Android maskable: arte completa de 360 px centralizada em uma tela branca de 512 px para proteger os cantos e o texto do recorte do sistema.
- Portal: imagem no menu lateral, cabeçalho, login e troca de senha. Ícones funcionais de ações permanecem independentes da marca.

Os derivados são redimensionamentos do original; não houve redesenho nem remoção de partes da arte. O original não integra a lista de arquivos públicos do build; os derivados otimizados são publicados.

Para regenerar, execute `node scripts/generate-pwa-icons.mjs` com Sharp disponível. A variável opcional `COP_SHARP_MODULE` aceita o caminho de uma instalação externa de Sharp; não é uma dependência da aplicação ou da publicação.

Validação: 103 testes aprovados, sintaxe e build aprovados. Prévia local confirmou as imagens carregadas no menu e cabeçalho e as duas referências de favicon, sem overflow.

Publicação: commit `0ef9022`, deployment `dpl_Ck3xpJfFFSnRjU2Axs99wB3C7KSk` READY, worker `cop-public-static-ff1316b63063e198`. Os seis PNGs foram verificados no endereço principal com HTTP 200 e hash SHA-1 idêntico ao arquivo local. A página publicada confirmou os dois favicons. Reversão disponível para o deployment anterior `dpl_Cizr6wz2uDmnunHJw6yoNh5BCiv5`.
