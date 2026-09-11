# Área do participante

## Contexto

O site já possui inscrição pública, preços definidos pelo servidor, checkout da InfinitePay, conciliação de pagamentos, painel administrativo e autenticação administrativa com Supabase Auth. A área do participante acrescentará uma conta individual liberada somente depois da confirmação do pagamento e permitirá que cada pessoa consulte exclusivamente sua própria inscrição.

As 14 inscrições existentes no projeto Supabase de produção `mtkjsrbywymwixwscosf` eram dados de teste e foram removidas com autorização explícita antes deste desenho. A tabela `public.registrations` foi validada com zero registros após a exclusão. Essa remoção remota é um fato operacional separado da futura migração e publicação da funcionalidade.

## Objetivos

- criar uma área autenticada e responsiva para participantes com pagamento confirmado;
- usar o e-mail informado como login e `CPF sem pontuação + DDMMAAAA` como senha inicial permanente;
- permitir a troca voluntária da senha depois do login;
- permitir redefinição administrativa para a senha inicial quando o participante perder o acesso;
- mostrar todos os dados informados na inscrição, a fotografia e os detalhes do pagamento;
- permitir baixar o comprovante de pagamento em PDF;
- incluir as seções Playlist, Partituras e Manuais e Certificado com placeholders honestos até que os conteúdos existam;
- garantir que cada participante consulte somente a própria inscrição;
- integrar a criação da conta à conciliação idempotente do pagamento.

## Fora do escopo

- recuperação automática de senha por e-mail;
- criação de conta antes da confirmação do pagamento;
- inclusão de playlists, partituras, manuais ou certificados reais;
- edição dos dados da inscrição pelo participante;
- múltiplas inscrições ou múltiplos perfis para o mesmo CPF;
- alteração de contas Auth existentes em caso de conflito de e-mail;
- cobrança real durante os testes;
- aplicação da migração no Supabase remoto, publicação no GitHub/Lovable ou merge em `main` sem autorização específica posterior.

## Perfis, autenticação e acesso

### Participante

O participante acessará `/participante/login` com o e-mail da inscrição e a senha inicial formada por 11 algarismos do CPF seguidos da data de nascimento em `DDMMAAAA`. Exemplo de formato: `0000000000015011990`. Pontos, traços e barras não participarão da senha.

A senha inicial será permanente: o participante poderá continuar usando-a enquanto desejar. Dentro da área autenticada haverá uma ação para alterar a senha. A troca exigirá a senha atual e uma nova senha válida. A nova senha nunca será enviada para logs, tabelas públicas ou auditorias.

Se o participante esquecer uma senha alterada, um administrador poderá redefini-la para `CPF + DDMMAAAA`. A operação será exclusiva do servidor, protegida pela autorização administrativa existente e registrada sem guardar o valor da senha.

### Liberação após pagamento

A conta será criada somente quando a conciliação com a InfinitePay confirmar o pagamento. O retorno do navegador e o webhook usarão o mesmo serviço idempotente. Parâmetros da URL, isoladamente, nunca liberarão a conta.

Depois que a inscrição mudar para `paid`, o servidor criará um usuário permanente no Supabase Auth com o e-mail confirmado e a senha inicial. Em seguida, gravará o vínculo da conta com a inscrição. Repetições do webhook ou da conciliação reutilizarão o vínculo existente e não criarão contas duplicadas.

Uma falha na criação da conta não desfará nem rebaixará um pagamento confirmado. O acesso ficará em estado pendente para nova tentativa administrativa. Se o Auth criar o usuário, mas a gravação do vínculo falhar, o servidor tentará remover somente o usuário recém-criado; se a compensação falhar, o caso ficará marcado para resolução administrativa.

### Conflitos de identidade

Se o e-mail já pertencer a uma conta Auth, o sistema não mudará a senha, não substituirá metadados e não vinculará a nova inscrição automaticamente. O acesso ficará com conflito e o painel administrativo mostrará o caso para resolução. Isso protege contas administrativas, contas de regentes e participantes já existentes.

### Autorização

A proteção da rota servirá como barreira de experiência, mas cada função de servidor verificará a sessão e o vínculo ativo entre `auth.uid()` e a inscrição paga. O identificador enviado pelo navegador nunca escolherá outra inscrição.

