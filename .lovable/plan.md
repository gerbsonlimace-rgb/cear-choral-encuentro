# PDFs administrativos: download e resumo

## Resultado
- Corrigir o fluxo de download no resumo e na lista de inscrições, com indicação clara quando o arquivo está pronto e ação final **Baixar PDF**.
- Acima da tabela do PDF, mostrar o número total de inscritos, o total pendente em dinheiro e o total pendente em rifas, incluindo a quantidade de rifas quando disponível.
- Incluir a logo do encontro no cabeçalho; não há indicação de uma logo individual cadastrada para cada coro.
- Preservar as colunas existentes: o pedido não identifica uma coluna para remover.

## Telas e dados
- Aplicar o mesmo comportamento de download aos PDFs por coro e aos PDFs da lista de inscrições.
- Calcular o resumo somente com os inscritos que entram no PDF, respeitando todos os filtros ou o nome exato do coro.
- Separar dinheiro da taxa de inscrição e rifas, evitando contar a mesma pendência nos dois totais.

## Detalhes técnicos e segurança
- Manter a geração autorizada no servidor e o registro de auditoria; não alterar permissões, checkout ou pagamentos.
- Incorporar a logo existente ao arquivo, sem depender de downloads externos durante a geração.
- Preparar o arquivo antes do clique final, mantendo compatibilidade com celulares e compartilhamento para salvar em Arquivos.
- Conferir as falhas de geração e entrega separadamente, oferecer nova tentativa e não tratar uma resposta HTTP 200 como prova de download concluído.

## Testes e entrega
- Testar os totais de dinheiro e rifas, inclusive inscritos isentos com 20 rifas/R$ 200.
- Testar preparação, download e nova tentativa; conferir um PDF de várias páginas com logo e resumo sem sobreposições.
- Validar o download pelo navegador. A conferência com inscrições reais permanece limitada pela ausência de sessão administrativa acessível aos testes automáticos; não solicitar senhas.
- Não publicar sem aprovação. Concluir também a revisão SEO já solicitada: os nove testes básicos atuais passaram, e os avisos antigos restantes precisam de verificação específica.