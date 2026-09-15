import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/participante")({
  head: () => ({
    meta: [
      { title: "Área do participante — II Encontro de Coros Diocesanos e Litúrgicos" },
      {
        name: "description",
        content:
          "Acesse sua inscrição no II Encontro de Coros Diocesanos e Litúrgicos e baixe o comprovante em PDF.",
      },
      { property: "og:title", content: "Área do participante — II Encontro de Coros" },
      {
        property: "og:description",
        content: "Consulte sua inscrição e baixe o comprovante em PDF.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "theme-color", content: "#ffffff" },
      { name: "color-scheme", content: "light" },
    ],
  }),
  component: () => <Outlet />,
});
