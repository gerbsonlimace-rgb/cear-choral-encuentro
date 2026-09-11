# Remover a camisa da inscrição

A camisa deixa de ser oferecida e cobrada. Isso também resolve o erro atual do formulário: hoje toda inscrição sem camisa é recusada na gravação, porque o tamanho vazio conflita com a regra do banco. Removendo a camisa, o conflito desaparece.

## O que muda para quem se inscreve

- O formulário não mostra mais a opção da camisa nem a escolha de tamanho.
- O total passa a ser somente o valor da inscrição do coro (padrão ou promocional).
- O checkout, a tela de confirmação, o comprovante em PDF e a área do participante deixam de exibir linha de camisa.

## O que muda na administração

- A configuração de preço da camisa sai da tela de coros/valores.
- A lista e a exportação de inscrições deixam de mostrar as colunas de camisa e tamanho.
- Inscrições antigas que já pagaram camisa continuam gravadas no banco e seguem exibidas com o valor efetivamente pago, sem oferecer camisa em novas inscrições.

## Detalhes técnicos

- Formulário e domínio: remover `includeShirt`, `shirtSize`, `displayedShirtPriceCents` de `registration.domain.ts` (schema, itens de checkout, cálculo de valor) e de `RegistrationSection.tsx`; a imagem `camisa-polo-evento` deixa de ser usada.
- Gravação: em `registration-payment.server.ts`, sempre inserir `include_shirt = false`, `shirt_size = null`, `shirt_price_cents = null`, satisfazendo `registrations_shirt_selection_check` e `registrations_shirt_price_snapshot_check`; incluir código/mensagem reais do erro do banco no log do servidor quando a gravação falhar.
- Preços: retirar `shirtPriceCents` do fluxo de cotação (`choir-pricing.domain.ts`, `choir-pricing.server.ts`, `choir-pricing.functions.ts`) e do painel `AdminChoirsPage`.
- Leituras: retirar camisa/tamanho de `admin.domain.ts`, `admin-registration.server.ts`, `AdminRegistrationsPage`, `participant.domain.ts`, `participant-auth.server.ts`, `ParticipantPortalPage`, recibos (`receipt.ts`, `participant-receipt.ts`) e `regent-payments.domain.ts`.
- Banco: nenhuma migração; colunas e restrições permanecem para preservar o histórico.
- Testes: atualizar as suítes afetadas e cobrir inscrição concluída sem camisa (gravando `shirt_size` nulo).

## Validação

- Rodar as suítes de inscrição, coros, admin e participante, mais a verificação de tipos.
- Reproduzir no navegador uma inscrição completa até o checkout ser criado, conferindo a linha no banco e removendo o registro de teste depois.
