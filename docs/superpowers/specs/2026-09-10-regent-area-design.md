# Área do regente e pagamentos complementares

## Contexto

O projeto já possui autenticação administrativa com Supabase Auth, cadastro de coros, preços normal e promocional configurados globalmente, inscrições associadas a um coro e checkout da InfinitePay. A nova funcionalidade acrescentará um perfil de regente vinculado a um único coro, uma área compartilhada com administradores e um histórico próprio para pagamentos parciais do complemento promocional.

Esta especificação preserva as regras já aprovadas: o participante não escolhe o tipo de preço, o servidor resolve e fotografa os valores vigentes na inscrição, e alterações posteriores na configuração não reescrevem o histórico.

## Objetivos

- permitir que o administrador cadastre, substitua, inative e redefina a senha de um regente;
- permitir somente um regente ativo por coro e somente um coro por regente ativo;
- autenticar o regente com e-mail e senha, sem depender de provedor de e-mail;
- mostrar ao regente apenas os participantes inscritos em seu coro;
- permitir que regentes e administradores paguem, em parcelas livres, o complemento individual de inscrições promocionais;
- preservar um histórico auditável de cobranças e confirmações;
- impedir mais de uma inscrição por CPF e permitir a retomada de uma inscrição pendente com CPF e data de nascimento;
- manter CPF, fotografia e dados financeiros privados e autorizados no servidor.

## Fora do escopo

- envio de convite, recuperação de senha ou aviso por e-mail;
- múltiplos regentes ativos para o mesmo coro;
- pagamento complementar agrupado para vários participantes em uma única cobrança;
- alteração automática de preços históricos;
- exclusão de inscrições ou pagamentos antigos;
- aplicação de SQL no Supabase remoto, publicação no GitHub/Lovable ou cobrança real durante a implementação local.

## Perfis e autenticação

### Regente

O administrador informará nome, e-mail, coro e senha temporária. Uma função exclusiva de servidor, protegida por `requireAdmin`, criará o usuário no Supabase Auth com o e-mail já confirmado, sem disparar mensagem. A senha temporária terá no mínimo oito caracteres e nunca será registrada em logs, auditoria ou tabelas públicas.

O primeiro acesso ocorrerá em `/regente/login`. Enquanto `password_change_required` estiver ativo, o usuário será conduzido à troca obrigatória da senha e não poderá abrir a lista do coro. Como não haverá provedor de e-mail, a redefinição futura será feita pelo administrador, que definirá outra senha temporária e reativará a troca obrigatória.

Se o e-mail já pertencer a outro usuário do Auth, o cadastro retornará conflito e não alterará a conta existente. Se a criação no Auth for concluída mas o vínculo falhar, o servidor tentará remover somente a conta que acabou de criar e apresentará uma falha administrativa segura.

### Administrador

Administradores continuarão autenticados pelo fluxo existente. Eles abrirão a mesma página `/regente`, com um seletor adicional para escolher qualquer coro. Dentro do coro selecionado, poderão consultar participantes e iniciar pagamentos com as mesmas ações disponíveis ao regente. Cada cobrança gravará quem a iniciou e com qual perfil.

### Autorização

A proteção de rota será apenas uma barreira de experiência. Cada função de servidor verificará a sessão e consultará no banco uma destas autorizações:

- associação administrativa ativa em `admin_users`; ou
- associação ativa em `choir_regents`, limitada ao `choir_id` gravado nessa associação.

O identificador de coro enviado pelo navegador nunca ampliará a autorização do regente. Claims editáveis em `user_metadata` não participarão das decisões de acesso.

## Modelo de dados

### Regentes

A tabela privada `public.choir_regents` conterá, no mínimo:

- `id uuid`;
- `user_id uuid`, referência ao usuário do Auth;
- `choir_id uuid`, referência ao coro;
- `name text`;
- `password_change_required boolean`;
- `granted_at timestamptz` e `granted_by uuid`;
- `revoked_at timestamptz` e `revoked_by uuid`.

Índices únicos parciais garantirão um único vínculo não revogado por coro e um único vínculo não revogado por usuário. Uma substituição revogará o vínculo atual e criará outro, preservando o histórico. A tabela terá RLS ativa, sem concessão direta a `anon` ou `authenticated`; somente funções de servidor autorizadas usarão o cliente administrativo.

### CPF único

