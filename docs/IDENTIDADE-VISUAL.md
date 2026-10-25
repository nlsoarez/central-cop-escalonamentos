# Ícone oficial do Central COP

Arte fornecida pelo usuário em 25/10/2026, preservada em `assets/central-cop-official.png` (1254 × 1254). Substitui o símbolo anterior de raio na identificação do projeto.

- Aba do navegador: PNGs de 32 e 48 px.
- Aplicativo/PWA: PNGs de 192 e 512 px; Apple Touch Icon de 180 px.
- Android maskable: arte completa de 360 px centralizada em uma tela branca de 512 px para proteger os cantos e o texto do recorte do sistema.
- Portal: imagem no menu lateral, cabeçalho, login e troca de senha. Ícones funcionais de ações permanecem independentes da marca.

Os derivados são redimensionamentos do original; não houve redesenho nem remoção de partes da arte. O original não integra a lista de arquivos públicos do build; os derivados otimizados são publicados.

Para regenerar, execute `node scripts/generate-pwa-icons.mjs` com Sharp disponível. A variável opcional `COP_SHARP_MODULE` aceita o caminho de uma instalação externa de Sharp; não é uma dependência da aplicação ou da publicação.

Validação: 103 testes aprovados, sintaxe e build aprovados. Prévia local confirmou as imagens carregadas no menu e cabeçalho e as duas referências de favicon, sem overflow.
