import { createFileRoute } from "@tanstack/react-router";
import { EventFeedbackPage } from "@/features/event-feedback/EventFeedbackPage";
import { getPublicFeedbackStats, submitEventFeedback } from "@/lib/event-feedback.functions";
import { FEEDBACK_URL } from "@/features/event-feedback/eventFeedback.domain";

const title = "Avalie o II Encontro de Coros | Sua voz faz a diferença";
const description =
  "Como foi o encontro para você? Responda à avaliação em cerca de 1 minuto e ajude a equipe organizadora a preparar o próximo encontro.";
const socialImage = "https://encontrocorosce.lovable.app/og-avaliacao-branca-5-estrelas-v3.jpg";
export const Route = createFileRoute("/avaliacao")({
  component: () => (
    <EventFeedbackPage
      onSubmit={(data) => submitEventFeedback({ data })}
      loadStats={getPublicFeedbackStats}
    />
  ),
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: FEEDBACK_URL },
      { property: "og:locale", content: "pt_BR" },
      { property: "og:site_name", content: "Encontro de Coros · Ceará" },
      {
        property: "og:image",
        content: socialImage,
      },
      { property: "og:image:secure_url", content: socialImage },
      { property: "og:image:url", content: socialImage },
      { property: "og:image:type", content: "image/jpeg" },
      { property: "og:image:width", content: "1733" },
      { property: "og:image:height", content: "907" },
      {
        property: "og:image:alt",
        content: "Avalie o encontro. Sua voz faz a diferença. Leva só 1 minuto. É anônimo. Logo do encontro e cinco estrelas douradas com um cursor clicando na quinta.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: socialImage },
      { name: "color-scheme", content: "light" },
    ],
    links: [{ rel: "canonical", href: FEEDBACK_URL }],
  }),
});
