# Área de apoio/patrocínio em fundo claro e cards de patrocinadores com legenda

## Objetivo
A seção única `#patrocinadores` sai do cartão escuro e passa a ser exibida em fundo claro, na mesma linguagem das demais seções da página. Os cards de patrocinadores vêm do cadastro do admin (como já ocorre) e passam a exibir o nome abaixo da logo, como legenda.

## O que muda (visível para o usuário)
- Fundo claro na área toda: remover o cartão escuro (`bg-foreground`) e o texto branco; título, subtítulo e descrição passam para as cores padrão da página (texto escuro sobre fundo claro), mantendo o rótulo "Apoio, organização e patrocínio" com o destaque âmbar.
- Cards institucionais (Organização / Apoio institucional) seguem iguais, já são claros; apenas se ajustam ao novo fundo (borda sutil para não "sumir" no fundo).
- Cards de patrocinadores reformatados:
  - Área da logo com altura uniforme, centralizada, sem distorcer.
  - Legenda com o nome do patrocinador abaixo da logo, com quebra de linha em até 2 linhas e altura mínima consistente para alinhar a grade.
  - Borda sutil, cantos arredondados e espaçamento interno uniforme; grade responsiva (2 colunas no celular, 3–4 no desktop).
- Quando não houver patrocinadores ativos cadastrados, a subseção de patrocinadores continua oculta (comportamento atual preservado).

## Detalhes técnicos
- `src/routes/index.tsx` (`SponsorsSection`): trocar o contêiner escuro por fundo claro com tokens semânticos (`bg-card`/`bg-background`, `text-foreground`, `text-muted-foreground`); remover classes de texto branco (`text-white`, `text-white/72`) substituindo por tokens.
- `src/features/sponsors/PublicSponsorsSection.tsx`: reestruturar o card para `logo em área fixa (object-contain) + <h3>/figcaption com o nome` (usar `<figure>`/`<figcaption>` para legenda semântica), com `line-clamp-2`, `min-h` na legenda, `border border-border` e grid responsivo.
- Testes: atualizar `src/features/sponsors/PublicSponsorsSection.test.tsx` para afirmar que o nome aparece como legenda; ajustar `src/routes/-index.test.tsx` se alguma classe/texto assertado mudar.
- Sem mudanças de backend, schema ou RLS.

## Verificação
- `bunx vitest run` nos dois arquivos de teste afetados; `bunx tsgo --noEmit`.
- Playwright em `http://localhost:8080/#patrocinadores` (desktop e mobile) conferindo fundo claro, logos alinhadas e legendas com nome; checar `/tmp/observability/build-errors.log`.
