import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  return {
    supabaseAdmin: createClient("https://supabase.example.test", "test-key", {
      global: { fetch: fetchMock },
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
});

import { createSupabaseEventNoticeRepository } from "./eventNotice.repository.server";

const row = {
  id: "44444444-4444-4444-8444-444444444444",
  event_id: "22222222-2222-4222-8222-222222222222",
  title: "Ensaio geral",
  body: "Chegue às 18h.",
  is_published: true,
  created_at: "2026-09-13T12:00:00.000Z",
  updated_at: "2026-09-13T12:00:00.000Z",
};
const response = (value: unknown) =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
beforeEach(() => fetchMock.mockReset());

describe("notice persistence through Supabase client", () => {
  it("finds the existing notice required for edit and withdrawal", async () => {
    fetchMock.mockResolvedValueOnce(response([row]));
    const result = await createSupabaseEventNoticeRepository().find(row.id);
    expect(result).toEqual({
      id: row.id,
      eventId: row.event_id,
      title: "Ensaio geral",
      body: "Chegue às 18h.",
      isPublished: true,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      eventName: "",
    });
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get("id")).toBe(`eq.${row.id}`);
  });

  it("filters participant reads by both configured event ids and publication", async () => {
    fetchMock.mockResolvedValueOnce(response([row]));
    const result = await createSupabaseEventNoticeRepository().listPublished([row.event_id]);
    expect(result[0].title).toBe("Ensaio geral");
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get("event_id")).toBe(`in.(${row.event_id})`);
    expect(url.searchParams.get("is_published")).toBe("eq.true");
    expect(url.searchParams.get("order")).toBe("created_at.desc");
  });

  it("persists withdrawal and trusted audit identity through an id-scoped update", async () => {
    fetchMock.mockResolvedValueOnce(response({ ...row, is_published: false }));
    const result = await createSupabaseEventNoticeRepository().update(row.id, {
      eventId: row.event_id,
      title: row.title,
      body: row.body,
      isPublished: false,
      adminUserId: "trusted-admin",
    });
    expect(result.isPublished).toBe(false);
    const [url, request] = fetchMock.mock.calls[0];
    expect(new URL(url).searchParams.get("id")).toBe(`eq.${row.id}`);
    expect(request.method).toBe("PATCH");
    expect(JSON.parse(request.body)).toMatchObject({
      is_published: false,
      updated_by: "trusted-admin",
    });
  });
});
