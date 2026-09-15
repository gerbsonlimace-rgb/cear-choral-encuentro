import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve("supabase/migrations/20260912212915_create_event_documents.sql"),
  "utf8",
)
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

describe("event document migration", () => {
  it("creates constrained metadata with indexed event lookup and server-only grants", () => {
    expect(sql).toContain("create table public.event_documents");
    expect(sql).toContain("event_id uuid not null");
    expect(sql).not.toContain("event_id uuid references public.coroapp_event_sources");
    expect(sql).toContain("storage_path text not null unique");
    expect(sql).toContain("mime_type = 'application/pdf'");
    expect(sql).toContain("size_bytes between 1 and 10485760");
    expect(sql).toContain("create index event_documents_event_id_idx");
    expect(sql).toContain("create index event_documents_category_idx");
    expect(sql).toContain("alter table public.event_documents enable row level security");
    expect(sql).toContain(
      "revoke all on table public.event_documents from public, anon, authenticated, service_role",
    );
    expect(sql).toContain(
      "grant select, insert, update, delete on table public.event_documents to service_role",
    );
  });

  it("creates a private PDF-only bucket with no browser Storage policy", () => {
    expect(sql).toContain("'event-documents', 'event-documents', false, 10485760");
    expect(sql).toContain("array['application/pdf']::text[]");
    expect(sql).not.toContain("create policy");
    expect(sql).not.toContain("on storage.objects");
  });
});
