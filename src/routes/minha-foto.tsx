import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import logo from "@/assets/logo-coros-branco.png";
import { PhotoArtEditor } from "@/features/photo-art/PhotoArtEditor";

export const Route = createFileRoute("/minha-foto")({
  component: MinhaFotoPage,
  head: () => ({
    meta: [
      { title: "Crie sua foto | II Encontro de Coros" },
      {
        name: "description",
        content:
          "Crie uma foto personalizada do II Encontro de Coros em Quixadá para baixar e compartilhar.",
      },
    ],
  }),
});

function MinhaFotoPage() {
  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-950">
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            to="/"
            aria-label="Voltar ao site do encontro"
            className="flex min-h-11 items-center gap-2 rounded-full px-2 text-sm font-extrabold text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d2a400]"
          >
            <ArrowLeft aria-hidden="true" className="size-5" />
            <span className="hidden sm:inline">Voltar</span>
          </Link>
          <img
            src={logo}
            alt="II Encontro de Coros Diocesanos e Litúrgicos"
            className="h-11 w-auto max-w-[13.5rem] object-contain"
          />
          <span aria-hidden="true" className="w-10 sm:w-[4.25rem]" />
        </div>
      </header>
      <main>
        <PhotoArtEditor />
      </main>
    </div>
  );
}
