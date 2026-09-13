---
name: Encontro de Coros
description: Identidade sacra contemporânea para campanha pública e operação interna clara.
colors:
  ink: "#18181b"
  gold: "#d5a900"
  gold-soft: "#fff8d6"
  canvas: "#f7f7f5"
  surface: "#ffffff"
  muted-text: "#52525b"
  border: "#e4e4e7"
  destructive: "#b91c1c"
typography:
  display:
    fontFamily: "Cinzel, Georgia, serif"
    fontWeight: 700
    lineHeight: 1.15
  headline:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.25
rounded:
  sm: "8px"
  md: "10px"
  lg: "12px"
  xl: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    height: "44px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
    height: "44px"
---

# Design System: Encontro de Coros

## Overview

**Creative North Star: "O Console de Regência"**

O sistema combina a solenidade musical da marca com a objetividade de uma mesa de regência: estrutura escura e precisa, superfícies claras para trabalho e sinais dourados usados somente onde orientam a ação. O resultado deve parecer contemporâneo, comunitário e confiável, sem transformar o tema sacro em ornamentação institucional pesada.

Há duas expressões coordenadas. O portal público pode usar a voz cerimonial de Cinzel e a energia visual da campanha. Participante, Regente e Administração são superfícies operacionais light, densas e legíveis, com Manrope em toda a hierarquia, topbar preta, navegação branca e dourado como sinal de estado.

**Key Characteristics:**

- Base light em branco levemente aquecido, nunca branco infinito sem estrutura.
- Preto organiza a arquitetura; dourado indica foco, seleção e prioridade.
- Ícones Lucide acompanham rótulos em navegação e ações não universais.
- Densidade compacta, alvos de toque confortáveis e informação escaneável.
- O portal público e os módulos autenticados compartilham a marca, não a mesma composição.

## Colors

A paleta é curta e hierárquica: tinta preta para estrutura, ouro litúrgico para orientação e neutros claros para manter a interface leve.

### Primary

- **Tinta de Partitura**: estrutura, tipografia principal, topbars e botões primários.
- **Ouro Litúrgico**: foco, estado ativo, ícones-chave e marcadores de navegação.

### Secondary

- **Luz Dourada**: fundo de seleção, destaque discreto e resposta de hover sem perder leveza.

### Neutral

- **Papel de Ensaio**: canvas dos módulos autenticados.
- **Branco de Superfície**: cards, sidebars, sheets e campos.
- **Grafite de Apoio**: metadados e texto secundário com contraste legível.
- **Linha de Pauta**: bordas e divisores finos.
- **Vermelho de Alerta**: erros e ações destrutivas, sempre acompanhado por texto.

### Named Rules

**The Gold Is a Signal Rule.** Dourado marca seleção, foco ou prioridade; não preenche grandes áreas decorativas.

**The Light Has Structure Rule.** Telas claras sempre preservam hierarquia por bordas, blocos brancos e enquadramento preto.

## Typography

**Display Font:** Cinzel (com Georgia)

**Body Font:** Manrope (com ui-sans-serif e system-ui)

**Character:** Cinzel pertence aos momentos cerimoniais da campanha pública. Manrope conduz todos os fluxos operacionais por ser compacto, claro e estável em dados, formulários e navegação.

### Hierarchy

- **Display** (700, escala responsiva, 1.15): grandes momentos de marca no portal público.
- **Headline** (800, 28px, 1.2): título principal de página nos módulos internos.
- **Title** (700, 18–20px, 1.3): seções, diálogos e cards de tarefa.
- **Body** (400, 14–16px, 1.5): instruções e conteúdo; parágrafos longos ficam próximos de 70 caracteres.
- **Label** (600–700, 12px, 1.25): campos, métricas, estados e navegação compacta; texto funcional nunca fica abaixo de 11px.

### Named Rules

**The One Operational Voice Rule.** Participante, Regente e Administração usam Manrope inclusive nos títulos; Cinzel não entra nos fluxos de trabalho.

## Layout

Os módulos autenticados usam uma topbar fixa de 48px. A partir de 768px, uma sidebar branca de 240px apresenta todos os destinos e pode ser recolhida para 72px; o conteúdo recebe o mesmo recuo estrutural. Abaixo desse ponto, a sidebar sai e uma barra inferior com 72px apresenta três destinos principais e “Mais”, respeitando a safe area.

