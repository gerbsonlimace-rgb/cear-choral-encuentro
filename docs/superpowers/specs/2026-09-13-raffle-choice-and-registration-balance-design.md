# Escolha de rifas e quitação da inscrição

## Objetivo

Permitir que o participante de um coro participante do Programa de Venda de Rifas escolha, obrigatoriamente antes do pagamento, entre:

- aderir ao programa, pagar agora somente a pré-inscrição e ter a vaga confirmada após a quitação do saldo; ou
- não aderir e pagar agora o valor integral da inscrição.

O participante terá acesso ao app depois que o primeiro pagamento for confirmado nos dois caminhos. Uma inscrição ainda sem pagamento confirmado não concede acesso ao app.

Administradores e regentes poderão consultar a situação financeira real de cada participante e abrir uma cobrança pelo saldo total pendente. Regentes permanecerão limitados ao próprio coro.

## Contexto atual

O projeto já possui:

- valor normal e promocional globais;
- indicação de quais coros participam do programa de rifas;
- snapshots de preço em cada inscrição;
- checkout inicial e confirmação pela InfinitePay;
- pagamentos complementares, com histórico e proteção contra cobranças abertas concorrentes;
- listagem administrativa em `/admin/inscricoes`;
- área do regente com participantes do coro;
- provisionamento de acesso ao app após a confirmação do pagamento inicial.

A situação `payment_status = 'paid'` hoje confirma somente o checkout inicial. Ela não significa necessariamente que o valor normal da inscrição foi integralmente quitado. A interface passará a apresentar uma situação financeira derivada do pagamento inicial e dos complementos confirmados.

## Escopo

### Incluído

- escolha obrigatória de adesão para coros participantes do programa;
- cálculo e exibição do preço conforme a escolha;
- texto positivo sobre pré-inscrição, venda de 25 rifas, saldo e confirmação da vaga;
- situações `Pendente`, `Parcialmente pago`, `Pago` e `Histórico`;
- valor pendente por participante no admin e no regente;
- checkout do saldo total pendente iniciado por administrador ou regente;
- preservação de pagamentos complementares anteriores;
- regras de acesso ao app compatíveis com o estado do pagamento inicial.

### Fora do escopo

- pagamento agrupado de vários participantes;
- cobrança parcial escolhida manualmente a partir da nova interface;
- alteração da quantidade de rifas;
- mudança dos preços globais;
- criação de um novo provedor ou método de pagamento;
- confirmação manual de pagamentos sem validação da InfinitePay;
- aplicação de migração ou publicação remota nesta etapa de desenvolvimento.

## Modelo de dados e compatibilidade

A escolha não criará uma coluna redundante. Ela determinará o snapshot de preço persistido:

- adesão às rifas: `pricing_type = 'promotional'` e `registration_price_cents` igual ao valor promocional;
- não adesão: `pricing_type = 'standard'` e `registration_price_cents` igual ao valor normal.

O servidor receberá a escolha como dado de intenção, buscará novamente o coro e os valores vigentes e produzirá o snapshot confiável. O valor exibido pelo navegador continuará servindo somente para detectar mudança de configuração; nunca será a autoridade do preço.

Inscrições promocionais existentes serão interpretadas como adesão ao programa. Inscrições normais existentes continuarão sem complemento. Nenhum dado histórico será reescrito.

## Situação financeira derivada

Para uma inscrição com snapshots válidos:

`total devido = standard_price_cents`

`principal confirmado = valor inicial confirmado + soma dos pagamentos complementares confirmados`

`valor pendente = max(0, total devido - principal confirmado)`

Taxas do cartão e valores de itens adicionais não entram no complemento das rifas. O cálculo usa o principal da inscrição, mantendo a regra atual do módulo de pagamentos complementares.

Os estados apresentados serão:

