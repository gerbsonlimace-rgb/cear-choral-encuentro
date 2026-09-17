import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260917160000_add_registration_exemptions.sql"),
  "utf8",
).toLowerCase();

describe("registration exemption migration", () => {
  it("adds an audited exemption origin and allows only zero financial values for it", () => {
    expect(migration).toContain("'infinitepay', 'manual', 'exemption'");
    expect(migration).toContain("exempted_by is not null");
    expect(migration).toContain("exempted_at is not null");
    expect(migration).toContain("payment_origin = 'exemption' and amount_cents = 0");
    expect(migration).toContain("payment_origin = 'exemption' and paid_amount_cents = 0");
  });

  it("keeps an exempt registration active without fabricating provider payment details", () => {
    expect(migration).toContain("payment_status = 'paid'");
    expect(migration).toContain("infinitepay_transaction_nsu is null");
    expect(migration).toContain("payment_method is null");
    expect(migration).toContain("paid_at is null");
  });
});
