import { createFileRoute } from "@tanstack/react-router";
import { EventFeedbackPage } from "@/features/event-feedback/EventFeedbackPage";
import { submitEventFeedback } from "@/lib/event-feedback.functions";

const title = "Sua voz faz a diferença | Avaliação do Encontro de Coros";
const description =
  "Conte como foi sua experiência no II Encontro de Coros. Avaliação anônima, rápida e sem login.";
export const Route = createFileRoute("/avaliacao")({
  component: () => <EventFeedbackPage onSubmit={(data) => submitEventFeedback({ data })} />,
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://encontrocorosce.lovable.app/avaliacao" },
      {
        property: "og:image",
        content: "https://encontrocorosce.lovable.app/og-coros-diocesanos-v7.jpg",
      },
      { name: "color-scheme", content: "light" },
    ],
    links: [{ rel: "canonical", href: "https://encontrocorosce.lovable.app/avaliacao" }],
  }),
});
