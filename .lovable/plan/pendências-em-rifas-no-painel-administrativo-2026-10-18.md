# Pendências em rifas no painel administrativo

## Resultado
- Em **Inscrições**, exibir **“Pendente em rifas”** com a quantidade e o equivalente em reais para quem participa do programa de rifas.
- Cada inscrito de um grupo isento terá **20 rifas pendentes · R$ 200,00**. A inscrição continuará identificada como isenta.
- Exibir a mesma informação no detalhe do inscrito e incluir o total de pendências em rifas no resumo administrativo, geral e por coro/diocese.
- Manter separadas as inscrições ainda não pagas: a entrada da inscrição não será apresentada como se fosse uma rifa.

## Regras e dados
- Cada rifa equivale a **R$ 10,00**.
- Para os inscritos no programa de rifas, usar o saldo restante já registrado, descontando complementos confirmados. Quando houver entrada ainda não paga, separar a entrada do restante destinado às rifas.
- Para inscritos de grupos isentos, aplicar **20 rifas por pessoa**, incluindo os inscritos existentes e os futuros.
- Isenções individuais concedidas pelo administrador fora dos grupos isentos não ganham automaticamente essa pendência.
- Se houver saldo que não seja múltiplo de R$ 10, mostrar o valor restante sem arredondar para uma quantidade incorreta de rifas.

## Limites desta entrega
- Mudança somente no painel administrativo: lista, detalhe e resumo.
- A pendência dos grupos isentos será um acompanhamento administrativo, separado da dívida da inscrição. Não criará cobrança na InfinitePay nem alterará preços, pagamentos, permissões, aprovação da isenção ou acesso ao evento.
- Não modificar as páginas do participante ou do regente e não criar registro de vendas ou baixa de rifas nesta entrega.

## Arquitetura e segurança
- Criar um cálculo específico de pendências em rifas para o painel administrativo, separado do cálculo financeiro usado nas cobranças.
- Usar os indicadores existentes de grupo isento e modalidade promocional; não alterar tabelas ou dados históricos.
- Adicionar campos próprios de rifas aos totais administrativos, sem misturar valores não recebidos com receita confirmada.
- Preservar a validação de administrador que já protege as consultas e as ações.

## Erros, testes e entrega
- Preservar os avisos de falha de carregamento e não inventar saldos para inscrições históricas sem dados suficientes.
- Testar: um inscrito de grupo isento = **20 rifas/R$ 200**; dois = **40 rifas/R$ 400**; entrada não conta como rifa; complemento confirmado reduz o saldo; isenção individual não recebe a regra do grupo; valores não múltiplos não geram contagem arredondada.
- Executar os testes administrativos afetados e conferir os erros da aplicação. A conferência automática com login depende da disponibilidade de uma sessão, atualmente indisponível neste projeto.
- Entregar no preview; publicar somente quando solicitado.