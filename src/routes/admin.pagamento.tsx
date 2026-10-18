import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { ComplementPaymentConfirmationPage } from "@/features/regent/ComplementPaymentConfirmationPage";
import { paymentLookupSchema } from "@/features/registration/registration.domain";
import { getAdminAccess } from "@/lib/admin.functions";

const returnSearchSchema = z.object({
  order_nsu: z.string().optional(),
  transaction_nsu: z.string().optional(),
  slug: z.string().optional(),
  receipt_url: z.string().optional(),
});

export const Route = createFileRoute("/admin/pagamento")({
  head: () => ({ meta: [
      { title: "Pagamento administrativo | Encontro de Coros" },
      { name: "description", content: "Pagamento administrativo no portal do II Encontro de Coros Diocesanos e Litúrgicos do Ceará." },
      { property: "og:title", content: "Pagamento administrativo | Encontro de Coros" },
      { property: "og:description", content: "Pagamento administrativo no portal do II Encontro de Coros Diocesanos e Litúrgicos do Ceará." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
  ] }),
  validateSearch: (search) => returnSearchSchema.parse(search),
  beforeLoad: async () => {
    const access = await getAdminAccess();
    if (access.status !== "authorized") throw redirect({ to: "/acessar" });
  },
  component: AdminPaymentReturnRoute,
});

function AdminPaymentReturnRoute() {
  const search = Route.useSearch();
  const lookup = paymentLookupSchema.safeParse({
    orderNsu: search.order_nsu,
    transactionNsu: search.transaction_nsu,
    slug: search.slug,
    receiptUrl: search.receipt_url,
  });
  return (
    <ComplementPaymentConfirmationPage
      lookup={lookup.success ? lookup.data : null}
      returnTo="/admin/inscricoes"
      returnLabel="Voltar às inscrições"
    />
  );
}
