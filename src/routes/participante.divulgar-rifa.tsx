import { createFileRoute, redirect } from "@tanstack/react-router";

import { ParticipantRaffleSharePage } from "@/features/participant/ParticipantRaffleSharePage";
import { getParticipantAccess } from "@/lib/participant.functions";

export const Route = createFileRoute("/participante/divulgar-rifa")({
  ssr: false,
  beforeLoad: async () => {
    const access = await getParticipantAccess();
    if (access.status !== "authorized") throw redirect({ to: "/acessar" });
  },
  head: () => ({
    meta: [
      { title: "Divulgar rifa beneficente | Área do participante" },
      { name: "description", content: "Crie e compartilhe a arte da rifa beneficente do seu coro." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ParticipantRaffleSharePage,
});
