import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260912200441_create_event_activity_attendance.sql",
);
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
const migration = existsSync(migrationPath) ? normalize(readFileSync(migrationPath, "utf8")) : "";

describe("event activity attendance migration", () => {
  it("creates private activity and attendance tables", () => {
    expect(migration).toContain("create table public.event_activities");
    expect(migration).toContain("create table public.event_activity_attendances");
    expect(migration).toContain("alter table public.event_activities enable row level security");
    expect(migration).toContain("alter table public.event_activity_attendances enable row level security");
    expect(migration).toContain("from public, anon, authenticated");
  });

  it("stores QR version and optional location verification", () => {
    expect(migration).toContain("verify_location boolean not null default false");
    expect(migration).toContain("qr_version integer not null default 1");
    expect(migration).toContain("radius_meters integer");
    expect(migration).toContain("unique (activity_id, participant_account_id)");
  });

  it("seeds the exact 24 public programme rows with categories", () => {
    const seededRows = Array.from(migration.matchAll(/\('([^']+)', '2026-11-(?:20|21|22)'/g));
    expect(seededRows).toHaveLength(24);
    expect(seededRows.map((match) => match[1])).toEqual([
      "credenciamento",
      "vesperas",
      "jantar",
      "abertura oficial",
      "1ª conferencia",
      "completas",
      "santa missa",
      "cafe da manha",
      "2ª conferencia",
      "coffee break",
      "3ª conferencia",
      "ensaio 1",
      "almoco",
      "4ª conferencia",
      "ensaio 2",
      "coffee break",
      "visita ao santuario",
      "concerto na catedral",
      "jantar",
      "laudes",
      "cafe da manha",
      "ensaio 3",
      "missa solene na catedral",
      "almoco e despedida",
    ]);
    for (const category of ["welcome", "celebration", "meal", "conference", "music", "visit"]) {
      expect(migration).toContain(`'${category}'`);
    }
  });
});