`registrations.cpf` armazenará exatamente 11 algarismos. Inscrições novas exigirão CPF, e um índice único para valores não nulos impedirá duplicidade. Linhas históricas sem CPF poderão permanecer nulas; nenhuma migração apagará inscrições ou inventará CPFs.

Antes de criar uma inscrição, o servidor normalizará o CPF e consultará uma inscrição existente. A restrição do banco continuará sendo a proteção final contra concorrência.

### Pagamentos complementares

A tabela privada `public.registration_complement_payments` conterá, no mínimo:

- `id uuid`;
- `registration_id uuid` e `choir_id uuid`;
- `amount_cents integer` positivo;
- `status text`: `creating`, `pending`, `paid`, `failed` ou `expired`;
- `order_nsu uuid` único;
- `checkout_url text` e identificadores de cobrança da InfinitePay;
- `initiated_by uuid` e `initiated_as text`, restrito a `regent` ou `admin`;
- `created_at`, `paid_at` e dados de confirmação/conciliação.

Um índice único parcial permitirá no máximo uma cobrança `creating` ou `pending` por inscrição. A associação entre pagamento, inscrição e coro será validada no banco. Somente pagamentos `paid`, confirmados diretamente com a InfinitePay, reduzirão o saldo.

As tabelas expostas terão RLS habilitada e nenhum acesso direto será concedido ao público. A `service_role` permanecerá exclusiva de arquivos de servidor.

## Regra financeira

O complemento é individual e exclui itens adicionais, como camisa:

`complemento total = standard_price_cents - registration_price_cents`

`saldo = complemento total - soma dos pagamentos complementares confirmados`

O complemento existirá somente quando:

- a inscrição usar `pricing_type = promotional`;
- os dois valores fotografados estiverem presentes e formarem diferença positiva; e
- o pagamento original da inscrição estiver confirmado como `paid`.

Inscrições normais e inscrições promocionais ainda não pagas aparecerão na lista, mas não permitirão iniciar o complemento. A segunda situação exibirá “Aguardando pagamento do participante”.

Regente ou administrador poderá escolher qualquer valor inteiro em centavos entre R$ 0,01 e o saldo. O servidor recalculará o saldo imediatamente antes de registrar a cobrança. Restrições e validações impedirão valores acima do saldo e duas cobranças abertas ao mesmo tempo.

Uma cobrança aberta reservará a ação operacional: o saldo contábil continuará baseado apenas em pagamentos confirmados, mas nenhum novo checkout será criado até a cobrança aberta ser paga, falhar ou expirar. A interface oferecerá **Continuar pagamento** usando o endereço já persistido.

O retorno e o webhook serão apenas sinais. A confirmação consultará a InfinitePay, exigirá o mesmo `order_nsu` e o valor original esperado, e atualizará a parcela de forma idempotente. Repetições não gerarão crédito duplicado.

## Retomada da inscrição do participante

O formulário público continuará criando uma única inscrição e um único pedido por CPF. Ao receber um CPF já cadastrado, o servidor não criará outra linha.

Uma ação de retomada solicitará somente CPF e data de nascimento. Os dois valores precisarão coincidir exatamente depois da normalização. A resposta não devolverá nome, telefone, fotografia, coro ou outros dados pessoais.

- inscrição `pending` com checkout persistido: reabrir o mesmo checkout;
- inscrição `paid`: informar apenas que a inscrição já está confirmada;
- dados divergentes: mostrar mensagem genérica orientando contato com a organização;
- inscrição sem checkout reutilizável: manter a inscrição única e orientar contato com a organização, sem criar silenciosamente uma segunda cobrança.

A consulta não exporá recibo nem detalhes de pagamento. Tentativas e erros não serão registrados com CPF completo em logs.

## Área compartilhada do regente

A rota `/regente` seguirá o visual compacto e responsivo do painel existente.

O cabeçalho mostrará o coro e o usuário atual. Administradores verão um seletor de coro; regentes verão somente o coro associado. O resumo exibirá:

- total de participantes;
- complemento total elegível;
- total complementar confirmado;
- saldo complementar pendente.

A busca aceitará nome ou CPF sem transportar esses dados na URL. No computador haverá tabela; no celular, cartões. Cada participante mostrará:

- fotografia;
- nome;
- CPF formatado;
- telefone;
- situação do pagamento original;
- valor normal e promocional fotografados;
- complemento pago e saldo;
- ação disponível ou motivo do bloqueio.

