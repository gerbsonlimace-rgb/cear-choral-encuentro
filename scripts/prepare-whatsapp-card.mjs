// Prepare or send participant PNGs sequentially through a dedicated Chrome profile.
import { createClient } from "@supabase/supabase-js";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, realpathSync, statSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.resolve(root, option("output") || "output/participant-cards");
const runtime = path.join(output, "playwright-runtime");
const profile = path.join(output, "chrome-whatsapp-profile");
const progressPath = path.join(output, "whatsapp-manual-progress.json");
const batch = Number(option("batch") || 1);
const participant = option("participant");
const registrationId = option("registration");
const autoSend = process.argv.includes("--send");
const startNow = process.argv.includes("--start");
const managed = process.argv.includes("--managed");
// Only explicitly confirmed resend requests pass --resend with specific IDs.
const resend = process.argv.includes("--resend");
let pauseRequested = false;
process.on("message", (message) => { if (message?.type === "pause") pauseRequested = true; });
const report = (event) => { if (process.send) process.send(event); };
const sender = phone(option("sender") || "5588981263997");

if (process.argv.includes("--help")) {
  console.log([
    "Prepara ou envia PNGs, uma conversa por vez, no Chrome.",
    '  node --env-file=.env --env-file=.env.local scripts/prepare-whatsapp-card.mjs --participant="Antonio Gerbson"',
    "  node --env-file=.env --env-file=.env.local scripts/prepare-whatsapp-card.mjs --batch=10 --send",
    "Sem --send, você confere e envia manualmente. --send clica em Enviar a cada cartão.",
    "--registration=<uuid>, --participant=<nome>, --batch=1..10, --output=<pasta>",
    "--sender=<telefone> confirma a conta conectada (padrão: conta do evento, final 3997).",
    "--start abre o Chrome sem esperar Enter. O WhatsApp não permite abas simultâneas.",
    "Envios registrados e tentativas inconclusivas são pulados em lotes futuros; não há repetição automática.",
  ].join("\n"));
  process.exit(0);
}
if (process.argv.includes("--tabs")) throw new Error("Use --batch=10. O WhatsApp desativa abas simultâneas.");
if (!Number.isInteger(batch) || batch < 1 || batch > (managed ? 1000 : 10)) throw new Error("Tamanho de lote inválido.");
if (!participant && !registrationId && !option("batch")) throw new Error("Informe --participant, --registration ou --batch.");
const requestedIds = option("ids-file") ? JSON.parse(readFileSync(option("ids-file"), "utf8")) : null;
if (requestedIds && (!Array.isArray(requestedIds) || requestedIds.some((id) => typeof id !== "string" || !/^[a-f0-9-]{36}$/i.test(id)))) throw new Error("Lista de inscrições inválida.");
if (resend && (!requestedIds || requestedIds.length < 1 || requestedIds.length > 1000)) throw new Error("O reenvio exige uma lista explícita de inscrições.");
const localRequire = createRequire(path.join(runtime, "package.json"));
let chromium;
try { ({ chromium } = localRequire("playwright-core")); }
catch { throw new Error("Instale: npm install --prefix output/participant-cards/playwright-runtime --no-package-lock playwright-core@1.65.1"); }
const manifest = JSON.parse(readFileSync(path.join(output, "source/manifest.json"), "utf8"));
if (!Array.isArray(manifest.cards)) throw new Error("Manifesto de cartões inválido.");
const cards = new Map(manifest.cards.map((card) => [card.id, card]));
if (cards.size !== manifest.cards.length) throw new Error("Cartões duplicados no manifesto.");
const supabase = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const loadDomain = async (relativePath) => {
  const source = readFileSync(path.join(root, relativePath), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
};
const { resolveParticipantCardLodging, buildParticipantCardMessage } = await loadDomain("src/features/public-attendance/participantCardDetails.domain.ts");
const { CONTACT_PERSON_NAME, CONTACT_PHONE_DISPLAY } = await loadDomain("src/features/contact/event-contact.ts");
const contact = { name: CONTACT_PERSON_NAME, phoneDisplay: CONTACT_PHONE_DISPLAY };
const progress = existsSync(progressPath) ? JSON.parse(readFileSync(progressPath, "utf8")) : {};
if (!progress || typeof progress !== "object" || Array.isArray(progress)) throw new Error("Arquivo de progresso inválido.");
const state = await currentState();
let selected = eligible(state.roster).filter((row) => {
  if (requestedIds && resend) return requestedIds.includes(row.id);
  if (requestedIds) return requestedIds.includes(row.id) && !progress[row.id]?.manuallySentAt && !progress[row.id]?.submittedAt && !progress[row.id]?.attemptStartedAt;
  if (registrationId) return row.id === registrationId;
  if (participant) return normalize(`${row.name} ${row.badge_name || ""}`).includes(normalize(participant));
  return !progress[row.id]?.manuallySentAt && !progress[row.id]?.submittedAt && !progress[row.id]?.attemptStartedAt;
}).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
if ((participant || registrationId) && selected.length !== 1) {
  console.log(selected.map((row) => ({ id: row.id, name: row.name })));
  throw new Error("Identifique uma única pessoa com --registration=<uuid>.");
}
selected = selected.slice(0, batch).map((row) => prepareRecipient(row, state));
if (!selected.length) { report({ phase: "complete", total: 0, completed: 0 }); console.log("Nenhum cartão pendente para preparar."); process.exit(0); }
const terminal = createInterface({ input: process.stdin, output: process.stdout });
let context;
let page;
let submitted = 0;
try {
  console.log(`${selected.length} cartões. Modo: ${autoSend ? "ENVIO AUTOMÁTICO" : "envio manual"}. Remetente: +${sender}`);
  report({ phase: "connecting", total: selected.length, completed: 0 });
  if (!startNow) await terminal.question("Enter para abrir o Chrome; Ctrl+C para sair. ");
  mkdirSync(profile, { recursive: true });
  context = await chromium.launchPersistentContext(profile, { channel: "chrome", headless: false, viewport: null });
  context.setDefaultTimeout(30000);
  const opened = context.pages();
  page = opened.at(-1) || await context.newPage();
  // This profile belongs to the script. Keep one WhatsApp tab to avoid session takeovers.
  for (const other of opened) if (other !== page && /^(https:\/\/web\.whatsapp\.com\/|about:blank)/.test(other.url())) await other.close();
  await page.goto("https://web.whatsapp.com", { waitUntil: "domcontentloaded" });
  console.log("Se aparecer um QR de vinculação, escaneie com a conta do evento.");
  await page.locator("#pane-side").waitFor({ state: "visible", timeout: 300000 });
  await verifySender(page);
  for (const recipient of selected) {
    if (pauseRequested) break;
    report({ phase: "preparing", registrationId: recipient.id, total: selected.length, completed: submitted });
    const fresh = await currentState();
    const row = eligible(fresh.roster).find((item) => item.id === recipient.id);
    if (!row || phone(row.phone) !== recipient.phone || row.name !== recipient.fullName) throw new Error("Inscrição ou telefone mudou. Reinicie para conferir os dados.");
    const current = prepareRecipient(row, fresh);
    console.log(`Preparando ${current.fullName} (+${current.phone}).`);
    if (!autoSend) await terminal.question("Enter para abrir a conversa e anexar o PNG. ");
    const url = new URL("https://web.whatsapp.com/send");
    url.searchParams.set("phone", current.phone);
    await page.goto(url.toString(), { waitUntil: "domcontentloaded" });
    await page.locator('#main footer [contenteditable="true"]').first().waitFor({ state: "visible", timeout: 60000 });
    await page.getByRole("dialog").filter({ hasText: /Iniciando conversa|Starting chat/i }).waitFor({ state: "hidden", timeout: 60000 });
    // Pick the photo menu explicitly: a generic image input can create a sticker.
    await page.locator("#main footer").getByRole("button", { name: /^(Anexar|Attach)$/i }).click();
    const chooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("menuitem", { name: /^(Fotos e vídeos|Photos & videos)$/i }).click();
    await (await chooserPromise).setFiles(current.imagePath);
    const caption = page.getByTestId("media-caption-input-container");
    await caption.waitFor({ state: "visible", timeout: 30000 });
    await caption.fill(current.message);
    const send = page.getByRole("button", { name: /^(Enviar 1 item selecionado|Send 1 selected item)$/i });
    await send.waitFor({ state: "visible" });
    if (autoSend) {
      if (pauseRequested) break;
      // A previous conversation can already contain the same caption. Record the
      // ids before the click and require a genuinely new outgoing photo message,
      // otherwise an old message would be mistaken for this delivery.
      const beforeIds = await page.locator("#main [data-id]").evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-id")).filter(Boolean),
      );
      // Save before the click so a crash or timeout cannot cause an automatic duplicate.
      const previous = progress[current.id];
      const history = previous ? [...(previous.history || []), { ...previous, history: undefined }] : undefined;
      progress[current.id] = { attemptStartedAt: new Date().toISOString(), sender, filename: current.filename, ...(resend ? { resend: true } : {}), ...(history ? { history } : {}) };
      saveProgress();
      report({ phase: "sending", registrationId: current.id, total: selected.length, completed: submitted });
      await send.click();
      await page.waitForFunction(
        ({ previousIds, caption }) => {
          const previous = new Set(previousIds);
          return Array.from(document.querySelectorAll("#main [data-id]")).some((node) => {
            if (previous.has(node.getAttribute("data-id"))) return false;
            if (!(node.innerText || "").includes(caption)) return false;
            return Boolean(node.querySelector('[aria-label="Abrir imagem"]'));
          });
        },
        { previousIds: beforeIds, caption: "Desde já, aguardamos sua participação!" },
        { timeout: 60000 },
      );
      // WhatsApp keeps the message with a pending clock icon while the upload
      // finishes. Give it time to settle before moving on or closing Chrome,
      // otherwise navigating away can cancel the delivery.
      await page.waitForTimeout(10000);
      progress[current.id].submittedAt = new Date().toISOString();
      progress[current.id].deliveryConfirmed = false;
      submitted += 1;
    } else {
      console.log("Confira a foto e a legenda. Clique em Enviar no Chrome.");
      const answer = await terminal.question("Depois digite ENVIADO; outra resposta pausa. ");
      if (answer.trim().toUpperCase() !== "ENVIADO") break;
      progress[current.id] = { manuallySentAt: new Date().toISOString(), sender };
    }
    saveProgress();
    report({ phase: "sent", registrationId: current.id, total: selected.length, completed: submitted });
    console.log("Envio registrado. A confirmação de entrega deve ser conferida no WhatsApp.");
  }
  console.log(`Finalizado. Cliques automáticos de envio: ${submitted}. Feche a janela do script quando terminar.`);
  report({ phase: pauseRequested ? "paused" : "complete", total: selected.length, completed: submitted });
} catch (error) {
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, "whatsapp-error.png") }).catch(() => {});
  console.error(error instanceof Error ? error.message : "Falha ao preparar o cartão.");
  console.error("Nenhuma tentativa inconclusiva será repetida automaticamente. Confira a conversa antes de repetir uma pessoa.");
  process.exitCode = 1;
  report({ phase: "error", error: "O envio parou. Confira o Chrome e a conversa antes de continuar.", total: selected.length, completed: submitted });
} finally {
  terminal.close();
  if (context && managed) await context.close();
  else if (context && context.pages().some((p) => !p.isClosed())) await new Promise((resolve) => context.on("close", resolve));
  if (process.connected) process.disconnect();
}

