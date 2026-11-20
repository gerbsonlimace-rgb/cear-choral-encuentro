# Named lodging implementation plan

> Execute inline with superpowers:executing-plans.

**Goal:** criar e alocar no sistema os quartos físicos do mapa.
**Architecture:** `named_rooms` opcional no plano singleton; modo específico de visualização/edição, conservando o modo antigo.
**Tech Stack:** React, TanStack Start, Supabase/Postgres, Vitest.
**Spec:** `docs/superpowers/specs/2026-11-20-named-lodging-design.md`.

## Constraints and review focus

- Não modificar valores financeiros, nomes ou coros das inscrições.
- R$ 80 pode manter a atribuição explícita do mapa, sempre com asterisco.
- Até três ocupantes por quarto, incluindo avulsos; não duplicar cadastros.
- Não perder atribuições na hidratação ou ao salvar; manter compatibilidade do modo antigo.
- Não presumir disponibilidade dos quartos sem identificação.

## Tasks

- [x] Testar parser de quartos físicos, chaves inválidas e limite com avulsos; implementar domínio, schema e persistência com migration aditiva.
- [x] Testar hidratação sem gravação automática, asterisco, movimento e recusa de superlotação; implementar tela com quartos por local e pendentes.
- [ ] Rodar testes e build; revisar diff; publicar a alteração conectada ao Lovable.
- [ ] Importar somente correspondências verificadas usando CLI, com validações em transação e leitura posterior; verificar a interface publicada.

## Verification ledger

- Hospedagem: 13 testes passam; TypeScript e build passam. Conferência visual desktop e 390 px sem transbordamento horizontal.
- Revisão independente corrigiu a liberação de vagas de inscrições canceladas; regressão falhou antes e passou depois.
- Suíte completa: 1378 passam, 13 falham, 2 ignorados. As mesmas 13 falhas foram reproduzidas em checkout limpo de `origin/main` (landing, rotas e ações financeiras), sem alterações desta tarefa.
- Migration aplicada e registrada pelo CLI. Importação transacional pelo CLI: 65 quartos, 122 inscrições e 9 avulsos alocados; um motorista avulso pendente. Checksum confirmou que as inscrições não mudaram durante a importação.
- Leitura posterior conferiu ocupação máxima 3, Nelsiana CP17, Neusa CP44, 13 inscrições de R$ 80 e nenhum cadastro/valor/situação de pagamento alterado.
- Foto conferida separadamente: bebê de Samara CP02, Letícia CP08, Flora CP12 e motorista de Dom Edmilson pendente; números antigos da foto não prevalecem sobre correções posteriores. Dados pessoais do mapa ficam somente no plano autorizado, fora do repositório.
