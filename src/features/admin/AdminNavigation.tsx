import {
  CalendarCheck2,
  ClipboardList,
  Files,
  HeartHandshake,
  LayoutDashboard,
  Megaphone,
  Music2,
  Settings,
} from "lucide-react";
import { InternalAppShell } from "@/components/internal-app/InternalAppShell";
import { PortalModeSwitch } from "@/features/access/PortalModeSwitch";

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
  { key: "activities", href: "/admin/atividades", label: "Agenda", icon: CalendarCheck2 },
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
  return (
    <InternalAppShell
      layout="navigation"
      className="admin-navigation"
      moduleLabel="Administração"
      navItems={links.map(({ key, ...item }) => ({ id: key, ...item }))}
      mobilePrimaryCount={4}
      activeId={current}
      onNavigate={
        navigateTo
          ? (id) => {
              const item = links.find(({ key }) => key === id);
              if (item) navigateTo(item.href);
            }
          : undefined
      }
      topbarActions={<PortalModeSwitch mode="admin" onNavigate={navigateTo} />}
    />
  );
}
