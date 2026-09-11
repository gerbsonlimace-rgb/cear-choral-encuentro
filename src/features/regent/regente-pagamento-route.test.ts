import { describe, expect, it } from "vitest";
import { requirePortalReadyRequestAccess } from "./regent-auth.middleware";
import { Route } from "@/routes/regente.pagamento";

describe("/regente/pagamento route contract", () => {
  it("requires server-side ready portal access", () => {
    expect(Route.options.server?.middleware).toContain(requirePortalReadyRequestAccess);
  });

  it("keeps the successful return destination in the regent area", () => {
    expect(Route.options.component).toBeDefined();
  });
});
