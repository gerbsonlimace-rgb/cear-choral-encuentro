# Cadastro de coros e valores de inscrição

## Objetivo

Criar no módulo administrativo um cadastro de coros que alimente a lista do formulário público e determine o valor da inscrição. Para este produto, diocese e coro representam a mesma classificação; a interface passará a usar o termo **Coro**.

O preço será sempre confirmado e calculado no servidor. Alterar o cadastro de um coro não poderá modificar o nome nem o valor registrados em inscrições anteriores.

## Escopo

Esta entrega inclui:

- CRUD administrativo de coros;
- valor de inscrição opcional por coro;
- ativação e inativação sem exclusão física;
- lista pública composta apenas por coros ativos com preço configurado;
- seleção do coro no formulário de inscrição;
- cálculo do pagamento a partir do preço vigente no cadastro;
- preservação do nome e do valor usados em cada inscrição;
- apresentação da distribuição administrativa como inscrições por coro;
- migração local versionada e testes automatizados.

Não fazem parte desta entrega:

- aplicação da migração no Supabase remoto;
- publicação no GitHub ou no Lovable;
- alteração manual de inscrições ou pagamentos existentes;
- cadastro de preços iniciais;
- exclusão física de coros.

## Cadastro inicial

A migração cadastrará, ativos e sem valor definido:

1. Coro Arquidiocesano de Fortaleza
2. Coro Diocesano de Quixadá
3. Coro Diocesano de Crato
4. Coro Diocesano de Sobral
5. Coro Diocesano de Itapipoca
6. Coro Diocesano de Tianguá
7. Coro Litúrgico

Os exemplos de R$ 300,00 e R$ 100,00 não serão gravados automaticamente. Os preços serão preenchidos posteriormente pelo administrador.

## Modelo de dados

### Coros

Uma nova tabela privada `public.choirs` armazenará:

- `id uuid`, chave primária gerada pelo banco;
- `name text`, nome obrigatório sem espaços apenas nas extremidades;
- `registration_price_cents integer`, valor opcional e positivo quando preenchido;
- `is_active boolean`, obrigatório e inicialmente verdadeiro;
- `created_at timestamptz`;
- `updated_at timestamptz`.

O nome será único sem diferenciar maiúsculas e minúsculas depois de remover espaços externos. O valor ficará em centavos para evitar arredondamento monetário. Um valor nulo significa **Não configurado** e impede a exibição pública do coro.

Não haverá exclusão física pelo aplicativo. A ação equivalente a excluir será inativar, permitindo reativação posterior e preservando referências históricas.

### Inscrições

A classificação textual atualmente armazenada em `registrations.diocese` será tratada como uma fotografia do nome do coro. A migração a renomeará para `choir_name` e removerá a restrição que contém a lista fixa de dioceses.

A tabela também receberá `choir_id uuid`, com referência a `public.choirs(id)` e exclusão restrita, e `choir_price_cents integer`, como fotografia do preço-base do coro. Essas colunas poderão permanecer nulas somente para inscrições históricas que não possam ter esses dados comprovados.

Ao criar uma nova inscrição, o servidor gravará:

- o `choir_id` escolhido;
- o nome vigente em `choir_name`;
- o preço-base vigente em `choir_price_cents`;
- o total do preço-base e dos demais componentes do pedido em `amount_cents`.

Assim, renomear, inativar ou alterar o preço do coro não reescreverá inscrições anteriores.

A migração tentará associar registros existentes somente quando houver correspondência determinística entre o nome antigo e um dos sete coros. Registros sem correspondência continuarão preservados, com o texto histórico, `choir_id` nulo e `choir_price_cents` nulo. Nenhum preço histórico será inferido a partir do total pago.

## Segurança e autorização

`public.choirs` terá RLS habilitada e não terá acesso direto concedido a `anon` ou `authenticated`. O cliente administrativo do servidor continuará sendo o único acesso ao banco para essa funcionalidade.

Cada operação de criação, edição, ativação ou inativação aplicará `requireAdmin` no servidor. A proteção visual da rota não será considerada uma fronteira de segurança.

A lista pública será exposta por uma função de servidor separada. Ela retornará somente:

- identificador;
- nome;
- valor da inscrição.

Essa função filtrará `is_active = true` e `registration_price_cents is not null`. Datas administrativas e coros indisponíveis não serão enviados ao navegador público.

## Fluxo administrativo

A área administrativa ganhará navegação entre **Inscrições** e **Coros**. A rota `/admin/coros` seguirá a identidade visual e o comportamento responsivo do painel existente.

A tela terá:

- tabela ou cartões responsivos com nome, valor e situação;
- botão **Cadastrar coro**;
- ação **Editar**;
- ação **Inativar**, com confirmação;
- ação **Reativar**;
- estado **Não configurado** para preço vazio;
- retorno imediato de carregamento, sucesso e falha.

O formulário de cadastro e edição aceitará nome, valor em reais e situação. O valor poderá ser apagado para voltar ao estado não configurado. A interface normalizará reais para centavos antes de enviar ao servidor, e o servidor repetirá toda a validação.

Serão rejeitados:

- nome vazio;
- nome duplicado, inclusive com diferença apenas de caixa ou espaços externos;
- valor zero ou negativo;
- valor com mais de duas casas decimais;
- identificador inexistente.

Erros não apagarão os campos preenchidos. Depois de uma mutação concluída, a listagem será recarregada a partir do registro persistido.

## Fluxo público de inscrição

O formulário público carregará os coros disponíveis pela função pública de servidor. O campo atualmente chamado **Diocese** passará a se chamar **Coro** e armazenará o identificador selecionado.

Antes de uma escolha, a página não exibirá um preço de inscrição fixo. Depois da seleção, mostrará o valor daquele coro e recalculará o total com a camisa, quando escolhida.

No envio, o navegador mandará o identificador do coro, nunca um preço confiável. O servidor consultará novamente o cadastro e exigirá que o coro ainda esteja ativo e com valor preenchido. Em seguida, calculará os itens e o total e criará a inscrição pendente.

Se o preço for alterado ou o coro for inativado enquanto o formulário estiver aberto, o servidor recusará a seleção antiga. A interface preservará os demais campos, recarregará a lista e pedirá uma nova escolha.

Se nenhum coro estiver disponível, o formulário informará que as inscrições ainda não estão disponíveis e não permitirá iniciar o pagamento.

## Checkout e histórico

O item principal enviado à InfinitePay usará o preço obtido no cadastro do coro. A camisa continuará sendo somada separadamente conforme a regra já existente.

O valor conferido durante a confirmação do pagamento continuará sendo o `amount_cents` gravado na inscrição. `choir_price_cents` permitirá apresentar o preço-base histórico separadamente do valor da camisa. Nenhuma confirmação posterior consultará o preço atual do coro.

Inscrições antigas continuarão visíveis no painel. A coluna e o resumo usarão o rótulo **Coro**; quando o registro antigo tiver apenas o texto histórico, esse texto será exibido normalmente.

## Componentes e responsabilidades

A implementação será dividida em unidades pequenas:

- domínio de coros: esquemas, tipos, normalização de preço e regras de disponibilidade;
- repositório de coros no servidor: leituras e mutações no Supabase;
- funções de servidor: contrato público e contratos administrativos protegidos;
- página administrativa: listagem, formulário e ações;
- formulário público: carregamento, seleção e apresentação do preço;
- domínio de inscrição: validação do identificador e construção de itens com preço resolvido no servidor;
- migração: tabela, segurança, dados iniciais e vínculo histórico;
- tipos do Supabase: representação estática do novo esquema.

Uma navegação administrativa compartilhada evitará duplicar os links e o encerramento de sessão entre as páginas de inscrições e coros.

## Tratamento de erros

Mensagens ao público e ao administrador não incluirão detalhes do Supabase, nomes de variáveis ou credenciais.

Falhas ao listar coros mostrarão uma opção de tentar novamente. Falhas ao salvar manterão o formulário aberto. Duplicidade será apresentada como conflito de nome. Indisponibilidade ou mudança de preço durante a inscrição será tratada como estado desatualizado, não como pagamento iniciado.

Nenhuma falha apagará inscrições existentes ou excluirá coros.

## Testes e verificação

A implementação seguirá TDD e cobrirá:

- conversão exata de reais para centavos;
- rejeição de preço inválido e nome duplicado;
- filtro da lista pública por situação e preço;
- autorização em toda operação administrativa;
- criação, edição, inativação e reativação;
- migração, RLS, restrições, sementes e preservação histórica;
- carregamento e estados da página administrativa;
- formulário público sem opções disponíveis;
- atualização visual do preço ao selecionar um coro;
- preservação dos campos após seleção desatualizada;
- cálculo do checkout com o preço resolvido no servidor;
- persistência do nome e do valor históricos;
- confirmação de pagamento contra o valor gravado no pedido;
- resumo administrativo por coro;
- comportamento responsivo essencial das duas páginas administrativas.

Ao final serão executados os testes focados, a suíte serial do projeto, TypeScript, lint dos arquivos alterados, verificação das migrações e build de produção. A aplicação remota da migração, o push e a validação no Lovable continuarão como etapas separadas, dependentes de autorização explícita.
