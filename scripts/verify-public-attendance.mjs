// Disposable SQL integration tests. Never connects to the event database.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const sql = path => readFileSync(`supabase/migrations/${path}`, "utf8");
const reg = "33333333-3333-4333-8333-333333333333";
const account = "22222222-2222-4222-8222-222222222222";
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table registrations (id uuid primary key, name text, badge_name text, choir_name text,
      payment_status text, cancelled_at timestamptz);
    create table participant_accounts (id uuid primary key, registration_id uuid, access_status text, user_id uuid);`);
  await db.exec(sql("20260912200441_create_event_activity_attendance.sql"));
  await db.exec(sql("20260914052311_allow_attendance_outside_activity_hours.sql"));
  const migration = readdirSync("supabase/migrations").find(x => x.endsWith("_public_attendance_cards.sql"));
  await db.exec(sql(migration));
  await db.exec(`insert into registrations values ('${reg}', 'Ana', 'Ana', 'Coro', 'paid', null);
    insert into registrations values ('44444444-4444-4444-8444-444444444444', 'Bia', null, 'Coro', 'pending', null);
    insert into registrations values ('55555555-5555-4555-8555-555555555555', 'Caio', null, 'Coro', 'paid', now());
    update event_activities set requires_qr = true, starts_at = '09:00', ends_at = '10:00'
      where id in (select id from event_activities order by sort_order limit 2);`);
  const { rows: activities } = await db.query("select * from public_attendance_overview()");
  assert.equal(activities.length, 2);
  assert.equal(activities[0].total_confirmed, 1);
  const { rows: [card] } = await db.query(`select token from registration_attendance_cards where registration_id='${reg}'`);
  assert.match(card.token, /^[a-f0-9]{64}$/);
  const call = (token, id = activities[0].id) => db.query("select * from record_public_attendance($1,$2)", [id, token]);
  const first = (await call(card.token)).rows[0];
  assert.equal(first.status, "recorded");
  assert.equal(first.attended, 1);
  assert.equal((await call(card.token)).rows[0].status, "already_recorded");
  // An existing account can subsequently use the old QR without creating a second record.
  await db.exec(`insert into participant_accounts values ('${account}', '${reg}', 'active', '${account}')`);
  const old = id => db.query("select * from record_event_activity_attendance($1,1,$2,$3)", [id, account, reg]);
  assert.equal((await old(activities[0].id)).rows[0].status, "already_recorded");
  assert.equal((await old(activities[1].id)).rows[0].status, "recorded");
  assert.equal((await call(card.token, activities[1].id)).rows[0].status, "already_recorded");
  const pending = (await db.query("select token from registration_attendance_cards where registration_id='44444444-4444-4444-8444-444444444444'")).rows[0];
  assert.equal((await call(pending.token)).rows[0].status, "ineligible");
  assert.equal((await call('a'.repeat(64))).rows[0].status, "invalid_card");
  await db.exec(`update registrations set cancelled_at = now() where id='${reg}'`);
  assert.equal((await call(card.token)).rows[0].status, "ineligible");
  assert.equal((await db.query("select * from public_attendance_overview()")).rows[0].attended, 0);
  assert.equal((await db.query("select count(*)::int n from event_activity_attendances")).rows[0].n, 2);
  const { rows: privileges } = await db.query(`select proname, has_function_privilege('anon',oid,'execute') a,
    has_function_privilege('authenticated',oid,'execute') b, has_function_privilege('service_role',oid,'execute') c
    from pg_proc where proname in ('record_public_attendance','public_attendance_overview','prepare_attendance_cards')`);
  assert.equal(privileges.length, 3);
  for (const p of privileges) assert.deepEqual([p.a,p.b,p.c], [false,false,true]);
  console.log("PASS: cards, no Auth account, paid/cancelled eligibility, shared idempotency, aggregate progress and service-role-only RPCs.");
} finally { await db.close(); }
