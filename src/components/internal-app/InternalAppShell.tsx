import { ChevronLeft, ChevronRight, LogOut, MoreHorizontal, UserRound } from "lucide-react";
import { useMemo, useState, type ComponentType, type MouseEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import eventLogo from "@/assets/logo-coros-preto.png";
import { cn } from "@/lib/utils";

type NavigationIcon = ComponentType<{
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}>;

export type InternalNavItem = {
  id: string;
  label: string;
  description?: string;
  icon: NavigationIcon;
  href?: string;
};

export type InternalAppShellProps = {
  brandLabel?: string;
  moduleLabel: string;
  navItems: readonly InternalNavItem[];
  mobilePrimaryCount?: number;
  activeId: string;
  onNavigate?: (id: string) => void;
  children?: ReactNode;
  layout?: "page" | "navigation";
  profileName?: string;
  profileDetail?: string;
  onSignOut?: () => void;
  signingOut?: boolean;
  topbarActions?: ReactNode;
  className?: string;
};

export function InternalAppShell({
  brandLabel = "Encontro de Coros",
  moduleLabel,
  navItems,
  mobilePrimaryCount = 3,
  activeId,
  onNavigate,
  children,
  profileName,
  profileDetail,
  onSignOut,
  signingOut = false,
  topbarActions,
  className,
  layout = "page",
}: InternalAppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const primaryItems = useMemo(
    () => navItems.slice(0, mobilePrimaryCount),
    [mobilePrimaryCount, navItems],
  );
  const secondaryItems = useMemo(
    () => navItems.slice(mobilePrimaryCount),
    [mobilePrimaryCount, navItems],
  );
  const secondaryActive = secondaryItems.some((item) => item.id === activeId);

  const navigate = (event: MouseEvent, item: InternalNavItem) => {
    if (
      item.href &&
      (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)
    )
      return;
    if (onNavigate) {
      event.preventDefault();
      onNavigate(item.id);
    }
    setMoreOpen(false);
  };

  return (
    <div
      className={cn(
        "internal-app text-foreground",
        layout === "page" ? "min-h-svh bg-background" : "contents",
        className,
      )}
    >
      <header
        data-testid="internal-topbar"
        className="fixed inset-x-0 top-0 z-50 flex h-12 items-center gap-3 border-b border-white/10 bg-brand-ink px-3 text-white shadow-[0_2px_12px_rgba(24,24,27,0.12)] sm:px-4"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="flex h-8 w-14 shrink-0 items-center overflow-hidden rounded-md bg-white/[0.06] px-1 sm:w-[5.5rem]">
            <img
              src={eventLogo}
              alt="Logo do II Encontro de Coros"
              className="h-7 w-full object-contain object-left"
            />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13px] font-bold tracking-tight sm:text-sm">{brandLabel}</p>
            <p className="truncate text-[11px] font-medium text-white/70">{moduleLabel}</p>
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {topbarActions}
          {(profileName || onSignOut) && (
            <div className="flex items-center gap-2 rounded-lg bg-white/[0.07] p-1">
              {profileName && (
                <div className="hidden max-w-44 min-w-0 items-center gap-2 px-1 sm:flex">
                  <span className="grid size-7 shrink-0 place-items-center rounded-md bg-white/10 text-brand-gold">
                    <UserRound aria-hidden="true" className="size-4" />
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate text-xs font-semibold">{profileName}</span>
                    {profileDetail && (
                      <span className="block truncate text-[11px] text-white/70">
                        {profileDetail}
                      </span>
                    )}
                  </span>
                </div>
              )}
              {onSignOut && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={signingOut ? "Saindo" : "Sair"}
                  className="size-9 text-white hover:bg-white/10 hover:text-brand-gold"
                  disabled={signingOut}
                  onClick={onSignOut}
                >
                  <LogOut aria-hidden="true" />
                </Button>
              )}
            </div>
          )}
        </div>
      </header>

      <div className={layout === "page" ? "flex min-h-svh pt-12" : "contents"}>
        <aside
          data-testid="internal-sidebar"
          className={cn(
            "top-12 hidden h-[calc(100svh-3rem)] shrink-0 flex-col border-r border-white/10 bg-brand-ink text-primary-foreground shadow-[4px_0_18px_rgba(24,24,27,0.08)] transition-[width] duration-200 md:flex",
            layout === "page" ? "sticky" : "fixed bottom-0 left-0 z-40",
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
            aria-label={`Navegação de ${moduleLabel}`}
            className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 pb-4"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const Control = item.href ? "a" : "button";
              const active = item.id === activeId;
              return (
                <Control
                  key={item.id}
                  type={item.href ? undefined : "button"}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group relative flex min-h-11 items-center rounded-xl text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold",
                    collapsed ? "justify-center px-2" : "gap-3 px-3",
                    active
                      ? "bg-brand-gold text-brand-ink"
                      : "text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground",
                  )}
                  onClick={(event) => navigate(event, item)}
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
                      active
                        ? "text-brand-ink"
                        : "text-primary-foreground/70 group-hover:text-brand-gold",
                    )}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Control>
              );
            })}
          </nav>
        </aside>

        {layout === "page" && (
          <main className="min-w-0 flex-1 px-4 pb-[calc(5.75rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 md:pb-8 md:pt-6 lg:px-8">
            {children}
          </main>
        )}
      </div>

      <nav
        aria-label={`Navegação móvel de ${moduleLabel}`}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-brand-ink px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(24,24,27,0.16)] md:hidden"
      >
        <div className="mx-auto flex h-[4.5rem] max-w-lg items-stretch">
          {primaryItems.map((item) => {
            const Icon = item.icon;
            const Control = item.href ? "a" : "button";
            const active = item.id === activeId;
            return (
              <Control
                key={item.id}
                type={item.href ? undefined : "button"}
                href={item.href}
                data-testid="internal-mobile-primary-item"
                aria-label={`Abrir ${item.label}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-gold",
                  active
                    ? "text-brand-gold"
                    : "text-primary-foreground/75 hover:text-primary-foreground",
                )}
                onClick={(event) => navigate(event, item)}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-brand-gold"
                  />
                )}
                <Icon aria-hidden="true" className="size-5" />
                <span className="max-w-full truncate">{item.label}</span>
              </Control>
            );
          })}
          {secondaryItems.length > 0 && (
            <button
              type="button"
              aria-label="Mais opções"
              aria-current={secondaryActive ? "page" : undefined}
              className={cn(
                "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-gold",
                secondaryActive
                  ? "text-brand-gold"
                  : "text-primary-foreground/75 hover:text-primary-foreground",
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
          )}
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          aria-label={`Mais opções de ${moduleLabel}`}
          className="internal-app max-h-[85dvh] overflow-y-auto rounded-t-2xl border-zinc-200 bg-white px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5"
        >
          <SheetHeader className="pr-10 text-left">
            <SheetTitle className="font-body text-lg font-bold">
              Mais opções de {moduleLabel}
            </SheetTitle>
            <SheetDescription>
              Acesse as demais áreas de {moduleLabel.toLocaleLowerCase("pt-BR")}.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 grid gap-2">
            {secondaryItems.map((item) => {
              const Icon = item.icon;
              const Control = item.href ? "a" : "button";
              const active = item.id === activeId;
              return (
                <SheetClose key={item.id} asChild>
                  <Control
                    type={item.href ? undefined : "button"}
                    href={item.href}
                    aria-label={item.label}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-14 items-center gap-3 rounded-xl border px-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold",
                      active
                        ? "border-brand-gold/60 bg-brand-gold-soft text-brand-ink"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
                    )}
                    onClick={(event) => navigate(event, item)}
                  >
                    <span
                      className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-lg",
                        active ? "bg-brand-gold text-brand-ink" : "bg-zinc-100 text-zinc-600",
                      )}
                    >
                      <Icon aria-hidden="true" className="size-[18px]" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold">{item.label}</span>
                      {item.description && (
                        <span className="block truncate text-xs text-zinc-500">
                          {item.description}
                        </span>
                      )}
                    </span>
                  </Control>
                </SheetClose>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
