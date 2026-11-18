import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/features/admin/admin-auth.middleware";
import { createFinanceEntrySchema } from "@/features/admin/admin-finance.domain";

export const getAdminFinance = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { getAdminFinanceSnapshot } = await import("@/features/admin/admin-finance.server");
    return getAdminFinanceSnapshot();
  });

export const createAdminFinance = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(createFinanceEntrySchema)
  .handler(async ({ data, context }) => {
    const { createAdminFinanceEntry } = await import("@/features/admin/admin-finance.server");
    return createAdminFinanceEntry(data, context.adminUserId);
  });

export const getAdminFinanceFile = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(z.object({ id: z.string().uuid() }).strict())
  .handler(async ({ data }) => {
    const { getAdminFinanceAttachment } = await import("@/features/admin/admin-finance.server");
    return getAdminFinanceAttachment(data.id);
  });
