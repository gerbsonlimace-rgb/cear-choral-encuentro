# PDF dos resultados das avaliações

**Objetivo:** exportar resultado geral, seis critérios e comentários completos em PDF com logo e leitura no celular.

**Arquitetura:** função de servidor protegida por `requireAdmin`, carregando todas as páginas pelo serviço existente. Gerador `pdf-lib` com logo embutido, páginas A5 verticais, tipografia legível, gráficos de distribuição e comentários agrupados por critério. Controle de exportação prepara o arquivo e oferece abrir ou compartilhar/baixar em um segundo toque síncrono.

**Decisões:** seguir identidade existente; exportar sempre todas as respostas, informando isso junto à ação; não usar a paginação/filtros visuais nem enviar opiniões do navegador ao servidor; excluir “Não utilizei” das médias. Trabalhar na branch de funcionalidade atual preservando arquivos preexistentes. Sem publicação ou alterações de banco.

## Execução

- [x] Testar PDF real: médias, distribuição, todos os comentários, nenhuma identificação, logo, texto longo com quebra, vazio e paginação.
- [x] Implementar gerador em `src/features/event-feedback/adminEventFeedback.pdf.ts` e função protegida em `src/lib/admin-event-feedback.functions.ts`.
- [x] Testar preparação, entrega por segundo toque, erro/retry e invalidação ao atualizar.
- [x] Implementar `src/features/admin/AdminFeedbackPdfExport.tsx` e inserir na tela existente.
- [x] Executar testes pertinentes, TypeScript e build; renderizar e inspecionar amostra sintética em tamanho de celular.

## Riscos verificados

Comentários extensos/palavras sem espaços não podem ultrapassar margens; erros não devem expor download incompleto; atualização deve invalidar o arquivo antigo; exportação deve manter o limite administrativo; símbolos fora da fonte devem ter substituição explícita em vez de quebrar o relatório.

## Verificação

41 testes pertinentes passaram. TypeScript, lint dos arquivos da funcionalidade e build passaram. `node scripts/check-feedback-pdf-build.mjs` auditou o PDF gerado pelo chunk real do servidor: logo incorporado, texto completo, margens e médias. Prévia sintética em `tmp/pdfs/feedback-preview.pdf`; imagens renderizadas conferidas visualmente. UI inicial/pronta verificada em 320, 390 e 1280 px, sem overflow ou erros do navegador. Revisão independente sem problemas acionáveis.

A tentativa da suíte geral apresentou falhas em `AdminRegistrationsPage` (filtros, autorização, exportação e edição) e foi interrompida após aproximadamente seis minutos, sem conclusão global. A asserção antiga da tela de avaliações foi ajustada ao rótulo existente “Nenhum”, sem mudança no produto. Não foram enviados dados fictícios nem alterados banco/site publicado.
