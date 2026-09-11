# Acesso unificado aos portais

## Contexto

O site público do Encontro de Coros possui três áreas autenticadas com Supabase Auth: Administração, Regente e Participante. Os fluxos existentes usam páginas de login separadas, embora todos recebam e-mail e senha e depois confirmem a autorização em funções de servidor.

O novo acesso reunirá a entrada em uma única página. A pessoa não escolherá um perfil: depois da autenticação, o servidor consultará os vínculos ativos e indicará a área correta. As proteções já existentes dentro de cada função administrativa, de regente e de participante continuarão sendo a fronteira real de autorização.

## Objetivos

- incluir na página inicial um único acesso denominado **Acessar portal**;
- autenticar administradores, regentes e participantes com o mesmo formulário;
- encaminhar cada conta automaticamente para a área correspondente;
- aplicar a prioridade **Administrador → Regente → Participante** quando uma conta tiver mais de um perfil ativo;
- preservar os endereços antigos de login sem manter formulários duplicados;
- manter mensagens genéricas e encerrar sessões sem perfil autorizado;
- funcionar de forma compacta e acessível no computador e no celular.

## Fora do escopo

- unir as interfaces ou os dados internos das três áreas;
- permitir que a pessoa escolha ou troque manualmente de perfil;
- mudar senhas, criar contas ou alterar vínculos de acesso;
- substituir as regras de autorização de servidor por decisões do navegador;
- criar nova tabela, política RLS ou migração;
- publicar no GitHub/Lovable como parte automática da implementação local.

## Entrada na página inicial

A página inicial exibirá uma ação **Acessar portal** que aponta para `/acessar`. Ela ficará no cabeçalho principal, ao lado da ação de inscrição, e permanecerá disponível na apresentação compacta usada em telas pequenas. Será uma ação única para todos os perfis; não haverá botões separados para administração, regente ou participante.

O estilo seguirá a hierarquia atual: **Inscrever** continuará como chamada principal da página pública e **Acessar portal** será uma ação secundária claramente visível. O texto e o destino serão iguais em todas as larguras de tela.

## Página de acesso

A rota pública `/acessar` mostrará:

- identidade visual do evento;
- título **Acessar portal**;
- campos de e-mail e senha;
- ação para mostrar ou ocultar a senha;
- botão **Entrar**;
- link **Voltar ao evento**.

Não haverá seletor de perfil. O formulário usará `signInWithPassword` do cliente Supabase já configurado. Enquanto a operação estiver em andamento, uma trava impedirá envio duplo. A senha será limpa depois de qualquer tentativa concluída e nunca será registrada.

Credenciais inválidas produzirão uma mensagem genérica. Se a autenticação funcionar, mas a verificação do perfil falhar tecnicamente, a sessão será encerrada e a mensagem não revelará a existência de vínculos. Se a conta estiver autenticada mas não possuir nenhum perfil ativo, a sessão também será encerrada com resposta genérica.

## Resolução do perfil

Uma única função de servidor retornará somente o destino necessário, sem devolver dados privados das associações. A decisão seguirá esta ordem:

1. associação ativa em `admin_users` → `/admin/inscricoes`;
2. associação ativa em `choir_regents` com troca obrigatória de senha → `/regente/alterar-senha`;
3. associação ativa e pronta em `choir_regents` → `/regente`;
4. associação participante ativa, vinculada a uma inscrição paga → `/participante`;
5. nenhuma associação válida → acesso indisponível.

A prioridade administrativa será aplicada antes das demais verificações. Portanto, uma conta que também esteja vinculada como regente ou participante abrirá a Administração. Uma conta de regente e participante, sem vínculo administrativo, abrirá o Portal do Regente.

A função exigirá uma sessão Supabase válida e consultará as mesmas fontes de autorização usadas pelos middlewares atuais. Ela não usará `user_metadata`, parâmetros de rota ou valores enviados pelo navegador para decidir o perfil. Uma resposta de roteamento não substituirá a nova validação executada quando a área de destino carregar dados.

## Compatibilidade das rotas

As páginas antigas continuarão aceitando seus endereços, mas não manterão três formulários independentes:

- `/admin/login` redirecionará para `/acessar`;
- `/regente/login` redirecionará para `/acessar`;
- `/participante/login` redirecionará para `/acessar`.

Isso preserva favoritos e links já compartilhados. As rotas protegidas continuarão redirecionando sessões ausentes ao fluxo de acesso unificado. O retorno não aceitará um destino arbitrário fornecido na URL; o servidor sempre recalculará o perfil para evitar redirecionamentos abertos ou ampliação de acesso.

