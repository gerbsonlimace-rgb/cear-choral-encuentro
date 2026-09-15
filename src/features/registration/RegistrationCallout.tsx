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

const raffleSummary = [
  {
    icon: CreditCard,
    label: "Pague R$ 100",
    detail: "agora",
  },
  {
    icon: CalendarDays,
    label: "Agende com o regente",
    detail: "e receba os blocos",
  },
  {
    icon: Ticket,
    label: "Venda 25 rifas",
    detail: "de R$ 10 cada",
  },
  {
    icon: Send,
    label: "Entregue até 30/10",
    detail: "ao seu regente",
  },
  {
    icon: Trophy,
    label: "Sorteio R$ 1.000 em 08/11",
    detail: "online",
  },
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
            <p className="text-sm text-white/60">Selecione uma opção para comparar.</p>
          </div>

          <div
            role="radiogroup"
            aria-label="Opções de inscrição"
            className="mt-7 grid grid-cols-1 items-stretch gap-4 md:grid-cols-2"
          >
            <label
              htmlFor="registration-option-integral"
              className={`relative flex min-h-[280px] w-full cursor-pointer flex-col overflow-hidden rounded-2xl border p-5 text-left transition-all focus-within:outline-none focus-within:ring-2 focus-within:ring-[#ffc400] focus-within:ring-offset-2 focus-within:ring-offset-[#11100e] sm:p-6 ${
                selectedOption === "integral"
                  ? "border-[#ffc400] bg-[linear-gradient(145deg,rgba(255,196,0,0.16),rgba(255,196,0,0.05))] shadow-[0_0_0_1px_rgba(255,196,0,0.28),0_16px_30px_rgba(0,0,0,0.22)]"
                  : "border-white/15 bg-white/[0.05] hover:border-[#ffc400]/55 hover:bg-white/[0.07]"
              }`}
            >
              <input
                id="registration-option-integral"
                type="radio"
                name="registrationOption"
                value="integral"
                aria-label="Inscrição integral"
                aria-describedby="integral-option-details"
                checked={selectedOption === "integral"}
                onChange={() => setSelectedOption("integral")}
                className="peer sr-only"
              />
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
              <div id="integral-option-details" className="contents">
                <p className="mt-7 font-display text-4xl font-bold leading-none tracking-tight sm:text-5xl">
                  R$ 300,00
                </p>
                <p className="mt-4 text-sm leading-relaxed text-white/70">
                  Pague à vista no Pix ou em até{" "}
                  <strong className="text-white">5x no cartão</strong>.
                </p>
                <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                  <p className="flex items-center gap-2 font-display text-xl font-bold text-white">
                    <Sparkles className="size-5 text-[#ffc400]" aria-hidden="true" />
                    Simples e rápido
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-white/65">
                    Faça o pagamento e confirme sua vaga sem etapas adicionais.
                  </p>
                </div>
                <p className="mt-auto flex items-center gap-2 rounded-xl bg-[#ffc400] px-4 py-3 text-sm font-extrabold text-black">
                  <Check className="size-5" strokeWidth={3} aria-hidden="true" />
                  Inscrição confirmada na hora
                </p>
              </div>
            </label>

            <label
              htmlFor="registration-option-raffles"
              className={`relative flex min-h-[320px] w-full cursor-pointer flex-col overflow-hidden rounded-2xl border p-5 text-left transition-all focus-within:outline-none focus-within:ring-2 focus-within:ring-[#ffc400] focus-within:ring-offset-2 focus-within:ring-offset-[#11100e] sm:p-6 ${
                selectedOption === "raffles"
                  ? "border-[#ffc400] bg-[linear-gradient(145deg,rgba(255,196,0,0.2),rgba(255,196,0,0.07))] shadow-[0_0_0_1px_rgba(255,196,0,0.32),0_16px_30px_rgba(0,0,0,0.22)]"
                  : "border-[#ffc400]/60 bg-[linear-gradient(145deg,rgba(255,196,0,0.1),rgba(255,255,255,0.04))] hover:border-[#ffc400]"
              }`}
            >
              <input
                id="registration-option-raffles"
                type="radio"
                name="registrationOption"
                value="raffles"
                aria-label="Programa de rifas"
                aria-describedby="raffle-option-summary"
                checked={selectedOption === "raffles"}
                onChange={() => setSelectedOption("raffles")}
                className="peer sr-only"
              />
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

              <div className="contents">
                <p
                  id="raffle-option-summary"
                  className="mt-7 max-w-4xl font-display text-2xl font-bold leading-tight tracking-tight sm:text-3xl"
                >
                  R$ 100,00 (Agora) + R$ 250,00 até o dia 30/10
                </p>
                <p className="mt-3 text-xs font-semibold text-white/65">
                  Disponível para coros participantes.
                </p>

                <ol
                  aria-label="Resumo do programa de rifas"
                  className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5"
                >
                  {raffleSummary.map(({ icon: Icon, label, detail }, index) => (
                    <li
                      key={label}
                      className="flex min-w-0 flex-col items-center rounded-xl border border-white/10 bg-white/[0.05] px-2 py-3 text-center"
                    >
                      <span className="inline-flex size-8 items-center justify-center rounded-full bg-[#ffc400] text-black">
                        <Icon className="size-4" strokeWidth={2.5} aria-hidden="true" />
                      </span>
                      <span className="mt-2 text-[11px] font-extrabold leading-tight text-white">
                        <span className="sr-only">Etapa {index + 1}: </span>
                        {label}
                      </span>
                      <span className="mt-1 text-[10px] leading-tight text-white/55">{detail}</span>
                    </li>
                  ))}
                </ol>

                <div className="mt-4 space-y-2 border-t border-white/10 pt-4 text-xs leading-relaxed text-white/65">
                  <p>
                    <strong className="text-white">Condições:</strong> venda mínima de 25 rifas de
                    R$ 10 e envio dos valores ao regente até 30/10 para subsidiar e confirmar sua
                    inscrição.
                  </p>
                  <p>
                    <strong className="text-white">Venda extra:</strong> solicite blocos adicionais
                    ao regente. Quem vender mais ganha um Pix de R$ 500.
                  </p>
                </div>
              </div>
            </label>
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
