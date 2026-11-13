# Deixar a lista de inscrições mais rápida (carregar, filtrar e mudar de página)

## O que causa a lentidão
O banco responde rápido (cerca de 6 ms por consulta). O tempo se perde nas etapas feitas no servidor e na tela a cada filtro ou mudança de página:
- A cada filtro, o servidor busca **todas** as inscrições de novo, junto com os pagamentos complementares e o histórico de checkouts, e só depois recorta a página.
- As fotos das 25 linhas são liberadas **uma a uma** (25 chamadas seguidas ao armazenamento).
- O filtro "Acesso ao app" percorre todas as contas de usuário a cada clique.
- O histórico de checkouts é pedido com listas de até 1000 inscrições por chamada, o que deixa cada pedido pesado.
- Na tela, a tabela some (fica em branco) enquanto carrega, e a pesquisa dispara uma busca a cada envio, mesmo se nada mudou.

## O que vai mudar para você
- Trocar filtro ou página deixa a tabela atual visível, com um indicador discreto de "atualizando", em vez de esvaziar a lista.
- Voltar para um filtro ou uma página que você já abriu mostra o resultado na hora e atualiza em segundo plano.
- As fotos aparecem junto com a lista, sem atraso extra.
- Os totais, os PDFs e o CSV continuam iguais e respeitando os filtros.

## Passos
1. **Medir antes:** registrar no servidor quanto tempo leva cada etapa (inscrições, pagamentos, histórico, logins, fotos) para confirmar onde está o maior atraso.
2. **Fotos em lote:** liberar as fotos da página com **uma única** chamada de armazenamento.
3. **Menos dados por filtro:**
   - buscar só as colunas necessárias para filtrar e calcular a situação de pagamento;
   - pedir o histórico de checkouts e os pagamentos complementares **apenas** das inscrições que podem ter esses dados (por exemplo, pendentes ou promocionais), e não de todas;
   - fazer essas buscas em grupos menores (cerca de 200 por vez) e em paralelo.
4. **Filtro de acesso ao app:** só consultar as contas quando esse filtro estiver ativo (como hoje), mas buscando as páginas de contas em paralelo e cruzando apenas com as inscrições que têm conta.
5. **Na tela:**
   - manter o resultado anterior visível enquanto carrega;
   - guardar na memória da página os resultados de cada combinação de filtro e página (válidos por cerca de 1 minuto), e apagar essa memória depois de qualquer ação (pago, isento, editar, excluir, tornar admin);
   - deixar a próxima página pré-carregada;
   - não repetir a busca quando a pesquisa enviada for igual à anterior.
6. **Medir depois** e comparar com o passo 1.

## Segurança e regras mantidas
- Tudo continua passando pela verificação de administrador no servidor; nenhuma permissão muda.
- As rifas continuam separadas da taxa de inscrição, e os cálculos financeiros não mudam.
- O filtro de login continua usando o registro real de entrada, não a criação da conta.
- Nenhuma mudança no banco de dados.

## Tratamento de erros
- Se a atualização falhar, a lista anterior fica na tela com a mensagem "Não foi possível atualizar. Tentar novamente".
- Se uma foto não puder ser liberada, aparece o avatar com as iniciais.

## Testes
- Atualizar os testes do servidor: fotos liberadas numa única chamada, buscas em grupos de 200, histórico pedido só das inscrições que precisam.
- Testes da tela: lista anterior visível durante a carga, resultado guardado ao voltar a um filtro, memória apagada após uma ação, pesquisa repetida não dispara nova busca.
- Rodar todos os testes do painel e conferir os tipos.

## Entrega
Depois da aprovação, implemento, comparo os tempos de antes e depois e informo o ganho. Para valer no site oficial, será preciso publicar.

## Detalhes técnicos
- `signPhotos`: trocar `createSignedUrl` por linha por `createSignedUrls(paths, expiry)`.
- `listSupersededCheckoutReviews` e `listComplementPayments`: grupos de 200 IDs com `Promise.all`; o histórico de checkouts limitado às linhas pendentes ou com `order_nsu` substituído.
- `listCandidates`: `fetchActiveRegentNames` uma vez para todos os IDs de coro, e não por lote.
- `listLoggedInRegistrationIds`: buscar as páginas de `listUsers` em paralelo depois da primeira; cruzar só com `participant_accounts` que tenham `user_id`.
- Em `AdminRegistrationsPage.tsx`: usar um `Map` de cache por `JSON.stringify(query)` com TTL de 60 s; não chamar `setResult(null)` durante a carga; pré-carregar `page + 1`; limpar o cache após as mutações.
- Os tempos de cada etapa vão para o log do servidor com `console.info`, sem dados pessoais.
