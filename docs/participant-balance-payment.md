# Pagamento do saldo pelo participante

O card financeiro da Home abre `/participante/pagamento` quando há saldo restante. A página mostra o total, o principal confirmado e o saldo, e encaminha ao checkout InfinitePay já usado pela inscrição, com Pix ou cartão. O retorno usa a confirmação de complemento existente e volta ao portal do participante.

## Autorização e cobrança

- As funções exigem sessão e conta de participante ativa. O identificador da inscrição vem do middleware; o navegador não escolhe inscrição, usuário ou valor.
- O serviço compartilhado calcula o saldo a partir dos preços salvos na inscrição e dos complementos confirmados. O banco repete a validação sob bloqueio da inscrição e mantém o índice de um único pedido aberto.
- Um checkout pendente pode ser retomado pelo participante se ainda corresponder ao saldo e tiver uma URL segura da InfinitePay, mesmo quando foi iniciado pelo regente. Pedidos em criação, URLs inválidas ou valores divergentes continuam reservados até serem reconciliados, evitando uma segunda cobrança.
- A quitação depende da consulta ao provedor, com verificação de valor e transação. O retorno do navegador sozinho não confirma pagamento. O webhook existente também reconhece o novo iniciador.
- Os históricos administrativo e do regente aceitam o iniciador `participant` e continuam contabilizando esses pagamentos.

## Publicação

Aplicar `supabase/migrations/20260914060948_allow_participant_balance_payments.sql` antes de disponibilizar o código. A migração permite o iniciador `participant` e valida sua associação à inscrição na inserção. Não altera valores, registros existentes, RLS nem permissões do navegador.

O destino de produção deve ser confirmado antes da aplicação. Em caso de reversão, retirar a funcionalidade do aplicativo e manter os registros financeiros: não excluir cobranças nem restringir novamente o campo `initiated_as` depois de existirem pagamentos de participantes.

## Validação local

Testes dos limites de autorização, cálculo, retomada, confirmação, Home, página de pagamento, histórico administrativo e histórico do regente; TypeScript e build de produção.

A migração foi executada em PostgreSQL local com o ledger e o trigger financeiro originais: associação válida, inscrição de terceiro, conta inativa, saldo excedido, reserva duplicada, confirmação posterior e ausência de acesso dos papéis do navegador.

As interfaces React foram exercitadas no navegador a 320 e 390 px com retorno do provedor simulado, sem cobrança real: Home → saldo → checkout → confirmação → Home quitada. Produção e pagamento real não fazem parte dessa validação.
