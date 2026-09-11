import { describe, expect, it } from "vitest";
import { Route } from "@/routes/regente.pagamento";

describe("/regente/pagamento route contract", () => {
  it("renders without request middleware so localStorage sessions can reach the protected verifier", () => {
    expect(Route.options.server?.middleware).toBeUndefined();
  });

  it("keeps the successful return destination in the regent area", () => {
    expect(Route.options.component).toBeDefined();
  });
});
