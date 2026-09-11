import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { paymentLookupSchema } from "@/features/registration/registration.domain";
import { ComplementPaymentConfirmationPage } from "@/features/regent/ComplementPaymentConfirmationPage";
import { requirePortalReadyRequestAccess } from "@/features/regent/regent-auth.middleware";

const returnSearchSchema = z.object({
  order_nsu: z.string().optional(),
  transaction_nsu: z.string().optional(),
  slug: z.string().optional(),
  receipt_url: z.string().optional(),
});
export const Route = createFileRoute("/regente/pagamento")({
  server: {
    middleware: [requirePortalReadyRequestAccess],
  },
  validateSearch: (search) => returnSearchSchema.parse(search),
  component: RegentPaymentReturnRoute,
});
function RegentPaymentReturnRoute() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const parsed = paymentLookupSchema.safeParse({
    orderNsu: search.order_nsu,
    transactionNsu: search.transaction_nsu,
    slug: search.slug,
    receiptUrl: search.receipt_url,
  });
  return (
    <ComplementPaymentConfirmationPage
      lookup={parsed.success ? parsed.data : null}
      onSuccess={() => navigate({ href: "/regente" })}
    />
  );
}
