# Avaliação pública Implementation Plan

> **For agentic workers:** Execute inline with verification at each task.

**Goal:** Página pública mobile em `/avaliacao` com cinco perguntas e persistência anônima.
**Architecture:** React/TanStack Start; schema Zod compartilhado; handler público POST com import dinâmico de repositório server-only; tabela independente Supabase com RLS e acesso service-role.
**Tech Stack:** React, TypeScript, CSS, Vitest, Supabase/Postgres.
**Spec:** `docs/superpowers/specs/2026-11-23-avaliacao-design.md`

## Global Constraints
- Preservar logo e identidade do evento; sem login ou identificação pessoal.
- Não alterar inscrições, rifas, receitas, `/euvou` ou histórico publicado.
- Alvos de 44px, suporte a 320px, foco visível e redução de movimento.

## Review Focus
- Resposta ausente ou inválida: rejeitar antes de salvar.
- Aspecto não utilizado: aceitar explicitamente, nunca confundir com nota zero.
- Falha de rede: preservar respostas e permitir nova tentativa idempotente.
- Duplo envio: apenas uma linha por UUID.
- Público: pode enviar pelo servidor; não pode ler avaliações.

## Tasks
- [x] Escrever testes de schema e envio (valores inválidos, anonimato, idempotência e erro); observar falha, implementar domínio, serviço, função e migração; executar testes.
- [x] Escrever testes do fluxo completo, retorno e retry; observar falha, implementar página e rota com logo, arte, progresso e controles acessíveis; executar testes.
- [x] Verificar tipos/build, migração e permissões; inspecionar mobile e desktop; detector visual; revisar alterações e entregar resultado verificável.

## Ledger
- Escopo e identidade aprovados pelo usuário na pergunta estruturada. Execução no checkout existente, preservando arquivos não relacionados.
- Branch `codex/avaliacao-evento` criada sobre `origin/main`, incluindo a conexão atual `fppmdkcwtnrvpqtfurdn`.
- Revisão independente encontrou perda de UUID após recarga e confirmação de respostas antigas em retries editados. Ambos corrigidos: snapshot em sessionStorage e upsert atômico por UUID. Regressões observadas RED→GREEN; 8 testes passaram.
- Migração verificada em Postgres descartável com PGlite: notas/limite de texto, NULL explícito, RLS, permissões e atualização idempotente passaram.
- Build de produção passou. `tsc` permanece bloqueado por erros preexistentes em gender, BlobPart e mocks de presença; nenhum erro nos novos arquivos.
- Layout inspecionado em desktop, 390px e 320px. Em 320px: sem overflow horizontal, notas com alvos de aproximadamente 49×49px. Detector executado; apenas avisos de escalas e tons já intencionais para legibilidade/contraste nesta superfície.
- Usuário solicitou deixar a implementação pronta para publicar depois. Nenhuma migração remota, push ou publicação executados.
