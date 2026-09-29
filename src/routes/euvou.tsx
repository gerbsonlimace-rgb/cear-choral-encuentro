import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import logo from "@/assets/logo-coros-branco.png";
import { PhotoArtEditor } from "@/features/photo-art/PhotoArtEditor";

const PAGE_URL = "https://encontrocorosce.lovable.app/euvou";
const SOCIAL_IMAGE_URL = "https://encontrocorosce.lovable.app/euvou-whatsapp.jpg";
const TITLE = "Crie sua foto #EuVou | Encontro de Coros 2026";
const DESCRIPTION =
  "Escolha uma arte, coloque sua foto e compartilhe que você vai ao II Encontro de Coros, em Quixadá.";

export const Route = createFileRoute("/euvou")({
  component: EuVouPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: PAGE_URL },
      { property: "og:image", content: SOCIAL_IMAGE_URL },
      { property: "og:image:secure_url", content: SOCIAL_IMAGE_URL },
      { property: "og:image:type", content: "image/jpeg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        property: "og:image:alt",
        content: "Arte Eu Vou do II Encontro de Coros em Quixadá",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
      { name: "twitter:image", content: SOCIAL_IMAGE_URL },
      { name: "color-scheme", content: "light" },
    ],
    links: [{ rel: "canonical", href: PAGE_URL }],
  }),
});

function EuVouPage() {
  return (
    <div className="internal-app min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-brand-gold/30 bg-brand-ink">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-3 sm:h-16 sm:px-6">
          <Link
            to="/"
            aria-label="Voltar ao site do encontro"
            className="flex min-h-10 items-center gap-1.5 rounded-full px-1.5 text-sm font-extrabold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
          >
            <ArrowLeft aria-hidden="true" className="size-5" />
            <span className="hidden sm:inline">Voltar</span>
          </Link>
          <img
            src={logo}
            alt="II Encontro de Coros Diocesanos e Litúrgicos"
            className="h-9 w-auto max-w-[11.5rem] object-contain sm:h-11 sm:max-w-[13.5rem]"
          />
          <span aria-hidden="true" className="w-8 sm:w-[4.25rem]" />
        </div>
      </header>
      <main>
        <PhotoArtEditor />
      </main>
    </div>
  );
}