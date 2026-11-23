# Avaliação pública Implementation Plan

> **For agentic workers:** Execute inline with verification at each task.

**Goal:** Página pública mobile em `/avaliacao` com quatro perguntas e persistência anônima.
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
- Ajustes solicitados: remover Transporte, reunir contribuição com os sete aspectos na mesma etapa e compactar o layout mantendo alvos de 44px. Fluxo reduzido para quatro etapas; teste do agrupamento e validação observado RED→GREEN, nove testes passaram.
- Compactação visual desfeita a pedido do usuário. Espaçamento original e opções de contribuição em uma coluna restaurados; Transporte continua removido e contribuição permanece junto dos demais aspectos.
- Ajustes finais: cabeçalho só com logo discreta/nome e contadores agregados; opções diretas, sem combobox; perguntas com rolagem interna e navegação fora dela. Convite e botão WhatsApp removidos, metadados OG preservados. Contadores sem dados nunca mostram zero artificial. Doze testes passaram; build e HTML SSR verificados. Revisão independente não encontrou problemas importantes em privacidade, contadores ou metadados. Publicação permanece adiada.
- Estrelas substituem notas numéricas, com preenchimento acumulado, hover e teclado. Ícones por critério. “Não utilizei” restrito a Alimentação/Hospedagem em UI, schema e migração ainda não aplicada. Novo teste RED→GREEN; treze testes passaram, build e SQL descartável passaram. Em 320×568, estrelas têm alvos de aproximadamente 51×48px e os botões permanecem fora da área rolável.

- Usuário substituiu estrelas por quadros clicáveis numerados e pediu emojis: escala 😞/🙁/😐/🙂/🤩 com notas 1–5, uma seleção por critério. Ícones, opção Não utilizei restrita e navegação fixa preservados. Teste ajustado RED→GREEN; treze testes e build passaram; quadros de aproximadamente 49×49px em 320×568.

- Usuário removeu Convivência e a pergunta de contribuição para o coro. Restam seis critérios; Estrutura agora descreve organização do espaço e dos materiais do encontro. Campos removidos também do payload, schema, serviço e migração ainda não publicada; treze testes, SQL descartável e build passaram. Link localhost enviado por engano foi desconsiderado.
