# Integração de inscrições com InfinitePay

## Objetivo

Substituir o pagamento Pix demonstrativo por um checkout real da InfinitePay, mantendo Pix com taxa zero nas condições comerciais vigentes e oferecendo cartão com a taxa repassada ao participante. Uma inscrição só será considerada confirmada depois que o servidor verificar o pagamento diretamente na InfinitePay.

## Escopo

Esta primeira versão inclui:

- gravação da inscrição e da opção de camisa no Supabase;
- cálculo do valor exclusivamente no servidor;
- criação de checkout hospedado pela InfinitePay para a InfiniteTag `antonio-gerbson`;
- Pix e cartão, com parcelamento conforme a configuração da conta InfinitePay;
- retorno do checkout para uma página de confirmação do evento;
- confirmação automática por webhook e verificação ativa do pagamento;
- armazenamento dos identificadores e dados de conciliação;
- testes automatizados e compilação do site.

Não fazem parte desta versão:

- envio de e-mail ou WhatsApp;
- painel administrativo;
- cancelamento ou estorno automatizado;
- aplicação da migração no banco remoto;
- publicação no GitHub ou Lovable;
- configuração da conta InfinitePay. O repasse das taxas do cartão deverá estar habilitado na própria conta.

## Arquitetura

A integração ficará no servidor TanStack Start já utilizado pelo projeto. O navegador nunca enviará um valor final confiável nem terá acesso à chave administrativa do Supabase.

As responsabilidades serão separadas em quatro unidades:

1. **Domínio de inscrição:** valida os campos e calcula os itens e o total em centavos.
2. **Cliente InfinitePay:** cria o checkout e consulta o estado do pagamento.
3. **Persistência:** grava a inscrição pendente e confirma o pagamento de forma idempotente no Supabase.
4. **Interface:** envia o formulário, redireciona ao checkout e apresenta o resultado verificado.

O endpoint público de webhook apenas aceitará o evento como um aviso. Antes de confirmar qualquer inscrição, o servidor consultará a InfinitePay usando os identificadores recebidos e comparará o pedido com o registro local.

## Fluxo de criação do checkout

1. O participante preenche e envia o formulário.
2. O servidor valida os dados com o esquema Zod.
3. O servidor monta os itens: inscrição por R$ 100,00 e, quando selecionada, camisa por R$ 39,90.
4. O servidor gera um identificador único `order_nsu` e grava a inscrição como `pending`.
5. O servidor chama `POST https://api.checkout.infinitepay.io/links` com a InfiniteTag, os itens, `order_nsu`, dados do participante, URL de retorno e URL do webhook.
6. O endereço do checkout retornado é salvo e enviado ao navegador.
7. O navegador redireciona o participante para o checkout hospedado pela InfinitePay.

Se a criação do checkout falhar, a inscrição permanecerá pendente para auditoria e o erro será apresentado sem apagar o formulário. O botão ficará bloqueado enquanto a solicitação estiver em andamento para evitar cliques repetidos.

## Fluxo de confirmação

A confirmação pode começar pelo webhook ou pelo retorno do participante. Os dois caminhos usam a mesma operação de conciliação:

1. Validar o formato dos identificadores recebidos.
2. Localizar a inscrição pelo `order_nsu`.
3. Consultar `POST https://api.checkout.infinitepay.io/payment_check` no servidor.
4. Exigir `success=true`, `paid=true`, o mesmo `order_nsu` e o mesmo valor original esperado.
5. Aceitar `paid_amount` maior que o valor original quando a diferença representar a taxa do cartão repassada ao participante.
6. Registrar forma de pagamento, parcelas, identificador da transação, comprovante e horário da confirmação.
7. Alterar o estado para `paid` em uma operação idempotente.

Parâmetros da URL de retorno e o corpo do webhook nunca serão suficientes, isoladamente, para confirmar uma inscrição. Eventos repetidos deverão produzir o mesmo resultado sem duplicação.

## Modelo de dados

A tabela privada `registrations` continuará sem acesso direto para `anon` ou `authenticated`. A migração acrescentará:

