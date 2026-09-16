# Melhorar a lista de inscrições da administração

## Objetivo
Tornar a tabela mais limpa e focada no acompanhamento financeiro, com os dados essenciais visíveis e todas as ações reunidas em um menu discreto por inscrição.

## Alterações na tela
- Manter **Coralista** com foto, nome e CPF, removendo dessa coluna todas as etiquetas de pagamento e acesso.
- Adicionar a coluna **E-mail**.
- Remover a coluna **Regente**.
- Substituir “Valor pago” e “Valor pendente” por uma única coluna **Pagamento**, mostrando:
  - situação: Pago, Pendente, Parcialmente pago ou Histórico;
  - valor recebido e saldo pendente, quando conhecidos.
- Manter **WhatsApp** e **Coro**.
- Substituir os botões espalhados por um botão de três pontos, com nome acessível “Mais ações para [nome]”.
- Reunir nesse menu somente as ações permitidas para cada inscrição: gerar/continuar pagamento, pagar saldo, marcar como pago, ver comprovante, reprocessar acesso e redefinir senha inicial.
- Preservar os diálogos de confirmação, anexação de comprovante e pagamento de saldo.
- No celular, aplicar a mesma hierarquia: identificação, e-mail, pagamento, WhatsApp e coro; o menu de três pontos fica no topo do cartão.

## Dados, segurança e erros
- Nenhuma alteração no banco, permissões, autenticação ou regras financeiras.
- O e-mail já é retornado pela listagem atual; será apenas exibido.
- As ações continuarão usando as validações e autorizações existentes no servidor.
- Erros e avisos atuais serão preservados, sem expor detalhes internos.

## Validação e entrega
- Atualizar os testes da tela para confirmar as novas colunas, a ausência de Regente e etiquetas junto ao nome, e as ações dentro do menu.
- Testar pagamentos, comprovantes e recuperação de acesso através do novo menu.
- Conferir a tabela no computador e os cartões no celular, incluindo textos longos e navegação por teclado.
- Verificar testes relevantes, tipos, compilação e erros no navegador antes de concluir.