| Condição | Situação | Valor pendente | Acesso ao app | Vaga confirmada |
| --- | --- | ---: | --- | --- |
| Registro sem dados financeiros suficientes | Histórico | Não disponível | Tratamento histórico atual | Não inferir |
| Checkout inicial ainda não confirmado | Pendente | Total do checkout inicial | Não | Não |
| Pré-inscrição confirmada e saldo maior que zero | Parcialmente pago | Saldo atual | Sim | Não |
| Pagamento integral inicial confirmado | Pago | R$ 0,00 | Sim | Sim |
| Pré-inscrição e complementos confirmados totalizam o valor normal | Pago | R$ 0,00 | Sim | Sim |

Uma cobrança complementar aberta não reduz o valor pendente. O saldo somente muda depois da confirmação do pagamento pelo provedor.

## Experiência do participante

### Escolha obrigatória

Depois da seleção de um coro participante do programa, o formulário mostrará duas opções sem seleção inicial:

1. **Quero participar do Programa de Venda de Rifas**
2. **Prefiro pagar a inscrição integral**

O participante não poderá avançar ao pagamento enquanto não escolher. Ao trocar de coro, uma escolha incompatível será limpa. Coros que não participam do programa seguirão diretamente com o valor integral e não exibirão a pergunta.

### Mensagem de adesão

Quando houver adesão, o resumo usará o seguinte sentido e tom:

> Você está aderindo ao Programa de Venda de Rifas do seu coro. Com essa escolha, você realiza agora sua pré-inscrição no valor de R$ X e participa da mobilização do grupo com a venda de 25 rifas. Assim que o valor restante de R$ Y for pago, sua inscrição será concluída e sua vaga estará confirmada.

O resumo destacará:

- `Pré-inscrição agora: R$ X`;
- `Valor restante: R$ Y`;
- `Confirmação da vaga: após a quitação do valor restante`.

Quando o participante optar pelo valor integral, o resumo informará que a inscrição integral será paga agora e que a vaga será confirmada após a confirmação desse pagamento.

### Retorno do pagamento inicial

A confirmação distinguirá os dois caminhos:

- adesão: **Pré-inscrição confirmada**, acesso ao app liberado, saldo visível e lembrete positivo de que a vaga será confirmada após a quitação;
- valor integral: **Inscrição confirmada**, acesso ao app liberado e vaga confirmada.

Enquanto o checkout inicial estiver pendente, a página não afirmará que o acesso ou a vaga foram liberados.

## Administração e regência

### `/admin/inscricoes`

A listagem administrativa exibirá, em desktop e mobile:

- situação financeira derivada;
- uma coluna ou campo **Valor pendente**;
- uma ação **Pagar saldo de R$ X** quando houver uma pré-inscrição confirmada e saldo disponível;
- **Continuar pagamento** quando já existir checkout complementar aberto e seguro;
- nenhuma ação de saldo para pagamento inicial pendente, inscrição integral quitada ou registro histórico sem snapshots.

Filtros e resumos administrativos que usam situação financeira passarão a respeitar a situação derivada. Totais pendentes subtrairão complementos já confirmados para não superestimar a receita esperada.

### Área do regente

A lista do regente usará os mesmos rótulos, valores e ações. A interface deixará de solicitar um valor livre: a ação criará uma cobrança pelo saldo total recalculado no servidor.

O histórico existente continuará visível, inclusive quando houver pagamentos complementares parciais antigos. Esses pagamentos serão descontados e o novo checkout cobrará apenas o restante.

## Criação e confirmação do checkout de saldo

O cliente enviará somente o identificador da inscrição. O servidor:

1. confirmará a identidade e a autorização ativa;
2. limitará o regente ao coro associado;
3. buscará a inscrição e os complementos confirmados;
4. rejeitará inscrições sem pagamento inicial confirmado ou sem snapshots coerentes;
5. verificará se já existe uma cobrança aberta;
6. calculará o saldo total atual;
7. reservará esse saldo antes de chamar a InfinitePay;
8. criará o checkout sem dados pessoais na descrição;
9. armazenará somente uma URL HTTPS pertencente aos hosts aceitos da InfinitePay.

