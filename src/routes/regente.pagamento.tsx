import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { ComplementPaymentConfirmationPage } from "@/features/regent/ComplementPaymentConfirmationPage";
import { paymentLookupSchema } from "@/features/registration/registration.domain";
import { getRegentAccess } from "@/lib/regent.functions";

const returnSearchSchema = z.object({
  order_nsu: z.string().optional(),
  transaction_nsu: z.string().optional(),
  slug: z.string().optional(),
  receipt_url: z.string().optional(),
});

export const Route = createFileRoute("/regente/pagamento")({
  head: () => ({ meta: [
      { title: "Pagamento do coro | Encontro de Coros" },
      { name: "description", content: "Pagamento do coro no portal do II Encontro de Coros Diocesanos e Litúrgicos do Ceará." },
      { property: "og:title", content: "Pagamento do coro | Encontro de Coros" },
      { property: "og:description", content: "Pagamento do coro no portal do II Encontro de Coros Diocesanos e Litúrgicos do Ceará." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
  ] }),
  validateSearch: (search) => returnSearchSchema.parse(search),
  beforeLoad: async () => {
    const access = await getRegentAccess();
    if (access.status === "password_change_required") {
      throw redirect({ to: "/regente/alterar-senha" });
    }
    if (access.status !== "authorized") throw redirect({ to: "/acessar" });
  },
  component: RegentPaymentReturnRoute,
});

function RegentPaymentReturnRoute() {
  const search = Route.useSearch();
  const lookup = paymentLookupSchema.safeParse({
    orderNsu: search.order_nsu,
    transactionNsu: search.transaction_nsu,
    slug: search.slug,
    receiptUrl: search.receipt_url,
  });
  return <ComplementPaymentConfirmationPage lookup={lookup.success ? lookup.data : null} />;
}
