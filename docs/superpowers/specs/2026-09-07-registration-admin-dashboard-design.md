# Painel administrativo de inscrições

## Objetivo

Criar uma área administrativa protegida para consultar e exportar as inscrições do II Encontro de Coros. O painel deve preservar os registros históricos, manter a chave administrativa do Supabase exclusivamente no servidor e autorizar cada operação privada a partir de uma identidade administrativa persistida e revogável.

## Escopo

Esta entrega inclui:

- login administrativo por e-mail e senha usando Supabase Auth;
- autorização administrativa persistida, vinculada ao UUID imutável de `auth.users`;
- rota protegida para listar, pesquisar e filtrar inscrições;
- paginação e ordenação executadas no servidor;
- exibição de camisa, valores, situação, forma de pagamento e parcelas;
- exportação em CSV dos resultados correspondentes aos filtros ativos;
- auditoria append-only das exportações;
- testes automatizados da autorização, consulta, CSV e interface;
- migrações versionadas somente no repositório local.

Não fazem parte desta entrega:

- cadastro público de administradores;
- recuperação de senha personalizada;
- gerenciamento de administradores pela interface;
- edição ou exclusão de inscrições;
- confirmação, cancelamento ou estorno manual de pagamentos;
- acesso direto do navegador às tabelas privadas;
- aplicação de SQL no Supabase remoto;
- publicação no GitHub ou Lovable;
- push de commits.

## Estado atual relevante

O projeto usa TanStack Start e já dispõe de:

- cliente Supabase público no navegador;
- middleware que anexa o token da sessão às funções de servidor;
- middleware de servidor que valida o token com `supabase.auth.getClaims` e fornece `userId` e claims verificados;
- cliente Supabase com `service_role` isolado em módulo `.server.ts`;
- middleware CSRF aplicado globalmente às funções de servidor;
- tabela `public.registrations` sem acesso para `anon` e `authenticated`;
- funções de servidor que gravam e conciliam pagamentos InfinitePay;
- estados `legacy`, `pending` e `paid` com preservação dos registros anteriores à integração de pagamentos.

Ainda não existe rota de login, área administrativa ou modelo persistido de administradores.

## Decisão de autenticação e autorização

O login usará e-mail e senha do Supabase Auth pelo cliente público já existente. Não haverá tela de cadastro. Contas administrativas serão criadas e mantidas fora do aplicativo pelos controles operacionais do Supabase.

A autenticação responde apenas quem é o usuário. A autorização será uma verificação separada e obrigatória no servidor. Um middleware `requireAdmin` irá:

1. compor o middleware de autenticação Supabase existente;
2. receber o `userId` obtido de um JWT validado;
3. consultar uma associação administrativa não revogada;
4. rejeitar a operação antes de qualquer consulta a inscrições quando a associação não existir.

O bloqueio visual da rota melhora a navegação, mas não é a fronteira de segurança. Toda função de servidor que devolva dados de inscrições ou produza exportação deve aplicar `requireAdmin` diretamente.

Não serão usados `user_metadata`, e-mail recebido do navegador ou parâmetros de URL para decisões de autorização. Claims administrativas também não serão usadas nesta versão, evitando revogações atrasadas por tokens ainda válidos.

## Modelo de administradores

Uma migração local criará `public.admin_users` como histórico de associações administrativas:

- `id uuid primary key default gen_random_uuid()`;
- `user_id uuid not null references auth.users(id) on delete restrict`;
- `granted_at timestamptz not null default now()`;
- `granted_by uuid references auth.users(id) on delete restrict`;
- `revoked_at timestamptz`;
- `revoked_by uuid references auth.users(id) on delete restrict`;
- restrição que exige `revoked_by` somente quando `revoked_at` estiver preenchido;
- índice único parcial em `user_id` quando `revoked_at is null`.

Cada concessão será uma nova linha. Revogar preencherá `revoked_at` e, quando disponível, `revoked_by`; linhas não serão apagadas ou reativadas. Esse formato preserva sucessivos ciclos de concessão e revogação.

A tabela terá RLS habilitada e nenhum privilégio para `anon` ou `authenticated`. O `service_role` receberá somente os privilégios necessários ao fluxo. Esta entrega lê associações e não oferece operações de concessão ou revogação pela aplicação.

Nenhum administrador será inserido automaticamente na migração. Depois de uma autorização futura para aplicar SQL remoto, o primeiro administrador será provisionado manualmente pelo UUID de uma conta já criada no Supabase Auth. O procedimento exato será documentado junto à migração sem incluir UUID, e-mail ou segredo no repositório.

## Auditoria de exportações

A migração criará `public.admin_access_events` como registro append-only:

- `id uuid primary key default gen_random_uuid()`;
- `admin_user_id uuid not null references auth.users(id) on delete restrict`;
- `event_type text not null`, inicialmente restrito a `registrations.export_csv`;
- `payment_status_filter text`, restrito a `pending`, `paid` ou `legacy` quando preenchido;
- `search_used boolean not null`;
- `result_count integer not null check (result_count >= 0)`;
- `created_at timestamptz not null default now()`.

