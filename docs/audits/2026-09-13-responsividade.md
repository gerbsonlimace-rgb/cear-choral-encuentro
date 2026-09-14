# Avaliação de responsividade

Avaliação da versão local em http://localhost:3000, em 13/09/2026. O checkout já continha alterações de outras tarefas. Não houve publicação.

## Cobertura e limites

- Página inicial: inspeção de todas as seções e medições em 320×568, 390×664, 430×832, 768×1024 e 1440×900.
- Menu público: reprodução visual em 667×375.
- Acesso ao portal e editor de foto: inspeção visual em 390×664.
- Componentes compartilhados de diálogos, navegação interna, participante, regente e administração: revisão de código, sem validação de telas autenticadas.
- Não foram exercitados pagamento, envio de inscrição, câmera, teclado virtual real, aumento de fonte pelo sistema nem Safari em aparelho físico. As dimensões são de viewport de navegador; 390×664 representa uma área útil reduzida, não uma simulação completa de iPhone.
- Carrosséis têm itens propositalmente fora da área visível. Esses itens não foram classificados como vazamento horizontal da página. Medidas transitórias durante redimensionamento não foram usadas como falhas confirmadas.

## Achados confirmados

| Prioridade | Área | Evidência e impacto | Direção de ajuste |
| --- | --- | --- | --- |
| Alta | Menu público em paisagem | Em 667×375, o painel mede 375 px, mas o link Acessar portal fica entre y=385 e 433. O painel usa overflow vertical visible, sem rolagem interna. O último acesso fica fora da tela. | Limitar o painel à altura disponível e permitir rolagem vertical. |
| Alta | Primeira seção | Em 390×664, os botões começam aproximadamente em y=897 e 957. Em 320×568, em y=1007 e 1067. Logo, título, informações e margens excedem a primeira tela. | Composição mobile mais compacta, com tamanho do logo e tipografia adaptados também à altura disponível. |
| Média | Programação | A coluna dos horários mede 60 px. Textos como 16h00–18h00 ocupam 81 px e avançam sobre a coluna do ícone; Na sequência ocupa 78 px. Sobreposição vista no navegador. | Dimensionar a coluna para o conteúdo ou permitir divisão dos intervalos em linhas. |
| Média | Inscrição, primeira etapa | Em 390×664, a prévia do crachá ocupa cerca de 400 px antes do botão Continuar. Ao acessar a seção, o botão aparece aproximadamente em y=1382. | Prévia compacta ou expansível e ações próximas dos campos; considerar ações persistentes sem encobrir conteúdo. |
| Média | Acesso ao portal | Em 390×664, Entrar ocupa y=620–668 e Voltar ao evento começa em y=684. A composição inicial não cabe por inteiro. | Reduzir logo, margens e texto auxiliar no mobile; validar também com teclado aberto. |
| Média | Editor de foto | A prévia inicial mede cerca de 407 px. Escolher uma foto está abaixo da primeira tela, próximo de y=799. Baixar e Compartilhar permanecem visíveis em barra inferior. | Priorizar seleção da foto e limitar a prévia pela altura disponível, especialmente no formato Story. |
| Média | Sobre | A seção acumulava cerca de 2450 px em 390×664: dois parágrafos longos, quatro cards em coluna e apresentação extensa do palestrante. | Texto já resumido nesta tarefa. Uma próxima mudança de layout pode compactar os cards e separar a apresentação do palestrante. |
| Baixa | Quixadá e apoio | Em 390×664, Quixadá ocupa cerca de 1070 px e apoio/patrocínio cerca de 936 px com os patrocinadores carregados. Os blocos são legíveis, mas excedem uma tela. | Reduzir texto e espaçamento conforme a prioridade de cada seção. Não comprimir conteúdo longo até prejudicar a leitura. |

## Riscos encontrados no código, ainda sem reprodução autenticada

- `src/components/ui/dialog.tsx`: o diálogo padrão é centralizado e não define altura máxima nem rolagem. Consumidores sem proteção própria, como cadastro de coro e pagamento de saldo do regente, precisam de teste em telas baixas e com teclado.
- `src/components/internal-app/InternalAppShell.tsx` e `src/features/admin/AdminNavigation.tsx`: painéis inferiores Mais não definem altura máxima/rolagem. O risco cresce com o número de opções e com fonte ampliada.
- A navegação interna já reserva espaço inferior para a barra fixa e considera safe area. Isso é uma base positiva, mas não substitui verificar cada tela com seu conteúdo real.
- Listas de administração e regente possuem apresentações diferentes entre mobile e desktop. Validar nomes longos, ações de pagamento, filtros, estados vazios, erros e diálogos com dados reais autorizados.
- Campos da inscrição foram medidos com fonte de 14 px, enquanto o acesso usa campos maiores. Padronizar a legibilidade e verificar o comportamento de foco no Safari real.