## Componentes e responsabilidades

- `UnifiedPortalLoginPage`: formulário, estados de carregamento, mensagens genéricas e navegação após a resposta segura;
- domínio de acesso unificado: tipo fechado para os destinos permitidos e regra explícita de prioridade;
- função de servidor de resolução: valida sessão, consulta os três vínculos e devolve o destino calculado;
- rota `/acessar`: metadados da página e montagem do formulário;
- rotas antigas de login: redirecionamento compatível para `/acessar`;
- página inicial: ação responsiva **Acessar portal**;
- middlewares atuais: permanecem responsáveis por proteger cada área e função de dados.

Os verificadores existentes serão reutilizados ou extraídos para serviços compartilhados, evitando duplicar consultas com semânticas diferentes. A extração não alterará as regras atuais de validade dos vínculos.

## Tratamento de estados e erros

- **credenciais inválidas:** mensagem genérica e permanência no formulário;
- **sem perfil ativo:** encerramento da sessão e mensagem genérica de acesso indisponível;
- **falha ao consultar perfis:** encerramento seguro da sessão e opção de tentar novamente;
- **troca obrigatória do regente:** encaminhamento para a tela existente de troca, nunca para o portal pronto;
- **falha ao encerrar sessão rejeitada:** a interface mantém a resposta genérica e não mostra dados de perfil;
- **sessão já válida ao abrir `/acessar`:** resolução do perfil e redirecionamento automático;
- **destino protegido nega o acesso:** prevalece a proteção da própria área, independentemente da decisão anterior.

## Segurança

- a senha será manipulada somente pelo Supabase Auth no navegador e nunca enviada às funções de resolução;
- a função unificada exigirá autenticação e retornará apenas um destino enumerado;
- `service_role` permanecerá exclusiva de módulos de servidor;
- nenhuma autorização dependerá de `user_metadata` editável;
- tabelas privadas não ganharão acesso direto para `anon` ou `authenticated`;
- cada função de dados continuará aplicando `requireAdmin`, acesso de regente ou acesso participante conforme seu domínio;
- respostas públicas não informarão qual perfil, e-mail ou vínculo existe quando o acesso for negado.

## Integração do trabalho existente

O fluxo unificado depende das áreas que estão sendo desenvolvidas em linhas de trabalho separadas. Antes de implementar, o plano deverá escolher uma base que contenha os contratos atuais de Administração e Regente e integrar somente os commits necessários da Área do Participante. Mudanças locais não relacionadas e worktrees existentes serão preservadas.

Não haverá rebase, amend, squash ou force-push de histórico já publicado no Lovable. A implementação será integrada por commits normais e verificáveis.

## Testes e critérios de aceite

A implementação seguirá TDD. Cada comportamento será comprovado primeiro por um teste que falha pela ausência da funcionalidade.

### Domínio e servidor

- administrador é encaminhado para `/admin/inscricoes`;
- regente com troca obrigatória é encaminhado para `/regente/alterar-senha`;
- regente pronto é encaminhado para `/regente`;
- participante ativo e pago é encaminhado para `/participante`;
- a prioridade Administrador → Regente → Participante é mantida em contas com múltiplos vínculos;
- conta sem perfil ativo não recebe destino;
- falha de consulta não concede acesso;
- o contrato rejeita destinos arbitrários e não expõe detalhes dos vínculos.

### Interface e rotas

- a página inicial exibe **Acessar portal** com destino `/acessar` em desktop e celular;
- o formulário não oferece escolha de perfil;
- o login evita envio duplo, limpa a senha e encaminha conforme a resposta segura;
- credenciais inválidas, falha de verificação e falta de perfil usam mensagens genéricas;
- uma sessão rejeitada é encerrada;
- uma sessão válida já existente é redirecionada ao abrir `/acessar`;
- os três endereços antigos de login conduzem a `/acessar`;
- o layout permanece utilizável nas larguras móveis e de desktop usadas pelo projeto.

### Verificação final local

- testes focados do acesso unificado, das rotas e da página inicial;
- regressões dos logins e middlewares administrativo, de regente e de participante;
- suíte Vitest excluindo worktrees aninhadas;
- TypeScript sem emissão;
- lint dos arquivos alterados;
- build de produção;
- smoke test das rotas públicas e protegidas;
- inspeção visual da página inicial e do login em desktop e celular, sem credenciais reais.

Push, publicação Lovable e verificação do endereço servido serão tratados como provas separadas. Antes de publicar, deverão ser informados o destino exato, o impacto, a reversão e a validação, com autorização específica para essa mutação de produção.
