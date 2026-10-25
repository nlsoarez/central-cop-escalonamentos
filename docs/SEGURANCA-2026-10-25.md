# Central COP — correções de segurança implantadas

Em 25/10/2026, foram implantadas correções de confinamento de destino e tratamento de URLs no gateway exclusivo do Central COP, preservação de backups existentes em colisões de nome e política CSP no frontend. Não houve alteração de autenticação, RLS, schema, firewall ou serviço de terceiros.

Validação: 85 testes locais aprovados; verificações internas de saúde e autorização sem escrita no banco; cinco verificações públicas de saúde e negação de acesso; tela de login renderizada. Os 1841 contatos foram preservados. Backup criptografado anterior à troca e reversão automática preparados; a chave SSH temporária foi removida e as quatro chaves anteriores mantidas.

Deployment Vercel: `dpl_6PLW91GoSP3UMESRUzdJaamdetYw` (produção READY). Configuração pública do backend preservada, CSP confirmada e proteção dos previews mantida.

Limitações: login real com senha e fluxo MAX não foram repetidos nesta etapa. O resultado não certifica ausência de outras vulnerabilidades. Sessões persistentes no navegador, resistência a arquivos compactados malformados, proteção contra carga distribuída e camadas das imagens Docker exigem avaliações específicas.

O relatório técnico detalhado e as evidências estão no diretório privado de trabalho `.local/`, fora do build público e do repositório.