## Ajuste realizado: texto de Sobre

Solicitação adicional do usuário: resumir a seção e deixar menos texto.

- Título: Fé, música e comunhão.
- Introdução reduzida, preservando propósito, edições de 2025/2026 e responsáveis pela iniciativa.
- Título do palestrante reduzido para Clayton Dias e biografia resumida a uma frase.
- Cards e link para a biografia oficial preservados.
- Altura da seção em 390×664: aproximadamente 2450 → 1908 px, redução de 542 px (22%). A seção ainda exige rolagem por incluir cards e palestrante.
- Conferência visual em 390×664 e 1440×900.
- Testes existentes: `npm run test:run -- src/routes/-index.test.tsx src/routes/-index.quixada.test.tsx --exclude '**/.worktrees/**' --no-file-parallelism --maxWorkers=1`: 2 arquivos e 15 testes aprovados.
- `git diff --check -- src/routes/index.tsx`: aprovado. Build e suíte completa não executados para esta alteração de texto.

## Critério para a próxima rodada

Seções curtas devem apresentar mensagem e ação na área útil da tela. Seções longas devem permitir rolagem e organizar o conteúdo em blocos compactos. Não usar altura fixa com corte de conteúdo. Validar largura e altura, celular em paisagem, foco/teclado, fonte ampliada, menus e diálogos, além dos estados de carregamento, erro e conteúdo longo.

Priorizar menu, abertura e horários da programação; depois formulário, acesso, editor e densidade das demais seções. A validação integral dos portais permanece pendente de uma sessão autenticada apropriada.

## Correções locais — 14/09/2026

O usuário autorizou corrigir todos os achados. Os itens acima descrevem o diagnóstico anterior; a situação atual é a seguinte.

### Implementação

- Abertura mobile dimensionada pela altura útil, com logo, informações, título e espaçamentos compactos. Conteúdo longo continua podendo rolar. Em telas abaixo de 380 px, a marca usa o logo sem a abreviação truncada ao lado.
- Menus, diálogos e confirmações compartilhados respeitam a altura disponível e permitem rolagem interna. Botões de fechar têm área de 44 px. A proteção é compartilhada pelas áreas pública, administrativa, participante e regente.
- Horários da programação ganharam coluna suficiente; em cards estreitos, horário e título ficam em linhas separadas. Textos longos podem quebrar sem invadir o ícone.
- Cards de Sobre passaram a linhas compactas no celular. Textos de Quixadá e apoio foram resumidos; imagens, títulos e margens também foram ajustados.
- Inscrição: campos com fonte de 16 px, crachá expansível e barra de ações visível no mobile. Um ResizeObserver reserva no formulário a altura real da barra. Os botões mudam para uma coluna quando necessário; a barra tem limite de 40dvh e rolagem para acomodar paisagem e fonte ampliada.
- Login: logo e margens menores em telas baixas; instrução de primeiro acesso resumida sem alterar a regra da senha.
- Editor: seleção da foto antes da prévia, canvas proporcional limitado pela altura da tela, opções sem vazamento lateral e barra final preservada.
- Preservada a mudança concorrente que criou `/inscricao`, substituiu o formulário da home por uma chamada e mudou o CTA para Inscrever-se agora. Essas alterações de navegação não foram criadas por esta tarefa.

### Evidência visual e geométrica

