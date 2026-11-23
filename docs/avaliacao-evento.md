# Avaliação pública do encontro

Atualização mais recente (23/11/2026): a pedido do usuário, CPF/e-mail foram removidos. A página começa diretamente com a pergunta geral e os cinco quadros de notas. O POST aceita somente opiniões e UUID aleatório, usando novamente upsert direto pelo servidor. O controle de identificadores criado anteriormente permanece privado e sem uso pelo formulário; nenhuma informação histórica foi apagada. O contador continua refletindo avaliações salvas, sem deduplicação por pessoa.

Rota: `/avaliacao`. Não exige login. Três etapas: avaliação geral; seis aspectos; sugestão opcional. O topo mostra apenas a logo discreta, “Sua voz faz a diferença” e os contadores. A avaliação geral e os critérios usam cinco quadros clicáveis com emojis e notas de 1 a 5, apenas um selecionado por vez, seleção por toque/teclado e descrição acessível da nota. Cada critério tem um ícone Lucide. “Não utilizei” está disponível somente em Alimentação e Hospedagem. As respostas aparecem diretamente na tela, sem combobox. Só o conteúdo das perguntas rola; progresso, navegação e envio permanecem visíveis, respeitando as áreas seguras do celular.

## Situação

Publicação autorizada em 23/11/2026. Migrações aplicadas no projeto `fppmdkcwtnrvpqtfurdn` pelo SQL Editor do Supabase, em uma única transação. A migração de arquivamento recebeu a versão exclusiva `20261120130001`, corrigindo a duplicidade anterior. As definições já existentes foram reconciliadas sem remover dados. O banco antigo `mtkjsrbywymwixwscosf` e a cópia Lovable com banco `fszpjxrpzlnsddgvxonc` não receberam alterações.

## Antes de publicar

Publicada em 23/11/2026 pelo projeto Lovable original. Link: https://encontrocorosce.lovable.app/avaliacao. Código integrado ao `main` em `2dedaab`; Lovable confirmou “Publicado” e “Seu site está atualizado”. A conferência abaixo foi concluída, com a ressalva de não enviar opiniões fictícias pelo formulário público.

1. A solicitação antiga de gênero no Lovable corresponde à migração já aplicada; evitar reaplicações desnecessárias.
2. Migrações `20261120120000`, `20261120130000`, `20261120130001` e `20261123215216` aplicadas e registradas. A tabela de avaliação é independente; não altera inscrições, Auth, presenças ou finanças.
3. Confirmar no ambiente do servidor `SUPABASE_URL=https://fppmdkcwtnrvpqtfurdn.supabase.co` e `SUPABASE_SERVICE_ROLE_KEY` desse mesmo projeto. A chave de serviço nunca deve receber prefixo `VITE_`. Uma chave antiga em `.env.local` precisa ser substituída antes de um teste integrado.
4. Erros de tipos preexistentes corrigidos: campo `gender`, `BlobPart` na geração de cartões e mocks sem `archiveCall`. TypeScript e build passaram.
5. Integrar esta branch sem reescrever histórico publicado e publicar pelo projeto Lovable original. Não criar um site separado.
6. Gravação como `service_role` e upsert com o mesmo UUID validados no banco real dentro de uma transação revertida: uma linha, nota atualizada, nenhum registro fictício persistido. O formulário público não foi submetido com opiniões fictícias. Permissões públicas de leitura e escrita direta permaneceram revogadas.

## Persistência e privacidade

O POST público valida o payload completo com Zod e usa o cliente de serviço apenas no servidor. Não solicita CPF, e-mail ou login. O schema estrito recusa campos de identificação adicionais. Retries com o mesmo UUID atualizam a única avaliação; o snapshot da sessão preserva respostas em falhas de conexão.

A equipe destinatária recebe opiniões sem identificação. O controle é pseudonimizado: o proprietário do banco pode correlacionar metadados transacionais e tem acesso ao segredo, portanto não se promete anonimato contra esse administrador. O campo livre orienta a não incluir dados pessoais. Não há login, comprovação de titularidade ou unificação automática entre CPF e e-mail da mesma pessoa.

A tabela possui RLS e revoga acesso de `public`, `anon` e `authenticated`; respostas não são listadas publicamente. Não há nome, CPF, email, ID de usuário, inscrição ou IP nas linhas de opiniões. O comentário é opcional e limitado a 1.000 caracteres. Apenas Alimentação e Hospedagem permitem `NULL` para “Não utilizei”; os outros quatro critérios exigem nota de 1 a 5 no servidor e no banco.

O navegador mantém o snapshot de um envio tentado na sessão para recuperar recargas após perda de conexão. O servidor salva por upsert atômico com o mesmo UUID, evitando duplicação e preservando alterações de uma nova tentativa. A confirmação só aparece após sucesso do servidor. Isso não impõe unicidade por pessoa: a avaliação continua anônima.

Os totais públicos são consultas de contagem, sem retornar inscrições ou avaliações: inscrições não canceladas e total de avaliações salvas. Um total indisponível aparece como “—”, nunca como zero inventado. O contador é atualizado após um envio bem-sucedido.

O convite e o botão de compartilhamento foram removidos a pedido do usuário. A rota mantém metadados Open Graph e Twitter renderizados no servidor, URL canônica pública e a imagem oficial JPEG de 1200×630 para a prévia do link no WhatsApp. A prévia real em aplicativos externos só estará disponível após a publicação da rota.

Atualização do compartilhamento em 23/11: o HTML de produção já respondia com metadados corretos a WhatsApp e Facebook Crawler, com imagem JPEG pública e robots permitindo acesso. Para renovar a prévia antiga observada pelo usuário, o título passou a destacar “Avalie o II Encontro de Coros”, a imagem recebeu URL própria `/og-avaliacao-encontro-2026-v2.jpg` e o link para um teste novo é `/avaliacao?convite=avaliacao-2026-v2`. O canônico permanece `/avaliacao`. A renderização dentro do WhatsApp não é garantida pelo site e não foi simulada enviando mensagens.

## Verificação realizada

- `npx vitest run src/features/event-feedback`: 13 testes passaram.
- `npm run build`: passou.
- Migração executada em Postgres descartável via `scripts/verify-event-feedback.mjs`, com RLS, permissões, limites e retries verificados.
- Inspeção em celulares de 390px e 320px. Em 320×568, o documento permaneceu com 568px de altura e scrollTop zero; ao rolar 1.412px de perguntas, a posição dos botões permaneceu idêntica. Respostas diretas, sem selects, controles de pelo menos 44px.
- HTML SSR retornou 200 com og:url, og:image, secure_url, tipo JPEG, dimensões, texto alternativo e twitter:card. O arquivo da imagem foi conferido em 1200×630.

Após as migrações, o banco manteve 157 inscrições ativas e zero avaliações. RLS habilitada; `anon` sem leitura/escrita; gravação disponível ao servidor. O site publicado carregou esses mesmos totais, confirmando sua conexão com o projeto correto. Metadados canônicos e imagem Open Graph conferidos na página pública. Em 390×844, rolar as perguntas manteve os dois botões na posição y=749,2 e o documento com altura de 844px.

Verificação da publicação: 19 testes direcionados passaram e `npx tsc --noEmit` e `npm run build` passaram. A suíte completa teve 1.462 testes aprovados, oito falhas preexistentes em quatro arquivos sem alterações nesta branch e dois testes ignorados.
