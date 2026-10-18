import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { PaymentConfirmationPage } from "@/features/registration/PaymentConfirmationPage";
import { paymentLookupSchema } from "@/features/registration/registration.domain";

const returnSearchSchema = z.object({
  order_nsu: z.string().optional(),
  transaction_nsu: z.string().optional(),
  slug: z.string().optional(),
  receipt_url: z.string().optional(),
});

export const Route = createFileRoute("/pagamento")({
  head: () => ({ meta: [
      { title: "Confirmação de pagamento | Encontro de Coros" },
      { name: "description", content: "Confirmação de pagamento no portal do II Encontro de Coros Diocesanos e Litúrgicos do Ceará." },
      { property: "og:title", content: "Confirmação de pagamento | Encontro de Coros" },
      { property: "og:description", content: "Confirmação de pagamento no portal do II Encontro de Coros Diocesanos e Litúrgicos do Ceará." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
  ] }),
  validateSearch: (search) => returnSearchSchema.parse(search),
  component: PaymentReturnRoute,
});

function PaymentReturnRoute() {
  const search = Route.useSearch();
  const lookup = paymentLookupSchema.safeParse({
    orderNsu: search.order_nsu,
    transactionNsu: search.transaction_nsu,
    slug: search.slug,
    receiptUrl: search.receipt_url,
  });

  return <PaymentConfirmationPage lookup={lookup.success ? lookup.data : null} />;
}
