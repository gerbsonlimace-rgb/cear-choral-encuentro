import { Link } from "@tanstack/react-router";
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
  Ticket,
  Utensils,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export function RegistrationCallout() {
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
        <div className="grid items-center gap-8 lg:grid-cols-[1.5fr_1fr] lg:gap-12">
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
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
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
                  className="rounded-2xl border-2 border-black/10 bg-white p-4 shadow-[5px_5px_0_rgba(0,0,0,0.14)] transition-transform hover:-translate-y-1 sm:p-5"
                >
                  <span className="mb-3 inline-flex size-12 items-center justify-center rounded-2xl bg-[#ffc400] text-black">
                    <Icon className="size-6" strokeWidth={2} aria-hidden="true" />
                  </span>
                  <h3 className="text-base font-extrabold">{label}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-black/65">{description}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[2rem] border-2 border-black bg-black p-6 text-white shadow-[10px_10px_0_rgba(255,255,255,0.45)] sm:p-8">
            <p className="text-center text-xs font-extrabold uppercase tracking-[0.18em] text-[#ffc400]">
              Garanta sua participação
            </p>
            <p className="mt-4 text-center font-display text-5xl font-extrabold tracking-tight sm:text-6xl">
              <span className="mr-2 text-2xl font-semibold">R$</span>300,00
            </p>

            <div
              role="region"
              aria-label="Programa de venda de rifas"
              className="mt-5 rounded-2xl border-2 border-[#ffc400] bg-[#ffc400] p-4 text-black"
            >
              <div className="flex items-start gap-3">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-black text-[#ffc400]">
                  <Ticket className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-extrabold uppercase tracking-wide">
                    Programa de venda de rifas
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-relaxed">
                    Pague R$ 100,00 agora para fazer sua pré-inscrição.
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-black/70">
                    Envie o valor restante arrecadado com as rifas até 30/10.
                  </p>
                </div>
              </div>
              <p className="mt-3 border-t border-black/15 pt-3 text-xs font-bold leading-relaxed text-black/70">
                Exclusivo para membros de coros que aderiram ao programa. Procure seu regente.
              </p>
            </div>

            <div
              role="group"
              aria-label="Formas de pagamento"
              className="mt-6 grid grid-cols-2 gap-3"
            >
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-left">
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[#ffc400] text-black">
                  <QrCode className="size-5" aria-hidden="true" />
                </span>
                <p className="mt-3 font-extrabold">Pix</p>
                <p className="mt-0.5 text-sm text-white/65">À vista</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-left">
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[#ffc400] text-black">
                  <CreditCard className="size-5" aria-hidden="true" />
                </span>
                <p className="mt-3 font-extrabold">Cartão</p>
                <p className="mt-0.5 text-sm text-white/65">Em até 6x</p>
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
