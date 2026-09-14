import { describe, expect, it, vi } from "vitest";

const { service, listSources } = vi.hoisted(() => ({
  service: {
    listAdmin: vi.fn(async () => []),
    listParticipant: vi.fn(async () => []),
    create: vi.fn(async () => ({ id: "document-1" })),
    update: vi.fn(async () => ({ id: "document-1" })),
    remove: vi.fn(async () => undefined),
    createAdminSignedUrl: vi.fn(async () => ({ signedUrl: "admin", expiresIn: 120 })),
    createParticipantSignedUrl: vi.fn(async () => ({
      signedUrl: "participant",
      expiresIn: 120,
    })),
  },
  listSources: vi.fn(async () => []),
}));

vi.mock("@/features/event-documents/eventDocument.service.server", () => ({
  getEventDocumentService: () => service,
}));
vi.mock("@/features/coroapp-integration/coroAppEventSource.service.server", () => ({
  getCoroAppEventSourceService: () => ({ list: listSources }),
}));
vi.mock("@tanstack/react-start", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-start")>();
  return {
    ...actual,
    createServerFn: (options: { method: string }) => {
      const middlewares: unknown[] = [];
      const builder = {
        middleware(value: unknown[]) {
          middlewares.push(...value);
          return builder;
        },
        validator() {
          return builder;
        },
        handler(handler: (input: unknown) => unknown) {
          return Object.assign(handler, { method: options.method, middlewares });
        },
      };
      return builder;
    },
  };
});

import { requireAdmin } from "@/features/admin/admin-auth.middleware";
import { requireParticipantAccess } from "@/features/participant/participant-auth.middleware";
import {
  createAdminEventDocument,
  deleteAdminEventDocument,
  getAdminEventDocumentBootstrap,
  getAdminEventDocumentUrl,
  getParticipantEventDocuments,
  getParticipantEventDocumentUrl,
  updateAdminEventDocument,
} from "./event-document.functions";

type ServerFunction = {
  (input: unknown): Promise<unknown>;
  method: string;
  middlewares: unknown[];
};

describe("event document server-function boundaries", () => {
  it("protects every administrative read and mutation with requireAdmin", async () => {
    const functions = [
      getAdminEventDocumentBootstrap,
      createAdminEventDocument,
      updateAdminEventDocument,
      deleteAdminEventDocument,
      getAdminEventDocumentUrl,
    ] as unknown as ServerFunction[];

    expect(functions.map((fn) => fn.method)).toEqual(["GET", "POST", "POST", "POST", "POST"]);
    for (const fn of functions) expect(fn.middlewares).toContain(requireAdmin);

    await (createAdminEventDocument as unknown as ServerFunction)({
      data: {
        eventId: "22222222-2222-4222-8222-222222222222",
        title: "Guia",
        category: "Guia",
        file: {
          base64: "JVBERi0xLjQKJSVFT0Y=",
          mimeType: "application/pdf",
          fileName: "guia.pdf",
        },
      },
      context: { adminUserId: "admin-1" },
    });
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({ adminUserId: "admin-1", title: "Guia" }),
    );
  });

  it("protects participant listing and signed access with requireParticipantAccess", () => {
    const functions = [
      getParticipantEventDocuments,
      getParticipantEventDocumentUrl,
    ] as unknown as ServerFunction[];

    expect(functions.map((fn) => fn.method)).toEqual(["GET", "POST"]);
    for (const fn of functions) expect(fn.middlewares).toContain(requireParticipantAccess);
  });
});
