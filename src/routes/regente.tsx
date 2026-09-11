import { Outlet, createFileRoute, redirect, useLocation } from "@tanstack/react-router";

import { RegentPortalPage } from "@/features/regent/RegentPortalPage";
import type { RegentAccess } from "@/features/regent/regent.domain";
import { getRegentAccess } from "@/lib/regent.functions";

function getRegentPortalRedirect(access: RegentAccess) {
  if (access.status === "password_change_required") return "/regente/alterar-senha" as const;
  if (access.status !== "authorized") return "/regente/login" as const;
  return null;
}

function shouldCheckRegentPortalAccess(pathname: string) {
  return pathname === "/regente" || pathname === "/regente/";
}

export const Route = createFileRoute("/regente")({
  beforeLoad: async ({ location }) => {
    if (!shouldCheckRegentPortalAccess(location.pathname)) return {};
    const access = await getRegentAccess();
    const destination = getRegentPortalRedirect(access);
    if (destination) throw redirect({ to: destination });
    if (access.status !== "authorized") throw redirect({ to: "/regente/login" });
    return { regentAccess: access };
  },
  component: RegentPortalRoute,
  head: () => ({
    meta: [
      { title: "Área do regente | Encontro de Coros" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function RegentPortalRoute() {
  const location = useLocation();
  const { regentAccess } = Route.useRouteContext();
  if (!shouldCheckRegentPortalAccess(location.pathname)) return <Outlet />;
  if (!regentAccess) return null;
  return <RegentPortalPage access={regentAccess} />;
}