As decisões de autorização não usarão `user_metadata`. A tabela de inscrições continuará privada para `anon` e `authenticated`; o `service_role` permanecerá exclusivo dos arquivos `.server.ts`.

## Modelo de dados

### `participant_accounts`

Uma nova tabela privada `public.participant_accounts` conterá, no mínimo:

- `id uuid primary key`;
- `registration_id uuid not null`, com referência única à inscrição;
- `user_id uuid not null`, com referência única ao usuário do Auth;
- `access_status text not null`, restrito a `active`, `pending` ou `conflict`;
- `provisioned_at timestamptz`;
- `last_error_code text`, apenas com códigos internos não sensíveis;
- `created_at timestamptz not null` e `updated_at timestamptz not null`.

Restrições únicas garantirão uma conta por inscrição e uma inscrição por usuário. Índices cobrirão as consultas por `registration_id`, `user_id` e estado pendente/conflitante. A tabela terá RLS habilitada e nenhum acesso direto será concedido a `anon` ou `authenticated`.

### `participant_access_events`

Uma tabela privada e append-only registrará eventos como:

- conta provisionada;
- provisionamento pendente;
- conflito de e-mail;
- reprocessamento solicitado;
- senha redefinida pelo administrador.

Cada evento conterá a conta ou inscrição afetada, o tipo, o administrador quando aplicável e data/hora. Senhas, CPF completo, tokens e respostas brutas do provedor não serão armazenados.

### CPF e inscrição

Novas inscrições continuarão exigindo CPF normalizado com exatamente 11 algarismos e data de nascimento. Como os registros de teste foram removidos, a implantação poderá aplicar a unicidade do CPF sem inventar ou apagar dados históricos. A restrição do banco continuará sendo a proteção final contra concorrência.

## Fluxos

### Pagamento e provisionamento

1. O participante envia a inscrição e abre o checkout.
2. A InfinitePay confirma o pagamento por reconciliação autenticada no servidor.
3. O servidor marca a inscrição como paga de forma idempotente.
4. O provisionador cria a conta Auth e o vínculo em `participant_accounts`.
5. A página de confirmação mostra `Acessar área do participante`.
6. Se o provisionamento estiver pendente, a confirmação do pagamento continua visível e informa que o acesso está sendo preparado.

### Login

1. O participante informa e-mail e senha em `/participante/login`.
2. O navegador usa `signInWithPassword` do Supabase Auth.
3. A área chama uma função de servidor com o bearer token anexado pelo middleware existente.
4. O servidor valida a sessão, a conta participante ativa, a inscrição vinculada e o pagamento confirmado.
5. Somente então devolve a visão segura da inscrição.

Erros de credenciais serão genéricos para não confirmar se um e-mail existe. Uma sessão autenticada sem vínculo participante será encerrada nessa área e exibirá uma mensagem de acesso indisponível.

### Alteração de senha

1. O participante abre `Alterar senha`.
2. Informa a senha atual, a nova senha e a confirmação.
3. O sistema revalida a senha atual e atualiza a credencial no Supabase Auth.
4. A interface limpa os campos e confirma o sucesso.

A nova senha terá no mínimo oito caracteres. O sistema não mostrará nem tentará reconstruir a senha atual.

### Redefinição administrativa

1. Um administrador autenticado abre a inscrição paga.
2. Aciona `Redefinir senha inicial` e confirma a operação.
3. O servidor recalcula a senha a partir do CPF e nascimento armazenados, chama a API administrativa do Auth e registra o evento.
4. Sessões anteriores do participante deverão ser revogadas quando o mecanismo disponível permitir; caso contrário, a interface administrativa informará explicitamente essa limitação.

### Reprocessamento de acesso

Um administrador poderá acionar `Reprocessar acesso` em inscrições pagas com provisionamento pendente ou conflito. O serviço repetirá as verificações idempotentes. Conflitos com uma conta existente continuarão sem alteração automática.

## Interface

### Login

A tela de login usará a identidade visual do evento, campos acessíveis para e-mail e senha, opção de mostrar/ocultar senha e orientação concisa sobre o formato inicial. Não haverá link de recuperação automática por e-mail.

### Área do participante

O cabeçalho mostrará a marca do evento, o nome do participante, `Alterar senha` e `Sair`. Em telas largas, a navegação será lateral. Em telas pequenas, será uma faixa horizontal compacta e rolável sem cortar o conteúdo.

