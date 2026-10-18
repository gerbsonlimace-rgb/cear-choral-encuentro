import { Outlet, createFileRoute, redirect, useLocation } from "@tanstack/react-router";

import { RegentPortalPage } from "@/features/regent/RegentPortalPage";
import type { RegentAccess } from "@/features/regent/regent.domain";
import { getRegentPortalBootstrap } from "@/lib/regent.functions";

function getRegentPortalRedirect(access: RegentAccess) {
  if (access.status === "password_change_required") return "/regente/alterar-senha" as const;
  if (access.status !== "authorized") return "/acessar" as const;
  return null;
}

function shouldCheckRegentPortalAccess(pathname: string) {
  return pathname === "/regente" || pathname === "/regente/";
}

export const Route = createFileRoute("/regente")({
  beforeLoad: async ({ location }) => {
    if (!shouldCheckRegentPortalAccess(location.pathname)) return {};
    const bootstrap = await getRegentPortalBootstrap();
    const access = bootstrap.access;
    const destination = getRegentPortalRedirect(access);
    if (destination) throw redirect({ to: destination });
    if (access.status !== "authorized") throw redirect({ to: "/acessar" });
    return { regentBootstrap: bootstrap };
  },
  component: RegentPortalRoute,
  head: () => ({
    meta: [
      { name: "description", content: "Área do regente no portal do II Encontro de Coros Diocesanos e Litúrgicos do Ceará." },
      { property: "og:title", content: "Área do regente | Encontro de Coros" },
      { property: "og:description", content: "Área do regente no portal do II Encontro de Coros Diocesanos e Litúrgicos do Ceará." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Área do regente | Encontro de Coros" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function RegentPortalRoute() {
  const location = useLocation();
  const { regentBootstrap } = Route.useRouteContext();
  if (!shouldCheckRegentPortalAccess(location.pathname)) return <Outlet />;
  if (!regentBootstrap || regentBootstrap.access.status !== "authorized") return null;
  return <RegentPortalPage access={regentBootstrap.access} initialData={regentBootstrap} />;
}
