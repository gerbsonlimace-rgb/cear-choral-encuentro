import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, CreditCard, LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getParticipantRegistration } from "@/lib/participant.functions";
import {
  startParticipantBalanceCheckout,
  type ParticipantBalanceCheckoutResult,
} from "@/lib/participant-payment.functions";
import type { ParticipantRegistrationView } from "./participant.domain";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const defaultStart = () => startParticipantBalanceCheckout({ data: {} });
const defaultOpen = (url: string) => window.location.assign(url);

type Props = {
  loadRegistration?: () => Promise<ParticipantRegistrationView>;
  startCheckout?: () => Promise<ParticipantBalanceCheckoutResult>;
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
  const [revision, setRevision] = useState(0);
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
    void loadRegistration()
      .then((view) => {
        if (!cancelled) setParticipant(view);
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

  const financial = participant?.payment.financialState;
  const known = financial && financial.status !== "legacy";
  const settled = known && financial.pendingCents === 0;
  const canPay = known && financial.status === "partially_paid" && financial.pendingCents > 0;

  const pay = async () => {
    if (!canPay || loading || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await startCheckout();
      if (!mounted.current) return;
      if (!result.ok) {
        if (result.code === "open_payment") {
          setOpenPayment(true);
        } else {
          setError(result.message);
        }
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
          <h1 className="text-xl font-bold">Pagamento da inscrição</h1>
          <p className="mt-1 text-sm text-zinc-600">Quite o valor restante do seu encontro.</p>
        </header>
        {loading ? (
          <p role="status" className="flex items-center gap-2 text-sm">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            Consultando saldo…
          </p>
        ) : (
          <section
            aria-label="Resumo do pagamento"
            className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-5"
          >
            {participant && <p className="text-sm font-semibold">{participant.identity.name}</p>}
            {known ? (
              <>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt>Valor total</dt>
                    <dd>
                      {money.format(
                        (financial.pendingCents + financial.confirmedPrincipalCents) / 100,
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 text-zinc-500">
                    <dt>Já pago</dt>
                    <dd>{money.format(financial.confirmedPrincipalCents / 100)}</dd>
                  </div>
                  <div className="border-t border-zinc-100 pt-4">
                    <dt className="text-xs text-zinc-500">Saldo restante</dt>
                    <dd className="app-metric mt-1 text-2xl font-semibold">
                      {money.format(financial.pendingCents / 100)}
                    </dd>
                  </div>
                </dl>
                {settled ? (
                  <p
                    role="status"
                    className="flex items-center gap-2 text-sm font-semibold text-emerald-700"
                  >
                    <CheckCircle2 aria-hidden="true" className="size-5" />
                    Inscrição quitada
                  </p>
                ) : openPayment ? (
                  <p role="status" className="text-sm text-zinc-600">
                    Há um pagamento em andamento. Aguarde a confirmação ou consulte seu regente.
                  </p>
                ) : canPay ? (
                  <>
                    <p className="text-sm text-zinc-600">
                      Pague com Pix ou cartão pelo InfinitePay, como na inscrição.
                    </p>
                    <Button
                      onClick={() => void pay()}
                      disabled={busy}
                      className="min-h-12 w-full gap-2 rounded-xl bg-[#ffc400] font-semibold text-black hover:bg-[#f2ba00]"
                    >
                      {busy ? (
                        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                      ) : (
                        <CreditCard aria-hidden="true" className="size-4" />
                      )}
                      {busy ? "Preparando pagamento…" : "Pagar saldo restante"}
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-zinc-600">
                    Consulte seu regente para conferir o pagamento da inscrição.
                  </p>
                )}
              </>
            ) : (
              <div>
                <h2 className="font-semibold">Saldo indisponível</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Atualize os valores ou consulte seu regente.
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
