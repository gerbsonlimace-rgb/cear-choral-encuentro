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
const unrestrictedAttendance = normalize(readFileSync(resolve(
  process.cwd(), "supabase/migrations/20260914052311_allow_attendance_outside_activity_hours.sql",
), "utf8"));

describe("attendance outside activity hours", () => {
  it("replaces the RPC without restricting check-in by activity date or time", () => {
    expect(unrestrictedAttendance).toContain("create or replace function public.record_event_activity_attendance");
    expect(unrestrictedAttendance).not.toContain("event_attendance_outside_window");
    expect(unrestrictedAttendance).not.toContain("window_starts_at");
    expect(unrestrictedAttendance).not.toContain("window_ends_at");
  });

  it("preserves access checks, location freshness and duplicate protection", () => {
    for (const rule of [
      "activity.requires_qr = false", "activity.qr_version <> p_qr_version",
      "participant.access_status <> 'active'", "registration.payment_status <> 'paid'",
      "interval '2 minutes'", "interval '30 seconds'", "p_accuracy_meters > 100",
      "activity.radius_meters", "on conflict (activity_id, participant_account_id) do nothing",
      "already_recorded", "from public, anon, authenticated", "to service_role",
    ]) expect(unrestrictedAttendance).toContain(rule);
  });
});

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

  it("keeps QR regeneration and attendance recording inside server-only RPCs", () => {
    expect(migration).toContain("create or replace function public.increment_event_activity_qr_version");
    expect(migration).toContain("create or replace function public.record_event_activity_attendance");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = public, pg_temp");
    expect(migration).toContain("grant execute on function public.increment_event_activity_qr_version");
    expect(migration).toContain("grant execute on function public.record_event_activity_attendance");
    expect(migration).toContain("to service_role");
    expect(migration).toContain("from public, anon, authenticated");
  });

  it("revalidates QR, participant, window and optional geofence atomically", () => {
    expect(migration).toContain("activity.requires_qr = false");
    expect(migration).toContain("activity.qr_version <> p_qr_version");
    expect(migration).toContain("participant.access_status <> 'active'");
    expect(migration).toContain("registration.payment_status <> 'paid'");
    expect(migration).toContain("interval '30 minutes'");
    expect(migration).toContain("interval '2 minutes'");
    expect(migration).toContain("interval '30 seconds'");
    expect(migration).toContain("p_accuracy_meters > 100");
    expect(migration).toContain("activity.radius_meters");
    expect(migration).toContain("on conflict (activity_id, participant_account_id) do nothing");
    expect(migration).toContain("already_recorded");
  });
});
