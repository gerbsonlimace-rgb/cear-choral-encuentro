// Prepare individual wa.me drafts for the generated participant card images.
// This does not send messages or attach files; the operator reviews and sends each chat.
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, writeFileSync, statSync } from "node:fs";
import path from "node:path";

const output = path.resolve(getOption("output") || "output/participant-cards");
const manifestPath = path.join(output, "source", "manifest.json");
const cardsPath = path.join(output, "cartoes");
const htmlPath = path.join(output, "whatsapp-envios.html");
const csvPath = path.join(output, "links-whatsapp.csv");

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printHelp();
  process.exit(0);
}
if (!existsSync(manifestPath)) throw new Error("Card manifest not found. Generate participant cards first.");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
if (!Array.isArray(manifest.cards)) throw new Error("The card manifest has no cards array.");

const supabase = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await supabase.rpc("admin_registration_snapshot", { p_search: "" });
if (error) throw new Error("Could not load the admin registration snapshot: " + error.message);
if (!Array.isArray(data?.registrations)) throw new Error("The admin snapshot did not return registrations.");

// The public card and check-in flow currently accepts paid, non-cancelled registrations.
const roster = data.registrations
  .filter((row) => row.payment_status === "paid" && !row.cancelled_at)
  .sort((a, b) => displayName(a).localeCompare(displayName(b), "pt-BR"));
const cardById = new Map(manifest.cards.map((card) => [card.id, card]));
if (cardById.size !== manifest.cards.length) throw new Error("The card manifest contains duplicate registration IDs.");
if (roster.length !== manifest.cards.length || roster.some((row) => !cardById.has(row.id))) {
  throw new Error("Generated cards do not match today's paid, non-cancelled roster. Regenerate them first.");
}

const recipients = roster.map((row) => {
  const card = cardById.get(row.id);
  if (!card || typeof card.filename !== "string" || path.basename(card.filename) !== card.filename || !card.filename.endsWith(".png")) {
    throw new Error("A card filename is invalid. Regenerate the card manifest.");
  }
  const imagePath = path.join(cardsPath, card.filename);
  if (!existsSync(imagePath) || statSync(imagePath).size === 0) {
    throw new Error("Missing generated card image: " + card.filename);
  }
  const phone = normalizeBrazilianPhone(row.phone);
  if (!phone) throw new Error("A paid registration has no valid Brazilian WhatsApp number. Fix it before generating links.");
  const name = card.name || displayName(row);
  const message =
    "🎶 Olá, " + name + "! Seu cartão do II Encontro de Coros está pronto. " +
    "Apresente o QR Code no credenciamento. Até breve!";
  const waUrl = new URL("https://wa.me/" + phone);
  waUrl.searchParams.set("text", message);
  return {
    id: row.id,
    name,
    choir: card.choirName || row.choir_name || "",
    phone,
    message,
    waUrl: waUrl.toString(),
    filename: card.filename,
    cardUrl: card.cardUrl,
  };
});

const csvRows = [
  ["Nome", "Coro", "Telefone", "Abrir conversa wa.me", "Cartão PNG", "Página do cartão"],
  ...recipients.map((recipient) => [
    recipient.name,
    recipient.choir,
    recipient.phone,
    recipient.waUrl,
    path.join("cartoes", recipient.filename),
    recipient.cardUrl,
  ]),
];
writeFileSync(
  csvPath,
  "\uFEFF" + csvRows.map((row) => row.map(csvCell).join(";")).join("\r\n"),
  "utf8",
);

const page = createHtmlPage(recipients, manifest.generatedAt || new Date().toISOString());
writeFileSync(htmlPath, page, "utf8");
console.log(JSON.stringify({
  output: output,
  eligiblePaidNonCancelled: recipients.length,
  html: htmlPath,
  csv: csvPath,
  sendsPerformed: 0,
}, null, 2));

function getOption(name) {
  const prefix = "--" + name + "=";
  const argument = process.argv.slice(2).find((item) => item.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : null;
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error("Missing required environment variable: " + name);
  return value;
}

function displayName(row) {
  return row.badge_name?.trim() || row.name;
}

function normalizeBrazilianPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (/^55\d{10,11}$/.test(digits)) return digits;
  if (/^\d{10,11}$/.test(digits)) return "55" + digits;
  return null;
}

