import { Link } from "@tanstack/react-router";
import { ArrowRight, Award, BedDouble, MessageCircle, Utensils } from "lucide-react";

import { Button } from "@/components/ui/button";

export function RegistrationCallout() {
  return (
    <section
      id="inscricao"
      aria-labelledby="registration-callout-title"
      className="scroll-mt-20 bg-foreground px-4 py-12 text-background sm:px-6 lg:py-16"
    >
      <div className="mx-auto max-w-5xl">
        <div className="grid items-center gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-amber">Inscrição</p>
            <h2
              id="registration-callout-title"
              className="mt-3 font-display text-3xl font-bold leading-tight sm:text-4xl"
            >
              Participe do encontro
            </h2>
            <ul className="mt-6 space-y-4 text-sm sm:text-base">
              {[
                { icon: Award, label: "Acesso ao evento com certificado" },
                { icon: Utensils, label: "Alimentação durante todo o evento" },
                { icon: BedDouble, label: "Hospedagem durante todo o evento" },
              ].map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3">
                  <Icon className="size-5 shrink-0 text-amber" aria-hidden="true" />
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-background/20 p-6 text-center sm:p-8">
            <p className="font-display text-5xl font-extrabold tracking-tight text-amber sm:text-6xl">
              <span className="mr-2 text-2xl font-semibold">R$</span>300,00
            </p>
            <p className="mt-3 text-base font-semibold">Parcelamento em até 6x</p>
            <Button
              asChild
              size="lg"
              className="mt-6 min-h-12 w-full rounded-full bg-amber text-base font-extrabold text-amber-foreground hover:bg-amber/90"
            >
              <Link to="/inscricao">
                Inscrever-se agora
                <ArrowRight className="size-5" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
        <div className="mt-8 border-t border-background/20 pt-6 lg:mt-10">
          <p className="text-base font-semibold">
            Evento destinado a membros de coros diocesanos e litúrgicos.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-background/75">
            Não faz parte de um coro e deseja participar? Entre em contato com a coordenação.
          </p>
          <a
            href="https://wa.me/5585999033232"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex min-h-11 max-w-full items-center gap-3 rounded-lg py-2 text-sm font-semibold text-amber underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-4 focus-visible:ring-offset-foreground"
          >
            <MessageCircle className="size-5 shrink-0" aria-hidden="true" />
            <span>
              Falar com a coordenação pelo WhatsApp
              <span className="mt-1 block text-background/75">(85) 99903-3232</span>
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