#### Identificação

A seção reunirá:

- fotografia da inscrição;
- nome;
- CPF mascarado;
- data de nascimento;
- e-mail;
- telefone;
- coro/diocese;
- demais respostas persistidas pelo formulário;
- estado e tipo da inscrição;
- valor pago;
- forma de pagamento e parcelas;
- data e hora do pagamento;
- código do pedido;
- ação `Baixar comprovante em PDF`.

Campos sem valor serão omitidos em vez de exibidos como `null`. A fotografia será servida por URL assinada de curta duração. O comprovante reutilizará a apresentação e os dados da confirmação de pagamento, incluindo a logo do evento.

#### Playlist

Exibirá: `A playlist do encontro será disponibilizada em breve.`

#### Partituras e Manuais

Exibirá: `As partituras e os materiais de orientação serão disponibilizados em breve.`

#### Certificado

Exibirá: `Seu certificado estará disponível após o evento.`

Os placeholders não terão arquivos fictícios, botões inativos que pareçam funcionais nem conteúdo de demonstração.

## Administração

A listagem/detalhe administrativo mostrará o estado do acesso participante para inscrições pagas:

- `Ativo`;
- `Aguardando criação`;
- `Conflito de e-mail`.

As ações disponíveis serão `Reprocessar acesso` e `Redefinir senha inicial`, apresentadas somente quando fizerem sentido. A autorização será verificada novamente dentro de cada função de servidor; a visibilidade do botão não será usada como controle de segurança.

## Tratamento de erros

- **Inscrição pendente:** não cria conta nem permite login participante.
- **Credenciais inválidas:** mensagem genérica e campos preservados, exceto a senha.
- **Conflito de e-mail:** preserva a conta existente e abre resolução administrativa.
- **Auth indisponível:** mantém o pagamento confirmado e marca o acesso como pendente.
- **Falha ao carregar a área:** mantém a sessão quando seguro e oferece nova tentativa.
- **Vínculo inválido ou revogado:** encerra o acesso à área e não devolve dados pessoais.
- **Foto indisponível:** mostra avatar neutro sem tornar o bucket público.
- **Comprovante indisponível:** informa a falha sem expor URLs ou respostas internas.

## Testes e validação

A implementação seguirá TDD, começando por testes que falham para cada comportamento novo.

### Domínio e servidor

- geração de senha inicial com CPF normalizado e `DDMMAAAA`;
- recusa de CPF ou nascimento inválido;
- provisionamento somente depois de `paid`;
- idempotência de retorno e webhook;
- uma conta por inscrição e uma inscrição por usuário;
- compensação quando o vínculo falha;
- preservação de contas existentes em conflitos de e-mail;
- autorização restrita à própria inscrição;
- reprocessamento e redefinição protegidos por `requireAdmin`;
- ausência de senha, token e CPF completo em logs/auditoria.

### Interface

- login, estados de carregamento e erros seguros;
- redirecionamento de sessão válida e inválida;
- quatro seções e os textos exatos dos placeholders;
- exibição dos dados informados e omissão dos ausentes;
- CPF mascarado, fotografia protegida e detalhes de pagamento;
- download do comprovante em PDF;
- troca de senha e limpeza de campos;
- layout em desktop e viewport móvel.

### Verificação final local

- testes focados;
- suíte Vitest completa excluindo worktrees aninhadas;
- TypeScript sem emissão;
- lint dos arquivos alterados;
- build de produção;
- smoke test das rotas públicas e protegidas;
- inspeção visual em desktop e celular sem usar credenciais reais.

Uma cobrança ou inscrição real, aplicação de SQL no projeto remoto, publicação no GitHub/Lovable e verificação do site servido serão tratadas como provas distintas e só ocorrerão com autorização específica.

## Estratégia Git

A implementação ficará na branch `codex/area-participante`, criada em worktree isolada. A worktree preservará integralmente as alterações não commitadas atualmente existentes em `codex/area-regente`.

Antes da implementação, será comparado o estado do Git local, `origin/main` e o projeto Lovable ativo para escolher a base que contém o fluxo mais recente de inscrição e pagamento. O trabalho reutilizará somente mudanças necessárias e não reescreverá histórico publicado. Não haverá rebase, amend, squash ou force-push de commits já enviados ao Lovable.

