import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Award,
  BedDouble,
  MessageCircle,
  Music2,
  ShoppingBag,
  Utensils,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { QuixadaRegistrationArtwork } from "./QuixadaRegistrationArtwork";

export function RegistrationCallout() {
  return (
    <section
      id="inscricao"
      aria-labelledby="registration-callout-title"
      className="relative isolate scroll-mt-20 overflow-hidden bg-[#fcf6e9] pt-12 text-[#393c32] lg:pt-16"
    >
      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-8 lg:grid-cols-[1.5fr_1fr] lg:gap-12">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-[#f3e6c8] px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-[#80602c]">
              <Music2 className="size-4" aria-hidden="true" />
              Inscrição
            </p>
            <h2
              id="registration-callout-title"
              className="mt-3 font-display text-3xl font-bold leading-tight sm:text-4xl"
            >
              Participe do encontro
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#656859] sm:text-base">
              Três dias de música, formação e partilha. Sua inscrição inclui:
            </p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                {
                  icon: Award,
                  label: "Formações e certificado",
                  description:
                    "Acesso às formações e certificado assinado pelo Prof. Dr. Clayton Dias.",
                  color: "bg-[#f4e8cc] text-[#86612c]",
                },
                {
                  icon: Utensils,
                  label: "Alimentação",
                  description: "Refeições nos três dias do evento.",
                  color: "bg-[#e6eddf] text-[#536946]",
                },
                {
                  icon: BedDouble,
                  label: "Hospedagem",
                  description: "Acolhimento durante todo o encontro.",
                  color: "bg-[#e2edf0] text-[#426b76]",
                },
                {
                  icon: ShoppingBag,
                  label: "Kit do evento",
                  description: "Um kit para acompanhar você nessa experiência.",
                  color: "bg-[#eee5f1] text-[#786080]",
                },
              ].map(({ icon: Icon, label, description, color }) => (
                <li
                  key={label}
                  className="rounded-2xl border border-[#e8e1d2] bg-white/75 p-4 sm:p-5"
                >
                  <span
                    className={`mb-3 inline-flex size-11 items-center justify-center rounded-2xl ${color}`}
                  >
                    <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <h3 className="text-base font-bold">{label}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#656859]">{description}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-[#e6d9b8] bg-[#fffdf7] p-6 text-center shadow-[0_12px_40px_-24px_rgba(128,96,44,0.3)] sm:p-8">
            <p className="mb-4 text-xs font-bold uppercase tracking-widest text-[#80602c]">
              Viva esse encontro
            </p>
            <p className="font-display text-5xl font-extrabold tracking-tight text-[#80602c] sm:text-6xl">
              <span className="mr-2 text-2xl font-semibold">R$</span>300,00
            </p>
            <p className="mt-3 text-base font-semibold text-[#656859]">Parcelamento em até 6x</p>
            <Button
              asChild
              size="lg"
              className="mt-6 min-h-12 w-full rounded-full bg-[#ead293] text-base font-extrabold text-[#493c21] hover:bg-[#e1c47d] focus-visible:ring-[#80602c]"
            >
              <Link to="/inscricao">
                Inscrever-se agora
                <ArrowRight className="size-5" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
        <div className="mt-8 border-t border-[#e6decc] pt-6 lg:mt-10">
          <p className="text-base font-semibold">
            Evento destinado a membros de coros diocesanos e litúrgicos.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[#656859]">
            Não faz parte de um coro e deseja participar? Entre em contato com a coordenação.
          </p>
          <a
            href="https://wa.me/5585999033232"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex min-h-11 max-w-full items-center gap-3 rounded-lg py-2 text-sm font-semibold text-[#536946] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#536946] focus-visible:ring-offset-4 focus-visible:ring-offset-[#fcf6e9]"
          >
            <MessageCircle className="size-5 shrink-0" aria-hidden="true" />
            <span>
              Falar com a coordenação pelo WhatsApp
              <span className="mt-1 block text-[#656859]">(85) 99903-3232</span>
            </span>
          </a>
        </div>
      </div>
      <QuixadaRegistrationArtwork />
    </section>
  );
}