function csvCell(value) {
  let text = String(value ?? "");
  if (/^[\s]*[=+@\-\\t\\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createHtmlPage(rows, generatedAt) {
  const cards = rows.map((row) => {
    const id = escapeHtml(row.id);
    const name = escapeHtml(row.name);
    const choir = escapeHtml(row.choir);
    const image = escapeHtml("cartoes/" + row.filename);
    const filename = escapeHtml(row.filename);
    const href = escapeHtml(row.waUrl);
    const search = escapeHtml((row.name + " " + row.choir).toLocaleLowerCase("pt-BR"));
    return [
      '<article class="card" data-id="' + id + '" data-search="' + search + '">',
      '  <img src="' + image + '" alt="Cartão de ' + name + '" loading="lazy">',
      '  <div class="details"><h2>' + name + '</h2><p>' + choir + '</p>',
      '    <p class="file">Anexe no WhatsApp: cartoes/' + filename + '</p>',
      '    <a class="open" href="' + href + '" target="_blank" rel="noopener">Abrir conversa</a>',
      '    <button class="sent" type="button">Marcar como enviado</button>',
      '  </div>',
      '</article>',
    ].join("\n");
  }).join("\n");
  const storageKey = "encontro-coros-whatsapp-" + generatedAt.replace(/[^0-9]/g, "").slice(0, 14);

  return [
    "<!doctype html>",
    '<html lang="pt-BR">',
    "<head>",
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    "  <title>Cartões do Encontro · WhatsApp</title>",
    "  <style>",
    "    :root{font-family:system-ui,sans-serif;color:#30262a;background:#f7f4ef}",
    "    *{box-sizing:border-box}body{margin:0}header{position:sticky;top:0;background:#fff;border-bottom:1px solid #ddd;padding:18px clamp(16px,4vw,40px);z-index:2}",
    "    h1{font-size:1.2rem;margin:0 0 12px}.summary{display:flex;gap:20px;align-items:center;flex-wrap:wrap}",
    "    .metric{font-weight:700}.bar{width:min(340px,80vw);height:12px}input[type=search]{padding:10px 12px;border:1px solid #bdb5b7;border-radius:9px;min-width:min(300px,90vw)}",
    "    main{max-width:1120px;margin:auto;padding:20px;display:grid;gap:14px}",
    "    .notice{background:#fff6df;border:1px solid #ead8a7;border-radius:10px;padding:14px;line-height:1.45}",
    "    .card{background:white;border:1px solid #e4ddda;border-radius:12px;padding:14px;display:grid;grid-template-columns:100px 1fr;gap:16px;align-items:center}",
    "    .card img{width:100px;height:150px;object-fit:cover;object-position:top;border-radius:7px;background:#eee}.details h2{font-size:1rem;margin:0 0 4px}.details p{margin:4px 0;color:#65595d}",
    "    .file{font-size:.84rem}.open,.sent{display:inline-block;margin:8px 8px 0 0;padding:10px 14px;border-radius:8px;font:inherit;font-weight:650;text-decoration:none;cursor:pointer}",
    "    .open{background:#176b45;color:white}.sent{background:#eee8e4;color:#30262a;border:0}.card[data-sent=true]{border-color:#348358;background:#f1fbf4}",
    "    .card[data-sent=true] .sent{background:#d8f1df}.empty{display:none;color:#65595d}@media(max-width:520px){main{padding:12px}.card{grid-template-columns:72px 1fr;gap:12px;padding:10px}.card img{width:72px;height:108px}.open,.sent{padding:9px 10px}}",
    "  </style>",
    "</head>",
    "<body>",
    "  <header>",
    "    <h1>Cartões do II Encontro de Coros</h1>",
    '    <div class="summary"><span class="metric">Inscritos: <span id="total">' + rows.length + '</span></span>',
    '      <span class="metric">Enviados (marcação manual): <span id="sent-count">0</span></span>',
    '      <progress class="bar" id="progress" max="' + rows.length + '" value="0"></progress>',
    '      <input id="search" type="search" placeholder="Buscar por nome ou coro">',
    "    </div>",
    "  </header>",
    "  <main>",
    '    <div class="notice"><strong>Envio manual via wa.me.</strong> A conversa abre com a mensagem preenchida. Anexe o PNG indicado no cartão e toque em Enviar no WhatsApp; depois marque o envio aqui. O WhatsApp não informa a esta página quando a mensagem foi enviada.</div>',
    cards,
    '    <p class="empty" id="empty">Nenhum inscrito encontrado.</p>',
    "  </main>",
    "  <script>",
    "    const key = " + JSON.stringify(storageKey) + ";",
    "    const items = Array.from(document.querySelectorAll('.card'));",
    "    let sent = {};",
    "    try { sent = JSON.parse(localStorage.getItem(key) || '{}'); } catch {}",
    "    function update() {",
    "      let count = 0;",
    "      for (const item of items) {",
    "        const done = Boolean(sent[item.dataset.id]);",
    "        item.dataset.sent = String(done);",
    "        item.querySelector('.sent').textContent = done ? 'Desfazer marcação' : 'Marcar como enviado';",
    "        if (done) count += 1;",
    "      }",
    "      document.querySelector('#sent-count').textContent = String(count);",
    "      document.querySelector('#progress').value = count;",
    "    }",
    "    for (const item of items) item.querySelector('.sent').addEventListener('click', () => {",
    "      sent[item.dataset.id] = !sent[item.dataset.id];",
    "      try { localStorage.setItem(key, JSON.stringify(sent)); } catch {}",
    "      update();",
    "    });",
    "    document.querySelector('#search').addEventListener('input', (event) => {",
    "      const query = event.target.value.trim().toLocaleLowerCase('pt-BR');",
    "      let visible = 0;",
    "      for (const item of items) {",
    "        const match = item.dataset.search.includes(query);",
    "        item.hidden = !match;",
    "        if (match) visible += 1;",
    "      }",
    "      document.querySelector('#empty').style.display = visible ? 'none' : 'block';",
    "    });",
    "    update();",
    "  </script>",
    "</body>",
    "</html>",
  ].join("\n");
}

function printHelp() {
  console.log([
    "Generate one wa.me draft per eligible participant.",
    "This creates local HTML and CSV files; it does not send messages or attach images.",
    "Only paid, non-cancelled registrations are included.",
    "",
    "Usage:",
    "  node --env-file=.env --env-file=.env.local scripts/generate-participant-wa-me-links.mjs",
    "",
    "Options:",
    "  --output=<dir>  Card export directory (default: output/participant-cards)",
    "  --help          Show this help",
  ].join("\n"));
}
