import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve("supabase/migrations/20260912194407_configure_coroapp_event_sources.sql"),
  "utf8",
)
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

describe("CoroApp event source migration", () => {
  it("keeps configuration server-only and replaces the ordered set atomically", () => {
    expect(sql).toContain("create table public.coroapp_event_sources");
    expect(sql).toContain("alter table public.coroapp_event_sources enable row level security");
    expect(sql).toContain(
      "revoke all on table public.coroapp_event_sources from public, anon, authenticated",
    );
    expect(sql).toContain(
      "grant select, insert, update, delete on table public.coroapp_event_sources to service_role",
    );
    expect(sql).toContain("create or replace function public.replace_coroapp_event_sources");
    expect(sql).toContain(
      "from public.admin_users where user_id = p_admin_user_id and revoked_at is null",
    );
    expect(sql).toContain("delete from public.coroapp_event_sources");
    expect(sql).toContain("jsonb_to_recordset(p_sources)");
    expect(sql).toContain(
      "grant execute on function public.replace_coroapp_event_sources(uuid, jsonb) to service_role",
    );
    expect(sql).not.toContain("to authenticated");
  });

  it("seeds the three explicitly selected CoroApp celebrations without copying repertoire", () => {
    expect(sql.match(/coroapp\.lovable\.app\/e\//g) || []).toHaveLength(3);
    expect(sql).toContain("grande concerto");
    expect(sql).toContain("apresentação da bem aventurada virgem maria");
    expect(sql).toContain("solenidade de nosso senhor jesus cristo rei do universo");
    expect(sql).not.toContain("song_audios");
    expect(sql).not.toContain("event_songs");
  });
});
