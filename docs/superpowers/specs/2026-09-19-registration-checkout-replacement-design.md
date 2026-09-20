# Substituição segura do checkout pendente da inscrição

## Objetivo

Quando um participante editar uma inscrição ainda não paga e avançar novamente, o sistema deverá persistir os dados atuais e usar um checkout compatível com eles. Mudanças no telefone, nome, e-mail, valor ou condições financeiras deverão gerar um novo checkout da InfinitePay. O checkout anterior deixará de ser oferecido pelo sistema.

A API pública do Checkout Integrado documenta criação de links e consulta de pagamentos, mas não oferece uma operação para cancelar ou expirar um checkout pendente. Portanto, “cancelar” neste desenho significa substituí-lo de forma lógica no sistema. O link anterior poderá continuar tecnicamente utilizável na InfinitePay; se ele for pago, o pagamento será verificado, preservado e encaminhado para revisão administrativa, sem confirmar automaticamente a inscrição atual.

Referência do provedor: [Como usar o Checkout Integrado da InfinitePay](https://ajuda.infinitepay.io/pt-BR/articles/10766888-como-usar-o-checkout-integrado-da-infinitepay).

## Contexto e causa do problema

O fluxo atual procura uma inscrição pelo CPF e, quando encontra um registro pendente com `checkout_url`, devolve imediatamente esse endereço. Essa saída acontece antes de:

- validar novamente a cotação vigente;
- comparar os dados enviados à InfinitePay;
- atualizar a inscrição no Supabase;
- criar um novo `order_nsu`.

Como consequência, o navegador mostra os dados editados, mas a InfinitePay recebe o link criado anteriormente, com o telefone e o valor antigos. Edições que não afetam o checkout também deixam de ser persistidas por causa da mesma saída antecipada.

## Escopo

### Incluído

- persistir todas as edições válidas de uma inscrição pendente;
- reutilizar o checkout atual somente quando o contrato financeiro e os dados enviados ao provedor permanecerem iguais;
- substituir o checkout quando nome, e-mail, telefone, itens, valor ou snapshots de preço mudarem;
- manter um histórico privado dos checkouts substituídos;
- reconhecer e verificar pagamentos tardios de checkouts substituídos;
- mostrar pagamentos tardios como pendentes de revisão administrativa;
- manter a proteção atual contra concorrência, cliques repetidos e confirmações duplicadas;
- testes automatizados do fluxo de substituição, concorrência e conciliação.

### Fora do escopo

- prometer o cancelamento remoto de um link que a API documentada da InfinitePay não permite cancelar;
- estorno automático;
- decisão automática sobre como aproveitar um pagamento tardio de valor diferente;
- alteração de preços ou das regras do Programa de Rifas;
- aplicação de migração no Supabase de produção;
- push, publicação no Lovable ou teste financeiro real.

## Comportamento esperado

Antes de decidir entre reutilizar ou substituir um checkout, o servidor sempre resolverá o coro e a cotação confiável e calculará os itens e o valor final.

O checkout existente poderá ser reutilizado somente quando todos estes dados continuarem iguais aos snapshots persistidos:

- nome, e-mail e telefone normalizado enviados à InfinitePay;
- itens e valor total;
- tipo de preço;
- valor normal, valor inicial e eventual saldo promocional.

Campos que não alteram o contrato do checkout, como nome do crachá ou perfil musical, serão atualizados na inscrição sem criar um novo link. Se qualquer dado do contrato mudar, o checkout atual será arquivado como substituído e um novo `order_nsu` será reservado antes de chamar a InfinitePay.

Requisições simultâneas para a mesma inscrição não criarão dois checkouts ativos. A primeira reservará a substituição; as demais aguardarão o resultado e receberão o mesmo link novo ou uma mensagem temporária de processamento.

## Modelo de dados

Uma nova tabela privada, `registration_superseded_checkouts`, registrará somente as tentativas substituídas. A inscrição continuará representando o checkout inicial atualmente ativo, preservando a compatibilidade com as telas e consultas existentes.

A tabela terá, no mínimo:

- `id uuid primary key`;
- `registration_id uuid not null` com referência restrita à inscrição;
- `order_nsu uuid not null unique`;
- `checkout_url text not null` restrita a HTTPS e aos hosts aceitos da InfinitePay;
- `amount_cents integer not null` e positivo;
- snapshots `pricing_type`, `standard_price_cents`, `registration_price_cents` e `remaining_price_cents`;
- `status text not null`, restrito a `superseded` e `paid_requires_review`;
- dados de conciliação da InfinitePay: fatura, transação, método, parcelas, valor pago, comprovante e horário;
- `superseded_at timestamptz not null`;
- `paid_at timestamptz` somente quando o pagamento tardio estiver confirmado.

Dados pessoais antigos não serão duplicados nessa tabela. O valor e os snapshots financeiros são suficientes para conciliar a tentativa, enquanto os dados atuais do participante permanecem na inscrição.

A tabela terá RLS ativa, nenhum acesso para `anon` ou `authenticated` e permissões somente para o servidor. `order_nsu` e identificador de transação serão únicos quando presentes.

## Operações atômicas

Uma função transacional de banco substituirá o checkout sob bloqueio da inscrição. Ela deverá:

1. localizar a inscrição pendente pelo identificador e bloquear a linha;
2. exigir o `order_nsu` esperado para impedir atualização perdida;
3. arquivar o checkout ativo e seus snapshots como `superseded`;
4. atualizar todos os dados atuais da inscrição;
5. gravar o novo `order_nsu`, valor, snapshots de preço e marcador temporário de criação;
6. retornar sucesso somente se toda a operação for concluída.

A função será `security invoker`, terá `search_path` fixo e permissão de execução revogada de `public`, `anon` e `authenticated`. Somente `service_role` poderá executá-la.

Quando o checkout puder ser reutilizado, uma atualização condicional separada persistirá os demais dados da inscrição sem alterar `order_nsu`, `checkout_url` ou os snapshots já comparados.

## Fluxo de criação e substituição

1. Validar a identidade da inscrição pelo CPF e data de nascimento.
2. Resolver coro, regras e cotação atual exclusivamente no servidor.
3. Calcular os itens e o valor que serão enviados à InfinitePay.
4. Comparar esse contrato com o checkout ativo persistido.
5. Se forem iguais, atualizar os demais dados e devolver o checkout atual.
6. Se forem diferentes, enviar a nova foto para um caminho associado ao novo pedido, quando aplicável.
7. Executar a substituição atômica, arquivando o checkout anterior.
8. Criar o novo checkout com nome, e-mail, telefone normalizado, itens e valor atuais.
9. Salvar a URL somente se a inscrição ainda estiver pendente e possuir o mesmo `order_nsu` reservado.
10. Redirecionar o participante somente para a nova URL salva.

Uma falha antes da reserva não modifica a inscrição. Uma falha depois da reserva mantém o registro completo e recuperável, sem reativar automaticamente o checkout antigo. Fotos anteriores somente serão removidas depois que a nova referência estiver persistida com segurança.

## Conciliação de pagamento tardio

O webhook e o retorno público continuarão tratando seus dados apenas como aviso. Toda confirmação consultará `payment_check` e comparará o valor com o snapshot local.

Para um `order_nsu` ativo, o fluxo existente confirmará a inscrição de forma idempotente. Para um `order_nsu` arquivado:

1. localizar a tentativa substituída;
2. consultar `payment_check` na InfinitePay;
3. exigir pagamento confirmado e valor original exato;
4. gravar a transação como `paid_requires_review` de forma idempotente;
5. não alterar `registrations.payment_status` nem o checkout atual;
6. responder com sucesso ao webhook depois da persistência;
7. registrar um alerta técnico sem expor dados pessoais desnecessários.

No retorno de um pagamento tardio, o participante verá: “Pagamento recebido e em análise. Não realize outro pagamento.” A interface não oferecerá imediatamente o checkout novo nesse estado.

## Revisão administrativa

Os detalhes da inscrição no painel administrativo mostrarão um alerta quando existir um checkout substituído com pagamento confirmado. O alerta incluirá valor, data, método, identificador e comprovante quando disponíveis, mas não decidirá automaticamente entre confirmação, aproveitamento de saldo ou estorno.

A resolução financeira continuará manual nesta entrega. Automatizar estorno ou converter o pagamento em outra modalidade exigirá um desenho próprio e autorização separada.

## Erros e observabilidade

- Cotação divergente será rejeitada antes de substituir o checkout.
- Falha ao arquivar ou reservar o novo pedido deixará o checkout anterior intacto.
- Falha na InfinitePay depois da reserva manterá estado recuperável e mostrará erro temporário.
- Uma URL externa ou insegura nunca será reutilizada nem persistida.
- Divergência de valor em tentativa substituída será registrada como erro de conciliação e não confirmará a inscrição.
- Repetição do mesmo webhook produzirá o mesmo estado sem duplicar pagamentos ou alertas.
- Logs e monitoramento usarão identificadores técnicos; dados pessoais não serão incluídos além do limite de privacidade já adotado pelo projeto.

## Testes e critérios de aceite

O desenvolvimento seguirá TDD e não criará cobranças reais. Os testes deverão comprovar:

- reprodução do defeito: checkout de R$ 100 e telefone antigo não pode ser devolvido depois da mudança para R$ 300 e telefone novo;
- criação de novo `order_nsu` e payload com os dados atuais;
- arquivamento do checkout anterior antes da substituição;
- persistência de edições não financeiras sem gerar um novo checkout;
- reutilização quando o contrato enviado ao provedor não mudou;
- comparação com preço confiável do servidor, nunca com valor fornecido pelo navegador;
- normalização correta do telefone brasileiro;
- somente um checkout ativo diante de envios concorrentes;
- recuperação de marcador de criação obsoleto;
- confirmação normal do pedido ativo;
- conciliação idempotente de pagamento tardio como `paid_requires_review`;
- pagamento tardio não altera automaticamente a inscrição nem a marca como paga;
- mensagem pública para não pagar novamente;
- alerta correspondente nos detalhes administrativos;
- políticas, restrições e permissões da nova tabela e função;
- testes focados em modo serial, verificação de tipos, lint dos arquivos alterados e build de produção.

## Entrega e implantação

A implementação será feita no worktree isolado `codex/checkout-refresh-design`, baseado em `origin/main`, preservando as alterações da cópia principal.

Código, migração versionada e testes poderão ser preparados localmente após aprovação desta especificação e do plano de implementação. Aplicar a migração no projeto Supabase de produção `mtkjsrbywymwixwscosf`, publicar no GitHub ou declarar implantação no Lovable exigirá autorização explícita e verificação independente de cada etapa.
