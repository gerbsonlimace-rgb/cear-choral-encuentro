// Loopback-only sender for personalized participant cards through Brevo.
import { createServer } from "node:http";
import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "output/participant-cards");
const manifestPath = path.join(output, "source/manifest.json");
const cardDirectory = path.join(output, "cartoes");
const progressPath = path.join(output, "brevo-email-progress.json");
const allowedOrigins = new Set(["https://encontrocorosce.lovable.app", ...(process.env.BREVO_ADMIN_ORIGINS || "").split(",").filter(Boolean)]);
const configured = Boolean(
  process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() &&
  process.env.BREVO_API_KEY?.trim() && process.env.BREVO_SENDER_EMAIL?.trim() && process.env.BREVO_TEST_EMAIL?.trim(),
);
const sender = {
  email: process.env.BREVO_SENDER_EMAIL?.trim() || "",
  name: process.env.BREVO_SENDER_NAME?.trim() || "Encontro de Coros",
};
const testEmail = process.env.BREVO_TEST_EMAIL?.trim().toLowerCase() || "";
const loadDomain = async (relativePath) => {
  const source = readFileSync(path.join(root, relativePath), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
};
const [{ resolveParticipantCardLodging, buildParticipantCardMessage }, eventContact] = await Promise.all([
  loadDomain("src/features/public-attendance/participantCardDetails.domain.ts"),
  loadDomain("src/features/contact/event-contact.ts"),
]);
const contact = { name: eventContact.CONTACT_PERSON_NAME, phoneDisplay: eventContact.CONTACT_PHONE_DISPLAY };
const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;
let running = false;
let pauseRequested = false;
let job = { phase: "idle", total: 0, completed: 0, sent: 0, review: 0, failed: 0, skipped: 0 };

function originAllowed(origin) {
  if (allowedOrigins.has(origin)) return true;
  try { const url = new URL(origin); return url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname); }
  catch { return false; }
}
async function authorize(request) {
  const token = request.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token || !supabase) return false;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return false;
  const membership = await supabase.from("admin_users").select("id").eq("user_id", data.user.id).is("revoked_at", null).maybeSingle();
  return !membership.error && Boolean(membership.data);
}
async function readBody(request) {
  let body = "";
  for await (const chunk of request) { body += chunk; if (body.length > 4096) throw new Error("Pedido muito grande."); }
  return JSON.parse(body || "{}");
}
function readProgress() {
  if (!existsSync(progressPath)) return {};
  const value = JSON.parse(readFileSync(progressPath, "utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Arquivo de progresso de e-mail inválido.");
  return value;
}
function writeProgress(value) {
  const temporary = `${progressPath}.tmp`;
  writeFileSync(temporary, JSON.stringify(value, null, 2), { mode: 0o600 });
  renameSync(temporary, progressPath);
}
async function loadRoster() {
  if (!supabase) throw new Error("Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente local.");
  const [snapshot, plan, lodging] = await Promise.all([
    supabase.rpc("admin_registration_snapshot", { p_search: "" }),
    supabase.from("registration_attendance_cards").select("registration_id,token"),
    supabase.from("lodging_plan").select("assignments,named_rooms,no_lodging_registration_ids,extra_people").maybeSingle(),
  ]);
  if (snapshot.error || !Array.isArray(snapshot.data?.registrations)) throw new Error("Não foi possível conferir as inscrições confirmadas.");
  if (plan.error) throw new Error("Não foi possível carregar os cartões individuais.");
  if (lodging.error) throw new Error("Não foi possível conferir a acomodação para a mensagem.");
  if (!existsSync(manifestPath)) throw new Error("Gere os PNGs dos cartões antes de enviar.");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(manifest.cards)) throw new Error("Manifesto de cartões inválido.");
  const cards = new Map(manifest.cards.map((card) => [card.id, card]));
  const tokens = new Map((plan.data || []).map((card) => [card.registration_id, card.token]));
  const roster = snapshot.data.registrations;
  return roster
    .filter((row) => row.payment_status === "paid" && !row.cancelled_at)
    .map((row) => ({ row, card: cards.get(row.id), token: tokens.get(row.id), lodging: resolveParticipantCardLodging(row.id, lodging.data, roster) }))
    .sort((a, b) => a.row.name.localeCompare(b.row.name, "pt-BR"));
}
function validRecipient(value) {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
function emailHtml(message) {
  const text = escapeHtml(message);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Seu cartão do participante</title></head><body style="margin:0;background:#f4f1ed;font-family:Arial,Helvetica,sans-serif;color:#30242a"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f1ed;padding:24px 12px"><tr><td align="center"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#fff;border-radius:16px;overflow:hidden"><tr><td style="padding:0;background:#642d43"><img src="https://encontrocorosce.lovable.app/og-coros-diocesanos-v7.jpg" alt="II Encontro de Coros Diocesanos e Litúrgicos" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0"></td></tr><tr><td style="padding:28px 32px 32px"><div style="font-size:15px;line-height:1.8;white-space:pre-line;color:#30242a">${text}</div></td></tr></table></td></tr></table></body></html>`;
}
function resolveCardFile(card) {
  if (!card || typeof card.filename !== "string" || path.basename(card.filename) !== card.filename || !card.filename.endsWith(".png")) return null;
  const file = path.join(cardDirectory, card.filename);
  if (!existsSync(file) || statSync(file).size === 0 || statSync(file).size > 12 * 1024 * 1024) return null;
  if (readFileSync(file).subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return null;
  return file;
}
function counts(progress) {
  let sent = 0, review = 0, failed = 0;
  for (const item of Object.values(progress)) {
    const state = item.send || {};
    if (state.status === "sent") sent++;
    else if (state.status === "review") review++;
    else if (state.status === "failed") failed++;
  }
  return { sent, review, failed };
}
async function sendOne({ row, card, token, lodging }, progress, mode) {
  const recipientEmail = mode === "test" ? testEmail : row.email.trim().toLowerCase();
  if (mode !== "test" && !validRecipient(recipientEmail)) return "missing_email";
  if (!/^[a-f0-9]{64}$/.test(token || "")) throw new Error(`Cartão individual não encontrado para ${row.name}.`);
  const file = resolveCardFile(card);
  if (!file) throw new Error(`Imagem PNG inválida ou ausente para ${row.name}. Gere novamente os cartões.`);
  if (!configured) throw new Error("Configure BREVO_API_KEY, BREVO_SENDER_EMAIL e BREVO_TEST_EMAIL em .env.local.");

  const record = progress[row.id] ||= {};
  const field = mode === "test" ? "test" : "send";
  record[field] = { status: "sending", startedAt: new Date().toISOString() };
  writeProgress(progress);
  const title = (row.badge_name?.trim() || row.name).replace(/[<>]/g, "").slice(0, 120);
  let response;
  try {
    response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": process.env.BREVO_API_KEY.trim(), "content-type": "application/json", accept: "application/json" },
      signal: AbortSignal.timeout(45000),
      body: JSON.stringify({
        sender,
        to: [{ email: recipientEmail, name: row.name }],
        subject: "Seu cartão do participante | II Encontro de Coros",
        htmlContent: emailHtml(buildParticipantCardMessage(title, lodging, contact)),
        attachment: [{ name: card.filename, content: readFileSync(file).toString("base64") }],
      }),
    });
  } catch (error) {
    record[field] = { status: "review", startedAt: record[field].startedAt, error: "Conexão interrompida após iniciar a chamada; confira o histórico do Brevo antes de repetir." };
    writeProgress(progress);
    throw new Error(`Não foi possível confirmar o envio de ${row.name}; confira o histórico do Brevo antes de repetir.`, { cause: error });
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status >= 500 || response.status === 429) {
      record[field] = { status: "review", startedAt: record[field].startedAt, error: `Brevo respondeu ${response.status}; confira os logs antes de repetir.` };
      writeProgress(progress);
      throw new Error(`O Brevo respondeu ${response.status}; envio de ${row.name} ficou para conferência.`);
    }
    record[field] = { status: "failed", failedAt: new Date().toISOString(), error: `Brevo rejeitou o envio (HTTP ${response.status}).` };
    writeProgress(progress);
    return "failed";
  }
  record[field] = { status: "sent", sentAt: new Date().toISOString(), messageId: typeof result.messageId === "string" ? result.messageId : null };
  writeProgress(progress);
  return "sent";
}
async function run(mode) {
  pauseRequested = false;
  const progress = readProgress();
  const roster = await loadRoster();
  const withCards = roster.filter(({ card }) => resolveCardFile(card));
  const eligible = withCards.filter(({ row }) => validRecipient(row.email));
  let selected;
  if (mode === "test") {
    selected = withCards.filter(({ row }) => /gerbson/i.test(row.name));
    if (selected.length !== 1) throw new Error("O e-mail de teste precisa corresponder a uma única inscrição confirmada com cartão gerado.");
  } else if (mode === "review") {
    selected = eligible.filter(({ row }) => progress[row.id]?.send?.status === "review");
  } else {
    selected = eligible.filter(({ row }) => !["sent", "review"].includes(progress[row.id]?.send?.status));
  }
  const omitted = roster.length - eligible.length;
  const priorSent = roster.filter(({ row }) => progress[row.id]?.send?.status === "sent").length;
  job = { phase: "sending", total: selected.length, completed: 0, sent: 0, review: 0, failed: 0, skipped: priorSent, missingEmail: omitted };
  if (mode === "all") console.log(JSON.stringify({ phase: "prepared", total: selected.length, alreadySent: priorSent, missingEmailOrCard: omitted }));
  for (const recipient of selected) {
    if (pauseRequested) { job = { ...job, phase: "paused" }; return; }
    try {
      const outcome = await sendOne(recipient, progress, mode);
      job = { ...job, completed: job.completed + 1, sent: job.sent + Number(outcome === "sent"), failed: job.failed + Number(outcome === "failed") };
    } catch (error) {
      const record = progress[recipient.row.id];
      const state = mode === "test" ? record?.test?.status : record?.send?.status;
      job = { ...job, review: job.review + Number(state === "review"), failed: job.failed + Number(state === "failed"), phase: "error", error: error instanceof Error ? error.message : "Falha no envio." };
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
  job = { ...job, phase: pauseRequested ? "paused" : "complete" };
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
    if (!await authorize(request)) { reply(401, { error: "Entre na administração para controlar os e-mails." }); return; }
    if (request.method === "GET" && request.url === "/status") {
      const progress = readProgress();
      const state = counts(progress);
      const testSent = Object.values(progress).some((item) => item.test?.status === "sent");
      reply(200, { ...job, ...state, busy: running, configured, testEmailConfigured: Boolean(testEmail), testEmail, testSent }); return;
    }
    if (request.method === "POST" && request.url === "/pause") {
      pauseRequested = true;
      reply(200, { ok: true }); return;
    }
    if (request.method !== "POST" || request.url !== "/jobs") { reply(404, { error: "Ação não encontrada." }); return; }
    if (running) { reply(409, { error: "Já há um envio de e-mail em andamento." }); return; }
    if (!configured) { reply(400, { error: "Configure BREVO_API_KEY, BREVO_SENDER_EMAIL e BREVO_TEST_EMAIL em .env.local." }); return; }
    const input = await readBody(request);
    if (!input || !["test", "all", "review"].includes(input.mode) || Object.keys(input).some((key) => key !== "mode")) { reply(400, { error: "Ação de envio inválida." }); return; }
    if (input.mode === "all" && !Object.values(readProgress()).some((item) => item.test?.status === "sent")) {
      reply(400, { error: "Envie e confira primeiro o teste para Gerbson antes de iniciar o lote." }); return;
    }
    running = true;
    job = { phase: "preparing", total: 0, completed: 0, sent: 0, review: 0, failed: 0, skipped: 0 };
    reply(202, { ...job, busy: true });
    void run(input.mode).catch((error) => { job = { ...job, phase: "error", error: error instanceof Error ? error.message : "Falha no serviço Brevo." }; })
      .finally(() => { running = false; });
  } catch (error) {
    reply(500, { error: error instanceof Error ? error.message : "Falha no serviço Brevo." });
  }
});
const cliMode = process.argv.slice(2);
if (cliMode.includes("--send-test") || cliMode.includes("--send-all")) {
  if (cliMode.length !== 1) throw new Error("Escolha apenas --send-test ou --send-all.");
  const mode = cliMode[0] === "--send-test" ? "test" : "all";
  if (mode === "all" && !Object.values(readProgress()).some((item) => item.test?.status === "sent")) {
    throw new Error("Envie e confira primeiro o teste para Gerbson antes de iniciar o lote.");
  }
  void run(mode).then(() => {
    const result = { phase: job.phase, sent: job.sent, review: job.review, failed: job.failed, error: job.error };
    console.log(JSON.stringify(result));
    process.exitCode = job.phase === "complete" && (mode === "all" || job.sent === 1) ? 0 : 1;
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : "Falha no envio de teste.");
    process.exitCode = 1;
  });
} else {
  server.listen(4320, "127.0.0.1", () => console.log("Serviço local de cartões por e-mail ativo em http://127.0.0.1:4320."));
}
server.on("error", (error) => { console.error(error.code === "EADDRINUSE" ? "O serviço já está ativo na porta 4320." : "Não foi possível iniciar o serviço local do Brevo."); process.exitCode = 1; });
