# Cadastro de coros e preços globais do evento

## Objetivo

Criar no módulo administrativo um cadastro de coros/dioceses que alimente a lista do formulário público. O valor normal, o valor promocional e o valor da camisa serão configurações globais do evento. Cada coro terá um indicador que determina automaticamente qual valor de inscrição será aplicado.

Para este produto, diocese e coro representam a mesma classificação. O participante apenas escolhe seu coro/diocese; ele não escolhe nem pode alterar manualmente o tipo de preço.

O preço será sempre resolvido e calculado novamente no servidor. Alterações futuras na configuração não poderão modificar os dados financeiros de inscrições anteriores.

## Escopo

Esta entrega inclui:

- configuração administrativa do valor normal global;
- configuração administrativa do valor promocional global;
- configuração administrativa do valor global da camisa;
- CRUD administrativo de coros/dioceses;
- indicador de promoção em cada coro;
- ativação e inativação sem exclusão física;
- lista pública composta apenas por coros ativos cujo preço aplicável esteja configurado;
- aplicação automática do valor normal ou promocional ao selecionar o coro;
- aviso sobre o subsídio por venda de rifas quando a promoção for aplicada;
- opção de incluir camisa e escolher tamanho quando seu valor estiver configurado;
- cálculo do pagamento a partir da configuração vigente;
- fotografia do coro, dos preços e do tipo aplicado em cada inscrição;
- apresentação da distribuição administrativa como inscrições por coro;
- migração local versionada e testes automatizados.

Não fazem parte desta entrega:

- aplicação da migração no Supabase remoto;
- publicação no GitHub ou no Lovable;
- alteração manual de inscrições ou pagamentos existentes;
- valores ou coros cadastrados inicialmente;
- escolha manual do tipo de preço pelo participante;
- exclusão física de coros.

## Estado inicial

A migração não cadastrará coros nem definirá preços. O administrador fará todo o preenchimento pela interface.

Enquanto não houver configuração suficiente, o formulário público mostrará somente os coros para os quais seja possível resolver um preço. Se nenhum coro estiver disponível, a inscrição ficará indisponível sem apresentar um valor inventado.

## Modelo de dados

### Configuração global

Uma nova tabela privada `public.event_registration_settings` manterá uma única configuração ativa:

- `id boolean`, chave fixa que garante uma única linha;
- `standard_price_cents integer`, valor normal opcional e positivo quando preenchido;
- `promotional_price_cents integer`, valor promocional opcional e positivo quando preenchido;
- `shirt_price_cents integer`, valor opcional e positivo da camisa;
- `created_at timestamptz`;
- `updated_at timestamptz`.

A migração criará apenas a linha estrutural, com os três valores nulos. Os valores serão armazenados em centavos para evitar arredondamento monetário.

Quando os dois valores estiverem preenchidos, o promocional deverá ser menor que o normal. A interface permitirá limpar um valor para retornar ao estado **Não configurado**.

### Coros

Uma nova tabela privada `public.choirs` armazenará:

- `id uuid`, chave primária gerada pelo banco;
- `name text`, nome obrigatório sem espaços apenas nas extremidades;
- `uses_promotional_price boolean`, obrigatório e inicialmente falso;
- `is_active boolean`, obrigatório e inicialmente verdadeiro;
- `created_at timestamptz`;
- `updated_at timestamptz`.

O nome será único sem diferenciar maiúsculas e minúsculas depois de remover espaços externos.

Não haverá exclusão física pelo aplicativo. A ação equivalente a excluir será inativar, permitindo reativação posterior e preservando referências históricas.

### Inscrições

A classificação textual atualmente armazenada em `registrations.diocese` será tratada como uma fotografia do nome do coro. A migração a renomeará para `choir_name` e removerá a restrição que contém a lista fixa de dioceses.

A tabela `public.registrations` também receberá:

- `choir_id uuid`, referência a `public.choirs(id)` com exclusão restrita;
- `pricing_type text`, restrito a `standard` ou `promotional` quando preenchido;
- `standard_price_cents integer`, fotografia do valor normal vigente;
- `registration_price_cents integer`, fotografia do preço-base efetivamente aplicado;
- `shirt_price_cents integer`, fotografia do preço da camisa, nula quando não incluída ou quando o registro é histórico sem valor comprovado.

Esses campos poderão permanecer nulos apenas nos registros históricos que já existiam antes da nova regra. Nenhum preço histórico será inferido a partir do valor total ou do valor pago.

Restrições do banco exigirão que novas inscrições preencham em conjunto a referência e as fotografias financeiras. Para preço normal, `registration_price_cents` deverá ser igual a `standard_price_cents`; para preço promocional, deverá ser menor. Valores históricos nulos continuarão aceitos sem preencher dados retroativamente.

