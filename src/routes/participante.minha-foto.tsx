import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import logo from "@/assets/logo-coros-branco.png";
import { PhotoArtEditor } from "@/features/photo-art/PhotoArtEditor";
import { getPhotoArtRedirect } from "@/features/photo-art/photoArtAccess";
import { getParticipantAccess } from "@/lib/participant.functions";

export const Route = createFileRoute("/participante/minha-foto")({
  beforeLoad: async () => {
    const access = await getParticipantAccess();
    const destination = getPhotoArtRedirect(access);
    if (destination) throw redirect({ to: destination });
  },
  component: ParticipantPhotoArtPage,
  head: () => ({
    meta: [
      { title: "Minha foto do encontro | Área do participante" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "color-scheme", content: "light" },
    ],
  }),
});

function ParticipantPhotoArtPage() {
  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-950">
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-3 sm:h-16 sm:px-6">
          <Link
            to="/participante"
            aria-label="Voltar à área do participante"
            className="flex min-h-10 items-center gap-1.5 rounded-full px-1.5 text-sm font-extrabold text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d2a400]"
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
