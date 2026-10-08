import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Award,
  BedDouble,
  Check,
  Clock3,
  Gift,
  Music2,
  ShoppingBag,
  Sparkles,
  Ticket,
  Utensils,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { RegistrationInstallments } from "./RegistrationInstallments";
import { RafflePrizeHighlight } from "./RafflePrizeHighlight";

const eventBenefits = [
  { icon: Music2, label: "Acesso integral a todas as formações litúrgicas" },
  { icon: ShoppingBag, label: "Kit oficial do participante com partituras impressas" },
  { icon: Award, label: "Certificado de participação diocesano (horas acadêmicas)" },
];

const completeBenefits = [
  ...eventBenefits,
  { icon: BedDouble, label: "Hospedagem no Centro Diocesano de Pastoral" },
  { icon: Utensils, label: "Alimentação completa durante todos os dias (pensão total)" },
];

export function RegistrationCallout() {
  return (
    <section
      id="inscricao"
      aria-labelledby="registration-callout-title"
      className="public-editorial-section public-registration-section relative isolate scroll-mt-20 overflow-hidden bg-background px-4 py-8 text-stone-950 sm:px-6 sm:py-10 lg:py-12"
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
          <h2
            id="registration-callout-title"
            className="public-registration-title font-display text-3xl font-extrabold uppercase leading-tight tracking-tight text-stone-950 sm:text-4xl md:text-5xl"
          >
            Como você deseja participar?
          </h2>
          <p className="public-registration-intro mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-stone-800 sm:text-base">
            Escolha o tipo de inscrição (modalidade) que combina com a sua participação. No próximo passo,
            você verá a forma de pagamento disponível para o seu coro.
          </p>
        </div>

        <div className="public-registration-options mt-6 grid grid-cols-1 items-start gap-6 md:grid-cols-2 lg:grid-cols-3">
          <article
            aria-label="Inscrição no evento"
            className="public-registration-option public-registration-option--event flex h-full w-full flex-col rounded-2xl border border-stone-200 bg-white p-5 shadow-lg shadow-amber-950/10 transition-transform duration-200 hover:-translate-y-1 hover:shadow-xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-stone-500">
                  PARTICIPAÇÃO INDIVIDUAL
                </p>
                <h3 className="mt-3 font-display text-2xl font-extrabold leading-tight text-stone-950 sm:text-3xl">
                  Inscrição no Evento
                </h3>
                <p data-testid="registration-option-summary" className="mt-1 text-xs font-semibold text-stone-600">
                  Acesso às formações, kit e certificado oficial
                </p>
              </div>
            </div>
            <div className="mt-5 rounded-xl bg-stone-100 px-4 py-3">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-stone-500">INVESTIMENTO</p>
              <div className="mt-1 flex flex-wrap items-baseline gap-2">
                <span className="public-registration-price font-display text-3xl font-extrabold tracking-tight text-stone-900 sm:text-4xl">R$ 80,00</span>
                <span className="text-xs font-semibold text-stone-600">• à vista</span>
              </div>
              <p className="mt-1 text-xs font-semibold text-stone-600">Sem custos de hospedagem inclusos</p>
              <RegistrationInstallments amountCents={8_000} />
            </div>
            <p className="mt-5 text-xs font-bold text-stone-800">O que está incluso:</p>
            <ul aria-label="Benefícios da inscrição no evento" className="mt-2 space-y-2.5 text-sm text-stone-700">
              {eventBenefits.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-start gap-2.5">
                  <span className="mt-0.5 shrink-0 rounded-full bg-amber-100 p-1 text-amber-800"><Icon className="size-3.5" strokeWidth={2.5} aria-hidden="true" /></span>
                  <span className="leading-snug">{label}</span>
                </li>
              ))}
            </ul>
          </article>

          <article
            aria-label="Inscrição + hospedagem e alimentação com rifas"
            className="public-registration-option public-registration-option--raffle relative flex h-full w-full flex-col rounded-2xl border-2 border-amber-600 bg-white p-5 pt-7 shadow-xl shadow-amber-950/15 transition-transform duration-200 hover:-translate-y-1 sm:p-6 sm:pt-7"
          >
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-500 px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.08em] text-amber-950 shadow-md">
              ★ MAIS ESCOLHIDO • ECONOMIZE C/ RIFAS
            </span>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-amber-700">EXPERIÊNCIA COMPLETA SUBSIDIADA</p>
                <h3 className="mt-3 font-display text-2xl font-extrabold leading-tight text-stone-950 sm:text-3xl">Inscrição + Hospedagem e Alimentação</h3>
                <p data-testid="registration-option-summary" className="mt-1 text-xs font-semibold text-stone-600">Entrada facilitada com programa diocesano de rifas</p>
              </div>
            </div>
            <div className="mt-5 rounded-xl bg-amber-50 px-4 py-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[0.68rem] font-bold uppercase leading-tight tracking-[0.12em] text-amber-800">ENTRADA INICIAL HOJE</p>
                  <div className="mt-1 flex items-baseline gap-2"><span className="public-registration-price font-display text-3xl font-extrabold tracking-tight text-stone-900 sm:text-4xl">R$ 100,00</span><span className="text-xs font-semibold text-stone-700">hoje no ato</span></div>
                </div>
                <span className="rounded-md bg-amber-700 px-2 py-1 text-[0.68rem] font-black leading-tight text-white">20 Rifas Cobrem o Resto</span>
              </div>
              <p className="mt-1 text-xs font-semibold text-stone-600">Total nominal do pacote: R$ 300,00</p>
              <RegistrationInstallments amountCents={10_000} />
            </div>
            <div aria-label="Subsídio da inscrição pelo programa de rifas" className="mt-3 rounded-xl bg-stone-100 px-4 py-3 text-sm text-stone-700">
              <p className="flex items-center gap-1.5 font-bold text-stone-900">
                <Ticket className="size-4 text-amber-700" aria-hidden="true" />
                <span>Como funciona o subsídio</span>:
              </p>
              <p className="mt-1 text-xs leading-relaxed">Você paga apenas R$ 100 agora e recebe 20 rifas de R$ 10,00. As vendas cobrem integralmente os R$ 200,00 restantes do retiro!</p>
            </div>
            <RafflePrizeHighlight />
            <p className="mt-5 text-xs font-bold text-stone-800">Tudo incluído no seu retiro:</p>
            <ul aria-label="Benefícios da inscrição com hospedagem e alimentação pelo programa de rifas" className="mt-2 space-y-2.5 text-sm text-stone-700">
              {completeBenefits.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-start gap-2.5"><span className="mt-0.5 shrink-0 rounded-full bg-amber-100 p-1 text-amber-800"><Icon className="size-3.5" strokeWidth={2.5} aria-hidden="true" /></span><span className="leading-snug">{label}</span></li>
              ))}
            </ul>
          </article>

          <article
            aria-label="Inscrição + hospedagem e alimentação"
            className="public-registration-option public-registration-option--complete flex h-full w-full flex-col rounded-2xl border border-stone-200 bg-white p-5 shadow-lg shadow-amber-950/10 transition-transform duration-200 hover:-translate-y-1 hover:shadow-xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-stone-500">SEM GESTÃO DE RIFAS</p>
                <h3 className="mt-3 font-display text-2xl font-extrabold leading-tight text-stone-950 sm:text-3xl">Inscrição + Hospedagem e Alimentação</h3>
                <p data-testid="registration-option-summary" className="mt-1 text-xs font-semibold text-stone-600">Pagamento integral direto (sem necessidade de venda de rifas)</p>
              </div>
            </div>
            <div className="mt-5 rounded-xl bg-stone-100 px-4 py-3">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-stone-500">Valor total único</p>
              <div className="mt-1 flex flex-wrap items-baseline gap-2"><span className="public-registration-price font-display text-3xl font-extrabold tracking-tight text-stone-900 sm:text-4xl">R$ 300,00</span><span className="text-xs font-semibold text-stone-600">• à vista ou até 12x</span></div>
              <p className="mt-1 text-xs font-semibold text-stone-600">Quitação completa imediata</p>
              <RegistrationInstallments amountCents={30_000} />
            </div>
            <p className="mt-5 text-xs font-bold text-stone-800">O que está incluso:</p>
            <ul aria-label="Benefícios da inscrição com hospedagem e alimentação" className="mt-2 space-y-2.5 text-sm text-stone-700">
              {completeBenefits.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-start gap-2.5"><span className="mt-0.5 shrink-0 rounded-full bg-amber-100 p-1 text-amber-800"><Icon className="size-3.5" strokeWidth={2.5} aria-hidden="true" /></span><span className="leading-snug">{label}</span></li>
              ))}
            </ul>
          </article>
        </div>

        <div
          data-registration-primary-action
          className="public-registration-primary-action mt-7 flex flex-col items-center gap-2 text-center sm:mt-8"
        >
          <Button
            asChild
            size="lg"
            className="min-h-14 rounded-full bg-stone-900 px-10 font-display text-lg font-bold text-amber-100 shadow-xl shadow-amber-950/25 hover:bg-stone-800"
          >
            <Link to="/inscricao">
              <Sparkles className="size-4" aria-hidden="true" />
              Fazer Inscrição
              <ArrowRight className="size-5" aria-hidden="true" />
            </Link>
          </Button>
        </div>

        <section
          aria-label="Sorteio especial para inscrições até 30 de setembro"
          className="public-registration-benefits public-giveaway relative mt-7 grid grid-cols-1 items-center gap-4 border-t border-amber-200/80 pt-4 sm:mt-8 md:grid-cols-12"
        >
            <div className="space-y-2 md:col-span-7">
              <p className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-200/80 px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wider text-amber-900">
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
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-stone-600">
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
                <p className="text-xs font-extrabold uppercase tracking-wider text-amber-800">
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
      </div>
    </section>
  );
}