Ao criar uma nova inscrição, o servidor gravará:

- o identificador e o nome vigentes do coro;
- o tipo de preço determinado pelo indicador do coro;
- o valor normal vigente;
- o preço-base normal ou promocional efetivamente aplicado;
- o valor vigente da camisa quando ela for incluída;
- o total em `amount_cents`, formado pelo preço-base e pelos demais itens do pedido.

Assim, renomear ou inativar um coro e alterar qualquer valor global não reescreverá inscrições anteriores. Como nenhum coro será criado pela migração, inscrições antigas manterão o texto histórico e começarão sem associação automática a um novo coro.

## Resolução automática do preço

A regra terá uma única fonte de verdade no servidor:

1. Receber o identificador do coro selecionado.
2. Consultar o coro e a configuração global atual.
3. Exigir que o coro esteja ativo.
4. Se `uses_promotional_price` for verdadeiro, exigir e aplicar `promotional_price_cents`.
5. Caso contrário, exigir e aplicar `standard_price_cents`.
6. Exigir também o valor normal para registrar a referência financeira e compor o aviso da promoção.
7. Construir os itens do checkout e persistir as fotografias financeiras.

O navegador nunca decidirá o preço. Ele receberá uma cotação para exibição, mas o servidor repetirá a resolução antes de criar o pagamento.

Para detectar uma configuração alterada enquanto o formulário está aberto, o envio incluirá a cotação exibida como dado não confiável. O servidor comparará tipo, valor de inscrição e valor da camisa exibidos com sua resolução atual. Se houver divergência, recusará o início do checkout e solicitará nova confirmação da seleção.

## Segurança e autorização

`public.event_registration_settings` e `public.choirs` terão RLS habilitada e não terão acesso direto concedido a `anon` ou `authenticated`. O cliente administrativo exclusivo do servidor continuará sendo a única camada com acesso direto para essa funcionalidade.

Cada leitura administrativa e operação de configuração, criação, edição, ativação ou inativação aplicará `requireAdmin` no servidor. A proteção visual da rota não será considerada uma fronteira de segurança.

A lista pública será exposta por uma função de servidor separada. Ela retornará apenas os dados necessários à escolha e à apresentação:

- identificador;
- nome;
- tipo de preço resolvido;
- valor normal;
- valor aplicado;
- valor da camisa, ou nulo quando ela estiver indisponível.

Essa função filtrará coros inativos e coros cujo preço aplicável não possa ser resolvido. Um coro normal exige o valor normal; um coro promocional exige tanto o valor normal quanto o promocional, pois os dois aparecem no aviso. Datas administrativas e configurações incompletas não serão expostas.

## Fluxo administrativo

A área administrativa ganhará navegação entre **Inscrições** e **Coros e valores**. A rota `/admin/coros` seguirá a identidade visual e o comportamento responsivo do painel existente.

No topo haverá o cartão **Valores do evento**, com:

- campo **Valor normal**;
- campo **Valor promocional**;
- campo **Valor da camisa**;
- estado **Não configurado** para campos vazios;
- ação explícita para salvar;
- mensagens imediatas de carregamento, sucesso e falha.

Abaixo haverá o cadastro de coros, com:

- tabela ou cartões responsivos com nome, tipo de preço e situação;
- botão **Cadastrar coro**;
- ação **Editar**;
- ação **Inativar**, com confirmação;
- ação **Reativar**.

O formulário de coro aceitará nome, situação e o indicador **Aplicar valor promocional**. Marcar esse indicador não replica nem grava um preço no coro; apenas escolhe qual configuração global será resolvida.

Se o valor correspondente ainda não estiver configurado, a tela permitirá salvar o coro, mas mostrará que ele continuará oculto na inscrição pública.

Serão rejeitados:

- nome vazio;
- nome duplicado, inclusive com diferença apenas de caixa ou espaços externos;
- valor zero ou negativo;
- valor com mais de duas casas decimais;
- valor promocional maior ou igual ao normal quando ambos estiverem preenchidos;
- identificador inexistente.

Erros não apagarão os campos preenchidos. Depois de uma mutação concluída, a interface recarregará os dados persistidos.

## Fluxo público de inscrição

O formulário público carregará os coros disponíveis pela função pública de servidor. O campo atualmente chamado **Diocese** passará a se chamar **Coro/Diocese** e armazenará o identificador selecionado.

Antes da seleção, não haverá preço fixo atribuído ao pedido. Ao selecionar um coro:

- o preço normal será exibido quando o indicador promocional estiver desativado;
- o preço promocional será selecionado automaticamente quando o indicador estiver ativado;
- o participante não verá controles para trocar o tipo de preço;
- o total será recalculado com a camisa, quando escolhida.

