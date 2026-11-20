# Chamada pública Implementation Plan

> **Para trabalhadores agenteicos:** SUB-HABILIDADE OBRIGATÓRIA: Use superpowers:executing-plans para implementar este plano task-by-task. Etapas usam sintaxe de checkbox (`- [ ]`) para rastreio.

**Goal:** Gerar cartões individuais e uma chamada pública contínua com progresso das inscrições confirmadas.

**Architecture:** Cartões opacos persistidos no servidor; uma RPC atômica registra a leitura e devolve progresso. Um leitor contínuo alimenta fila limitada sem esperar a rede. Relatórios e portal reutilizam a tabela de presenças existente.

**Tech Stack:** TanStack Start, React, Supabase/Postgres, Zod, BarcodeDetector, ZXing, qrcode, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-20-chamada-publica-qr-design.md`

## Global Constraints

- `/chamada` e `/cartão` públicas, sem login nem chave da equipe.
- `payment_status = 'paid' AND cancelled_at IS NULL`; não alterar finanças.
- Câmera contínua; nenhuma pausa artificial entre QR diferentes.
- Presença única por `(activity_id, registration_id)`; tabelas e RPCs somente service_role.
- Preservar alterações locais, histórico Lovable e `/euvou`.

## Review Focus

- Uma inscrição sem conta Auth deve funcionar: teste SQL com conta inexistente.
- Dois leitores e fluxo antigo não podem duplicar: teste SQL de conflito cruzado.
- Respostas concorrentes não podem regredir progresso: teste da fila e UI.
- Falha de rede não significa sucesso: teste pendências, retry e próximo QR.
- Browser sem BarcodeDetector e desmontagem durante permissão: teste do scanner.

### Task 1: Dados e serviço

**Files:** nova migração; `src/features/public-attendance/publicAttendance.{domain,server,repository.server}.ts`; `src/lib/public-attendance.functions.ts`; testes e `scripts/verify-public-attendance.mjs`.

**Interfaces:** `PublicAttendanceActivity {id,title,activityDate,startsAt,endsAt,totalConfirmed,attended,revision}`; `PublicAttendanceResult {status,participantName,checkedInAt,activity}`; `PublicParticipantCard {name,choirName,cardUrl,qrDataUrl,eligible}`.

- [ ] Escrever e executar testes vermelhos de validação/token/CSV e script SQL de elegibilidade, duplicidade e permissões.
- [ ] Implementar tabela de cartões, emissão idempotente, progresso agregado e RPC única de leitura; migrar unicidade do fluxo antigo sem perder histórico.
- [ ] Implementar repositório, serviço e server functions; exportação administrativa usa snapshot e não divulga dados por endpoint público.
- [ ] Executar testes focados e SQL em banco descartável; resultado esperado: zero falhas.

### Task 2: Scanner e fila

**Files:** `src/features/public-attendance/continuousQrScanner.ts`, `attendanceScanQueue.ts` e testes.

**Interfaces:** `startContinuousQrScanner(video,onRead,signal): Promise<cleanup>`; `createAttendanceScanQueue({submit,onChange,onResult,concurrency})` com `enqueue,retryFailed,dispose`.

- [ ] Testar QR distintos enquanto servidor pendente, dedup, falha recuperável, fila limitada e cancelamento do scanner.
- [ ] Implementar detecção contínua nativa e fallback ZXing, mantendo stream aberto e encerrando tracks ao sair.
- [ ] Implementar até três envios concorrentes, supressão por token, limite de pendências e retry explícito.
- [ ] Executar testes focados; resultado esperado: zero falhas.

### Task 3: Páginas e administração

**Files:** `PublicAttendancePage.tsx`, `PublicParticipantCardPage.tsx`, `AdminAttendanceCardsActions.tsx`; rotas `chamada.tsx`, `cartao.tsx`; integrar ações em `AdminEventActivitiesPage.tsx`; testes.

**Interfaces:** consome tipos e fila anteriores e funções públicas GET/POST; exportação administrativa retorna CSV preparado.

- [ ] Testar lista, seleção/início, progresso confirmado, duplicado, retry e câmera persistente.
- [ ] Criar páginas móveis simples, pausa/som, progresso, feedback e pendências; polling/foco sem regressão por respostas antigas.
- [ ] Adicionar preparação/exportação de cartões e link da chamada à programação administrativa; preparar download antes do clique final.
- [ ] Gerar route tree pelo Vite e executar testes, TypeScript, build e verificação visual móvel/desktop.

### Task 4: Revisão e entrega

- [ ] Revisar todos os requisitos com um revisor independente e corrigir achados relevantes com evidência.
- [ ] Verificar migração/publicação separadamente e gerar cartões reais somente quando ambiente correto estiver comprovado.
- [ ] Relatar URLs/artefatos realmente disponíveis e limitações de câmera física/publicação com precisão.