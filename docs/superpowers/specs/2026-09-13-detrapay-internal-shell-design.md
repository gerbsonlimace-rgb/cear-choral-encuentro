# DetraPay-Inspired Internal Modules Design

## Goal

Replace the visual shell of the authenticated participant, regent, and administration modules with a cohesive DetraPay-inspired operating interface while preserving the Encontro de Coros black-and-gold identity and all existing business behavior.

## Scope

- Participant authenticated surfaces under `/participante`, including attendance and the persistent media player.
- Regent authenticated surfaces under `/regente`, including participant management and profile/logout controls.
- Administration surfaces under `/admin`, including summary, registrations, choirs, sponsors, documents, activities, CoroApp integration, settings, and embedded panels.
- Shared operational components used only by these authenticated areas.

## Explicitly Out of Scope

- Public homepage and institutional content.
- `/acessar` and its authentication/recovery presentation.
- Public registration and payment-confirmation presentation.
- Business rules, permissions, data loading, server functions, database schema, and route contracts.
- DetraPay branding, logos, financial terminology, and financial business logic.

## Visual Direction

The modules remain light. The dominant canvas is a cool warm-white neutral with white content surfaces, compact borders, and restrained shadows. Black creates the structural frame and high-contrast typography. Gold is reserved for active navigation, focus, selected states, key icons, and primary emphasis.

- Body type: Manrope for dense operational readability.
- Display type: Cinzel only for selective brand moments, never routine app headings.
- Corners: 10-14px, avoiding oversized pill-shaped containers.
- Spacing: compact 4/8/12/16/24/32px rhythm.
- Icons: Lucide, paired with text for navigation and actions that are not universally understood.
- Motion: brief CSS transitions, disabled under reduced-motion preference.
- Touch targets: at least 44px on mobile.

## Shared Shell

### Desktop

- Fixed 48px black topbar with event identity, current module label, and profile/logout affordance.
- White collapsible left sidebar with grouped navigation.
- Active sidebar item uses a pale gold surface, black text, and a gold icon/edge marker.
- Main content uses a constrained readable width with compact page headers and optional actions.

### Mobile

- Fixed compact black topbar with module title and contextual profile/action control.
- White bottom navigation with three primary destinations and a `Mais` item.
- Active destination uses gold icon/text and a 3px gold indicator.
- `Mais` opens a bottom sheet containing secondary routes with icons and descriptions.
- Safe-area padding and `100dvh` behavior are mandatory.

## Module Navigation

### Participant

- Primary: Início, Cantos, Documentos.
- More: Guia, Meu perfil, logout/admin access when authorized.
- Persistent media-player behavior remains intact.

### Regent

- Primary: Resumo, Participantes, Perfil.
- Choir selection and payment-complement actions remain where their task context requires them.

### Administration

- Primary mobile: Resumo, Inscrições, Coros.
- More: Patrocinadores, Documentos, Atividades, Integrações, Configurações.
- Desktop shows all authorized destinations in a collapsible sidebar.

## Component Language

- `InternalAppShell`: responsive frame, topbar, desktop sidebar, mobile bottom navigation, more sheet, and content inset.
- `InternalPageHeader`: eyebrow/module context, title, supporting copy, and action area.
- `InternalMetricCard`: icon, label, tabular value, optional supporting status.
- Existing shadcn primitives retain their APIs but receive internal-module styling through scoped tokens and shell classes.
- Lists and tables become cards on narrow screens, preserving semantic labels and actions.
- Loading, empty, error, and unavailable states use the same icon-led panel language.

## Accessibility and Behavior

- Keep visible labels, `aria-current`, landmark names, keyboard focus, and live error roles.
- Black-on-gold and black-on-white combinations must preserve readable contrast.
- Gold is not the sole status signal; icons and text remain present.
- Existing tests for routes, permissions, data loading, filters, playback, and logout continue to describe behavior.

## Implementation Safety

- Work only in the existing `codex/impeccable-light-polish` worktree.
- Preserve the dirty primary checkout unchanged.
- Do not push, deploy, or mutate Supabase as part of this redesign.
- The pre-existing `AdminRegistrationsPage` advanced-filter test exceeds its 5s timeout before these changes; track it separately from redesign regressions.
