import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/regente")({ component: RegentRoute });
function RegentRoute() {
  return <Outlet />;
}