O conteúdo da pesquisa não será gravado, pois pode conter nome, e-mail ou telefone. O log registra somente se houve pesquisa, o filtro de situação, o administrador, o horário e a quantidade exportada.

A aplicação terá somente `insert` e `select` sobre essa tabela por meio do `service_role`; não haverá fluxo de atualização ou exclusão. O evento será inserido somente depois que a exportação tiver sido construída com sucesso.

## Fronteira de servidor

As unidades administrativas serão separadas por responsabilidade:

1. **Domínio:** esquemas de filtros, paginação, tipos apresentados no painel e formatação segura do CSV.
2. **Autorização:** middleware `requireAdmin`, sem importação estática do cliente administrativo em código isomórfico.
3. **Persistência:** consultas a `registrations`, `admin_users` e `admin_access_events` em módulo `.server.ts`.
4. **Funções:** endpoints tipados de sessão administrativa, listagem e exportação.
5. **Interface:** login e painel, sem conhecimento da chave administrativa ou acesso direto às tabelas.

O cliente `service_role` continuará importado somente por módulos `.server.ts`. As funções isomórficas carregarão implementações de servidor dinamicamente, seguindo o padrão já empregado no fluxo de inscrições.

## Contratos das funções de servidor

### Consultar sessão administrativa

Uma função protegida retornará apenas os dados mínimos necessários para a interface, como UUID e e-mail verificado. A ausência de sessão produzirá estado não autenticado; uma sessão válida sem associação ativa produzirá acesso negado.

### Listar inscrições

A entrada validada conterá:

- `search`: texto aparado com limite de 100 caracteres;
- `paymentStatus`: `all`, `pending`, `paid` ou `legacy`;
- `page`: inteiro positivo;
- `pageSize`: inteiro entre 1 e 100, com padrão 25.

A pesquisa abrangerá nome, e-mail, telefone, cidade e instituição. Caracteres especiais serão tratados para que não alterem indevidamente a expressão de filtro do PostgREST.

A consulta retornará:

- linhas da página atual;
- quantidade total correspondente;
- página e tamanho efetivos.

A ordenação será `created_at desc, id desc`, tornando a paginação determinística quando duas inscrições tiverem o mesmo horário.

Cada linha poderá conter somente:

- identificador e data da inscrição;
- nome, e-mail e telefone;
- cidade, instituição e função no evento;
- situação e tamanho da camisa;
- valor esperado e valor efetivamente pago;
- situação do pagamento, forma, parcelas e data de pagamento.

URLs de checkout, identificadores internos da InfinitePay e comprovantes não serão incluídos porque não são necessários ao painel solicitado.

### Exportar CSV

A entrada usará os mesmos campos `search` e `paymentStatus`, sem paginação. A consulta será executada em lotes internos até reunir todos os registros correspondentes.

O servidor retornará nome do arquivo e conteúdo CSV. O navegador apenas iniciará o download do resultado já autorizado e produzido no servidor.

O arquivo terá:

- codificação UTF-8 com BOM para compatibilidade com Excel;
- separador `;`, adequado ao uso comum em instalações brasileiras do Excel;
- cabeçalhos em português;
- datas em formato brasileiro legível;
- valores monetários em reais;
- aspas duplicadas e campos cercados por aspas quando necessário;
- neutralização de células cujo primeiro caractere significativo seja `=`, `+`, `-` ou `@`, evitando interpretação como fórmula.

O nome seguirá `inscricoes-AAAA-MM-DD.csv`.

## Representação dos registros históricos

Registros `legacy` foram criados antes de existirem colunas de camisa e pagamento. Portanto:

- camisa será exibida como `Não informado`;
- valor esperado e valor pago serão exibidos como `Não informado` quando nulos;
- forma de pagamento e parcelas serão exibidas como `Não informado`;
- o estado será apresentado como `Histórico`, sem inferir pagamento pendente ou concluído.

Para registros novos:

- `include_shirt = false` será exibido como `Sem camisa`;
- `include_shirt = true` exibirá o tamanho;
- `amount_cents` será o valor esperado do pedido;
- `paid_amount_cents`, quando existente, será o valor efetivamente pago, inclusive eventual taxa de cartão repassada;
- Pix será apresentado sem linguagem de parcelamento, embora o dado persistido permaneça disponível;
- cartão exibirá a quantidade de parcelas registrada pela conciliação InfinitePay.

Nenhum valor ausente será convertido para zero.

## Rotas e interface

### `/admin/login`

A tela terá e-mail, senha e ação `Entrar`. Ela usará `supabase.auth.signInWithPassword` com a chave pública. Mensagens de credenciais inválidas serão genéricas e não revelarão se a conta existe.

Depois do login, a aplicação consultará a função de sessão administrativa. Um administrador ativo seguirá para `/admin/inscricoes`; um usuário autenticado sem autorização verá `Acesso não autorizado` e poderá sair.

### `/admin/inscricoes`

A rota executará uma verificação administrativa antes de carregar a interface. Falta de sessão redirecionará para `/admin/login`; usuário autenticado sem associação ativa receberá uma tela de acesso negado.