async function verifySender(target) {
  await target.getByRole("button", { name: "Você", exact: true }).click();
  await target.getByRole("button", { name: "Ver perfil", exact: true }).click();
  await target.getByRole("heading", { name: "Editar perfil", exact: true }).waitFor({ state: "visible" });
  const expected = phoneVariants(sender);
  await target.waitForFunction((numbers) => {
    const text = document.body.innerText;
    return (text.match(/\+55[\s\d()-]{10,22}/g) || []).some((match) => numbers.includes(match.replace(/\D/g, "")));
  }, expected, { timeout: 10000 });
  console.log("Remetente conferido no perfil do WhatsApp.");
}
function saveProgress() {
  const tmp = `${progressPath}.tmp`;
  writeFileSync(tmp, JSON.stringify(progress, null, 2), { mode: 0o600 });
  renameSync(tmp, progressPath);
}
function option(name) { return process.argv.slice(2).find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3); }
function requiredEnv(name) { const value = process.env[name]?.trim(); if (!value) throw new Error(`Variável ausente: ${name}`); return value; }
function normalize(value) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
function phone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (/^55\d{10,11}$/.test(digits)) return digits;
  if (/^\d{10,11}$/.test(digits)) return `55${digits}`;
  throw new Error("Telefone inválido. Corrija antes de preparar o cartão.");
}
function phoneVariants(value) { return value.length === 13 && value[4] === "9" ? [value, value.slice(0, 4) + value.slice(5)] : [value]; }
function eligible(rows) { return rows.filter((row) => row.payment_status === "paid" && !row.cancelled_at); }
async function currentState() {
  const [snapshot, plan] = await Promise.all([
    supabase.rpc("admin_registration_snapshot", { p_search: "" }),
    supabase.from("lodging_plan").select("assignments,named_rooms,no_lodging_registration_ids,extra_people").maybeSingle(),
  ]);
  if (snapshot.error || plan.error || !Array.isArray(snapshot.data?.registrations)) throw new Error("Não foi possível conferir inscrições e hospedagem atuais.");
  return { roster: snapshot.data.registrations, plan: plan.data };
}
function prepareRecipient(row, current) {
  const card = cards.get(row.id);
  if (!card || card.fullName !== row.name || card.name !== (row.badge_name?.trim() || row.name)) throw new Error("Cartão ausente ou desatualizado. Gere novamente os PNGs.");
  if (typeof card.filename !== "string" || path.basename(card.filename) !== card.filename || !card.filename.endsWith(".png")) throw new Error("Nome do PNG inválido.");
  const imagePath = realpathSync(path.join(output, "cartoes", card.filename));
  if (path.dirname(imagePath) !== realpathSync(path.join(output, "cartoes")) || statSync(imagePath).size === 0 || readFileSync(imagePath).subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new Error("PNG inválido.");
  const lodging = resolveParticipantCardLodging(row.id, current.plan, current.roster);
  const message = buildParticipantCardMessage(card.name, lodging, contact);
  return { id: row.id, fullName: row.name, filename: card.filename, imagePath, phone: phone(row.phone), message };
}
