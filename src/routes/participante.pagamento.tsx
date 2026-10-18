import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { ParticipantBalancePaymentPage } from "@/features/participant/ParticipantBalancePaymentPage";
import { ComplementPaymentConfirmationPage } from "@/features/regent/ComplementPaymentConfirmationPage";
import {
  paymentLookupSchema,
  type PaymentLookup,
} from "@/features/registration/registration.domain";
import { getParticipantAccess } from "@/lib/participant.functions";
import { verifyParticipantBalancePayment } from "@/lib/participant-payment.functions";

const searchSchema = z.object({
  order_nsu: z.string().optional(),
  transaction_nsu: z.string().optional(),
  slug: z.string().optional(),
  receipt_url: z.string().optional(),
});
const verifyPayment = (lookup: PaymentLookup) => verifyParticipantBalancePayment({ data: lookup });

export const Route = createFileRoute("/participante/pagamento")({
  validateSearch: searchSchema,
  beforeLoad: async () => {
    const access = await getParticipantAccess();
    if (access.status !== "authorized") throw redirect({ to: "/acessar" });
  },
  head: () => ({
    meta: [
      { name: "description", content: "Pagamento da inscrição no portal do II Encontro de Coros Diocesanos e Litúrgicos do Ceará." },
      { property: "og:title", content: "Pagamento da inscrição | Área do participante" },
      { property: "og:description", content: "Pagamento da inscrição no portal do II Encontro de Coros Diocesanos e Litúrgicos do Ceará." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Pagamento da inscrição | Área do participante" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ParticipantPaymentRoute,
});

function ParticipantPaymentRoute() {
  const search = Route.useSearch();
  if (Object.values(search).some((value) => value !== undefined)) {
    const lookup = paymentLookupSchema.safeParse({
      orderNsu: search.order_nsu,
      transactionNsu: search.transaction_nsu,
      slug: search.slug,
      receiptUrl: search.receipt_url,
    });
    return (
      <ComplementPaymentConfirmationPage
        lookup={lookup.success ? lookup.data : null}
        verifyPayment={verifyPayment}
        returnTo="/participante"
        returnLabel="Voltar à área do participante"
      />
    );
  }
  return <ParticipantBalancePaymentPage />;
}