A opção **Incluir camisa oficial** e a escolha de tamanho serão exibidas somente quando o valor da camisa estiver configurado. A promoção será aplicada apenas ao preço-base da inscrição; a camisa manterá o mesmo valor para todos os coros.

Quando o preço promocional for aplicado, a página destacará um aviso com valores dinâmicos baseado neste texto:

> Valor promocional para este coro: R$ 100,00. O valor normal do evento é R$ 300,00. A diferença será subsidiada pela venda de rifas, e o coralista deverá participar dessa ação.

Os valores do exemplo serão substituídos pelos valores globais vigentes. O aviso é informativo e não exige uma caixa adicional de aceite.

Se qualquer preço mudar ou o coro for inativado enquanto o formulário estiver aberto, o servidor recusará a cotação desatualizada. A interface preservará os demais campos, recarregará as opções e pedirá que o participante confirme novamente o coro. Se a camisa ficar indisponível, ela será removida do pedido e o participante verá a alteração antes de tentar novamente.

Se nenhum coro estiver disponível, o formulário informará que as inscrições ainda não estão disponíveis e não permitirá iniciar o pagamento.

## Checkout e histórico

O item principal enviado à InfinitePay usará exclusivamente o preço resolvido no servidor. A camisa será somada separadamente pelo valor global vigente e somente quando tiver sido escolhida com tamanho válido.

O valor conferido durante a confirmação do pagamento continuará sendo o `amount_cents` gravado na inscrição. `standard_price_cents`, `registration_price_cents`, `shirt_price_cents` e `pricing_type` permitirão comprovar posteriormente o benefício e os itens aplicados. Nenhuma confirmação consultará os preços atuais.

Inscrições antigas continuarão visíveis no painel. A coluna e o resumo usarão o rótulo **Coro**; quando o registro antigo tiver apenas o texto histórico, esse texto será exibido normalmente.

## Componentes e responsabilidades

A implementação será dividida em unidades pequenas:

- domínio de configuração: esquemas, tipos e conversão monetária;
- domínio de coros: esquemas, tipos e regras de disponibilidade;
- repositório no servidor: leituras e mutações no Supabase;
- funções de servidor: contrato público e contratos administrativos protegidos;
- página administrativa: valores globais, listagem, formulário e ações;
- formulário público: carregamento, seleção, cotação automática e aviso;
- domínio de inscrição: validação da cotação e construção dos itens com preço resolvido;
- migração: tabelas, segurança e preservação histórica;
- tipos do Supabase: representação estática do novo esquema.

Uma navegação administrativa compartilhada evitará duplicar os links e o encerramento de sessão entre as páginas de inscrições e coros.

## Tratamento de erros

Mensagens ao público e ao administrador não incluirão detalhes do Supabase, nomes de variáveis ou credenciais.

Falhas ao listar configurações ou coros mostrarão uma opção de tentar novamente. Falhas ao salvar manterão o formulário aberto. Duplicidade será apresentada como conflito de nome. Indisponibilidade ou mudança de preço durante a inscrição será tratada como cotação desatualizada, antes do pagamento.

Nenhuma falha apagará inscrições existentes ou excluirá coros.

## Testes e verificação

A implementação seguirá TDD e cobrirá:

- conversão exata de reais para centavos;
- validação dos dois valores globais e da relação entre eles;
- rejeição de preço inválido e nome duplicado;
- filtro da lista pública por situação e configuração aplicável;
- autorização em toda leitura e mutação administrativa;
- criação, edição, inativação e reativação de coros;
- migração, RLS, restrições, configuração vazia e preservação histórica;
- carregamento e estados da página administrativa;
- formulário público sem opções disponíveis;
- seleção automática do preço normal;
- seleção automática do preço promocional;
- apresentação dinâmica do aviso de rifas;
- ausência de escolha manual do tipo de preço;
- atualização visual do total ao selecionar o coro ou a camisa;
- ocultação da camisa enquanto seu valor não estiver configurado;
- uso e persistência do valor global da camisa;
- preservação dos campos após uma cotação desatualizada;
- cálculo do checkout com o preço resolvido no servidor;
- rejeição de preço, tipo ou coro manipulados no navegador;
- persistência das fotografias de coro e preço;
- confirmação do pagamento contra o total gravado no pedido;
- resumo administrativo por coro;
- comportamento responsivo essencial das páginas administrativas.

Ao final serão executados os testes focados, a suíte serial do projeto, TypeScript, lint dos arquivos alterados, verificação das migrações e build de produção. A aplicação remota da migração, o push e a validação no Lovable continuarão como etapas separadas, dependentes de autorização explícita.
