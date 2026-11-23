# Avaliação pública do encontro

Rota: `/avaliacao`. Não exige login. Quatro etapas: avaliação geral; sete aspectos com a contribuição para o coro na mesma tela; intenção de voltar; sugestão opcional. A página usa a logo e a fotografia oficiais existentes, com espaços reduzidos e controles de pelo menos 44px para celular.

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

O POST público valida o payload completo com Zod e usa o cliente de serviço apenas no servidor. A tabela possui RLS e revoga acesso de `public`, `anon` e `authenticated`; respostas não são listadas publicamente. Não há nome, CPF, email, ID de usuário, inscrição ou IP na avaliação. O comentário é opcional e limitado a 1.000 caracteres. Notas de aspectos não utilizados são `NULL`, não zero.

O navegador mantém o snapshot de um envio tentado na sessão para recuperar recargas após perda de conexão. O servidor salva por upsert atômico com o mesmo UUID, evitando duplicação e preservando alterações de uma nova tentativa. A confirmação só aparece após sucesso do servidor. Isso não impõe unicidade por pessoa: a avaliação continua anônima.

## Verificação realizada

- `npx vitest run src/features/event-feedback`: 9 testes passaram.
- `npm run build`: passou.
- Migração executada em Postgres descartável via `scripts/verify-event-feedback.mjs`, com RLS, permissões, limites e retries verificados.
- Inspeção visual em desktop e celulares de 390px e 320px; controles de nota acima de 44px e sem rolagem horizontal.

Não houve envio de avaliação ou alteração de schema no banco de produção.
