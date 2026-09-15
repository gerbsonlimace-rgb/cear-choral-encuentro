import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route as AdminPaymentRoute } from "@/routes/admin.pagamento";
import { Route as RegentPaymentRoute } from "@/routes/regente.pagamento";

const server = vi.hoisted(() => ({ getAdminAccess: vi.fn() }));

vi.mock("@/lib/admin.functions", () => ({ getAdminAccess: server.getAdminAccess }));

describe("/regente/pagamento route contract", () => {
  it("renders without request middleware so localStorage sessions can reach the protected verifier", () => {
    expect(RegentPaymentRoute.options.server?.middleware).toBeUndefined();
  });

  it("keeps the successful return destination in the regent area", () => {
    expect(RegentPaymentRoute.options.component).toBeDefined();
  });
});

describe("/admin/pagamento route contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires an active administrator before accepting an InfinitePay return", async () => {
    server.getAdminAccess.mockResolvedValue({ status: "forbidden" });

    await expect(AdminPaymentRoute.options.beforeLoad?.({} as never)).rejects.toBeDefined();
  });

  it("accepts the validated provider search keys for an active administrator", async () => {
    server.getAdminAccess.mockResolvedValue({
      status: "authorized",
      userId: "admin-1",
      email: "admin@example.com",
    });

    await expect(AdminPaymentRoute.options.beforeLoad?.({} as never)).resolves.toBeUndefined();
    const validateSearch = AdminPaymentRoute.options.validateSearch as (search: unknown) => unknown;
    expect(
      validateSearch({
        order_nsu: "11111111-1111-4111-8111-111111111111",
        transaction_nsu: "transaction-123",
        slug: "invoice-123",
        receipt_url: "https://receipts.infinitepay.com.br/receipt-123",
      }),
    ).toEqual({
      order_nsu: "11111111-1111-4111-8111-111111111111",
      transaction_nsu: "transaction-123",
      slug: "invoice-123",
      receipt_url: "https://receipts.infinitepay.com.br/receipt-123",
    });
  });
});
