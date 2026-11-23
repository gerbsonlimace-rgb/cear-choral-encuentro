# Avaliação pública do encontro

Rota: `/avaliacao`. Não exige login. Três etapas: avaliação geral; seis aspectos; sugestão opcional. O topo mostra apenas a logo discreta, “Sua voz faz a diferença” e os contadores. A avaliação geral e os critérios usam cinco quadros clicáveis com emojis e notas de 1 a 5, apenas um selecionado por vez, seleção por toque/teclado e descrição acessível da nota. Cada critério tem um ícone Lucide. “Não utilizei” está disponível somente em Alimentação e Hospedagem. As respostas aparecem diretamente na tela, sem combobox. Só o conteúdo das perguntas rola; progresso, navegação e envio permanecem visíveis, respeitando as áreas seguras do celular.

## Situação

Implementação preparada na branch `codex/avaliacao-evento`, sobre a configuração atual de `origin/main`. Publicação adiada a pedido do usuário. O banco atual é `fppmdkcwtnrvpqtfurdn`; o banco antigo `mtkjsrbywymwixwscosf` e a cópia Lovable com banco `fszpjxrpzlnsddgvxonc` não devem receber esta migração por engano.

## Antes de publicar

1. Resolver a migração anterior pendente no projeto Lovable original `e6f04773-e2dc-44c3-a483-34df39d64822`, conforme o trabalho que a originou. Não aprová-la automaticamente como parte desta avaliação.
2. Aplicar `supabase/migrations/20261123215216_event_feedback.sql` no banco atual. A tabela é nova e independente; não altera inscrições, Auth, presenças ou finanças.
3. Confirmar no ambiente do servidor `SUPABASE_URL=https://fppmdkcwtnrvpqtfurdn.supabase.co` e `SUPABASE_SERVICE_ROLE_KEY` desse mesmo projeto. A chave de serviço nunca deve receber prefixo `VITE_`. Uma chave antiga em `.env.local` precisa ser substituída antes de um teste integrado.
4. Resolver os erros de tipos preexistentes que o build do Lovable possa exigir: campos `gender`, `BlobPart` na geração de cartões e mocks sem `archiveCall`. O build Vite da avaliação já passou.
5. Integrar esta branch sem reescrever histórico publicado e publicar pelo projeto Lovable original. Não criar um site separado.
6. Validar um envio no ambiente autorizado, confirmar uma única linha em `event_feedback` e testar nova tentativa com o mesmo UUID. Verificar que visitantes não conseguem consultar respostas.

## Persistência e privacidade

O POST público valida o payload completo com Zod e usa o cliente de serviço apenas no servidor. A tabela possui RLS e revoga acesso de `public`, `anon` e `authenticated`; respostas não são listadas publicamente. Não há nome, CPF, email, ID de usuário, inscrição ou IP na avaliação. O comentário é opcional e limitado a 1.000 caracteres. Apenas Alimentação e Hospedagem permitem `NULL` para “Não utilizei”; os outros quatro critérios exigem nota de 1 a 5 no servidor e no banco.

O navegador mantém o snapshot de um envio tentado na sessão para recuperar recargas após perda de conexão. O servidor salva por upsert atômico com o mesmo UUID, evitando duplicação e preservando alterações de uma nova tentativa. A confirmação só aparece após sucesso do servidor. Isso não impõe unicidade por pessoa: a avaliação continua anônima.

Os totais públicos são consultas de contagem, sem retornar inscrições ou avaliações: inscrições não canceladas e total de avaliações salvas. Um total indisponível aparece como “—”, nunca como zero inventado. O contador é atualizado após um envio bem-sucedido.

O convite e o botão de compartilhamento foram removidos a pedido do usuário. A rota mantém metadados Open Graph e Twitter renderizados no servidor, URL canônica pública e a imagem oficial JPEG de 1200×630 para a prévia do link no WhatsApp. A prévia real em aplicativos externos só estará disponível após a publicação da rota.

## Verificação realizada

- `npx vitest run src/features/event-feedback`: 13 testes passaram.
- `npm run build`: passou.
- Migração executada em Postgres descartável via `scripts/verify-event-feedback.mjs`, com RLS, permissões, limites e retries verificados.
- Inspeção em celulares de 390px e 320px. Em 320×568, o documento permaneceu com 568px de altura e scrollTop zero; ao rolar 1.412px de perguntas, a posição dos botões permaneceu idêntica. Respostas diretas, sem selects, controles de pelo menos 44px.
- HTML SSR retornou 200 com og:url, og:image, secure_url, tipo JPEG, dimensões, texto alternativo e twitter:card. O arquivo da imagem foi conferido em 1200×630.

Não houve envio de avaliação ou alteração de schema no banco de produção.
