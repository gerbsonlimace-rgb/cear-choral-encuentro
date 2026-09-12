# Área única de apoio, organização e patrocinadores

## Objetivo
Unificar “Apoio e organização” e “Patrocinadores” em uma única área da página inicial, e exibir os cards de patrocinadores vindos do cadastro feito no módulo administrativo (em vez das logos fixas no código).

## Como vai ficar
- Uma seção só, com um título e um texto de abertura sobre quem realiza e quem apoia o encontro.
- No topo da área, os dois cards institucionais: Coro Diocesano de Quixadá (Organização) e Diocese de Quixadá (Apoio institucional).
- Abaixo, na mesma área, a faixa de logos dos patrocinadores cadastrados no painel de administração, com nome como texto alternativo da imagem.
- Se nenhum patrocinador estiver ativo no cadastro, a área continua aparecendo apenas com os cards institucionais.
- As logos fixas de patrocinadores que hoje estão no código deixam de ser usadas; a lista passa a refletir exatamente o cadastro.

## Observação
Organização e apoio institucional seguem fixos, porque o cadastro do admin hoje só guarda nome, logo e situação (ativo/inativo) — não há como marcar um cadastro como “organização”. Se quiser também gerenciá-los pelo painel, isso vira um ajuste adicional no cadastro.

## Detalhes técnicos
- `src/routes/index.tsx`: fundir `SponsorsSection` em uma seção única; remover o array `sponsors` e os imports das logos fixas; renderizar `PublicSponsorsSection` (já existente em `src/features/sponsors/PublicSponsorsSection.tsx`) dentro da área unificada.
- Ajustar `PublicSponsorsSection` para receber a grade de logos sem repetir cabeçalho/título próprio (título passa a ser da área unificada), mantendo o retorno vazio quando não há patrocinadores ativos.
- Dados vêm de `getPublicSponsors` (`src/lib/sponsor.functions.ts`), sem mudanças de backend, RLS ou schema.
- Atualizar `PublicSponsorsSection.test.tsx` e os testes de home (`src/routes/-index.test.tsx`) conforme a nova estrutura.

## Verificação
- Rodar os testes afetados e o typecheck.
- Conferir a página inicial em desktop e celular com patrocinadores cadastrados e sem nenhum ativo.