O cabeçalho mostrará `Inscrições`, o total encontrado, a ação `Exportar CSV` e a ação `Sair`. A barra de consulta terá pesquisa textual e filtro de situação.

No desktop, os dados serão uma tabela compacta. No celular, as mesmas informações serão agrupadas em cartões para evitar rolagem horizontal impraticável. Os estados usarão badges distintos para `Pendente`, `Pago` e `Histórico`.

Pesquisa, filtro e página permanecerão no estado local do painel. O texto pesquisado pode conter nome, e-mail ou telefone e, por isso, não será colocado na URL, no histórico do navegador ou em logs. Alterar a pesquisa ou o filtro reiniciará a paginação na primeira página.

A exportação usará os filtros ativos e todos os resultados correspondentes, não apenas a página visível.

## Estados e erros

- Enquanto autentica ou consulta, a interface mostrará estado de carregamento sem reaproveitar dados de uma sessão anterior.
- Credenciais inválidas produzirão mensagem genérica.
- Sessão ausente ou expirada redirecionará para o login.
- Usuário autenticado sem autorização verá acesso negado, sem detalhes sobre associações administrativas.
- Falhas de consulta ou exportação apresentarão mensagem temporária e opção de tentar novamente.
- Erros internos registrados no servidor não conterão senha, token, chave, conteúdo da pesquisa ou linhas exportadas.
- A falha ao gravar auditoria impedirá que a exportação seja tratada como concluída, mantendo correspondência entre downloads bem-sucedidos e eventos registrados.
- Logout limpará a sessão Supabase e os dados administrativos em cache.

## Segurança

- A chave `service_role` nunca será referenciada em componentes, rotas client-side ou variáveis `VITE_*`.
- Toda entrada de função de servidor será validada.
- A autorização precederá qualquer acesso às inscrições.
- O middleware CSRF existente continuará aplicado às funções de servidor.
- O navegador não consultará `registrations`, `admin_users` ou `admin_access_events` diretamente.
- Não haverá autorização por `user_metadata`, e-mail ou estado mantido somente no cliente.
- As tabelas expostas no schema `public` terão RLS habilitada e grants explícitos mínimos.
- A exportação neutralizará fórmulas de planilha.
- Nenhum fluxo desta entrega apagará ou sobrescreverá inscrições históricas.

## Estratégia de testes

O desenvolvimento seguirá ciclos de teste falhando, implementação mínima e teste passando.

### Domínio

- validação e normalização dos filtros;
- limites de página e tamanho;
- mapeamento de `legacy`, camisa e pagamento sem inventar valores;
- cabeçalhos, acentos, delimitadores, aspas e quebras de linha no CSV;
- proteção contra fórmulas iniciadas por `=`, `+`, `-` e `@`.

### Autorização

- ausência de cabeçalho de autenticação;
- JWT inválido;
- usuário autenticado sem associação;
- associação revogada;
- associação ativa;
- comprovação de que a consulta a inscrições não ocorre antes da autorização.

### Persistência e funções

- composição segura da pesquisa;
- filtro para cada situação e opção `all`;
- ordenação determinística;
- paginação e total correspondente;
- exportação de todos os lotes;
- auditoria após sucesso;
- ausência de evento quando consulta ou construção do arquivo falhar;
- erros genéricos para o navegador.

### Interface

- login bem-sucedido e inválido;
- redirecionamento sem sessão;
- acesso negado para usuário comum;
- renderização da tabela e dos estados históricos;
- pesquisa e filtro reiniciando corretamente a paginação;
- download com filtros ativos;
- sessão expirada e logout.

### Verificação final local

- testes focados durante cada ciclo;
- suíte Vitest completa;
- ESLint;
- compilação de produção;
- revisão do diff para confirmar isolamento de segredos e ausência de alterações destrutivas.

Nenhum teste fará chamadas reais à InfinitePay, criará usuários remotos ou aplicará SQL no Supabase remoto.

## Critérios de aceite

1. Uma chamada direta e não autenticada às funções administrativas é rejeitada antes de consultar dados.
2. Um usuário Supabase válido sem associação administrativa ativa não consegue listar nem exportar inscrições.
3. Um administrador ativo consegue pesquisar, filtrar e paginar as inscrições.
4. Camisa, valores, situação, forma de pagamento e parcelas são apresentados sem inferir dados ausentes em registros `legacy`.
5. A exportação contém todos os resultados dos filtros ativos e é segura para abertura em planilhas.
6. Cada exportação concluída gera um evento de auditoria sem duplicar os dados pessoais exportados.
7. Nenhuma inscrição pode ser editada ou excluída pelo painel.
8. A chave `service_role` permanece somente no bundle de servidor.
9. Testes, lint e build passam localmente.
10. Nenhum SQL remoto, push ou publicação é executado nesta entrega.

## Implantação posterior

Aplicação da migração, criação da conta administrativa, concessão inicial, configuração de senha e publicação serão etapas posteriores. Cada alteração remota exigirá autorização específica com indicação do projeto e do impacto.
