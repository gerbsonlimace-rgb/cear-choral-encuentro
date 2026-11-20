// Loopback-only bridge between the authorized admin page and the local Chrome worker.
import { createServer } from "node:http";
import { fork } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { parseJobSelection, selectJobRegistrationIds } from "./whatsapp-job-selection.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "output/participant-cards");
const progressPath = path.join(output, "whatsapp-manual-progress.json");
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const allowedOrigins = new Set(["https://encontrocorosce.lovable.app", ...(process.env.WHATSAPP_ADMIN_ORIGINS || "").split(",").filter(Boolean)]);
let worker = null;
let reserving = false;
let job = { phase: "idle", total: 0, completed: 0 };

function originAllowed(origin) {
  if (allowedOrigins.has(origin)) return true;
  try { const url = new URL(origin); return url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname); }
  catch { return false; }
}
function progress() {
  const records = existsSync(progressPath) ? JSON.parse(readFileSync(progressPath, "utf8")) : {};
  return Object.fromEntries(Object.entries(records).map(([id, record]) => [id,
    record.deliveryConfirmed === true || record.readConfirmed === true ? "received" :
      record.submittedAt || record.manuallySentAt ? "sent" : record.attemptStartedAt ? "review" : record.failedAt ? "failed" : "pending"]));
}
async function authorize(request) {
  const token = request.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return false;
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return false;
  const membership = await client.from("admin_users").select("id").eq("user_id", data.user.id).is("revoked_at", null).maybeSingle();
  return !membership.error && Boolean(membership.data);
}
async function readBody(request) {
  let body = "";
  for await (const chunk of request) { body += chunk; if (body.length > 65536) throw new Error("Pedido muito grande."); }
  return JSON.parse(body || "{}");
}
const server = createServer(async (request, response) => {
  const origin = request.headers.origin;
  if (!originAllowed(origin)) { response.writeHead(403); response.end(); return; }
  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  response.setHeader("Access-Control-Allow-Private-Network", "true");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  const reply = (status, body) => { response.writeHead(status); response.end(JSON.stringify(body)); };
  if (request.method === "OPTIONS") { response.writeHead(204); response.end(); return; }
  try {
    if (!await authorize(request)) { reply(401, { error: "Entre na administração para controlar os envios." }); return; }
    if (request.method === "GET" && request.url === "/status") {
      reply(200, { ...job, busy: Boolean(worker) || reserving, registrations: progress() }); return;
    }
    if (request.method === "POST" && request.url === "/pause") {
      if (worker?.connected) worker.send({ type: "pause" });
      if (worker) job = { ...job, pauseRequested: true };
      reply(200, { ok: true }); return;
    }
    if (request.method !== "POST" || request.url !== "/jobs") { reply(404, { error: "Ação não encontrada." }); return; }
    if (worker || reserving) { reply(409, { error: "Já há um envio em andamento." }); return; }
    // Reserve before any asynchronous work: concurrent clicks cannot create two Chrome workers.
    reserving = true;
    try {
      const input = await readBody(request);
      let selection;
      try { selection = parseJobSelection(input); }
      catch (error) { reply(400, { error: error.message }); return; }
      const snapshot = await client.rpc("admin_registration_snapshot", { p_search: "" });
      if (snapshot.error || !Array.isArray(snapshot.data?.registrations)) throw new Error("Não foi possível conferir as inscrições.");
      const states = progress();
      const ids = selectJobRegistrationIds(snapshot.data.registrations, states, selection);
      if (!ids.length) { reply(400, { error: "Não há cartões pendentes elegíveis. Envios já feitos e tentativas em revisão não são repetidos." }); return; }
      mkdirSync(path.join(output, "jobs"), { recursive: true });
      const idsPath = path.join(output, "jobs", `${randomUUID()}.json`);
      writeFileSync(idsPath, JSON.stringify(ids), { mode: 0o600 });
      job = { phase: "connecting", total: ids.length, completed: 0, pauseRequested: false };
      try {
        worker = fork(path.join(root, "scripts/prepare-whatsapp-card.mjs"), [
          `--batch=${ids.length}`, `--ids-file=${idsPath}`, "--managed", "--start", "--send", ...(selection.resend ? ["--resend"] : []),
        ], { cwd: root, env: process.env, stdio: ["ignore", "ignore", "ignore", "ipc"], windowsHide: true });
      } catch (error) { unlinkSync(idsPath); throw error; }
      const currentWorker = worker;
      currentWorker.on("message", (event) => { job = { ...job, ...event }; });
      currentWorker.on("error", () => { job = { ...job, phase: "error", error: "Não foi possível iniciar o Chrome. Feche a janela anterior do script e tente novamente." }; });
      currentWorker.on("exit", (code) => {
        if (!["complete", "paused", "error"].includes(job.phase)) job = { ...job, phase: "error", error: "O script parou. Confira o Chrome e as tentativas em revisão antes de continuar." };
        if (code && job.phase !== "error") job = { ...job, phase: "error" };
        if (worker === currentWorker) worker = null;
        if (existsSync(idsPath)) unlinkSync(idsPath);
      });
      reply(202, { ...job, busy: true });
    } finally { reserving = false; }
  } catch (error) {
    reply(500, { error: error instanceof Error ? error.message : "Falha no serviço local." });
  }
});
server.listen(4319, "127.0.0.1", () => console.log("Serviço WhatsApp ativo em http://127.0.0.1:4319. Use os botões na administração de inscrições."));
server.on("error", (error) => { console.error(error.code === "EADDRINUSE" ? "O serviço já está ativo na porta 4319." : "Não foi possível iniciar o serviço local."); process.exitCode = 1; });
