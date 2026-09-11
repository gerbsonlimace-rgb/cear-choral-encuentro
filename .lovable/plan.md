# Corrigir erro ao enviar a inscrição

## O que está acontecendo

A inscrição do site chega ao servidor, mas a gravação no banco é recusada e o participante vê a falha genérica. O registro do servidor mostra: `[Registration checkout] creation failed {"reason":"Não foi possível salvar a inscrição."}` e nenhuma inscrição foi criada.

Causa confirmada: quando a pessoa **não** marca a camisa, o formulário envia o tamanho como texto vazio em vez de "sem tamanho". A regra do banco exige que, sem camisa, o tamanho fique realmente vazio (nulo), então a gravação é rejeitada — ou seja, hoje **nenhuma inscrição sem camisa consegue ser concluída**.

## Correção

1. Ao gravar a inscrição, converter tamanho de camisa vazio para "sem valor", garantindo coerência com a regra do banco (com e sem camisa).
2. Registrar no log do servidor o código e a mensagem reais do banco quando a gravação falhar, mantendo a mensagem amigável na tela — hoje o motivo real fica invisível.
3. Testes: cobrir inscrição sem camisa (tamanho vazio → nulo) e inscrição com camisa (tamanho preservado), no serviço de inscrição.

## Detalhes técnicos

- `src/features/registration/registration-payment.server.ts`: em `createPending`, normalizar `shirt_size` (`input.shirtSize?.trim() || null`) e garantir `shirt_price_cents` nulo quando não há camisa; incluir `error.code`/`error.message` no log antes de lançar a mensagem pública.
- `src/features/registration/registration-payment.server.test.ts`: novos casos para os dois cenários de camisa.
- Restrições envolvidas: `registrations_shirt_selection_check` e `registrations_shirt_price_snapshot_check`.

## Validação

- Rodar as suítes de inscrição e a verificação de tipos.
- Reproduzir no navegador uma inscrição sem camisa até o checkout ser criado, e conferir a linha gravada no banco (removendo o registro de teste depois).