O conteúdo usa largura legível por módulo e ritmo de 4, 8, 12, 16, 24 e 32px. Cards de métricas formam grids responsivos; tabelas e listas preservam cartões móveis e semântica. Alvos interativos têm pelo menos 44px.

## Elevation & Depth

A profundidade é predominantemente tonal e estrutural. Cards comuns usam borda fina e sombra ambiente quase imperceptível; topbar e navegação móvel recebem sombras suaves apenas para separar camadas fixas do conteúdo.

### Shadow Vocabulary

- **Card ambiente** (`0 1px 2px rgba(24,24,27,0.04)`): separação mínima de métricas e superfícies brancas.
- **Topbar estrutural** (`0 2px 12px rgba(24,24,27,0.12)`): mantém o enquadramento preto acima do conteúdo.
- **Navegação móvel** (`0 -8px 24px rgba(24,24,27,0.06)`): distingue a barra fixa sem criar peso visual.

### Named Rules

**The Flat-by-Default Rule.** Bordas e contraste tonal fazem o trabalho; sombras existem apenas para hierarquia entre camadas.

## Shapes

Controles e superfícies usam cantos moderadamente curvos de 8 a 16px. Navegação e botões ficam entre 8 e 12px; cards e sheets podem chegar a 16px. Pílulas ficam restritas a badges e estados curtos. Marcadores ativos usam linhas douradas finas, não faixas laterais decorativas em conteúdo.

## Components

### Buttons

- **Shape:** retângulo compacto com cantos de 8px e altura mínima de 44px.
- **Primary:** tinta preta, texto branco, peso 600; dourado fica para o foco e não compete com a ação.
- **Hover / Focus:** transição curta; foco recebe contorno dourado de 2px com afastamento visível.
- **Secondary / Ghost:** superfície branca ou transparente, borda neutra e hover em luz dourada ou cinza claro.

### Chips

- **Style:** texto curto, cantos totalmente arredondados e contraste por fundo, borda e rótulo.
- **State:** seleção usa luz dourada mais ícone ou texto; status não depende apenas da cor.

### Cards / Containers

- **Corner Style:** cantos de 12px.
- **Background:** branco sobre papel de ensaio.
- **Shadow Strategy:** sombra ambiente baixa; cards aninhados preferem somente borda.
- **Border:** linha de pauta de 1px.
- **Internal Padding:** 16px no mobile e até 20px em métricas desktop.

### Inputs / Fields

- **Style:** superfície branca, borda cinza, cantos de 8px e altura mínima de 44px.
- **Focus:** contorno dourado de 2px; caret dourado.
- **Error / Disabled:** vermelho com mensagem explícita; estado desabilitado reduz contraste sem remover o rótulo.

### Navigation

- Desktop usa sidebar branca, ícones de 18px e item ativo em luz dourada com marcador dourado.
- Mobile mostra três destinos primários com ícones de 20px; destinos secundários abrem um bottom sheet com descrição.
- A topbar preta identifica produto e módulo; perfil e saída ficam contextuais, sem disputar atenção.

### Metric Card

Métricas usam ícone dourado em bloco de 40px, rótulo de 12px, valor tabular forte e detalhe opcional. O ícone reforça significado, nunca substitui o rótulo.

## Do's and Don'ts

### Do:

- **Do** mantenha a base light e use preto para enquadrar navegação e ações principais.
- **Do** reserve dourado para foco, seleção, indicadores e ícones de prioridade.
- **Do** combine ícones com texto e preserve `aria-current`, foco visível e alvos de 44px.
- **Do** mantenha três destinos primários no mobile e mova o restante para “Mais”.

### Don't:

- **Don't** altere a composição do portal público ao evoluir os módulos autenticados.
- **Don't** use Cinzel em dashboards, formulários, tabelas ou navegação operacional.
- **Don't** transforme cards e controles comuns em pílulas grandes.
- **Don't** use dourado como único sinal de status ou em grandes fundos decorativos.
- **Don't** introduza gradientes, sombras duras ou ornamentação que reduza a leitura.
