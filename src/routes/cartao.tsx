import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { PublicParticipantCardPage } from "@/features/public-attendance/PublicParticipantCardPage";

export const Route = createFileRoute("/cartao")({
  validateSearch: z.object({ token: z.string().max(64).catch("") }),
  beforeLoad: ({ search }) => {
    if (!/^[a-f0-9]{64}$/.test(search.token ?? "")) {
      throw redirect({ to: "/chamada", replace: true });
    }
  },
  component: CardRoute,
  head: () => ({ meta: [{ title: "Meu cartão | Encontro de Coros" }, { name: "robots", content: "noindex, nofollow" }, { name: "referrer", content: "no-referrer" }, { name: "color-scheme", content: "light" }] }),
});

function CardRoute() {
  return <PublicParticipantCardPage token={Route.useSearch().token} />;
}