| Verificação | Resultado |
| --- | --- |
| Abertura 320×568 | Os dois botões terminam em y=533. |
| Abertura 390×664 | Os dois botões terminam em y=568. |
| Abertura 430×832 | Os dois botões terminam em y=662. |
| Abertura 768×1024 | Os dois botões terminam em y=778. |
| Abertura 1440×900 | Botões terminam em y=625; composição desktop em duas colunas preservada. |
| Menu 667×375 | Painel com 375 px, conteúdo de 453 px e overflow-y:auto. Após rolar, Acessar portal termina em y=355 e fica acessível. |
| Login 320×568 | Entrar termina em y=522; Voltar ao evento em y=566. |
| Login 390×664 | Os controles cabem na área inicial; antes da última compactação adicional, Entrar terminava em y=561 e Voltar ao evento em y=621. |
| Programação 320 px | Horário e título separados em linhas, sem excesso na largura dos textos medidos. |
| Inscrição 390×664 | Continuar fica na barra inferior, com 48 px de altura. A prévia abre e fecha sem deslocar a barra. |
| Barra da etapa final com fonte de 200% | Fixture local sem dados reais: botões sem transbordamento; barra limitada a aproximadamente 227 px e espaço reservado de 259 px. |
| Diálogo longo com fonte de 200% | Fixture local: em 320×568, top=32/bottom=536; em 667×375, top=32/bottom=343. Conteúdo longo com rolagem e sem excesso lateral. |
| Editor 390×664 | Seleção de foto aparece antes da prévia; formato Story preserva proporção (112×199 px). Página com largura de 375 px, contida no viewport de 390 px. |
| Sobre 390×664 | Seção completa com cards e palestrante: aproximadamente 1338 px, contra 2450 px no diagnóstico inicial. |
| Quixadá 390×664 | Aproximadamente 643 px, contra 1070 px. |
| Apoio/patrocinadores 390×664 | Aproximadamente 761 px, contra 936 px com os patrocinadores carregados. |

As fixtures temporárias usadas para geometria foram removidas. Elas verificam o CSS compartilhado, não substituem testes de operações autenticadas. Nenhuma inscrição ou transação foi enviada.

### Validação técnica e limites

- Seleção de 9 arquivos: 73 testes aprovados após atualizar expectativas dos títulos e CTAs alterados. A primeira execução teve falhas de texto; os arquivos afetados foram corrigidos e reexecutados com sucesso. A última reexecução de acesso aprovou 19 testes.
- Build de produção concluído com sucesso. Permanecem avisos sobre tamanho de bundles e arquivo de teste reconhecido como candidato a rota; não foram introduzidos como parte dos ajustes de layout.
- Diff check dos arquivos editados aprovado.
- Revisão independente do código concluída; o risco apontado na barra de pagamento em telas estreitas foi corrigido e conferido com fonte ampliada.
- Na conclusão da etapa local, ainda não havia commit ou push. A publicação posterior está registrada abaixo. Alterações preexistentes e concorrentes foram preservadas.
- Safari físico, teclado virtual real e operações autenticadas com dados reais não foram exercitados. As seções longas continuam roláveis; não há promessa de que qualquer quantidade de conteúdo caiba em uma única tela.

## Integração para publicação na main — 14/09/2026

- Push solicitado explicitamente pelo usuário; pacote preparado em worktree isolada a partir de `origin/main` (`59c23b2`), atualizada para `ba0faa8` durante a integração.
- Preservados o rascunho persistente da inscrição, a página `/inscricao`, os avisos e as novas amostras de moldura já publicados por outras tarefas. Aplicados apenas os ajustes visuais desta auditoria.
- Build de produção e `npx tsc --noEmit` aprovados na versão integrada.
- Nova conferência em 390×664: abertura com botões até y=568; editor com seletor até y=274 e canvas de 199 px de altura. Ambas as páginas sem excesso de largura.
- Publicação Git não comprova o deploy no Lovable; banco de dados não foi alterado por esta tarefa.

A atualização concorrente `ba0faa8` substituiu o editor público por artes prontas no portal do participante. A integração preserva essa navegação e as artes aprovadas: título antes da prévia, canvas limitado pela altura útil e fieldsets sem excesso lateral. As medidas anteriores de seletor antes da prévia descrevem a versão local anterior a essa reformulação, não o novo fluxo de artes prontas.

Também incorporada a atualização concorrente `2e6b401`: a página dedicada de inscrição usa formulário compacto e ações no fluxo da página, preservando os controles na tela inicial. As regras específicas dessa página prevalecem sobre o rodapé fixo genérico desta auditoria.

Validação final sobre `2e6b401`: 4 arquivos / 46 testes aprovados em uma única execução (inscrição, editor, home e composição da abertura). Os testes da inscrição tiveram timeouts nas execuções anteriores, mas a execução final completa passou sem alterar os limites dos testes. Os demais testes de interface haviam aprovado 51 casos e os testes do rascunho, 5 casos. A checagem final `tsc --noEmit` também passou.

Build final de produção aprovado sobre a integração atualizada. Publicação em commit próprio de responsividade, sem alterações de banco ou reescrita do histórico remoto.
