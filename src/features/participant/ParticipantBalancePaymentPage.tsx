import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, LoaderCircle, RefreshCw, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getParticipantRegistration } from "@/lib/participant.functions";
import {
  startParticipantBalanceCheckout,
  type ParticipantBalanceCheckoutResult,
} from "@/lib/participant-payment.functions";
import type { ParticipantRegistrationView } from "./participant.domain";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const defaultStart = (raffleTickets: number) => startParticipantBalanceCheckout({ data: { raffleTickets } });
const defaultOpen = (url: string) => window.location.assign(url);

type Props = {
  loadRegistration?: () => Promise<ParticipantRegistrationView>;
  startCheckout?: (raffleTickets: number) => Promise<ParticipantBalanceCheckoutResult>;
  openCheckout?: (url: string) => void;
};

export function ParticipantBalancePaymentPage({
  loadRegistration = getParticipantRegistration,
  startCheckout = defaultStart,
  openCheckout = defaultOpen,
}: Props) {
  const [participant, setParticipant] = useState<ParticipantRegistrationView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [openPayment, setOpenPayment] = useState(false);
  const [existingCheckout, setExistingCheckout] = useState<{ url: string; tickets: number } | null>(null);
  const [revision, setRevision] = useState(0);
  const [selectedTickets, setSelectedTickets] = useState("1");
  const submitting = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setOpenPayment(false);
    setExistingCheckout(null);
    void loadRegistration()
      .then((view) => {
        if (!cancelled) {
          setParticipant(view);
          setSelectedTickets("1");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setParticipant(null);
          setError("Não foi possível consultar seu saldo. Tente atualizar os valores.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadRegistration, revision]);

  const raffles = participant?.raffles;
  const known = raffles && raffles.totalTickets !== null;
  const settled = known && raffles.pendingCents === 0;
  const count = /^\d+$/.test(selectedTickets) ? Number(selectedTickets) : 0;
  const canPay = Boolean(known && Number.isSafeInteger(count) && count > 0 && count <= 2_147_483);

  const pay = async () => {
    if (!canPay || loading || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await startCheckout(count);
      if (!mounted.current) return;
      if (!result.ok) {
        if (result.code === "open_payment") {
          setOpenPayment(true);
        } else {
          setError(result.message);
        }
        return;
      }
      if (result.existingRaffleTickets && result.existingRaffleTickets !== count) {
        setOpenPayment(true);
        setExistingCheckout({ url: result.checkoutUrl, tickets: result.existingRaffleTickets });
        return;
      }
      openCheckout(result.checkoutUrl);
    } catch {
      if (mounted.current)
        setError("Não foi possível abrir o pagamento. Atualize os valores e tente novamente.");
    } finally {
      submitting.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <main className="internal-app min-h-svh bg-[#f7f7f5] px-4 py-6 text-zinc-950">
      <div className="mx-auto max-w-lg space-y-5">
        <Link
          to="/participante"
          className="inline-flex min-h-11 items-center gap-2 text-sm text-zinc-600"
        >
          <ArrowLeft aria-hidden="true" className="size-4" /> Voltar à Home
        </Link>
        <header>
          <h1 className="text-xl font-bold">Suas rifas</h1>
          <p className="mt-1 text-sm text-zinc-600">Conte suas vendas e dê mais um passo para realizar o encontro.</p>
        </header>
        {loading ? (
          <p role="status" className="flex items-center gap-2 text-sm">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            Consultando saldo…
          </p>
        ) : (
          <section
            aria-label="Resumo das rifas"
            className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-5"
          >
            {participant && <p className="text-sm font-semibold">{participant.identity.name}</p>}
            {raffles ? (
              <>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt>Meta de rifas</dt>
                    <dd>{raffles.totalTickets === null ? money.format(raffles.totalCents / 100) : `${raffles.totalTickets} rifas`}</dd>
                  </div>
                  <div className="flex justify-between gap-4 text-zinc-600">
                    <dt>Já pagas</dt>
                    <dd>{raffles.paidTickets === null ? money.format(raffles.paidCents / 100) : `${raffles.paidTickets} rifas`}</dd>
                  </div>
                  {raffles.extraTickets ? <div className="flex justify-between gap-4 text-emerald-700"><dt>Além da meta</dt><dd>+{raffles.extraTickets} rifas</dd></div> : null}
                  <div className="border-t border-zinc-100 pt-4">
                    <dt className="text-xs text-zinc-600">Valor pendente da meta</dt>
                    <dd className="app-metric mt-1 text-2xl font-semibold">
                      {money.format(raffles.pendingCents / 100)}
                    </dd>
                  </div>
                </dl>
                {settled && (
                  <p
                    role="status"
                    className="flex items-center gap-2 text-sm font-semibold text-emerald-700"
                  >
                    <CheckCircle2 aria-hidden="true" className="size-5" />
                    Rifas quitadas
                  </p>
                )}
                {openPayment ? (
                  <div role="status" className="space-y-3 text-sm text-zinc-600">
                    <p>{existingCheckout
                      ? `Você já tem um pagamento de ${existingCheckout.tickets} rifas em andamento.`
                      : "Há um pagamento em andamento. Aguarde a confirmação antes de informar outras vendas."}</p>
                    {existingCheckout && <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => openCheckout(existingCheckout.url)}>Continuar pagamento</Button>}
                  </div>
                ) : known ? (
                  <>
                    <label htmlFor="raffle-ticket-count" className="block text-sm font-semibold text-zinc-950">
                      Quantas rifas você vendeu?
                    </label>
                    <input
                      id="raffle-ticket-count"
                      type="number"
                      inputMode="numeric"
                      min="1"
                      step="1"
                      value={selectedTickets}
                      onChange={(event) => setSelectedTickets(event.target.value)}
                      className="min-h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 text-base text-zinc-950 outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                    />
                    <p className="text-sm text-zinc-600">
                      Você pode vender mais que a meta. Cada rifa vale {money.format(10)}.
                    </p>
                    <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
                      <span>Pagamento de agora</span>
                      <strong>{canPay ? money.format(count * 10) : "Informe uma quantidade válida"}</strong>
                    </div>
                    <p className="text-sm text-zinc-600">Pague com Pix ou cartão pela InfinitePay. As rifas entram no total pago após a confirmação.</p>
                    <Button
                      onClick={() => void pay()}
                      disabled={busy || !canPay}
                      className="min-h-12 w-full gap-2 rounded-xl bg-zinc-900 font-semibold text-white hover:bg-zinc-800"
                    >
                      {busy ? (
                        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                      ) : (
                        <Ticket aria-hidden="true" className="size-4" />
                      )}
                      {busy ? "Preparando pagamento…" : `Pagar ${count} ${count === 1 ? "rifa" : "rifas"}`}
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-zinc-600">
                    Consulte seu regente para conferir a quantidade de rifas.
                  </p>
                )}
              </>
            ) : (
              <div>
                <h2 className="font-semibold">Saldo indisponível</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Atualize os valores ou consulte seu regente para conferir as rifas.
                </p>
              </div>
            )}
          </section>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
          >
            {error}
          </p>
        )}
        <Button
          variant="ghost"
          disabled={loading || busy}
          onClick={() => setRevision((value) => value + 1)}
          className="min-h-11 gap-2 text-sm"
        >
          <RefreshCw aria-hidden="true" className="size-4" /> Atualizar valores
        </Button>
      </div>
    </main>
  );
}
