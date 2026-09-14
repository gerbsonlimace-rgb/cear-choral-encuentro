import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  Award,
  BedDouble,
  Check,
  CreditCard,
  MessageCircle,
  Music2,
  ShoppingBag,
  Sparkles,
  Ticket,
  Utensils,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export function RegistrationCallout() {
  const [selectedOption, setSelectedOption] = useState<"integral" | "raffles">("integral");

  return (
    <section
      id="inscricao"
      aria-labelledby="registration-callout-title"
      className="relative isolate scroll-mt-20 overflow-hidden bg-[#f7c948] px-4 py-10 text-black sm:px-6 lg:py-14"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 size-72 rounded-full border-[42px] border-white/25" />
        <div className="absolute -bottom-36 -right-28 size-96 rounded-full border-[56px] border-black/10" />
        <Music2 className="absolute left-[5%] top-1/2 size-20 -rotate-12 text-black/10" />
        <Sparkles className="absolute right-[6%] top-12 size-16 rotate-12 text-white/50" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="grid items-center gap-8 lg:grid-cols-[0.88fr_1.3fr] lg:gap-10">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-black/90 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#ffc400]">
              <Sparkles className="size-4" aria-hidden="true" />
              Inscrição
            </p>
            <h2
              id="registration-callout-title"
              className="mt-4 max-w-xl font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl"
            >
              Faça agora sua inscrição
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-black/70">
              Escolha a melhor forma de participar:
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
                  className="rounded-xl border border-black/10 bg-white/90 p-3 shadow-sm transition-transform hover:-translate-y-0.5 sm:p-4"
                >
                  <span className="mb-2 inline-flex size-9 items-center justify-center rounded-lg bg-[#ffc400]/25 text-black">
                    <Icon className="size-5" strokeWidth={2} aria-hidden="true" />
                  </span>
                  <h3 className="text-sm font-bold">{label}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-black/65">{description}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-black/90 bg-[#11100e] p-6 text-white shadow-[0_18px_40px_rgba(0,0,0,0.16)] sm:p-8 lg:p-10">
            <p className="text-center text-sm font-bold uppercase tracking-[0.16em] text-[#ffc400]">
              Escolha sua forma de inscrição
            </p>
            <div
              role="radiogroup"
              aria-label="Opções de inscrição"
              className="mt-7 grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2"
            >
              <button
                type="button"
                role="radio"
                aria-checked={selectedOption === "integral"}
                aria-label="Inscrição integral"
                onClick={() => setSelectedOption("integral")}
                className={`relative flex min-h-[280px] flex-col overflow-hidden rounded-2xl border p-5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffc400] focus-visible:ring-offset-2 focus-visible:ring-offset-[#11100e] sm:p-6 ${
                  selectedOption === "integral"
                    ? "border-[#ffc400] bg-[linear-gradient(145deg,rgba(255,196,0,0.16),rgba(255,196,0,0.05))] shadow-[0_0_0_1px_rgba(255,196,0,0.28),0_16px_30px_rgba(0,0,0,0.22)]"
                    : "border-white/15 bg-white/[0.05] hover:border-[#ffc400]/55 hover:bg-white/[0.07]"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute right-5 top-5 inline-flex size-6 items-center justify-center rounded-full border transition-colors ${
                    selectedOption === "integral"
                      ? "border-[#ffc400] bg-[#ffc400] text-black"
                      : "border-white/30 text-transparent"
                  }`}
                >
                  <Check className="size-4" strokeWidth={3} />
                </span>
                <div className="flex items-center gap-3 pr-8">
                  <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#ffc400] text-black">
                    <CreditCard className="size-5" strokeWidth={2.25} aria-hidden="true" />
                  </span>
                  <p className="text-base font-bold">Inscrição integral</p>
                </div>
                <p className="mt-7 font-display text-4xl font-bold leading-none tracking-tight sm:text-5xl">
                  R$ 300,00
                </p>
                <p className="mt-4 text-sm leading-relaxed text-white/70">
                  Pague à vista no Pix ou em até <strong className="text-white">5x no cartão</strong>.
                </p>
                <p className="mt-auto flex items-center gap-2 pt-6 text-xs font-semibold text-white/60">
                  <Check className="size-4 text-[#ffc400]" aria-hidden="true" />
                  Inscrição quitada na hora
                </p>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={selectedOption === "raffles"}
                aria-label="Programa de rifas"
                onClick={() => setSelectedOption("raffles")}
                className={`relative flex min-h-[280px] flex-col overflow-hidden rounded-2xl border p-5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffc400] focus-visible:ring-offset-2 focus-visible:ring-offset-[#11100e] sm:p-6 ${
                  selectedOption === "raffles"
                    ? "border-[#ffc400] bg-[linear-gradient(145deg,rgba(255,196,0,0.16),rgba(255,196,0,0.05))] shadow-[0_0_0_1px_rgba(255,196,0,0.28),0_16px_30px_rgba(0,0,0,0.22)]"
                    : "border-white/15 bg-white/[0.05] hover:border-[#ffc400]/55 hover:bg-white/[0.07]"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute right-5 top-5 inline-flex size-6 items-center justify-center rounded-full border transition-colors ${
                    selectedOption === "raffles"
                      ? "border-[#ffc400] bg-[#ffc400] text-black"
                      : "border-white/30 text-transparent"
                  }`}
                >
                  <Check className="size-4" strokeWidth={3} />
                </span>
                <div className="flex items-center gap-3 pr-8">
                  <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#ffc400] text-black">
                    <Ticket className="size-5" strokeWidth={2.25} aria-hidden="true" />
                  </span>
                  <p className="text-base font-bold">Programa de rifas</p>
                </div>
                <p className="mt-7 font-display text-4xl font-bold leading-none tracking-tight sm:text-5xl">
                  R$ 100,00
                </p>
                <p className="mt-2 text-sm font-bold uppercase tracking-[0.16em] text-[#ffc400]">
                  Agora
                </p>
                <p className="mt-3 text-sm font-semibold leading-relaxed text-white/70">
                  + valor restante com a venda de rifas até 30/10.
                </p>
                <p className="mt-auto pt-5 text-xs font-semibold leading-relaxed text-white/55">
                  Exclusivo para membros de coros que aderiram ao programa. Procure seu regente.
                </p>
              </button>
            </div>

            <Button
              asChild
              size="lg"
              className="mt-7 min-h-14 w-full rounded-xl bg-[#ffc400] text-lg font-bold text-black hover:bg-[#ffd336] focus-visible:ring-white"
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
          <p className="mt-1.5 text-sm leading-relaxed text-black/60">
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
