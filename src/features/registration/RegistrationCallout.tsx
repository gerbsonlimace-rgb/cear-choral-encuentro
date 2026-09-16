import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Award,
  BedDouble,
  Clock3,
  CreditCard,
  Gift,
  MessageCircle,
  Music2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Ticket,
  Utensils,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const benefits = [
  { icon: Award, label: "Formações e certificado" },
  { icon: Utensils, label: "Alimentação" },
  { icon: BedDouble, label: "Hospedagem" },
  { icon: ShoppingBag, label: "Kit do evento" },
];

const raffleSummary = [
  { label: "Pagamento inicial", description: "Pague R$ 100 agora no Pix ou cartão." },
  {
    label: "Blocos de rifas",
    description: "Agende com seu regente um momento para receber os blocos.",
  },
  { label: "Venda mínima", description: "Venda pelo menos 25 rifas de R$ 10 cada." },
  {
    label: "Entrega dos valores",
    description: "Envie todo o valor arrecadado ao seu regente até 30/10.",
  },
  { label: "Sorteio", description: "Sorteio online do prêmio de R$ 1.000 em 08/11." },
];

export function RegistrationCallout() {
  return (
    <section
      id="inscricao"
      aria-labelledby="registration-callout-title"
      className="relative isolate scroll-mt-20 overflow-hidden bg-[radial-gradient(circle_at_50%_-10%,#ffd95a_0%,#f6b61f_45%,#cf8205_100%)] px-4 py-12 text-stone-950 sm:px-6 lg:py-16"
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

      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-amber-400/50 bg-stone-950/85 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-amber-300 shadow-lg backdrop-blur-md">
            <span className="size-1.5 rounded-full bg-amber-400" aria-hidden="true" />
            Formas de inscrição
          </p>
          <h2
            id="registration-callout-title"
            className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight text-stone-950 drop-shadow-sm sm:text-4xl md:text-5xl"
          >
            Como você deseja participar?
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm font-medium leading-relaxed text-stone-900/85 sm:text-base">
            Selecione a modalidade ideal para sua vaga. Todas as opções garantem credenciamento
            completo, partituras originais e certificado.
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-stone-950/10 bg-[#fffdf9]/85 px-4 py-4 shadow-lg backdrop-blur-md sm:px-6">
          <p className="text-center text-xs font-extrabold uppercase tracking-[0.16em] text-stone-700/70">
            Sua inscrição inclui
          </p>
          <ul
            aria-label="Benefícios inclusos na inscrição"
            className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-4"
          >
            {benefits.map(({ icon: Icon, label }) => (
              <li key={label} className="flex min-w-0 items-center gap-2.5 text-sm font-bold">
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-stone-950 text-amber-300">
                  <Icon className="size-4" strokeWidth={2.25} aria-hidden="true" />
                </span>
                <span className="leading-snug">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <section
          aria-label="Sorteio especial para inscrições até 30 de setembro"
          className="relative mt-8 overflow-hidden rounded-2xl border border-[#d4af37]/40 bg-[#fffdf9]/95 p-5 shadow-xl shadow-amber-950/10 backdrop-blur-md sm:p-7"
        >
          <div
            aria-hidden="true"
            className="absolute -bottom-20 -right-20 size-56 rounded-full bg-amber-400/15 blur-3xl"
          />
          <div className="relative z-10 flex flex-col items-center justify-between gap-6 lg:flex-row">
            <div className="flex-1 text-center lg:text-left">
              <p className="inline-flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-800">
                <Gift className="size-3.5" aria-hidden="true" />
                Sorteio especial
              </p>
              <h3 className="mt-3 font-display text-xl font-bold tracking-normal text-stone-900 sm:text-2xl">
                Inscreva-se até{" "}
                <span className="text-amber-700 underline decoration-amber-700/40 underline-offset-4">
                  30/09
                </span>{" "}
                e concorra aos dois livros exclusivos
              </h3>
              <p className="mt-2 max-w-xl text-xs leading-relaxed text-stone-600 sm:text-sm">
                Um participante contemplado levará para casa as edições comemorativas:{" "}
                <strong className="font-semibold text-amber-800">
                  Canto Gregoriano — Teoria e Prática na Liturgia
                </strong>{" "}
                e{" "}
                <strong className="font-semibold text-amber-800">
                  Cristo, nossa esperança — Caderno de Partituras
                </strong>
                .
              </p>
              <div className="mt-3 flex items-center justify-center gap-4 text-xs text-stone-500 lg:justify-start">
                <span className="inline-flex items-center gap-1.5 font-medium text-amber-800">
                  <Clock3 className="size-4" aria-hidden="true" />
                  Sorteio válido para todas as modalidades
                </span>
                <span className="hidden text-stone-400 sm:inline-block" aria-hidden="true">
                  •
                </span>
                <span className="hidden sm:inline-block">Entrega durante o evento</span>
              </div>
            </div>
            <div
              className="flex shrink-0 items-end justify-center gap-3 py-1 sm:gap-4"
              aria-label="Livros do sorteio"
            >
              <img
                src="/giveaway/canto-gregoriano.jpg"
                alt="Capa do livro Canto Gregoriano — Teoria e prática na Liturgia"
                loading="lazy"
                decoding="async"
                className="h-36 w-24 rounded-lg border border-[#d4af37]/50 bg-white object-contain p-1 shadow-md transition-transform duration-300 hover:-translate-y-1 sm:h-40 sm:w-28"
              />
              <img
                src="/giveaway/cristo-nossa-esperanca.jpg"
                alt="Capa do livro Cristo, nossa esperança — Caderno de Partituras"
                loading="lazy"
                decoding="async"
                className="h-36 w-24 rounded-lg border border-[#d4af37]/50 bg-white object-contain p-1 shadow-md transition-transform duration-300 hover:-translate-y-1 sm:h-40 sm:w-28"
              />
            </div>
          </div>
        </section>

        <div className="mt-6 grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 lg:gap-6">
          <article className="flex w-full flex-col rounded-2xl border-2 border-amber-300/90 bg-[#fffdf9] p-4 shadow-lg shadow-amber-950/10 sm:p-6">
            <span className="flex items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-100/80 px-3 py-1 text-xs font-bold tracking-wider text-amber-800">
                <CreditCard className="size-4 text-amber-600" aria-hidden="true" />
                Inscrição integral
              </span>
            </span>
            <span className="mt-4 block">
              <span className="block font-display text-4xl font-extrabold tracking-tight text-stone-900 sm:text-5xl">
                R$ 300,00
              </span>
              <span className="mt-1 block text-sm font-medium text-stone-500">
                Pague à vista no Pix ou parcele em até{" "}
                <strong className="text-stone-900">5x no cartão</strong>
              </span>
              <span className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50 p-3.5">
                <Zap className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden="true" />
                <span>
                  <span className="block text-xs font-bold uppercase tracking-wider text-amber-800">
                    Simples e Imediato
                  </span>
                  <span className="mt-0.5 block text-xs text-stone-600">
                    Faça o pagamento online e confirme sua vaga de forma automática, sem tarefas
                    adicionais.
                  </span>
                </span>
              </span>
            </span>
            <span className="mt-4 flex items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
              Inscrição confirmada na hora
            </span>
          </article>

          <article className="flex w-full flex-col rounded-2xl border-2 border-amber-300/90 bg-[#fffdf9] p-4 shadow-lg shadow-amber-950/10 sm:p-6">
            <span className="flex items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-100/80 px-3 py-1 text-xs font-bold tracking-wider text-amber-800">
                <Ticket className="size-4 text-amber-600" aria-hidden="true" />
                Programa de rifas
              </span>
            </span>
            <span className="mt-4 block">
              <span className="block font-display text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">
                R$ 100,00 (Agora) + R$ 250,00 até o dia 30/10
              </span>
              <span className="mt-1 flex items-center gap-1.5 text-xs font-medium text-amber-700">
                <span className="size-1.5 rounded-full bg-amber-500" /> Exclusivo para membros de
                coros participantes
              </span>
              <span className="my-4 block border-t border-amber-100" />
              <ol
                aria-label="Resumo do programa de rifas"
                className="space-y-2.5 text-xs text-stone-700"
              >
                {raffleSummary.map(({ label, description }, index) => (
                  <li
                    key={label}
                    className="flex items-start gap-2.5 rounded-lg border border-amber-200/60 bg-amber-50/70 p-2.5"
                  >
                    <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-200 text-[11px] font-bold text-amber-800">
                      {index + 1}
                    </span>
                    <span>
                      <strong className="text-stone-900">{label}:</strong> {description}
                    </span>
                  </li>
                ))}
              </ol>
              <span className="mt-5 block border-t border-amber-100 pt-3 text-[11px] leading-tight text-stone-500">
                * A vaga só será homologada definitivamente mediante entrega dos comprovantes ao
                regente até 30/10.
              </span>
              <span className="mt-3 block space-y-1 text-[11px] leading-tight text-stone-500">
                <span className="block">
                  <strong className="text-stone-800">Condições:</strong> venda mínima de 25 rifas de
                  R$ 10 e envio dos valores ao regente até 30/10 para subsidiar e confirmar sua
                  inscrição.
                </span>
                <span className="block">
                  <strong className="text-stone-800">Venda extra:</strong> solicite blocos
                  adicionais ao regente. Quem vender mais ganha um Pix de R$ 500.
                </span>
              </span>
            </span>
          </article>
        </div>

        <section
          aria-label="Ação de inscrição"
          className="relative mt-6 overflow-hidden rounded-2xl border border-[#d4af37]/40 bg-[#fffdf9]/95 p-4 shadow-xl shadow-amber-950/15 backdrop-blur-md sm:p-5"
        >
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="text-center md:text-left">
              <span className="text-xs font-bold uppercase tracking-widest text-amber-800">
                Inscrições abertas
              </span>
              <h3 className="mt-1 text-lg font-bold text-stone-900 sm:text-xl">
                Escolha sua modalidade no formulário
              </h3>
              <p className="mt-1 text-xs text-stone-600 sm:text-sm">
                Confira as condições da inscrição integral ou do programa de rifas e finalize sua
                vaga.
              </p>
            </div>
            <Button
              asChild
              size="lg"
              className="min-h-14 w-full rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 px-8 text-base font-extrabold tracking-wide text-stone-950 shadow-lg shadow-amber-500/25 hover:from-amber-600 hover:to-amber-500 sm:w-auto sm:min-w-[260px] sm:text-lg"
            >
              <Link to="/inscricao">
                Inscrever-se agora
                <ArrowRight className="size-5" aria-hidden="true" />
              </Link>
            </Button>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 border-t border-amber-200/80 pt-5 text-xs text-stone-600 md:justify-between">
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-600" aria-hidden="true" />
              <span className="font-medium text-stone-800">Ambiente de pagamento 100% seguro</span>
            </span>
            <span className="flex items-center gap-2">
              <Zap className="size-4 text-amber-700" aria-hidden="true" />
              <span className="font-medium text-stone-800">Pix com aprovação imediata</span>
            </span>
            <span className="flex items-center gap-2">
              <MessageCircle className="size-4 text-amber-800" aria-hidden="true" />
              <span className="font-medium text-stone-800">
                Dúvidas? Suporte no WhatsApp da coordenação
              </span>
            </span>
          </div>
        </section>
      </div>
    </section>
  );
}
