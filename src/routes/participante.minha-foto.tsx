import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useCallback } from "react";

import logo from "@/assets/logo-coros-branco.png";
import { ParticipantPhotoArtGate } from "@/features/photo-art/ParticipantPhotoArtGate";
import { PhotoArtEditor } from "@/features/photo-art/PhotoArtEditor";
import { getParticipantAccess } from "@/lib/participant.functions";

export const Route = createFileRoute("/participante/minha-foto")({
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
  const navigate = useNavigate();
  const onMissingAccess = useCallback(() => {
    void navigate({ to: "/acessar", replace: true });
  }, [navigate]);

  return (
    <ParticipantPhotoArtGate checkAccess={getParticipantAccess} onMissingAccess={onMissingAccess}>
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
    </ParticipantPhotoArtGate>
  );
}