A validação no banco continuará repetindo o cálculo sob bloqueio da inscrição, impedindo que requisições concorrentes ultrapassem o saldo. A confirmação continuará consultando a InfinitePay, comparando `order_nsu` e valor e aplicando a transição de forma idempotente.

O caminho de retorno será escolhido no servidor conforme o perfil autenticado. O navegador não poderá fornecer uma URL de retorno arbitrária.

## Acesso ao app

O acesso não dependerá do rótulo renderizado. A regra de servidor continuará baseada na confirmação do pagamento inicial:

- `payment_status = 'pending'`: não provisionar nem autorizar acesso;
- `payment_status = 'paid'` com preço promocional e saldo: provisionar e autorizar acesso, apresentando a inscrição como parcialmente paga;
- `payment_status = 'paid'` sem saldo: provisionar e autorizar acesso, apresentando a inscrição como paga.

Isso separa corretamente acesso ao app de confirmação da vaga.

## Erros e recuperação

- Mudança de preços entre a exibição e o envio pedirá ao participante que confira o novo resumo.
- Ausência de escolha obrigatória manterá o participante na etapa atual e focará o grupo de opções.
- Falha ao criar checkout não modificará a situação financeira.
- Resultado incerto de reserva ou criação não criará automaticamente uma segunda cobrança.
- Checkout aberto com URL segura permitirá continuar; URL ausente ou insegura mostrará estado de processamento sem navegação.
- Confirmação divergente de valor ou transação será rejeitada sem marcar pagamento como pago.
- Falha ao provisionar o acesso após pagamento confirmado continuará recuperável pelos mecanismos administrativos existentes.

## Segurança

- Tabelas financeiras permanecem privadas, com RLS ativa e sem acesso direto de `anon` ou `authenticated`.
- Chaves administrativas e integração InfinitePay permanecem somente no servidor.
- Cada função administrativa aplica `requireAdmin` no servidor.
- Cada função do regente resolve a associação ativa no servidor e limita a consulta ao coro autorizado.
- Parâmetros do navegador, `user_metadata` e rótulos de interface não concedem autorização.
- A cobrança usa o saldo calculado pelo servidor, não um valor fornecido pelo cliente.

## Testes e verificação

O desenvolvimento seguirá TDD e incluirá testes para:

- escolha obrigatória sem valor inicial;
- limpeza ou adaptação da escolha ao trocar de coro;
- cálculo e texto dos caminhos promocional e integral;
- rejeição de combinação incoerente entre escolha e cotação;
- persistência do snapshot promocional ou normal correto;
- estados `Pendente`, `Parcialmente pago`, `Pago` e `Histórico`;
- acesso negado antes do pagamento inicial e liberado depois dele;
- saldo descontando pagamentos complementares confirmados e ignorando cobranças abertas, falhas ou expiradas;
- checkout sempre igual ao saldo total recalculado;
- bloqueio de checkout duplicado e de valor acima do saldo no banco;
- autorização administrativa e isolamento do regente por coro;
- apresentação equivalente em desktop e mobile;
- retorno de pagamento correto para administrador e regente;
- compatibilidade com inscrições e parcelas anteriores.

Ao final serão executados testes focados em modo serial, verificação de tipos, lint dos arquivos alterados, build de produção e inspeção do diff. A aplicação local será validada nas rotas do participante, `/admin/inscricoes` e regente.

## Entrega e limites operacionais

A implementação será feita no worktree isolado `codex/raffle-choice-settlement`, baseado no `origin/main`, para preservar as alterações não relacionadas da cópia principal.

O desenho proposto não exige nova migração: reutiliza os snapshots de preço e a tabela de pagamentos complementares existentes. Caso a implementação revele uma necessidade real de alterar o banco, o trabalho voltará à revisão de desenho antes de criar ou aplicar SQL.

Commit, push, publicação Lovable e mutação remota são etapas independentes. Nenhuma publicação ou alteração remota será inferida a partir da aprovação deste documento.
