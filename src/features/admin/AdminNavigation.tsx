import { CalendarDays, ClipboardList, Files, HeartHandshake, LayoutDashboard, Music2, Settings } from "lucide-react";

type AdminNavigationProps = {
  current: "summary" | "registrations" | "choirs" | "activities" | "sponsors" | "documents" | "settings";
  navigateTo?: (to: AdminNavigationPath) => void;
};

export type AdminNavigationPath =
  | "/admin/resumo"
  | "/admin/inscricoes"
  | "/admin/coros"
  | "/admin/atividades"
  | "/admin/patrocinadores"
  | "/admin/documentos"
  | "/admin/configuracoes";

export function AdminNavigation({ current, navigateTo }: AdminNavigationProps) {
  const linkClass = (active: boolean) =>
    `flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
      active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
    }`;

  const links = [
    ["summary", "/admin/resumo", "Resumo", LayoutDashboard],
    ["registrations", "/admin/inscricoes", "Inscrições", ClipboardList],
    ["choirs", "/admin/coros", "Coros", Music2],
    ["activities", "/admin/atividades", "Programação", CalendarDays],
    ["sponsors", "/admin/patrocinadores", "Patrocinadores", HeartHandshake],
    ["documents", "/admin/documentos", "Documentos", Files],
    ["settings", "/admin/configuracoes", "Configurações", Settings],
  ] as const;

  return (
    <nav
      aria-label="Navegação administrativa"
      className="flex gap-1 overflow-x-auto rounded-xl border bg-card p-1 [scrollbar-width:thin]"
    >
      {links.map(([key, href, label, Icon]) => (
        <a
          key={key}
          href={href}
          aria-current={current === key ? "page" : undefined}
          className={linkClass(current === key)}
          onClick={(event) => {
            if (navigateTo) {
              event.preventDefault();
              navigateTo(href);
            }
          }}
        >
          <Icon aria-hidden="true" className="size-4" />
          {label}
        </a>
      ))}
    </nav>
  );
}
