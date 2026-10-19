# Filtro de acesso ao app nas inscrições

## Tela e comportamento
- Adicionar **Acesso ao app** aos filtros da lista administrativa de inscrições, com as opções **Todos**, **Nunca fez login** e **Já fez login**.
- Combinar esse filtro com busca, pagamento, coro e função. Ao alterá-lo, voltar à primeira página e atualizar a quantidade de resultados.
- Aplicar a mesma seleção ao exportar CSV, sem mudar os valores financeiros ou o resumo geral.

## Regra e dados
- Considerar acesso somente quando a conta vinculada à inscrição tiver um login registrado. Cadastro, confirmação de pagamento e liberação de acesso não contam.
- Inscrições sem conta vinculada também entram em **Nunca fez login**.
- Usar o histórico já existente do serviço de login, sem criar registros de acesso retroativos ou alterar contas.
- A conferência atual encontrou 64 inscrições: 26 com login registrado e 38 sem login, incluindo 8 sem conta vinculada. Esses números serão recalculados ao consultar a lista.

## Segurança e erros
- Disponibilizar o filtro somente no painel administrativo, mantendo a verificação de administrador no servidor.
- Consultar os dados de login exclusivamente no servidor; não enviar informações privadas das contas para o navegador.
- Se a consulta de acesso falhar, mostrar o erro e permitir tentar novamente, sem classificar essas pessoas incorretamente como sem acesso.
- Preservar o estado vazio da lista quando nenhum inscrito corresponder aos filtros.

## Detalhes técnicos
- Estender a validação dos filtros e o pedido de exportação com a seleção de acesso.
- Consultar as contas de autenticação em páginas completas e relacionar o registro de login ao usuário de `participant_accounts`, não apenas ao e-mail.
- Aplicar a seleção antes da paginação e da exportação, aproveitando o processamento atual da lista administrativa.
- Não criar tabelas, alterar permissões ou mudar a lógica de pagamento.

## Testes e entrega
- Testar conta com login, conta sem login e inscrição sem conta; verificar a combinação com os filtros existentes, paginação e CSV.
- Rodar os testes administrativos pertinentes e verificar a ausência de erros no sistema.
- Conferir o filtro na tela pública de login e a proteção do painel; a verificação completa da lista com uma sessão administrativa depende de acesso autenticado ao serviço externo e será informada como não verificada se indisponível.
- Entregar no preview, sem publicar automaticamente.