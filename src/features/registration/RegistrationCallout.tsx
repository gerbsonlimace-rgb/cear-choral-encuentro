import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  Award,
  BedDouble,
  CreditCard,
  MessageCircle,
  Music2,
  QrCode,
  ShoppingBag,
  Sparkles,
  Utensils,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export function RegistrationCallout() {
  const [selectedOption, setSelectedOption] = useState<"integral" | "raffles">("integral");

  return (
    <section
      id="inscricao"
      aria-labelledby="registration-callout-title"
      className="relative isolate scroll-mt-20 overflow-hidden bg-[#ffc400] px-4 py-12 text-black sm:px-6 lg:py-16"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 size-72 rounded-full border-[42px] border-white/25" />
        <div className="absolute -bottom-36 -right-28 size-96 rounded-full border-[56px] border-black/10" />
        <Music2 className="absolute left-[5%] top-1/2 size-20 -rotate-12 text-black/10" />
        <Sparkles className="absolute right-[6%] top-12 size-16 rotate-12 text-white/50" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.15fr] lg:gap-10">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-xs font-extrabold uppercase tracking-[0.16em] text-[#ffc400]">
              <Sparkles className="size-4" aria-hidden="true" />
              Inscrição
            </p>
            <h2
              id="registration-callout-title"
              className="mt-4 max-w-xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl"
            >
              Tudo o que você precisa para viver o encontro
            </h2>
            <p className="mt-4 max-w-2xl text-base font-medium leading-relaxed text-black/70">
              Três dias de música, formação e partilha. Sua inscrição inclui:
            </p>
            <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {[
                {
                  icon: Award,
                  label: "Formações e certificado",
                  description:
                    "Acesso às formações e certificado assinado pelo Prof. Dr. Clayton Dias.",
                },
                {
                  icon: Utensils,
                  label: "Alimentação",
                  description: "Refeições nos três dias do evento.",
                },
                {
                  icon: BedDouble,
                  label: "Hospedagem",
                  description: "Acolhimento durante todo o encontro.",
                },
                {
                  icon: ShoppingBag,
                  label: "Kit do evento",
                  description: "Um kit para acompanhar você nessa experiência.",
                },
              ].map(({ icon: Icon, label, description }) => (
                <li
                  key={label}
                  className="rounded-2xl border-2 border-black/10 bg-white p-3 shadow-[4px_4px_0_rgba(0,0,0,0.14)] transition-transform hover:-translate-y-1 sm:p-4"
                >
                  <span className="mb-2 inline-flex size-10 items-center justify-center rounded-xl bg-[#ffc400] text-black">
                    <Icon className="size-5" strokeWidth={2} aria-hidden="true" />
                  </span>
                  <h3 className="text-sm font-extrabold">{label}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-black/65">{description}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[2rem] border-2 border-black bg-black p-6 text-white shadow-[10px_10px_0_rgba(255,255,255,0.45)] sm:p-8">
            <p className="text-center text-xs font-extrabold uppercase tracking-[0.18em] text-[#ffc400]">
              Escolha como participar
            </p>
            <div
              role="radiogroup"
              aria-label="Opções de inscrição"
              className="mt-5 grid grid-cols-2 items-stretch gap-3"
            >
              <button
                type="button"
                role="radio"
                aria-checked={selectedOption === "integral"}
                aria-label="Opção A: inscrição integral"
                onClick={() => setSelectedOption("integral")}
                className={`flex h-full flex-col rounded-2xl border-2 p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffc400] focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                  selectedOption === "integral"
                    ? "border-[#ffc400] bg-white/15"
                    : "border-white/20 bg-white/10 hover:border-white/45"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="inline-flex size-8 items-center justify-center rounded-lg bg-[#ffc400] text-sm font-extrabold text-black">
                    A
                  </span>
                  <p className="text-sm font-extrabold">Inscrição integral</p>
                </div>
                <p className="mt-4 font-display text-3xl font-extrabold tracking-tight">
                  R$ 300,00
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/70">
                  Pague agora via Pix ou cartão em até <strong className="text-white">5x</strong>.
                </p>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={selectedOption === "raffles"}
                aria-label="Opção B: programa de rifas"
                onClick={() => setSelectedOption("raffles")}
                className={`flex h-full flex-col rounded-2xl border-2 p-4 text-left text-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                  selectedOption === "raffles"
                    ? "border-white bg-[#ffc400]"
                    : "border-[#ffc400]/60 bg-[#ffc400]/80 hover:border-white"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="inline-flex size-8 items-center justify-center rounded-lg bg-black text-sm font-extrabold text-[#ffc400]">
                    B
                  </span>
                  <p className="text-sm font-extrabold">Programa de rifas</p>
                </div>
                <p className="mt-4 font-display text-3xl font-extrabold tracking-tight">
                  R$ 100,00 agora
                </p>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-black/70">
                  + valor restante com a venda de rifas até 30/10.
                </p>
                <p className="mt-auto pt-3 text-xs font-bold leading-relaxed text-black/70">
                  Exclusivo para membros de coros que aderiram ao programa. Procure seu regente.
                </p>
              </button>
            </div>

            <div
              role="group"
              aria-label="Formas de pagamento"
              className="mt-4 grid grid-cols-2 gap-2"
            >
              <div className="rounded-xl border border-white/15 bg-white/10 p-3 text-left">
                <span className="inline-flex size-8 items-center justify-center rounded-lg bg-[#ffc400] text-black">
                  <QrCode className="size-4" aria-hidden="true" />
                </span>
                <p className="mt-2 text-sm font-extrabold">Pix</p>
                <p className="mt-0.5 text-xs text-white/65">À vista</p>
              </div>
              <div className="rounded-xl border border-white/15 bg-white/10 p-3 text-left">
                <span className="inline-flex size-8 items-center justify-center rounded-lg bg-[#ffc400] text-black">
                  <CreditCard className="size-4" aria-hidden="true" />
                </span>
                <p className="mt-2 text-sm font-extrabold">Cartão</p>
                <p className="mt-0.5 text-xs text-white/65">Em até 5x</p>
              </div>
            </div>

            <Button
              asChild
              size="lg"
              className="mt-6 min-h-14 w-full rounded-full bg-[#ffc400] text-base font-extrabold text-black hover:bg-[#ffd336] focus-visible:ring-white"
            >
              <Link to="/inscricao">
                Inscrever-se agora
                <ArrowRight className="size-5" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
        <div className="mt-10 border-t border-black/20 pt-6">
          <p className="text-base font-semibold">
            Evento destinado a membros de coros diocesanos e litúrgicos.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-black/65">
            Não faz parte de um coro e deseja participar? Entre em contato com a coordenação.
          </p>
          <a
            href="https://wa.me/5585999033232"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex min-h-11 max-w-full items-center gap-3 rounded-full bg-white px-4 py-2 text-sm font-extrabold text-black shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-4 focus-visible:ring-offset-[#ffc400]"
          >
            <MessageCircle className="size-5 shrink-0" aria-hidden="true" />
            <span>
              Falar com a coordenação pelo WhatsApp
              <span className="mt-1 block font-semibold text-black/60">(85) 99903-3232</span>
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
