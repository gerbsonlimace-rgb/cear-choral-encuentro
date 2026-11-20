import { test } from "node:test";
import assert from "node:assert/strict";
import { parseJobSelection, selectJobRegistrationIds } from "./whatsapp-job-selection.mjs";
const a = "5bf18595-a8bb-4d54-bfb1-1ffd2e385304";
const b = "2eb9f28d-23f9-4f32-9e01-e9459986d8b9";

test("empty, ambiguous and malformed selections never become a send-all job", () => {
  for (const value of [null, {}, [], { registrationIds: [] }, { registrationIds: ["invalid"] },
    { registrationIds: Array(1001).fill(a) }, { scope: "all", registrationIds: [a] }, { registrationId: a, registrationIds: [b] },
    { resendRegistrationId: "invalid" }, { resendRegistrationId: a, scope: "all" }]) {
    assert.throws(() => parseJobSelection(value));
  }
  assert.deepEqual(parseJobSelection({ scope: "all" }), { scope: "all" });
  assert.deepEqual(parseJobSelection({ registrationId: a }), { registrationIds: [a] });
  assert.deepEqual(parseJobSelection({ registrationIds: [a, a, b] }), { registrationIds: [a, b] });
  assert.deepEqual(parseJobSelection({ resendRegistrationId: a }), { registrationIds: [a], resend: true });
});
test("a selected job can never include unselected, cancelled, unpaid or already processed people", () => {
  const rows = [
    { id: a, payment_status: "paid", cancelled_at: null },
    { id: b, payment_status: "paid", cancelled_at: null },
    { id: "cancelled", payment_status: "paid", cancelled_at: "2026-11-20" },
    { id: "pending", payment_status: "pending", cancelled_at: null },
  ];
  assert.deepEqual(selectJobRegistrationIds(rows, {}, parseJobSelection({ registrationIds: [b] })), [b]);
  assert.deepEqual(selectJobRegistrationIds(rows, { [b]: "sent" }, parseJobSelection({ registrationIds: [b] })), []);
  assert.deepEqual(selectJobRegistrationIds(rows, { [b]: "review" }, parseJobSelection({ registrationIds: [b] })), []);
  assert.deepEqual(selectJobRegistrationIds(rows, {}, parseJobSelection({ scope: "all" })), [a, b]);
});
test("an explicit resend repeats only that paid, active person even after a sent or review state", () => {
  const rows = [
    { id: a, payment_status: "paid", cancelled_at: null },
    { id: b, payment_status: "paid", cancelled_at: null },
    { id: "c", payment_status: "paid", cancelled_at: "2026-11-20" },
  ];
  const resendA = parseJobSelection({ resendRegistrationId: a });
  assert.deepEqual(selectJobRegistrationIds(rows, { [a]: "sent", [b]: "sent" }, resendA), [a]);
  assert.deepEqual(selectJobRegistrationIds(rows, { [a]: "review" }, resendA), [a]);
  assert.deepEqual(selectJobRegistrationIds(rows, { c: "sent" }, { registrationIds: ["c"], resend: true }), []);
  assert.deepEqual(selectJobRegistrationIds([{ id: a, payment_status: "pending", cancelled_at: null }], { [a]: "sent" }, resendA), []);
});

test("explicit selected resends include only the chosen people and never become all", () => {
  const selection = parseJobSelection({ resendRegistrationIds: [a, b] });
  assert.deepEqual(selection, { registrationIds: [a, b], resend: true });
  assert.deepEqual(selectJobRegistrationIds([{ id: a, payment_status: 'paid' }, { id: b, payment_status: 'pending' }], {[a]:'sent'}, selection), [a]);
  assert.throws(() => parseJobSelection({resendRegistrationIds:[]}));
});
