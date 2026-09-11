import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ParticipantRegistrationView = {
  participantName: string;
  email: string;
  choirName?: string;
  paymentStatus: "pending" | "paid";
  paymentMethod?: "pix" | "credit_card";
  installments?: number;
  amountCents?: number;
  paidAmountCents?: number;
  paidAt?: string;
  orderNsu?: string;
  receiptUrl?: string;
  checkoutUrl?: string;
};

export type ParticipantLoginResult =
  | { ok: true; registrations: ParticipantRegistrationView[] }
  | { ok: false; message: string };

export const INVALID_PARTICIPANT_CREDENTIALS =
  "E-mail ou senha incorretos. A senha é o seu CPF seguido da data de nascimento (ex.: 12345678909 20031990).";

/** Accepted password shapes: CPF digits + birth date as ddmmyyyy, yyyymmdd or ddmmyy. */
export function participantPasswordMatches(input: string, cpf: string, birthDate: string) {
  const digits = input.replace(/\D/g, "");
  const cpfDigits = cpf.replace(/\D/g, "");
  const [year, month, day] = birthDate.slice(0, 10).split("-");
  if (!year || !month || !day) return false;

  const candidates = [
    `${cpfDigits}${day}${month}${year}`,
    `${cpfDigits}${year}${month}${day}`,
    `${cpfDigits}${day}${month}${year.slice(2)}`,
  ];

  return candidates.includes(digits);
}

const participantColumns =
  "name,email,cpf,birth_date,choir_name,payment_status,payment_method,installments,amount_cents,paid_amount_cents,paid_at,order_nsu,receipt_url,checkout_url" as const;

type ParticipantRow = {
  name: string | null;
  email: string | null;
  cpf: string | null;
  birth_date: string | null;
  choir_name: string | null;
  payment_status: string | null;
  payment_method: string | null;
  installments: number | null;
  amount_cents: number | null;
  paid_amount_cents: number | null;
  paid_at: string | null;
  order_nsu: string | null;
  receipt_url: string | null;
  checkout_url: string | null;
};

export function toParticipantView(row: ParticipantRow): ParticipantRegistrationView {
  return {
    participantName: row.name ?? "",
    email: row.email ?? "",
    paymentStatus: row.payment_status === "paid" ? "paid" : "pending",
    ...(row.choir_name ? { choirName: row.choir_name } : {}),
    ...(row.payment_method === "pix" || row.payment_method === "credit_card"
      ? { paymentMethod: row.payment_method }
      : {}),
    ...(row.installments ? { installments: row.installments } : {}),
    ...(row.amount_cents ? { amountCents: row.amount_cents } : {}),
    ...(row.paid_amount_cents ? { paidAmountCents: row.paid_amount_cents } : {}),
    ...(row.paid_at ? { paidAt: row.paid_at } : {}),
    ...(row.order_nsu ? { orderNsu: row.order_nsu } : {}),
    ...(row.receipt_url ? { receiptUrl: row.receipt_url } : {}),
    ...(row.paymentStatusPlaceholder ? {} : {}),
    ...(row.payment_status !== "paid" && row.checkout_url ? { checkoutUrl: row.checkout_url } : {}),
  } as ParticipantRegistrationView;
}

export async function loginParticipantWithCredentials(credentials: {
  email: string;
  password: string;
}): Promise<ParticipantLoginResult> {
  const email = credentials.email.trim().toLowerCase();

  const { data, error } = await supabaseAdmin
    .from("registrations")
    .select(participantColumns)
    .ilike("email", email)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[Participant area] lookup failed", { reason: error.message });
    return { ok: false, message: "Não foi possível consultar sua inscrição agora. Tente novamente." };
  }

  const rows = (data ?? []) as ParticipantRow[];
  const matching = rows.filter(
    (row) =>
      row.cpf &&
      row.birth_date &&
      participantPasswordMatches(credentials.password, row.cpf, row.birth_date),
  );

  if (matching.length === 0) return { ok: false, message: INVALID_PARTICIPANT_CREDENTIALS };

  return { ok: true, registrations: matching.map(toParticipantView) };
}
