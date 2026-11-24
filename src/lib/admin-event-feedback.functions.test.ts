import { describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-start")>();
  return {
    ...actual,
    createServerFn: () => {
      const middlewares: unknown[] = [];
      const builder = {
        middleware(value: unknown[]) {
          middlewares.push(...value);
          return builder;
        },
        handler(handler: () => unknown) {
          return Object.assign(handler, { middlewares });
        },
      };
      return builder;
    },
  };
});
import { requireAdmin } from "@/features/admin/admin-auth.middleware";
import { getAdminEventFeedback } from "./admin-event-feedback.functions";
describe("private feedback boundary", () => {
  it("requires server-side administrator authorization before reading opinions", () => {
    expect((getAdminEventFeedback as unknown as { middlewares: unknown[] }).middlewares).toContain(
      requireAdmin,
    );
  });
});
