import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Award,
  BedDouble,
  Check,
  ClipboardList,
  Clock3,
  Gift,
  Info,
  Music2,
  ShoppingBag,
  Sparkles,
  Ticket,
  Utensils,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const benefits = [
  { icon: Award, label: "Formações & Certificado" },
  { icon: Utensils, label: "Alimentação Completa" },
  { icon: BedDouble, label: "Hospedagem Confortável" },
  { icon: ShoppingBag, label: "Kit com Partituras" },
];

const raffleHighlights = [
  "Venda mínima de 25 rifas de R$ 10 com seu coro",
  "Prestação de contas até 30/10 com o regente",
  "Concorra a R$ 1.000 no sorteio + bônus de R$ 500",
];

const raffleSteps = [
  {
    label: "Pagamento inicial",
    description: "Pague R$ 100 agora no Pix ou cartão para pré-reserva da vaga.",
  },
  {
    label: "Blocos de rifas",
    description: "Agende com seu regente um momento para receber os blocos oficiais.",
  },
  { label: "Venda mínima", description: "Venda pelo menos 25 rifas de R$ 10 cada (total R$ 250)." },
  {
    label: "Entrega dos valores",
    description:
      "Envie o valor arrecadado ao seu regente até 30/10 para subsidiar e homologar sua inscrição.",
  },
  {
    label: "Sorteio online",
    description:
      "Sorteio do prêmio de R$ 1.000 em 08/11. Solicite blocos adicionais para concorrer ao Pix de R$ 500 do maior vendedor.",
  },
];

