type AdminNavigationProps = {
  current: "registrations" | "choirs" | "sponsors";
  navigateTo?: (to: AdminNavigationPath) => void;
};

export type AdminNavigationPath = "/admin/inscricoes" | "/admin/coros" | "/admin/patrocinadores";

export function AdminNavigation({ current, navigateTo }: AdminNavigationProps) {
  const linkClass = (active: boolean) =>
    `rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
      active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
    }`;

  return (
    <nav
      aria-label="Navegação administrativa"
      className="flex flex-wrap gap-1 rounded-xl border bg-card p-1"
    >
      <a
        href="/admin/inscricoes"
        className={linkClass(current === "registrations")}
        onClick={(event) => {
          if (navigateTo) {
            event.preventDefault();
            navigateTo("/admin/inscricoes");
          }
        }}
      >
        Inscrições
      </a>
      <a
        href="/admin/coros"
        className={linkClass(current === "choirs")}
        onClick={(event) => {
          if (navigateTo) {
            event.preventDefault();
            navigateTo("/admin/coros");
          }
        }}
      >
        Coros e valores
      </a>
      <a
        href="/admin/patrocinadores"
        className={linkClass(current === "sponsors")}
        onClick={(event) => {
          if (navigateTo) {
            event.preventDefault();
            navigateTo("/admin/patrocinadores");
          }
        }}
      >
        Patrocinadores
      </a>
    </nav>
  );
}
