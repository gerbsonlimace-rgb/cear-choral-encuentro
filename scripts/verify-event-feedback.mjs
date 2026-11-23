// Run only against a disposable in-memory Postgres, never the event database.
// node scripts/verify-event-feedback.mjs <absolute-path-to-pglite-entry>
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
try {
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  await db.exec(readFileSync("supabase/migrations/20261123215216_event_feedback.sql", "utf8"));
  const { rows: [privileges] } = await db.query(`select
    has_table_privilege('anon','event_feedback','select') as public_read,
    has_table_privilege('anon','event_feedback','insert') as public_write,
    has_table_privilege('authenticated','event_feedback','select') as authenticated_read,
    has_table_privilege('service_role','event_feedback','insert,update,select') as server_access,
    (select relrowsecurity from pg_class where oid='public.event_feedback'::regclass) as rls`);
  assert.deepEqual(privileges, { public_read: false, public_write: false, authenticated_read: false, server_access: true, rls: true });
  await db.exec("set role service_role");
  const id = "22222222-2222-4222-8222-222222222222";
  const save = (overall, suggestion = "") => db.query(`insert into event_feedback
    (submission_id,overall,organization,formation,celebrations,venue,suggestion) values ($1,$2,4,4,4,4,$3)
    on conflict (submission_id) do update set overall=excluded.overall,suggestion=excluded.suggestion`, [id, overall, suggestion]);
  await save(4);
  await save(5, "Sugestão atualizada");
  const { rows: [row] } = await db.query("select overall,suggestion,lodging,(select count(*)::int from event_feedback) as count from event_feedback");
  assert.deepEqual(row, { overall: 5, suggestion: "Sugestão atualizada", lodging: null, count: 1 });
  await assert.rejects(save(0), /check constraint/);
  await assert.rejects(save(6), /check constraint/);
  await assert.rejects(save(4, "a".repeat(1001)), /check constraint/);
  await assert.rejects(db.query("update event_feedback set formation = null"), /not-null constraint/);
  await db.exec("reset role; set role anon");
  await assert.rejects(db.query("select * from event_feedback"), /permission denied/);
  await db.exec("reset role; set role authenticated");
  await assert.rejects(db.query("select * from event_feedback"), /permission denied/);
  await db.exec("reset role");
  const { readdirSync } = await import("node:fs");
  const controlMigration = readdirSync("supabase/migrations").find(name => name.endsWith("_anonymous_feedback_response_control.sql"));
  await db.exec(readFileSync(`supabase/migrations/${controlMigration}`, "utf8"));
  await db.exec("set role service_role");
  const feedback = { submission_id: "33333333-3333-4333-8333-333333333333", overall: 4, organization: 4, formation: 4, celebrations: 4, venue: 4, food: null, lodging: null, suggestion: "" };
  const controlledSave = (identity, value) => db.query("select public.save_anonymous_event_feedback($1,$2::jsonb)", [identity, JSON.stringify(value)]);
  await controlledSave("email:teste@example.com", feedback);
  await controlledSave("email:teste@example.com", { ...feedback, overall: 5 });
  assert.equal((await db.query("select overall from event_feedback where submission_id=$1", [feedback.submission_id])).rows[0].overall, 5);
  await assert.rejects(controlledSave("email:teste@example.com", { ...feedback, submission_id: "44444444-4444-4444-8444-444444444444" }), /feedback_already_sent/);
  await assert.rejects(controlledSave("email:novo@example.com", { ...feedback, submission_id: "55555555-5555-4555-8555-555555555555", overall: 6 }), /check constraint/);
  // Invalid answers must roll back the control record too.
  await controlledSave("email:novo@example.com", { ...feedback, submission_id: "55555555-5555-4555-8555-555555555555" });
  await assert.rejects(db.query("select * from private.event_feedback_identity_keys"), /permission denied/);
  await db.exec("reset role");
  const keys = (await db.query("select * from private.event_feedback_identity_keys")).rows;
  assert.equal(keys.length, 2);
  assert.deepEqual(Object.keys(keys[0]), ["identity_key"]);
  assert.match(keys[0].identity_key, /^[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify(keys).includes("example.com"));
  await db.exec("set role anon");
  await assert.rejects(controlledSave("email:public@example.com", feedback), /permission denied/);
  console.log("PASS: private separated identity control, atomic duplicate rejection, retry update, rollback on invalid answers; migration, RLS, migration, RLS, private responses, server-only writes, rating bounds, comment limit, unused NULL ratings and atomic retry updates.");
} finally { await db.close(); }