export function RegistrationCallout() {
  const [raffleDialogOpen, setRaffleDialogOpen] = useState(false);

  return (
    <section
      id="inscricao"
      aria-labelledby="registration-callout-title"
      className="public-editorial-section public-registration-section relative isolate scroll-mt-20 overflow-hidden bg-[radial-gradient(circle_at_50%_-10%,#ffd95a_0%,#f6b61f_45%,#cf8205_100%)] px-4 py-8 text-stone-950 sm:px-6 sm:py-10 lg:py-12"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden opacity-40"
      >
        <div className="absolute -left-24 top-24 size-64 rotate-[-12deg] border-[42px] border-amber-700/25" />
        <div className="absolute -right-28 bottom-10 size-80 rotate-[18deg] border-[48px] border-amber-900/20" />
        <Music2 className="absolute left-[4%] top-[36%] size-24 -rotate-12 text-amber-900/20" />
        <Sparkles className="absolute right-[7%] top-12 size-16 rotate-12 text-amber-50/80" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-5xl">
        <div className="public-registration-heading mx-auto flex max-w-3xl flex-col items-center text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-100/90 px-3.5 py-1 text-xs font-bold uppercase tracking-[0.18em] text-amber-900 shadow-sm">
            <span className="size-1.5 rounded-full bg-amber-600" aria-hidden="true" />
            Formas de inscrição
          </p>
          <h2
            id="registration-callout-title"
            className="public-registration-title mt-3 font-display text-3xl font-extrabold uppercase leading-tight tracking-tight text-stone-950 sm:text-4xl md:text-5xl"
          >
            Como você deseja participar?
          </h2>
          <p className="public-registration-intro mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-stone-800 sm:text-base">
            Selecione a modalidade ideal para sua vaga. Todas as opções garantem credenciamento
            completo, partituras originais e certificado oficial.
          </p>
        </div>

        <div className="public-registration-options mt-6 grid grid-cols-1 items-stretch gap-6 md:grid-cols-2">
          <article
            aria-label="Inscrição Integral"
            className="public-registration-option relative flex min-h-[21rem] w-full flex-col justify-between overflow-hidden rounded-2xl border-2 border-amber-300 bg-white p-5 shadow-lg shadow-amber-950/10 transition-transform duration-200 hover:-translate-y-1 hover:shadow-xl sm:p-6"
          >
            <div className="absolute right-0 top-0 rounded-bl-xl bg-stone-900 px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-300">
              <span className="inline-flex items-center gap-1.5">
                <Zap className="size-3" aria-hidden="true" />
                Inscrição confirmada na hora
              </span>
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                <Clock3 className="size-3.5" aria-hidden="true" />
                Inscrição Integral
              </span>
              <div className="mt-4">
                <div className="flex flex-wrap items-baseline gap-1.5">
                  <span className="text-sm font-semibold text-stone-500">Valor único:</span>
                  <span className="public-registration-price font-display text-3xl font-extrabold tracking-tight text-stone-900 sm:text-4xl">
                    R$ 300,00
                  </span>
                </div>
                <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                  <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />À vista
                  via Pix ou parcele em até <strong className="text-stone-900">5x no cartão</strong>
                </p>
              </div>
              <div className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50 p-3.5">
                <div className="flex items-start gap-2.5">
                  <span className="shrink-0 rounded-lg bg-amber-100/80 p-1.5 text-amber-600">
                    <Zap className="size-4" aria-hidden="true" />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                        Simples e imediato
                      </h3>
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        Sem tarefas
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-snug text-stone-700">
                      Faça o pagamento online e confirme sua vaga na mesma hora, sem tarefas
                      adicionais.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </article>

          <article
            aria-label="Programa de Rifas"
            className="public-registration-option relative flex min-h-[21rem] w-full flex-col justify-between overflow-hidden rounded-2xl border border-stone-200 bg-white p-5 shadow-lg shadow-amber-950/10 transition-transform duration-200 hover:-translate-y-1 hover:shadow-xl sm:p-6"
          >
            <div className="absolute right-0 top-0 rounded-bl-xl bg-amber-100/90 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-900">
              Apoio comunitário
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-stone-100 px-3 py-1 text-xs font-bold text-stone-800">
                <Ticket className="size-3.5 text-stone-600" aria-hidden="true" />
                Programa de Rifas
              </span>
              <div className="mt-4">
                <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                  <span className="public-registration-price font-display text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">
                    R$ 100,00
                  </span>
                  <span className="text-xs font-bold uppercase text-stone-500">(Agora)</span>
                  <span className="text-lg font-bold text-stone-600">+ R$ 250,00</span>
                  <span className="text-xs font-semibold text-amber-800">até 30/10</span>
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                  <Info className="size-3.5 text-amber-600" aria-hidden="true" />
                  Exclusivo para membros de coros participantes
                </p>
              </div>
              <ul
                aria-label="Destaques do programa de rifas"
                className="mt-5 space-y-2 text-xs text-stone-700"
              >
                {raffleHighlights.map((highlight) => (
                  <li key={highlight} className="flex items-start gap-2">
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-amber-600"
                      strokeWidth={2.5}
                      aria-hidden="true"
                    />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
              <Dialog open={raffleDialogOpen} onOpenChange={setRaffleDialogOpen}>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="mt-5 flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-amber-200/80 bg-amber-50 px-3 text-left text-xs font-bold text-amber-900 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"
                  >
                    <span className="inline-flex items-center gap-2">
                      <ClipboardList className="size-4 text-amber-600" aria-hidden="true" />
                      Ver regulamento e etapas das rifas
                    </span>
                    <span className="shrink-0 text-amber-700">(5 etapas) →</span>
                  </button>
                </DialogTrigger>
                <DialogContent className="border-amber-200 bg-[#fffdf9] sm:max-w-lg">
                  <DialogHeader className="text-left">
                    <DialogTitle className="font-display text-base text-stone-900">
                      Regulamento do Programa de Rifas
                    </DialogTitle>
                    <DialogDescription className="text-left text-xs leading-relaxed text-stone-600">
                      Confira o passo a passo para participar através do programa de apoio
                      comunitário junto ao seu coro:
                    </DialogDescription>
                  </DialogHeader>
                  <ol className="space-y-2.5 text-xs text-stone-700">
                    {raffleSteps.map(({ label, description }, index) => (
                      <li
                        key={label}
                        className="flex items-start gap-2.5 rounded-xl border border-stone-100 bg-stone-50 p-2.5"
                      >
                        <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-white">
                          {index + 1}
                        </span>
                        <p>
                          <strong className="text-stone-900">{label}:</strong> {description}
                        </p>
                      </li>
                    ))}
                  </ol>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" className="bg-amber-500 text-white hover:bg-amber-600">
                        Entendido, fechar
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </article>
        </div>

        <div
          data-registration-primary-action
          className="public-registration-primary-action mt-7 flex flex-col items-center gap-2 text-center sm:mt-8"
        >
          <Button
            asChild
            size="lg"
            className="min-h-12 rounded-full bg-stone-900 px-8 font-display text-base font-bold text-amber-100 shadow-lg shadow-amber-950/25 hover:bg-stone-800"
          >
            <Link to="/inscricao">
              <Sparkles className="size-4" aria-hidden="true" />
              Fazer Inscrição
              <ArrowRight className="size-5" aria-hidden="true" />
            </Link>
          </Button>
        </div>

        <section
          aria-label="Benefícios gerais e sorteio especial"
          className="public-registration-benefits relative mt-7 sm:mt-8"
        >
          <div
            className="absolute -bottom-10 -right-10 size-48 rounded-full bg-amber-300/30 blur-2xl"
            aria-hidden="true"
          />
          <div className="relative z-10">
            <div className="flex items-center justify-between gap-3">
              <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-amber-900">
                <span className="size-1.5 rounded-full bg-amber-600" aria-hidden="true" />
                Incluso em qualquer modalidade
              </p>
              <span className="hidden rounded-full bg-amber-200/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 sm:inline-block">
                Benefícios gerais
              </span>
            </div>
            <ul
              aria-label="Benefícios gerais da inscrição"
              className="public-benefits-strip mt-3 grid grid-cols-2 gap-2 text-stone-800 sm:grid-cols-4"
            >
              {benefits.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="flex min-w-0 items-center gap-2 rounded-lg border border-amber-200/70 bg-white/90 px-2.5 py-1.5 text-xs font-semibold"
                >
                  <span className="shrink-0 rounded bg-amber-100 p-1 text-amber-900">
                    <Icon className="size-3.5" strokeWidth={2} aria-hidden="true" />
                  </span>
                  <span className="leading-tight">{label}</span>
                </li>
              ))}
            </ul>
          </div>

          <section
            aria-label="Sorteio especial para inscrições até 30 de setembro"
            className="public-giveaway relative z-10 mt-5 grid grid-cols-1 items-center gap-4 border-t border-amber-200/80 pt-4 md:grid-cols-12"
          >
            <div className="space-y-2 md:col-span-7">
              <p className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-200/80 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-900">
                <Gift className="size-3" aria-hidden="true" />
                Sorteio especial
              </p>
              <h3 className="font-display text-lg font-bold leading-snug text-stone-900 sm:text-xl">
                Inscreva-se até{" "}
                <span className="text-amber-800 underline decoration-amber-400 decoration-2 underline-offset-2">
                  30/09
                </span>{" "}
                e concorra aos dois livros exclusivos
              </h3>
              <p className="text-xs leading-relaxed text-stone-700">
                Concorra às edições comemorativas:{" "}
                <strong className="text-stone-900">
                  “Canto Gregoriano – Teoria e Prática na Liturgia”
                </strong>{" "}
                e{" "}
                <strong className="text-stone-900">
                  “Cristo, nossa esperança – Caderno de Partituras”
                </strong>
                .
              </p>
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold text-stone-600 sm:text-[11px]">
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-200/80 bg-white/80 px-2 py-0.5">
                  <Clock3 className="size-3 text-amber-600" aria-hidden="true" />
                  Válido para todas as modalidades
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-200/80 bg-white/80 px-2 py-0.5">
                  <Check className="size-3 text-amber-600" aria-hidden="true" />
                  Entrega durante o evento
                </span>
              </div>
            </div>
            <div className="public-giveaway-books flex items-center justify-center pt-1 md:col-span-3 md:pt-0">
              <div
                className="flex items-center justify-center gap-2.5"
                aria-label="Livros do sorteio"
              >
                <img
                  src="/giveaway/canto-gregoriano.jpg"
                  alt="Capa do livro Canto Gregoriano — Teoria e prática na Liturgia"
                  loading="lazy"
                  decoding="async"
                  className="h-32 w-24 rounded-lg border border-amber-500/50 bg-white object-contain p-1 shadow-md transition-transform duration-300 hover:-translate-y-1 sm:h-36 sm:w-28"
                />
                <img
                  src="/giveaway/cristo-nossa-esperanca.jpg"
                  alt="Capa do livro Cristo, nossa esperança — Caderno de Partituras"
                  loading="lazy"
                  decoding="async"
                  className="h-32 w-24 rounded-lg border border-amber-500/50 bg-white object-contain p-1 shadow-md transition-transform duration-300 hover:-translate-y-1 sm:h-36 sm:w-28"
                />
              </div>
            </div>
            <div className="public-giveaway-action flex flex-col items-center gap-3 text-center md:col-span-2">
              <div className="w-full max-w-[15rem] space-y-2">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">
                  Inscreva-se agora
                </p>
                <p className="text-xs leading-relaxed text-stone-700">
                  Garanta sua vaga e participe do sorteio dos dois livros.
                </p>
                <Button
                  asChild
                  size="sm"
                  className="min-h-10 w-full rounded-lg bg-amber-500 px-4 font-extrabold text-white shadow-md shadow-amber-500/20 hover:bg-amber-600"
                >
                  <Link to="/inscricao">
                    Fazer Inscrição
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </div>
          </section>
        </section>
      </div>
    </section>
  );
}
