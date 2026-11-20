import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAdminRegistrationService } from "./admin-registration.server";
import {
  buildFinanceAutoEntries,
  type CreateFinanceEntry,
  type FinanceEntry,
} from "./admin-finance.domain";

const BUCKET = "financial-attachments";
const MAX_BYTES = 10 * 1024 * 1024;

function todayInFortaleza(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (part: string) => parts.find((item) => item.type === part)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export async function getAdminFinanceSnapshot(): Promise<{
  entries: FinanceEntry[];
  asOfDate: string;
  manualAvailable: boolean;
}> {
  const [registrations, manual] = await Promise.all([
    getAdminRegistrationService().financeRows(),
    (async () => {
      const all: Array<{
        id: string;
        entry_type: string;
        entry_date: string;
        description: string;
        responsible: string;
        notes: string;
        amount_cents: number;
        attachment_file_name: string | null;
      }> = [];
      for (let start = 0; ; start += 1000) {
        const { data, error } = await supabaseAdmin
          .from("financial_entries")
          .select(
            "id,entry_type,entry_date,description,responsible,notes,amount_cents,attachment_file_name",
          )
          .order("entry_date", { ascending: false })
          .order("created_at", { ascending: false })
          .range(start, start + 999);
        if (error) {
          if (error.code === "42P01" || error.code === "PGRST205")
            return { rows: [], available: false };
          throw new Error("Não foi possível consultar os lançamentos financeiros.");
        }
        all.push(...(data ?? []));
        if (!data || data.length < 1000) return { rows: all, available: true };
      }
    })(),
  ]);
  const asOfDate = todayInFortaleza();
  const entries: FinanceEntry[] = [
    ...buildFinanceAutoEntries(registrations, asOfDate),
    ...manual.rows.map((row) => ({
      id: row.id,
      type: row.entry_type === "expense" ? ("expense" as const) : ("income" as const),
      source: "manual" as const,
      date: row.entry_date,
      description: row.description,
      responsible: row.responsible,
      notes: row.notes,
      amountCents: row.amount_cents,
      attachmentName: row.attachment_file_name,
    })),
  ];
  return { asOfDate, entries, manualAvailable: manual.available };
}

function checkedAttachment(attachment: NonNullable<CreateFinanceEntry["attachment"]>) {
  const bytes = Buffer.from(attachment.base64, "base64");
  if (bytes.length === 0 || bytes.length > MAX_BYTES)
    throw new Error("O anexo deve ter até 10 MB.");
  const mime = attachment.mimeType;
  const valid =
    mime === "application/pdf"
      ? bytes.subarray(0, 5).toString() === "%PDF-"
      : mime === "image/png"
        ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!valid) throw new Error("O conteúdo do anexo não corresponde ao formato informado.");
  return bytes;
}

export async function createAdminFinanceEntry(
  input: CreateFinanceEntry,
  adminUserId: string,
): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  const attachment = input.attachment;
  const extension =
    attachment?.mimeType === "application/pdf"
      ? "pdf"
      : attachment?.mimeType === "image/png"
        ? "png"
        : "jpg";
  const path = attachment ? `${id}/${crypto.randomUUID()}.${extension}` : null;
  if (attachment && path) {
    const bytes = checkedAttachment(attachment);
    const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, {
      contentType: attachment.mimeType,
      upsert: false,
    });
    if (error) throw new Error("Não foi possível enviar o anexo.");
  }
  const { error } = await supabaseAdmin.from("financial_entries").insert({
    id,
    entry_type: input.type,
    entry_date: input.date,
    description: input.description,
    responsible: input.responsible,
    notes: input.notes,
    amount_cents: input.amountCents,
    attachment_path: path,
    attachment_file_name: attachment?.fileName ?? null,
    attachment_mime_type: attachment?.mimeType ?? null,
    created_by: adminUserId,
  });
  if (error) {
    if (path) await supabaseAdmin.storage.from(BUCKET).remove([path]);
    throw new Error("Não foi possível salvar o lançamento financeiro.");
  }
  return { id };
}

export async function getAdminFinanceAttachment(id: string): Promise<{ signedUrl: string }> {
  const { data, error } = await supabaseAdmin
    .from("financial_entries")
    .select("attachment_path")
    .eq("id", id)
    .maybeSingle();
  if (error || !data?.attachment_path) throw new Error("Anexo não encontrado.");
  const signed = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(data.attachment_path, 60);
  if (signed.error || !signed.data?.signedUrl) throw new Error("Não foi possível abrir o anexo.");
  return { signedUrl: signed.data.signedUrl };
}
