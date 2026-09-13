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
