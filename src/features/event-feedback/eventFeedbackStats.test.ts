import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadEventFeedbackStats } from "./eventFeedback.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: vi.fn() } }));

describe("public feedback totals", () => {
  beforeEach(() => vi.mocked(supabaseAdmin.from).mockReset());
  it("returns only aggregate counts and excludes cancelled registrations", async () => {
    const activeOnly = vi.fn().mockResolvedValue({ count: 245, error: null });
    const registrations = vi.fn().mockReturnValue({ is: activeOnly });
    const responses = vi.fn().mockResolvedValue({ count: 18, error: null });
    vi.mocked(supabaseAdmin.from).mockImplementation(
      (table: string) =>
        ({ select: table === "registrations" ? registrations : responses }) as never,
    );
    expect(await loadEventFeedbackStats()).toEqual({ registrations: 245, responses: 18 });
    expect(activeOnly).toHaveBeenCalledWith("cancelled_at", null);
    expect(registrations).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(responses).toHaveBeenCalledWith("submission_id", { count: "exact", head: true });
  });
  it("represents an unavailable total as unknown instead of inventing zero responses", async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation(
      (table: string) =>
        ({
          select: () =>
            table === "registrations"
              ? { is: async () => ({ count: 245, error: null }) }
              : Promise.resolve({ count: null, error: { code: "42P01" } }),
        }) as never,
    );
    expect(await loadEventFeedbackStats()).toEqual({ registrations: 245, responses: null });
  });
});
