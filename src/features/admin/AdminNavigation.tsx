import {
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Files,
  HeartHandshake,
  LayoutDashboard,
  Megaphone,
  MoreHorizontal,
  Music2,
  Settings,
} from "lucide-react";
import { useState, type MouseEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type AdminNavigationKey =
  | "summary"
  | "registrations"
  | "choirs"
  | "sponsors"
  | "documents"
  | "notices"
  | "activities"
  | "integrations"
  | "settings";

type AdminNavigationProps = {
  current: AdminNavigationKey;
  /** Retained while callers migrate; participant access is no longer an admin menu item. */
  canAccessParticipant?: boolean;
  navigateTo?: (to: AdminNavigationPath) => void;
};

export type AdminNavigationPath =
  | "/admin/inscricoes"
  | "/admin/resumo"
  | "/admin/coros"
  | "/admin/patrocinadores"
  | "/admin/documentos"
  | "/admin/avisos"
  | "/admin/atividades"
  | "/admin/configuracoes"
  | "/participante";

const links = [
  { key: "summary", href: "/admin/resumo", label: "Resumo", icon: LayoutDashboard },
  { key: "registrations", href: "/admin/inscricoes", label: "Inscrições", icon: ClipboardList },
  { key: "choirs", href: "/admin/coros", label: "Coros", icon: Music2 },
  { key: "activities", href: "/admin/atividades", label: "Programação", icon: CalendarCheck2 },
  { key: "sponsors", href: "/admin/patrocinadores", label: "Patrocinadores", icon: HeartHandshake },
  { key: "documents", href: "/admin/documentos", label: "Documentos", icon: Files },
  { key: "notices", href: "/admin/avisos", label: "Avisos", icon: Megaphone },
  { key: "settings", href: "/admin/configuracoes", label: "Configurações", icon: Settings },
] as const satisfies ReadonlyArray<{
  key: AdminNavigationKey;
  href: AdminNavigationPath;
  label: string;
  icon: typeof LayoutDashboard;
}>;

export function AdminNavigation({ current, navigateTo }: AdminNavigationProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const secondaryActive = links.slice(3).some(({ key }) => key === current);

  const handleNavigation = (event: MouseEvent<HTMLAnchorElement>, href: AdminNavigationPath) => {
    if (navigateTo) {
      event.preventDefault();
      navigateTo(href);
    }
    setMoreOpen(false);
  };

  return (
    <>
      <header
        data-testid="admin-topbar"
        className="fixed inset-x-0 top-0 z-50 flex h-12 items-center gap-2.5 border-b border-white/10 bg-brand-ink px-3 text-white shadow-[0_2px_12px_rgba(24,24,27,0.12)] sm:px-4"
      >
        <span className="grid size-7 place-items-center rounded-lg bg-brand-gold text-brand-ink">
          <Music2 aria-hidden="true" className="size-4" />
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[13px] font-bold tracking-tight sm:text-sm">
            Encontro de Coros
          </span>
          <span className="block truncate text-[11px] font-medium text-white/70">
            Administração
          </span>
        </span>
      </header>

      <aside
        data-testid="admin-sidebar"
        className={cn(
          "fixed bottom-0 left-0 top-12 z-40 hidden flex-col border-r border-white/10 bg-brand-ink text-primary-foreground shadow-[4px_0_18px_rgba(24,24,27,0.08)] transition-[width] duration-200 md:flex",
          collapsed ? "w-[4.5rem]" : "w-60",
        )}
      >
        <div className={cn("flex p-2", collapsed ? "justify-center" : "justify-end")}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-brand-gold"
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? <ChevronRight aria-hidden="true" /> : <ChevronLeft aria-hidden="true" />}
          </Button>
        </div>
        <nav
          aria-label="Navegação administrativa"
          className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 pb-4"
        >
          {links.map(({ key, href, label, icon: Icon }) => {
            const active = current === key;
            return (
              <a
                key={key}
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={collapsed ? label : undefined}
                title={collapsed ? label : undefined}
                className={cn(
                  "group relative flex min-h-11 items-center rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold",
                  collapsed ? "justify-center px-2" : "gap-3 px-3",
                  active
                    ? "bg-brand-gold text-brand-ink"
                    : "text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground",
                )}
                onClick={(event) => handleNavigation(event, href)}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-brand-gold"
                  />
                )}
                <Icon
                  aria-hidden="true"
                  className={cn(
                    "size-[18px] shrink-0",
                    active ? "text-brand-ink" : "text-primary-foreground/70 group-hover:text-brand-gold",
                  )}
                />
                {!collapsed && <span className="truncate">{label}</span>}
              </a>
            );
          })}
        </nav>
      </aside>

      <nav
        aria-label="Navegação móvel administrativa"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-brand-ink px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(24,24,27,0.16)] md:hidden"
      >
        <div className="mx-auto flex h-[4.5rem] max-w-lg items-stretch">
          {links.slice(0, 3).map(({ key, href, label, icon: Icon }) => {
            const active = current === key;
            return (
              <a
                key={key}
                href={href}
                data-testid="mobile-admin-navigation-item"
                aria-label={`Abrir ${label}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-gold",
                  active ? "text-brand-gold" : "text-primary-foreground/75 hover:text-primary-foreground",
                )}
                onClick={(event) => handleNavigation(event, href)}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-brand-gold"
                  />
                )}
                <Icon aria-hidden="true" className="size-5" />
                <span className="max-w-full truncate">{label}</span>
              </a>
            );
          })}
          <button
            type="button"
            data-testid="mobile-admin-navigation-item"
            aria-label="Mais opções administrativas"
            aria-current={secondaryActive ? "page" : undefined}
            className={cn(
              "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-gold",
              secondaryActive ? "text-brand-gold" : "text-primary-foreground/75 hover:text-primary-foreground",
            )}
            onClick={() => setMoreOpen(true)}
          >
            {secondaryActive && (
              <span
                aria-hidden="true"
                className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-brand-gold"
              />
            )}
            <MoreHorizontal aria-hidden="true" className="size-5" />
            <span>Mais</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          aria-label="Mais opções de Administração"
          className="internal-app rounded-t-2xl border-zinc-200 bg-white px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5"
        >
          <SheetHeader className="pr-10 text-left">
            <SheetTitle className="font-body text-lg font-bold">
              Mais opções de Administração
            </SheetTitle>
            <SheetDescription>Acesse as demais áreas de gestão do encontro.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 grid gap-2">
            {links.slice(3).map(({ key, href, label, icon: Icon }) => {
              const active = current === key;
              return (
                <SheetClose key={key} asChild>
                  <a
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-14 items-center gap-3 rounded-xl border px-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold",
                      active
                        ? "border-brand-gold/60 bg-brand-gold-soft text-brand-ink"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
                    )}
                    onClick={(event) => handleNavigation(event, href)}
                  >
                    <span
                      className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-lg",
                        active ? "bg-brand-gold text-brand-ink" : "bg-zinc-100 text-zinc-600",
                      )}
                    >
                      <Icon aria-hidden="true" className="size-[18px]" />
                    </span>
                    <span className="text-sm font-bold">{label}</span>
                  </a>
                </SheetClose>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