- `include_shirt boolean not null default false`;
- `shirt_size text` com consistência em relação a `include_shirt`;
- `amount_cents integer`, obrigatório e positivo para pedidos novos, mas nulo para registros antigos cujo valor não possa ser comprovado;
- `payment_status text not null default 'pending'`, restrito a `legacy`, `pending` e `paid`;
- `order_nsu uuid unique`, obrigatório para pedidos novos e nulo somente em registros antigos;
- `checkout_url text`;
- `infinitepay_invoice_slug text`;
- `infinitepay_transaction_nsu text` com unicidade quando preenchido;
- `payment_method text`, restrito a `pix` e `credit_card` quando preenchido;
- `installments integer` positivo quando preenchido;
- `paid_amount_cents integer` positivo quando preenchido;
- `receipt_url text`;
- `paid_at timestamptz`.

A consistência entre camisa, tamanho, situação do pagamento e dados de confirmação também será protegida por restrições no banco. Somente funções de servidor com a chave `service_role` poderão inserir ou alterar inscrições.

A migração preservará eventuais registros existentes. Eles serão classificados como `legacy`, sem inventar valor, pedido ou situação de pagamento. Depois desse preenchimento inicial, o padrão da coluna será alterado para `pending`, e todos os novos registros terão valor e `order_nsu` obrigatórios.

## Interface

O Pix fictício e o QR ilustrativo serão removidos. O formulário exibirá um botão “Continuar para pagamento” e, durante o envio, “Preparando pagamento…”.

Após o checkout, uma página própria apresentará um destes estados:

- **Confirmado:** inscrição garantida, forma de pagamento e link do comprovante;
- **Processando:** verificação automática por um período curto;
- **Não confirmado:** orientação para não realizar outro pagamento e ação “Verificar novamente”;
- **Erro temporário:** mensagem clara e possibilidade de tentar a verificação novamente.

Se o checkout for abandonado, a inscrição continuará pendente e não será tratada como vaga confirmada. A consulta pública do resultado devolverá somente informações de pagamento necessárias à tela, sem expor os dados pessoais da inscrição.

## Configuração

A InfiniteTag padrão será `antonio-gerbson`, usada somente no servidor. O endereço público do site será configurável para compor as URLs de retorno e webhook, com o domínio publicado do projeto como valor de produção.

Nenhum segredo novo da InfinitePay é exigido pela API pública documentada. As credenciais administrativas do Supabase permanecerão em variáveis exclusivas do servidor. O código não incluirá valores sensíveis.

## Tratamento de erros e observabilidade

- Falhas de validação retornarão mensagens específicas ao formulário.
- Falhas da InfinitePay não converterão a inscrição para paga.
- Falhas de banco durante o webhook retornarão erro para permitir nova tentativa do provedor.
- Respostas externas inesperadas serão rejeitadas e registradas sem incluir dados pessoais ou credenciais nos logs.
- A confirmação será idempotente por `order_nsu` e `infinitepay_transaction_nsu`.
- Divergências de valor, pedido ou transação serão registradas como erro de conciliação e exigirão análise manual.

## Testes e critérios de aceite

Os testes usarão respostas simuladas da InfinitePay e não criarão cobranças reais.

Devem ser comprovados:

- cálculo correto da inscrição com e sem camisa;
- rejeição de tamanho ausente quando há camisa;
- payload correto para a criação do checkout;
- preservação do formulário quando a criação falha;
- redirecionamento somente após a criação bem-sucedida;
- confirmação válida para Pix e cartão;
- aceitação do valor pago maior no cartão, mantendo o valor original exato;
- rejeição de pagamento inexistente, pedido divergente ou valor original divergente;
- repetição segura do webhook;
- exposição apenas do estado necessário na página pública;
- compilação completa do projeto.

## Implantação

A entrega inicial será somente local: código, testes e migração versionada. Aplicar a migração no Supabase remoto e publicar no GitHub/Lovable serão ações posteriores e exigirão autorização específica. Depois da publicação, o fluxo deverá ser validado com uma cobrança real de baixo valor ou com o menor cenário permitido pela operação, mediante autorização separada.
