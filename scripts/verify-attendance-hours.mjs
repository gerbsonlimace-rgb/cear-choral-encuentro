// Run with an isolated PGlite installation: node scripts/verify-attendance-hours.mjs <pglite-module-path> [--original]
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const original = readFileSync("supabase/migrations/20260912200441_create_event_activity_attendance.sql", "utf8");
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table public.registrations (id uuid primary key, payment_status text);
    create table public.participant_accounts (
      id uuid primary key, registration_id uuid, access_status text, user_id uuid
    );
  `);
  await db.exec(original);
  if (!process.argv.includes("--original")) {
    await db.exec(readFileSync("supabase/migrations/20260914052311_allow_attendance_outside_activity_hours.sql", "utf8"));
  }
  await db.exec(`
    insert into public.registrations values ('33333333-3333-4333-8333-333333333333', 'paid');
    insert into public.participant_accounts values (
      '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333',
      'active', '44444444-4444-4444-8444-444444444444'
    );
    -- Allow dates relative to today in this disposable test database only.
    alter table public.event_activities drop constraint event_activities_activity_date_check;
  `);
  const call = (id, extra = "", version = 1) => db.query(`
    select * from public.record_event_activity_attendance(
      '${id}', ${version}, '22222222-2222-4222-8222-222222222222',
      '33333333-3333-4333-8333-333333333333' ${extra}
    )
  `);
  const ids = [];
  for (const offset of [-1, 1]) {
    const { rows: [activity] } = await db.query(`
      insert into public.event_activities (title, activity_date, starts_at, ends_at, category, requires_qr)
      values ('Teste QR', current_date + ${offset}, '09:00', '10:00', 'conference', true) returning id
    `);
    ids.push(activity.id);
    assert.equal((await call(activity.id)).rows[0].status, "recorded");
    assert.equal((await call(activity.id)).rows[0].status, "already_recorded");
  }
  assert.equal((await db.query("select count(*)::int as total from public.event_activity_attendances")).rows[0].total, 2);
  const id = ids[0];
  await assert.rejects(call(id, "", 2), /EVENT_ATTENDANCE_QR_REVOKED/);
  await db.exec(`update public.event_activities set is_active = false where id = '${id}'`);
  await assert.rejects(call(id), /EVENT_ATTENDANCE_ACTIVITY_UNAVAILABLE/);
  await db.exec(`update public.event_activities set is_active = true where id = '${id}'; update public.participant_accounts set access_status = 'blocked'`);
  await assert.rejects(call(id), /EVENT_ATTENDANCE_PARTICIPANT_UNAUTHORIZED/);
  await db.exec("update public.participant_accounts set access_status = 'active'; update public.registrations set payment_status = 'pending'");
  await assert.rejects(call(id), /EVENT_ATTENDANCE_REGISTRATION_UNPAID/);
  await db.exec(`
    update public.registrations set payment_status = 'paid';
    update public.event_activities set verify_location = true, latitude = -4.9708, longitude = -39.0167, radius_meters = 150 where id = '${id}'
  `);
  await assert.rejects(call(id), /EVENT_ATTENDANCE_LOCATION_REQUIRED/);
  await assert.rejects(call(id, ", -4.9708, -39.0167, 20, clock_timestamp() - interval '3 minutes'"), /EVENT_ATTENDANCE_LOCATION_STALE/);
  await assert.rejects(call(id, ", -4.9708, -39.0167, 101, clock_timestamp()"), /EVENT_ATTENDANCE_LOCATION_INACCURATE/);
  await assert.rejects(call(id, ", 0, 0, 20, clock_timestamp()"), /EVENT_ATTENDANCE_OUTSIDE_GEOFENCE/);
  assert.equal((await call(id, ", -4.9708, -39.0167, 20, clock_timestamp()")).rows[0].status, "already_recorded");
  const { rows: [privileges] } = await db.query(`
    select has_function_privilege('anon', oid, 'execute') as anon,
      has_function_privilege('authenticated', oid, 'execute') as authenticated,
      has_function_privilege('service_role', oid, 'execute') as service_role
    from pg_proc where proname = 'record_event_activity_attendance'
  `);
  assert.deepEqual(privileges, { anon: false, authenticated: false, service_role: true });
  console.log("PASS: early/late check-ins, duplicates, QR/access/payment/location checks and RPC permissions.");
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  if (error.internalQuery) console.error(error.internalQuery);
  process.exitCode = 1;
} finally {
  await db.close();
}
