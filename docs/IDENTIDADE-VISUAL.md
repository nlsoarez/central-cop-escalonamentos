# Ícone oficial do Central COP

## Ícone atual e login — atualização de 25/10/2026

O anexo **Ícone de Operações com Headset.png** substituiu a arte anterior. O arquivo original atual está em `assets/central-cop-official.png`. Todos os tamanhos derivados mantêm a imagem completa, sem acrescentar bordas, sombras ou margens; a versão maskable agora também usa a mesma imagem de 512 px, sem a margem adicional da versão anterior. Os fundos e detalhes já existentes na arte enviada foram preservados. Os elementos `<img>` da marca têm borda e sombra CSS zeradas.

O login tem painel de contexto com o datacenter no desktop, formulário dedicado e apresentação compacta no mobile. Oferece mostrar/ocultar senha e alternância de tema sem reconstruir os campos, além de botão desabilitado e indicação **Entrando…** durante o envio. A mudança de largura também preserva o formulário. A autenticação, mensagens genéricas de erro, política de sessão e permissões do backend permanecem nas mesmas funções existentes.

Verificação desta atualização: 103 testes aprovados, sintaxe e build aprovados. Navegador com respostas locais simuladas verificou carregamento, alternância de senha, envio pendente, recuperação após erro e entrada bem-sucedida; nenhuma credencial real foi usada. Layouts em 320, 360, 390, 430, 768, 1024 e 1440 px sem overflow horizontal; borda computada da marca em 0 px e nenhum erro de console. Capturas: `output/login/login-desktop.png`, `login-dark.png` e `login-mobile.png`.

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
