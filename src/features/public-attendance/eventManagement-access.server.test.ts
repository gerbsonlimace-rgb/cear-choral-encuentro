import { describe, expect, it } from "vitest";
import { evaluateEventManagementAccess } from "./eventManagement.domain";

const account = {
  registration_id: "registration",
  access_status: "active" as string | null,
  registrations: { cancelled_at: null as string | null },
};

describe("independent scanner and report access", () => {
  it("administration alone never bypasses the explicit report permission", () => {
    expect(evaluateEventManagementAccess({ app_metadata: { user_metadata_report: "registration" } }, account, true))
      .toEqual({ canScan: true, canReport: false });
  });
  it("reports permission grants no scanner or administrative access", () => {
    expect(evaluateEventManagementAccess({ app_metadata: { event_report_registration_id: "registration" } }, account, false))
      .toEqual({ canScan: false, canReport: true });
  });
  it("cancelled and inactive accounts do not receive report access", () => {
    expect(evaluateEventManagementAccess(
      { app_metadata: { event_report_registration_id: "registration" } },
      { ...account, access_status: "revoked" }, false,
    ).canReport).toBe(false);
    expect(evaluateEventManagementAccess(
      { app_metadata: { event_report_registration_id: "registration" } },
      { ...account, registrations: { cancelled_at: "2026-11-20" } }, false,
    ).canReport).toBe(false);
  });
  it("missing account or mismatched permission never grants reports", () => {
    expect(evaluateEventManagementAccess({ app_metadata: {} }, null, false).canReport).toBe(false);
    expect(evaluateEventManagementAccess(null, account, false).canReport).toBe(false);
    expect(evaluateEventManagementAccess({ app_metadata: { event_report_registration_id: "other" } }, account, false).canReport).toBe(false);
  });
});