O telefone será um link `wa.me`, normalizado para o formato brasileiro `+55` quando tiver 10 ou 11 algarismos. A interface não enviará mensagens automaticamente.

As fotografias permanecerão em bucket privado. O servidor retornará somente URLs assinadas e temporárias das linhas que o usuário estiver autorizado a ver. Ausência ou falha da fotografia usará um avatar neutro sem impedir a lista.

Ao selecionar **Pagar complemento**, um diálogo mostrará participante, saldo máximo, campo de valor livre e resumo. A confirmação criará a cobrança e redirecionará para a InfinitePay. Uma cobrança aberta trocará a ação para **Continuar pagamento**. Cada participante poderá expandir um histórico com valor, situação, data e responsável por cada parcela.

## Administração dos regentes

A página `/admin/coros` exibirá o regente ativo de cada coro e oferecerá:

- **Cadastrar regente** para coros sem vínculo ativo;
- **Substituir regente**, revogando o anterior e criando o novo vínculo;
- **Inativar regente**;
- **Redefinir senha**, definindo nova senha temporária e exigindo troca no próximo acesso.

O formulário conterá nome, e-mail, coro e senha temporária. A interface avisará que não há recuperação automática por e-mail. Todas as mutações exigirão `requireAdmin` no servidor e manterão o formulário preenchido em falhas recuperáveis.

O menu administrativo ganhará **Área dos regentes**, apontando para a rota compartilhada.

## Tratamento de erros e concorrência

- falha ao listar participantes mostrará nova tentativa sem expor detalhes internos;
- falha ao criar checkout não diminuirá o saldo e marcará a tentativa como `failed` quando houver registro persistido;
- falha temporária na confirmação manterá a cobrança `pending` para nova verificação;
- confirmação divergente de pedido ou valor não será aceita;
- conflitos de regente ou CPF serão resolvidos pela restrição do banco e convertidos em mensagens específicas ou genéricas conforme o público;
- paginação e filtros serão aplicados no servidor para evitar carregar dados pessoais de outros coros;
- valores financeiros serão armazenados e calculados apenas como inteiros em centavos;
- nenhuma exclusão em cascata removerá inscrições ou histórico financeiro.

## Componentes e responsabilidades

A implementação será dividida em unidades pequenas:

- domínio de acesso do regente: esquemas, tipos e decisões de autorização;
- serviço de autenticação: criação, redefinição e troca obrigatória de senha;
- repositório de regentes: vínculos ativos e histórico;
- domínio financeiro: elegibilidade, saldo e validação de parcela;
- repositório de pagamentos: criação, listagem e confirmação idempotente;
- integração InfinitePay: criação e conferência de checkout complementar;
- consultas do portal: resumo, paginação, filtros e URLs temporárias de foto;
- funções de servidor: contratos públicos, de regente e administrativos;
- interfaces: login, troca de senha, portal compartilhado e cadastro administrativo;
- migrações: CPF único, regentes, histórico financeiro, índices, restrições e RLS.

## Testes e critérios de aceite

A implementação seguirá TDD. Nenhum teste automatizado criará cobrança real.

Serão cobertos:

- normalização, validação e unicidade de CPF;
- retomada por CPF e nascimento sem exposição de dados;
- reabertura de checkout pendente e resposta para inscrição paga;
- criação de regente, conflito de e-mail, inativação, substituição e redefinição;
- exclusividade de um regente ativo por coro e por usuário;
- bloqueio do portal até a troca da senha temporária;
- autorização administrativa e isolamento entre coros em toda função de servidor;
- geração de URLs temporárias apenas para fotos autorizadas;
- normalização segura do link de WhatsApp;
- cálculo do complemento a partir das fotografias históricas;
- bloqueio para inscrição normal, promocional não paga, valor inválido e saldo insuficiente;
- pagamentos parciais sucessivos e saldo restante;
- bloqueio de duas cobranças abertas;
- criação correta do checkout complementar;
- confirmação idempotente e rejeição de divergências da InfinitePay;
- resumo financeiro e histórico por participante;
- estados de carregamento, vazio, erro e responsividade essencial das telas;
- preservação de registros históricos nas migrações.

Ao final serão executados testes focados, suíte serial completa, TypeScript, lint dos arquivos alterados, verificação das migrações e build de produção. Aplicação remota de migração, push, publicação Lovable e pagamento real permanecerão etapas separadas e dependentes de autorização explícita.
