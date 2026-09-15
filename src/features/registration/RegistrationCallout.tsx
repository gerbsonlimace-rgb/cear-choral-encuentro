import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  Award,
  BedDouble,
  CalendarDays,
  Check,
  CreditCard,
  Music2,
  Send,
  ShoppingBag,
  Sparkles,
  Ticket,
  Trophy,
  Utensils,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const benefits = [
  { icon: Award, label: "Formações e certificado" },
  { icon: Utensils, label: "Alimentação" },
  { icon: BedDouble, label: "Hospedagem" },
  { icon: ShoppingBag, label: "Kit do evento" },
];

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
        <div className="rounded-2xl border border-black/10 bg-white/85 px-4 py-4 shadow-sm backdrop-blur-sm sm:px-6">
          <p className="text-center text-xs font-extrabold uppercase tracking-[0.16em] text-black/60">
            Sua inscrição inclui
          </p>
          <ul
            aria-label="Benefícios inclusos na inscrição"
            className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-4"
          >
            {benefits.map(({ icon: Icon, label }) => (
              <li key={label} className="flex min-w-0 items-center gap-2.5 text-sm font-bold">
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-black text-[#ffc400]">
                  <Icon className="size-4" strokeWidth={2.25} aria-hidden="true" />
                </span>
                <span className="leading-snug">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mx-auto mt-9 max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full bg-black/90 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#ffc400]">
            <Sparkles className="size-4" aria-hidden="true" />
            Inscrição
          </p>
          <h2
            id="registration-callout-title"
            className="mt-4 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl"
          >
            Faça agora sua inscrição
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-black/70">
            Escolha a opção que combina com você. No formulário, seu coro indicará quais modalidades
            estão disponíveis.
          </p>
        </div>

        <div className="mt-8 w-full rounded-3xl border border-black/90 bg-[#11100e] p-5 text-white shadow-[0_18px_40px_rgba(0,0,0,0.16)] sm:p-8 lg:p-10">
          <div className="flex flex-col gap-2 text-center sm:flex-row sm:items-end sm:justify-between sm:text-left">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#ffc400]">
                Formas de inscrição
              </p>
              <h3 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
                Como você deseja participar?
              </h3>
            </div>
            <p className="text-sm text-white/60">Toque em uma opção para comparar.</p>
          </div>

          <div
            role="radiogroup"
            aria-label="Opções de inscrição"
            className="mt-7 grid grid-cols-1 items-stretch gap-4 md:grid-cols-2"
          >
            <button
              type="button"
              role="radio"
              aria-checked={selectedOption === "integral"}
              aria-label="Inscrição integral"
              onClick={() => setSelectedOption("integral")}
              className={`relative flex min-h-[320px] flex-col overflow-hidden rounded-2xl border p-5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffc400] focus-visible:ring-offset-2 focus-visible:ring-offset-[#11100e] sm:p-6 ${
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
              <p className="mt-auto flex items-center gap-2 pt-6 text-sm font-semibold text-white/65">
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
              className={`relative flex min-h-[320px] flex-col overflow-hidden rounded-2xl border p-5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffc400] focus-visible:ring-offset-2 focus-visible:ring-offset-[#11100e] sm:p-6 ${
                selectedOption === "raffles"
                  ? "border-[#ffc400] bg-[linear-gradient(145deg,rgba(255,196,0,0.2),rgba(255,196,0,0.07))] shadow-[0_0_0_1px_rgba(255,196,0,0.32),0_16px_30px_rgba(0,0,0,0.22)]"
                  : "border-[#ffc400]/60 bg-[linear-gradient(145deg,rgba(255,196,0,0.1),rgba(255,255,255,0.04))] hover:border-[#ffc400]"
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute right-5 top-5 inline-flex size-6 items-center justify-center rounded-full border transition-colors ${
                  selectedOption === "raffles"
                    ? "border-[#ffc400] bg-[#ffc400] text-black"
                    : "border-[#ffc400]/60 text-transparent"
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
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-[#ffc400]">
                Agora
              </p>

              <div className="mt-5 rounded-2xl bg-[#ffc400] p-4 text-black shadow-[0_12px_24px_rgba(255,196,0,0.18)]">
                <div className="flex items-center gap-3">
                  <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-black text-[#ffc400]">
                    <Trophy className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-display text-2xl font-extrabold leading-none">
                      Concorra a R$ 1.000
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-bold">
                      <CalendarDays className="size-4" aria-hidden="true" />
                      Sorteio online em 08/11
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
                <p className="flex items-center gap-2 text-sm font-bold">
                  <Ticket className="size-4 shrink-0 text-[#ffc400]" aria-hidden="true" />
                  25 rifas de R$ 10
                </p>
                <p className="flex items-center gap-2 text-sm font-bold">
                  <Send className="size-4 shrink-0 text-[#ffc400]" aria-hidden="true" />
                  Envie os R$ 250 até 30/10
                </p>
              </div>
              <p className="mt-auto border-t border-white/10 pt-4 text-xs font-semibold leading-relaxed text-white/60">
                A adesão ao programa depende da venda das 25 rifas e do envio do valor dentro do
                prazo.
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
    </section>
  );
}
