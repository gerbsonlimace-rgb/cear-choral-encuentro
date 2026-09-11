# Corrigir falha do checkout InfinitePay

## Objetivo
Evitar a tela em branco quando a InfinitePay rejeitar a criação do checkout e informar claramente o que precisa ser corrigido.

## Alterações
- Interpretar respostas de erro da InfinitePay, preservando uma mensagem pública segura para o caso de checkout externo desativado.
- Retornar falhas esperadas da função de pagamento como resultado controlado, em vez de deixar o erro atravessar a chamada e derrubar a tela.
- Exibir no formulário a orientação apropriada e manter os dados preenchidos para nova tentativa.
- Manter os detalhes completos da resposta apenas nos registros do servidor.
- Atualizar os testes para cobrir a resposta real `external_checkout_not_enabled` e a ausência de tela em branco.

## Validação
- Executar os testes do cliente InfinitePay, do serviço de inscrição e do formulário.
- Confirmar que o projeto compila sem erros.
- Reproduzir uma inscrição no navegador e verificar que a página continua visível com o aviso correto.
