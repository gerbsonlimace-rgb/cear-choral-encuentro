import { createFileRoute, Link } from "@tanstack/react-router";
import logo from "@/assets/logo-coros-preto.png";
import { RegistrationSection } from "@/features/registration/RegistrationSection";
import "@/features/registration/registration-page.css";

export const Route = createFileRoute("/inscricao")({
  component: RegistrationPage,
  head: () => ({
    meta: [
      { title: "Inscrição | II Encontro de Coros" },
      {
        name: "description",
        content:
          "Inscreva-se no II Encontro de Coros Diocesanos e Litúrgicos, de 20 a 22 de novembro de 2026, em Quixadá.",
      },
    ],
  }),
});

function RegistrationPage() {
  return (
    <div className="registration-page public-event-page min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6 lg:h-[4.5rem]">
          <Link
            to="/"
            className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-sm font-bold text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Página inicial
          </Link>
          <img
            src={logo}
            alt="II Encontro de Coros Diocesanos e Litúrgicos"
            className="h-12 w-auto min-w-0 max-w-[40%] object-contain"
          />
        </div>
      </header>
      <main>
        <h1 className="sr-only">Inscrição no II Encontro de Coros</h1>
        <RegistrationSection />
      </main>
    </div>
  );
}
