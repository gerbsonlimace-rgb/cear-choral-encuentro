import {
  useCallback,
  useEffect,
  useRef,
  useState,
  memo,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  BadgeCheck,
  Ban,
  Banknote,
  ChartNoAxesCombined,
  CheckCircle2,
  CircleOff,
  Clock3,
  ExternalLink,
  History,
  Link2,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  KeyRound,
  Trash2,
  ShieldCheck,
  ShieldOff,
  Users,
  FileDown,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { deliverFile, openPreparedPdf } from "@/lib/file-download";
import { dietaryRestrictionLabels } from "@/features/public-attendance/publicAttendance.domain";
import type { AdminPdfFile } from "./admin-registration-pdf";
import { InternalMetricCard } from "@/components/internal-app/InternalMetricCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BalancePaymentDialog, isSafeCheckoutUrl } from "@/features/regent/BalancePaymentDialog";
import { startComplementCheckout } from "@/lib/regent.functions";
import {
  createAdminRegistrationCheckoutLink,
  exportAdminRegistrations,
  exportAdminRegistrationsPdf,
  getAdminAccess,
  getAdminRegistrationReceipt,
  getAdminRegistrationSummary,
  getAdminRegistrationPhotos,
  listAdminRegistrations,
  markAdminRegistrationPaid,
  setAdminRegistrationRafflePaid,
  cancelAdminRegistration,
  deleteAdminRegistration,
  reprocessParticipantAccess,
  resetParticipantInitialPassword,
  updateAdminRegistration,
  listAdminRegistrationRoles,
  grantAdminFromRegistration,
  revokeAdminFromRegistration,
  type AdminAccessState,
  type AdminRegistrationsBootstrap,
} from "@/lib/admin.functions";
import type { RegistrationAdminRole } from "@/features/admin/admin-roles.server";
import { getPublicRegistrationConfiguration } from "@/lib/choir-pricing.functions";
import type { PublicChoirOption } from "@/features/choirs/choir-pricing.domain";
import { dioceseOptions, type Diocese } from "@/features/dioceses/diocese.domain";
import {
  genderOptions,
  musicalProfileOptions,
  voicePartOptions,
  type Gender,
  type MusicalProfile,
  type VoicePart,
} from "@/features/registration/registration.domain";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type {
  AdminExportFile,
  AdminRegistrationExportQuery,
  AdminRegistrationPage,
  AdminRegistrationQuery,
  AdminRegistrationRow,
  AdminRegistrationSummary,
} from "./admin.domain";
import {
  adminUpdateRegistrationFormSchema,
  getAdminFinancialState,
  getRegistrationDisplayName,
  manualPaymentReceiptMimeTypeSchema,
  MAX_MANUAL_PAYMENT_RECEIPT_BYTES,
  type AdminUpdateRegistrationInput,
  type ManualPaymentReceipt,
} from "./admin.domain";
import { AdminNavigation, type AdminNavigationPath } from "./AdminNavigation";
import { AdminChoirSummaryCard, type PrepareChoirPdf } from "./AdminChoirSummaryCard";
import { getAdminRafflePending, getAdminRegistrationPendingCents, formatAdminRafflePending } from "./admin-raffle.domain";
import {
  getManualPaymentDue,
  parseReceivedAmount,
  type ManualPaymentRemainder,
} from "./admin-manual-payment.domain";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { EventReportRoleAction } from "./EventReportRoleAction";
import { AdminWhatsAppToolbar, AdminRegistrationWhatsAppButton, AdminWhatsAppSelection, useAdminWhatsApp, type AdminWhatsAppController } from "./AdminWhatsAppActions";
import { AdminBrevoCardEmail } from "./AdminBrevoCardEmail";

type ManualPaymentChoice = {
  amountCents: number;
  remainder: ManualPaymentRemainder;
  originalRegistrationPriceCents: number;
  rafflePaidCents?: number;
  reason: string;
};

function manualPaymentDue(row: AdminRegistrationRow) {
  return getManualPaymentDue({
    paymentStatus: row.paymentStatus,
    paymentOrigin: row.paymentOrigin ?? null,
    amountCents: row.amountCents,
    paidAmountCents: row.paidAmountCents,
    pricingType: row.pricingType,
    standardPriceCents: row.standardPriceCents,
    registrationPriceCents: row.registrationPriceCents,
    feePendingCents: row.manualFeePendingCents ?? null,
    discountCents: row.manualDiscountCents ?? null,
    originalRegistrationPriceCents: row.adminRegistrationOriginalPriceCents ?? null,
  });
}

function getAdminAccessErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
    return "O localhost não encontrou SUPABASE_SERVICE_ROLE_KEY. Configure essa chave no arquivo .env.local e reinicie o localhost.";
  }
  return "Não foi possível verificar seu acesso. Tente novamente.";
}

const centsToInput = (value: number) => (value / 100).toFixed(2).replace(".", ",");

type Props = {
  deleteRegistration?: (input: {
    data: { registrationId: string; cpf: string };
  }) => Promise<{ status: "deleted" | "cpf_mismatch" }>;
  onSignedOut: () => void;
  onMissingSession: () => void;
  checkAdmin?: () => Promise<AdminAccessState>;
  loadInitialData?: () => Promise<AdminRegistrationsBootstrap>;
  loadRegistrations?: (input: { data: AdminRegistrationQuery }) => Promise<AdminRegistrationPage>;
  loadSummary?: () => Promise<AdminRegistrationSummary>;
  loadPhotos?: (input: { data: { registrationIds: string[] } }) => Promise<Record<string, string>>;
  exportRegistrations?: (input: { data: AdminRegistrationExportQuery }) => Promise<AdminExportFile>;
  exportPdfRegistrations?: (input: { data: AdminRegistrationExportQuery }) => Promise<AdminPdfFile>;
  reprocessAccess?: (input: { data: { registrationId: string } }) => Promise<unknown>;
  resetInitialPassword?: (input: { data: { registrationId: string } }) => Promise<{
    status: "success";
    sessionsRevoked: false;
  }>;
  createPaymentLink?: (input: { data: { registrationId: string } }) => Promise<{
    checkoutUrl: string;
    reused: boolean;
  }>;
  markPaid?: (input: {
    data: {
      registrationId: string;
      receipt?: ManualPaymentReceipt;
      amountCents?: number;
      remainder?: ManualPaymentRemainder;
      originalRegistrationPriceCents?: number;
      rafflePaidCents?: number;
      reason?: string;
    };
  }) => Promise<{
    status: "paid";
    registrationId: string;
    receivedCents?: number;
    pendingCents?: number;
    discountCents?: number;
  }>;
  getReceiptUrl?: (input: { data: { registrationId: string } }) => Promise<{
    signedUrl: string;
    expiresIn: number;
  }>;
  openReceiptUrl?: (url: string) => void;
  copyToClipboard?: (value: string) => Promise<void>;
  getSession?: () => Promise<{ data: { session: unknown | null }; error: unknown }>;
  signOut?: () => Promise<{ error: unknown }>;
  startBalanceCheckout?: (input: { data: { registrationId: string } }) => Promise<{
    checkoutUrl: string;
    orderNsu: string;
  }>;
  /** Test/embedding seam matching the shared dialog's naming. */
  startCheckout?: (input: { data: { registrationId: string } }) => Promise<{
    checkoutUrl: string;
    orderNsu: string;
  }>;
  navigateToCheckout?: (url: string) => void;
  navigateTo?: (to: AdminNavigationPath | "/regente") => void;
  updateRegistration?: (input: {
    data: AdminUpdateRegistrationInput;
  }) => Promise<{ status: "updated"; registrationId: string }>;
  loadChoirs?: () => Promise<{ choirs: PublicChoirOption[] }>;
  loadRoles?: (input: {
    data: { registrationIds: string[] };
  }) => Promise<Record<string, RegistrationAdminRole>>;
  grantAdmin?: (input: { data: { registrationId: string } }) => Promise<unknown>;
  revokeAdmin?: (input: { data: { registrationId: string } }) => Promise<unknown>;
};

function AdminTag() {
  return (
    <span className="ml-2 inline-flex items-center rounded-full bg-brand-gold/20 px-2 py-0.5 align-middle text-[0.65rem] font-semibold uppercase tracking-wide text-foreground">
      Admin
    </span>
  );
}

const defaultGetSession = () => supabase.auth.getSession();
const defaultSignOut = () => supabase.auth.signOut();
const defaultCopyToClipboard = (value: string) => navigator.clipboard.writeText(value);
const defaultOpenReceiptUrl = (url: string) => window.open(url, "_blank", "noopener,noreferrer");
const initialQuery: AdminRegistrationQuery = {
  search: "",
  paymentStatus: "all",
  choirId: "all",
  musicalProfile: "all",
  loginStatus: "all",
  page: 1,
  pageSize: 25,
};

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Fortaleza",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const moneyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = (value: string | null) =>
  value ? dateTimeFormatter.format(new Date(value)).replace(", ", " ") : "Não informado";
const money = (value: number | null) =>
  value === null ? "Não informado" : moneyFormatter.format(value / 100);
const dateOnly = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "Não informado";
};
const optionalText = (value: string | null | undefined) => value?.trim() || "Não informado";
const safeInfinitePayReceiptUrl = (value: string | null): string | null => {
  if (!value) return null;
  try {
    const url = new URL(value);
    const allowed = ["infinitepay.io", "infinitepay.com.br"].some(
      (root) => url.hostname === root || url.hostname.endsWith(`.${root}`),
    );
    return url.protocol === "https:" && allowed ? value : null;
  } catch {
    return null;
  }
};

const musicalProfileLabels: Record<string, string> = {
  coralista: "Coralista",
  corista: "Coralista",
  singer: "Coralista",
  regente: "Regente",
  conductor: "Regente",
  regent: "Regente",
  instrumentista: "Instrumentista",
  instrumentalist: "Instrumentista",
};

function musicalProfileLabel(row: AdminRegistrationRow): string {
  const profile = row.musicalProfile?.trim().toLowerCase();
  if (profile && musicalProfileLabels[profile]) return musicalProfileLabels[profile];
  const legacyRole = row.role.trim().toLowerCase();
  return musicalProfileLabels[legacyRole] ?? "Não informado";
}

function nameInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

function ParticipantAvatar({ row, large = false }: { row: AdminRegistrationRow; large?: boolean }) {
  return (
    <Avatar className={`${large ? "h-20 w-20" : "h-10 w-10"} shrink-0 border border-border`}>
      {row.photoUrl && (
        <AvatarImage src={row.photoUrl} alt={`Foto de ${getRegistrationDisplayName(row)}`} />
      )}
      <AvatarFallback
        className={`bg-primary/10 font-semibold text-primary ${large ? "text-xl" : "text-xs"}`}
      >
        {nameInitials(getRegistrationDisplayName(row))}
      </AvatarFallback>
    </Avatar>
  );
}

function Status({ row }: { row: AdminRegistrationRow }) {
  if (row.cancelledAt) {
    return <Badge variant="destructive">Cancelada</Badge>;
  }
  const status = getAdminFinancialState(row).status;
  const freePending = row.paymentStatus === "pending" && row.isFreeRegistration;
  const label = freePending
    ? "Aguardando aprovação"
    : (row.manualDiscountCents ?? 0) > 0
      ? "Isenção parcial"
      : status === "paid" && (row.manualFeePendingCents ?? 0) > 0
      ? "Parcialmente pago"
      : {
        legacy: "Histórico",
        pending: "Pendente taxa de inscrição",
        partially_paid: "Parcialmente pago",
        paid: "Pago",
        exempt: "Isenção total",
      }[status];
  return (
    <Badge variant={status === "paid" || status === "partially_paid" ? "default" : "secondary"}>
      {label}
    </Badge>
  );
}

function pendingAmountCents(row: AdminRegistrationRow): number | null {
  return getAdminFinancialState(row).pendingCents;
}

function receivedAmountCents(row: AdminRegistrationRow): number | null {
  const state = getAdminFinancialState(row);
  return state.confirmedPrincipalCents ?? row.paidAmountCents;
}

function readReceipt(file: File): Promise<ManualPaymentReceipt> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o comprovante selecionado."));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const separator = result.indexOf(",");
      if (separator < 0) {
        reject(new Error("Não foi possível ler o comprovante selecionado."));
        return;
      }
      resolve({
        base64: result.slice(separator + 1),
        mimeType: manualPaymentReceiptMimeTypeSchema.parse(file.type),
        fileName: file.name,
      });
    };
    reader.readAsDataURL(file);
  });
}

function PaymentSummary({ row }: { row: AdminRegistrationRow }) {
  const state = getAdminFinancialState(row);
  const raffle = getAdminRafflePending(row, state);
  const received = receivedAmountCents(row);
  const pending = pendingAmountCents(row);
  return (
    <div className="space-y-1.5">
      <Status row={row} />
      <div className="space-y-0.5 text-xs text-muted-foreground">
        {state.status === "exempt" && (
          <p>
            Valor: <span className="font-medium text-foreground">{money(0)}</span>
          </p>
        )}
        {state.status !== "exempt" && (
          <>
            {received !== null && (
              <p>
                Recebido: <span className="font-medium text-foreground">{money(received)}</span>
              </p>
            )}
            {pending !== null &&
              (!raffle || state.status === "pending" || (row.manualFeePendingCents ?? 0) > 0) && (
              <p>
                Pendente taxa de inscrição: <span className="font-medium text-foreground">{money(getAdminRegistrationPendingCents(row, state))}</span>
              </p>
            )}
            {(row.manualDiscountCents ?? 0) > 0 && (
              <p>
                Isenção parcial: <span className="font-medium text-foreground">{money(row.manualDiscountCents ?? 0)}</span>
              </p>
            )}
            {received === null && pending === null && <p>Valores não informados</p>}
          </>
        )}
        {raffle && (
          <p>Pendente em rifas: <span className="font-medium text-foreground">{formatAdminRafflePending(raffle)}</span></p>
        )}
      </div>
    </div>
  );
}

const voicePartLabels: Record<string, string> = {
  soprano: "Soprano",
  contralto: "Contralto",
  tenor: "Tenor",
  baixo: "Baixo",
  other: "Outro",
};

function DetailItem({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-muted/20 p-4">
      <h3 className="mb-4 text-sm font-semibold text-foreground">{title}</h3>
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

function RegistrationDetailsDialog({
  row,
  onOpenChange,
}: {
  row: AdminRegistrationRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  if (!row) return null;
  const financial = getAdminFinancialState(row);
  const paymentMethod =
    row.paymentMethod === "pix"
      ? "Pix"
      : row.paymentMethod === "credit_card"
        ? "Cartão de crédito"
        : "Não informado";
  const paymentOrigin =
    row.paymentOrigin === "manual"
      ? "Confirmação manual"
      : row.paymentOrigin === "infinitepay"
        ? "InfinitePay"
        : row.paymentOrigin === "exemption"
          ? row.paymentStatus === "pending"
            ? "Isenção aguardando aprovação"
            : "Isenção total"
          : "Não informado";
  const pricingType =
    financial.status === "exempt"
      ? "Isenção total"
      : (row.manualDiscountCents ?? 0) > 0
        ? "Isenção parcial"
      : row.isFreeRegistration && row.paymentStatus === "pending"
        ? "Aguardando aprovação"
        : row.pricingType === "promotional"
          ? "Programa de rifas"
          : row.pricingType === "standard"
            ? "Inscrição integral"
            : "Não informado";
  const review = row.supersededCheckoutReview;
  const reviewReceiptUrl = safeInfinitePayReceiptUrl(review?.receiptUrl ?? null);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <div className="flex items-start gap-4 pr-8">
            <ParticipantAvatar row={row} large />
            <div className="min-w-0 space-y-2">
              <DialogTitle className="break-words text-left text-xl">{row.name}</DialogTitle>
              <DialogDescription className="text-left">
                Dados completos da inscrição realizada em {dateTime(row.createdAt)}.
              </DialogDescription>
              <Status row={row} />
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-2">
          <DetailSection title="Dados pessoais">
            <DetailItem label="Nome completo">{row.name}</DetailItem>
            <DetailItem label="Nome no crachá">{optionalText(row.badgeName)}</DetailItem>
            <DetailItem label="CPF">{row.cpf}</DetailItem>
            <DetailItem label="Data de nascimento">{dateOnly(row.birthDate)}</DetailItem>
            <DetailItem label="E-mail" wide>
              {row.email}
            </DetailItem>
            <DetailItem label="WhatsApp">{row.phone}</DetailItem>
            <DetailItem label="Cidade">{row.city}</DetailItem>
            <DetailItem label="Instituição" wide>
              {optionalText(row.institution)}
            </DetailItem>
          </DetailSection>

          <DetailSection title="Participação e coro">
            <DetailItem label="Diocese">{row.diocese}</DetailItem>
            <DetailItem label="Coro">{row.choirName}</DetailItem>
            <DetailItem label="Outro coro">{optionalText(row.otherChoirName)}</DetailItem>
            <DetailItem label="Perfil musical">{musicalProfileLabel(row)}</DetailItem>
            <DetailItem label="Naipe / voz">
              {row.voicePart ? (voicePartLabels[row.voicePart] ?? row.voicePart) : "Não informado"}
            </DetailItem>
            <DetailItem label="Função anterior">{optionalText(row.role)}</DetailItem>
            <DetailItem label="Regente responsável">{optionalText(row.regentName)}</DetailItem>
            <DetailItem label="Camiseta">
              {row.includeShirt
                ? `${optionalText(row.shirtSize)}${row.shirtPriceCents ? ` · ${money(row.shirtPriceCents)}` : ""}`
                : "Não solicitada"}
            </DetailItem>
            <DetailItem label="Observações" wide>
              {optionalText(row.observations)}
            </DetailItem>
            <DetailItem label="Restrição alimentar">
              {row.dietaryRestriction == null ? "Ainda não informado" : row.dietaryRestriction ? "Sim" : "Não"}
            </DetailItem>
            <DetailItem label="Tipos de restrição alimentar" wide>
              {row.dietaryRestriction == null
                ? "Ainda não informado"
                : row.dietaryRestriction
                  ? dietaryRestrictionLabels(row.dietaryRestrictionTypes, row.dietaryRestrictionOther) || "Ainda sem detalhes"
                  : "Não se aplica"}
            </DetailItem>
            <DetailItem label="Usará van para traslado">
              {row.usesEventVan == null ? "Ainda não informado" : row.usesEventVan ? "Sim" : "Não"}
            </DetailItem>
          </DetailSection>

          {review && (
            <section
              role="alert"
              className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 lg:col-span-2"
            >
              <h3 className="font-semibold">Pagamento de checkout substituído</h3>
              <p className="mt-1 text-sm">
                Revisão administrativa necessária; a inscrição atual não foi confirmada
                automaticamente.
              </p>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-medium">Valor do checkout</dt>
                  <dd>{money(review.amountCents)}</dd>
                </div>
                <div>
                  <dt className="font-medium">Valor recebido</dt>
                  <dd>{money(review.paidAmountCents)}</dd>
                </div>
                <div>
                  <dt className="font-medium">Pago em</dt>
                  <dd>{dateTime(review.paidAt)}</dd>
                </div>
                <div>
                  <dt className="font-medium">Forma de pagamento</dt>
                  <dd>{review.paymentMethod === "pix" ? "Pix" : "Cartão de crédito"}</dd>
                </div>
                <div>
                  <dt className="font-medium">Transação</dt>
                  <dd className="break-all">{review.transactionNsu}</dd>
                </div>
              </dl>
              {reviewReceiptUrl && (
                <a
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium underline"
                  href={reviewReceiptUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Ver comprovante <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              )}
            </section>
          )}

          <DetailSection title="Financeiro">
            <DetailItem label="Modalidade">{pricingType}</DetailItem>
            <DetailItem label="Valor padrão">{money(row.standardPriceCents)}</DetailItem>
            <DetailItem label="Valor da inscrição">{money(row.registrationPriceCents)}</DetailItem>
            <DetailItem label="Valor do pedido">{money(row.amountCents)}</DetailItem>
            <DetailItem label="Recebido">{money(receivedAmountCents(row))}</DetailItem>
            <DetailItem label="Pendente taxa de inscrição">{money(getAdminRegistrationPendingCents(row, financial))}</DetailItem>
            {(row.manualDiscountCents ?? 0) > 0 && (
              <DetailItem label="Isenção parcial">{money(row.manualDiscountCents ?? 0)}</DetailItem>
            )}
            {getAdminRafflePending(row, financial) && (
              <DetailItem label="Pendente em rifas">
                {formatAdminRafflePending(getAdminRafflePending(row, financial) ?? { cents: 0, tickets: 0 })}
              </DetailItem>
            )}
            <DetailItem label="Forma de pagamento">{paymentMethod}</DetailItem>
            <DetailItem label="Parcelas">{row.installments ?? "Não informado"}</DetailItem>
            <DetailItem label="Origem do pagamento">{paymentOrigin}</DetailItem>
            <DetailItem label="Pago em">{dateTime(row.paidAt)}</DetailItem>
            <DetailItem label="Comprovante">
              {row.hasManualReceipt ? "Disponível no menu Mais" : "Não disponível"}
            </DetailItem>
            <DetailItem label="Acesso do participante">
              {row.participantAccess?.label ?? "Não disponível"}
            </DetailItem>
          </DetailSection>

          <DetailSection title="Dados da inscrição">
            <DetailItem label="Data e hora">{dateTime(row.createdAt)}</DetailItem>
            <DetailItem label="Código da inscrição">{row.id}</DetailItem>
          </DetailSection>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function isInteractiveTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(target.closest("button,a,input,select,textarea,label,[role='menuitem']"))
  );
}

/**
 * Clicks inside portaled windows (payment, confirmations, menus) bubble through
 * React to the row/card. Only clicks physically inside the row open details.
 */
function shouldOpenDetails(event: MouseEvent<HTMLElement>) {
  const target = event.target;
  return (
    target instanceof Node && event.currentTarget.contains(target) && !isInteractiveTarget(target)
  );
}

function RegistrationViews({
  rows,
  whatsApp,
  participantActionBusy,
  onReprocess,
  onReset,
  onBalancePayment,
  onPaymentLink,
  onMarkPaid,
  onDelete,
  onCancel,
  onViewReceipt,
  onEdit,
  roles,
  onToggleAdmin,
  onEventReportsChange,
}: {
  rows: AdminRegistrationRow[];
  whatsApp: AdminWhatsAppController;
  participantActionBusy: boolean;
  onReprocess: (row: AdminRegistrationRow) => void;
  onReset: (row: AdminRegistrationRow) => Promise<void>;
  onBalancePayment: (row: AdminRegistrationRow) => void;
  onPaymentLink: (row: AdminRegistrationRow) => void;
  onMarkPaid: (
    row: AdminRegistrationRow,
    receipt: ManualPaymentReceipt | undefined,
    payment: ManualPaymentChoice,
  ) => Promise<boolean>;
  onDelete?: (row: AdminRegistrationRow, cpf: string) => Promise<boolean>;
  onCancel?: (row: AdminRegistrationRow, refundCents: number) => Promise<boolean>;
  onViewReceipt: (row: AdminRegistrationRow) => void;
  onEdit?: (row: AdminRegistrationRow) => void;
  roles?: Record<string, RegistrationAdminRole>;
  onToggleAdmin?: (row: AdminRegistrationRow, makeAdmin: boolean) => Promise<void>;
  onEventReportsChange?: (id: string, enabled: boolean) => void;
}) {
  const [selectedRow, setSelectedRow] = useState<AdminRegistrationRow | null>(null);
  const openWithKeyboard = (event: KeyboardEvent<HTMLElement>, row: AdminRegistrationRow) => {
    if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " "))
      return;
    event.preventDefault();
    setSelectedRow(row);
  };
  return (
    <>
      <div className="hidden rounded-xl border bg-card md:block">
        <Table aria-label="Inscrições">
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="w-12"><span className="sr-only">Selecionar para WhatsApp</span></TableHead>
              {[
                "Data e hora",
                "Coralista",
                "Função",
                "E-mail",
                "Pagamento",
                "WhatsApp",
                "Coro",
                "Mais",
              ].map((label) => (
                <TableHead key={label} scope="col">
                  {label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                tabIndex={0}
                aria-label={`Ver todos os dados de ${row.name}`}
                className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                onClick={(event) => {
                  if (shouldOpenDetails(event)) setSelectedRow(row);
                }}
                onKeyDown={(event) => openWithKeyboard(event, row)}
              >
                <TableCell className="align-top p-1"><AdminWhatsAppSelection row={row} controller={whatsApp} /></TableCell>
                <TableCell className="whitespace-nowrap align-top">
                  <time dateTime={row.createdAt}>{dateTime(row.createdAt)}</time>
                </TableCell>
                <TableCell className="max-w-56 align-top">
                  <div className="flex items-center gap-3">
                    <ParticipantAvatar row={row} />
                    <div className="min-w-0">
                      <p className="break-words font-medium">
                        {getRegistrationDisplayName(row)}
                        {roles?.[row.id]?.isAdmin && <AdminTag />}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">CPF {row.cpf}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="align-top">{musicalProfileLabel(row)}</TableCell>
                <TableCell className="max-w-52 break-all align-top">{row.email}</TableCell>
                <TableCell className="min-w-36 align-top">
                  <PaymentSummary row={row} />
                </TableCell>
                <TableCell className="max-w-44 align-top">
                  <p>{row.phone}</p>
                  <AdminRegistrationWhatsAppButton row={row} controller={whatsApp} />
                </TableCell>
                <TableCell className="max-w-44 align-top">
                  <p className="break-words font-medium">{row.choirName}</p>
                </TableCell>
                <TableCell className="w-16 text-right align-top">
                  <RegistrationActions
                    row={row}
                    onReprocess={onReprocess}
                    onReset={onReset}
                    onBalancePayment={onBalancePayment}
                    onPaymentLink={onPaymentLink}
                    onMarkPaid={onMarkPaid}
                    onDelete={onDelete}
                    onCancel={onCancel}
                    onViewReceipt={onViewReceipt}
                    onEdit={onEdit}
                    role={roles?.[row.id]}
                    onToggleAdmin={onToggleAdmin}
                    onEventReportsChange={onEventReportsChange}
                    busy={participantActionBusy}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <section aria-label="Cartões de inscrições" className="space-y-3 md:hidden">
        {rows.map((row) => (
          <Card
            key={row.id}
            tabIndex={0}
            aria-label={`Ver todos os dados de ${row.name}`}
            className="cursor-pointer shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={(event) => {
              if (shouldOpenDetails(event)) setSelectedRow(row);
            }}
            onKeyDown={(event) => openWithKeyboard(event, row)}
          >
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <AdminWhatsAppSelection row={row} controller={whatsApp} />
                  <ParticipantAvatar row={row} />
                  <div className="min-w-0">
                    <h2 className="break-words text-sm font-semibold">
                      {getRegistrationDisplayName(row)}
                      {roles?.[row.id]?.isAdmin && <AdminTag />}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">CPF {row.cpf}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{dateTime(row.createdAt)}</p>
                  </div>
                </div>
                <RegistrationActions
                  row={row}
                  onReprocess={onReprocess}
                  onReset={onReset}
                  onBalancePayment={onBalancePayment}
                  onPaymentLink={onPaymentLink}
                  onMarkPaid={onMarkPaid}
                  onDelete={onDelete}
                  onCancel={onCancel}
                  onViewReceipt={onViewReceipt}
                  onEdit={onEdit}
                  role={roles?.[row.id]}
                  onToggleAdmin={onToggleAdmin}
                    onEventReportsChange={onEventReportsChange}
                  busy={participantActionBusy}
                />
              </div>
              <dl className="grid grid-cols-2 gap-3 text-xs">
                <div className="col-span-2">
                  <dt className="text-muted-foreground">E-mail</dt>
                  <dd className="break-all">{row.email}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Função</dt>
                  <dd>{musicalProfileLabel(row)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="mb-1 text-muted-foreground">Pagamento</dt>
                  <dd>
                    <PaymentSummary row={row} />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">WhatsApp</dt>
                  <dd><p>{row.phone}</p><AdminRegistrationWhatsAppButton row={row} controller={whatsApp} /></dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Coro</dt>
                  <dd className="break-words">{row.choirName}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        ))}
      </section>
      <RegistrationDetailsDialog
        row={selectedRow}
        onOpenChange={(open) => !open && setSelectedRow(null)}
      />
    </>
  );
}

function RegistrationActions({
  row,
  onReprocess,
  onReset,
  onBalancePayment,
  onPaymentLink,
  onMarkPaid,
  onDelete,
  onCancel,
  onViewReceipt,
  onEdit,
  role,
  onToggleAdmin,
  onEventReportsChange,
  busy,
}: {
  row: AdminRegistrationRow;
  onReprocess: (row: AdminRegistrationRow) => void;
  onReset: (row: AdminRegistrationRow) => Promise<void>;
  onBalancePayment: (row: AdminRegistrationRow) => void;
  onPaymentLink: (row: AdminRegistrationRow) => void;
  onMarkPaid: (
    row: AdminRegistrationRow,
    receipt: ManualPaymentReceipt | undefined,
    payment: ManualPaymentChoice,
  ) => Promise<boolean>;
  onDelete?: (row: AdminRegistrationRow, cpf: string) => Promise<boolean>;
  onCancel?: (row: AdminRegistrationRow, refundCents: number) => Promise<boolean>;
  onViewReceipt: (row: AdminRegistrationRow) => void;
  onEdit?: (row: AdminRegistrationRow) => void;
  role?: RegistrationAdminRole;
  onToggleAdmin?: (row: AdminRegistrationRow, makeAdmin: boolean) => Promise<void>;
  onEventReportsChange?: (id: string, enabled: boolean) => void;
  busy: boolean;
}) {
  const [confirmMarkPaid, setConfirmMarkPaid] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [refundInput, setRefundInput] = useState("");
  const [confirmAdmin, setConfirmAdmin] = useState(false);
  const [deleteCpf, setDeleteCpf] = useState("");
  const [receipt, setReceipt] = useState<ManualPaymentReceipt | null>(null);
  const [receiptError, setReceiptError] = useState("");
  const due = manualPaymentDue(row);
  const savedOriginalPrice = row.adminRegistrationOriginalPriceCents ??
    (row.paymentOrigin === "exemption" ? null : row.registrationPriceCents);
  const [originalAmountInput, setOriginalAmountInput] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [reason, setReason] = useState("");
  const [rafflePaidInput, setRafflePaidInput] = useState("");
  const [remainder, setRemainder] = useState<ManualPaymentRemainder>("pending");
  const state = getAdminFinancialState(row);
  // Cancelled registrations stay configurable so admins can settle values after cancellation.
  const canConfigurePayment =
    (row.paymentStatus === "pending" || due?.mode === "balance" || row.paymentOrigin === "exemption");
  const openUrl = row.openComplementPayment?.checkoutUrl;
  const access = row.participantAccess;
  const selectReceipt = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setReceipt(null);
    setReceiptError("");
    if (!manualPaymentReceiptMimeTypeSchema.safeParse(file.type).success) {
      setReceiptError("Envie um comprovante em PDF, JPG ou PNG.");
      return;
    }
    if (file.size === 0 || file.size > MAX_MANUAL_PAYMENT_RECEIPT_BYTES) {
      setReceiptError("O comprovante deve ter entre 1 byte e 10 MB.");
      return;
    }
    try {
      setReceipt(await readReceipt(file));
    } catch {
      setReceiptError("Não foi possível ler o comprovante selecionado.");
    }
  };
  const openMarkPaid = () => {
    setReceipt(null);
    setReceiptError("");
    const original = savedOriginalPrice ?? (row.isFreeRegistration ? 0 : null);
    setOriginalAmountInput(original === null ? "" : centsToInput(original));
    setAmountInput(
      row.paymentOrigin === "exemption"
        ? "0,00"
        : due
          ? centsToInput(due.dueCents)
          : original === null
            ? ""
            : centsToInput(original),
    );
    setReason(row.manualPaymentReason ?? "");
    setRafflePaidInput(row.adminRafflePaidCents ? centsToInput(row.adminRafflePaidCents) : "");
    setRemainder(row.paymentOrigin === "exemption" || row.isFreeRegistration ? "discount" : "pending");
    setConfirmMarkPaid(true);
  };
  const originalAmountCents = parseReceivedAmount(originalAmountInput);
  const receivedCents = parseReceivedAmount(amountInput);
  const rafflePending = getAdminRafflePending(row, state);
  const rafflePaidRaw =
    rafflePaidInput.trim() === "" ? undefined : parseReceivedAmount(rafflePaidInput);
  const rafflePaidError =
    rafflePaidInput.trim() !== "" && rafflePaidRaw === null
      ? "Informe um valor válido para as rifas."
      : "";
  const parsedRafflePaidCents = rafflePaidRaw ?? undefined;
  const showRafflePayment = row.isFreeRegistration || row.pricingType === "promotional";
  const dueCents = due?.mode === "balance"
    ? due.dueCents
    : row.paymentOrigin === "exemption" || !due
      ? originalAmountCents
      : due.dueCents;
  const leftoverCents =
    dueCents !== null && receivedCents !== null && receivedCents <= dueCents ? dueCents - receivedCents : 0;
  const amountError = originalAmountCents === null
    ? "Informe o valor original da inscrição."
    : receivedCents === null
      ? "Informe o valor recebido."
      : dueCents === null
        ? "Informe um valor pendente válido."
        : receivedCents > dueCents
          ? `O valor não pode ser maior que ${money(dueCents)}.`
          : leftoverCents > 0 && due?.canSplit === false && !row.isFreeRegistration
              ? "Esta inscrição só pode ser quitada pelo valor total."
              : "";
  const hasActions =
    Boolean(onEdit) ||
    row.hasManualReceipt ||
    (typeof openUrl === "string" && isSafeCheckoutUrl(openUrl)) ||
    canConfigurePayment ||
    due?.mode === "balance" ||
    (state.status === "partially_paid" && state.pendingCents > 0) ||
    access?.canReprocess ||
    access?.canReset ||
    Boolean(onDelete);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={busy || !hasActions}
            aria-label={`Mais ações para ${row.name}`}
          >
            <MoreHorizontal aria-hidden="true" className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <EventReportRoleAction registrationId={row.id} role={role} cancelled={Boolean(row.cancelledAt)} onChanged={onEventReportsChange} />
          <DropdownMenuSeparator />
          {onEdit && (
            <>
              <DropdownMenuItem onSelect={() => onEdit(row)}>
                <Pencil aria-hidden="true" /> Editar dados
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {row.hasManualReceipt && (
            <DropdownMenuItem onSelect={() => onViewReceipt(row)}>
              <ExternalLink aria-hidden="true" /> Ver comprovante
            </DropdownMenuItem>
          )}
          {openUrl && isSafeCheckoutUrl(openUrl) && (
            <DropdownMenuItem asChild>
              <a href={openUrl}>Continuar pagamento</a>
            </DropdownMenuItem>
          )}
          {state.status === "pending" && !row.isFreeRegistration && (
            <>
              <DropdownMenuItem onSelect={() => onPaymentLink(row)}>
                <Link2 aria-hidden="true" /> Gerar novo link de pagamento
              </DropdownMenuItem>
            </>
          )}
          {canConfigurePayment && (
            <DropdownMenuItem onSelect={openMarkPaid}>
              <BadgeCheck aria-hidden="true" /> Configurar pagamento
            </DropdownMenuItem>
          )}
          {state.status === "partially_paid" &&
            state.pendingCents > 0 &&
            !row.openComplementPayment && (
              <DropdownMenuItem onSelect={() => onBalancePayment(row)}>
                <Banknote aria-hidden="true" /> Pagar saldo de {money(state.pendingCents)}
              </DropdownMenuItem>
            )}
          {(access?.canReprocess || access?.canReset) && <DropdownMenuSeparator />}
          {access?.canReprocess && (
            <DropdownMenuItem onSelect={() => onReprocess(row)}>
              <RefreshCw aria-hidden="true" /> Reprocessar acesso
            </DropdownMenuItem>
          )}
          {access?.canReset && (
            <DropdownMenuItem onSelect={() => setConfirmReset(true)}>
              <KeyRound aria-hidden="true" /> Redefinir senha inicial
            </DropdownMenuItem>
          )}
          {onToggleAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!role?.hasAccount || (role.isAdmin && role.isSelf)}
                onSelect={() => setConfirmAdmin(true)}
              >
                {role?.isAdmin ? (
                  <ShieldOff aria-hidden="true" />
                ) : (
                  <ShieldCheck aria-hidden="true" />
                )}
                <span className="flex flex-col">
                  {role?.isAdmin ? "Remover administrador" : "Tornar administrador"}
                  {!role?.hasAccount && (
                    <span className="text-xs text-muted-foreground">
                      Libere o acesso do participante primeiro.
                    </span>
                  )}
                </span>
              </DropdownMenuItem>
            </>
          )}
          {onCancel && !row.cancelledAt && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => {
                  setRefundInput("0,00");
                  setConfirmCancel(true);
                }}
              >
                <Ban aria-hidden="true" /> Cancelar inscrição
              </DropdownMenuItem>
            </>
          )}
          {onDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => {
                  setDeleteCpf("");
                  setConfirmDelete(true);
                }}
              >
                <Trash2 aria-hidden="true" /> Excluir inscrição
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {row.openComplementPayment &&
        !(typeof openUrl === "string" && isSafeCheckoutUrl(openUrl)) && (
          <span className="sr-only">Pagamento em processamento</span>
        )}
      <AlertDialog
        open={confirmMarkPaid}
        onOpenChange={(open) => {
          setConfirmMarkPaid(open);
          if (!open) {
            setReceipt(null);
            setReceiptError("");
          }
        }}
      >
        <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Configurar pagamento da inscrição
            </AlertDialogTitle>
            <AlertDialogDescription>
              Valor original: {money(originalAmountCents)}. Registre quanto foi recebido e escolha se o saldo fica pendente ou recebe isenção.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`payment-original-${row.id}`}>Valor original da inscrição (R$)</Label>
              <Input
                id={`payment-original-${row.id}`}
                inputMode="decimal"
                autoComplete="off"
                value={originalAmountInput}
                disabled={busy || (savedOriginalPrice !== null && row.paymentOrigin !== "exemption")}
                onChange={(event) => setOriginalAmountInput(event.target.value)}
              />
              {row.paymentOrigin === "exemption" && savedOriginalPrice === null && (
                <p className="text-xs text-muted-foreground">O valor anterior não foi preservado. Informe o valor original para registrar o pagamento.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`payment-amount-${row.id}`}>Valor recebido (R$)</Label>
              <Input
                id={`payment-amount-${row.id}`}
                inputMode="decimal"
                autoComplete="off"
                value={amountInput}
                disabled={busy}
                aria-invalid={Boolean(amountError)}
                aria-describedby={`payment-amount-help-${row.id}`}
                onChange={(event) => setAmountInput(event.target.value)}
              />
              <p id={`payment-amount-help-${row.id}`} className={amountError ? "text-sm text-destructive" : "text-xs text-muted-foreground"}>
                {amountError ||
                  (leftoverCents > 0
                    ? `Restante: ${money(leftoverCents)}`
                    : "Valor total: a taxa de inscrição fica quitada.")}
              </p>
            </div>
            {showRafflePayment && (
              <div className="space-y-2">
                <Label htmlFor={`payment-raffle-${row.id}`}>Rifas pagas (R$)</Label>
                <Input
                  id={`payment-raffle-${row.id}`}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0,00"
                  value={rafflePaidInput}
                  disabled={busy}
                  aria-invalid={Boolean(rafflePaidError)}
                  aria-describedby={`payment-raffle-help-${row.id}`}
                  onChange={(event) => setRafflePaidInput(event.target.value)}
                />
                <p
                  id={`payment-raffle-help-${row.id}`}
                  className={rafflePaidError ? "text-sm text-destructive" : "text-xs text-muted-foreground"}
                >
                  {rafflePaidError ||
                    (rafflePending
                      ? `Pendente em rifas: ${formatAdminRafflePending(rafflePending)}. Informe quanto foi recebido manualmente.`
                      : "Informe quanto foi recebido manualmente pelas rifas.")}
                </p>
              </div>
            )}
            {leftoverCents > 0 && !amountError && (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-foreground">
                  O que fazer com o restante de {money(leftoverCents)}?
                </legend>
                <RadioGroup
                  value={remainder}
                  onValueChange={(value) => setRemainder(value as ManualPaymentRemainder)}
                  disabled={busy}
                >
                  <label
                    htmlFor={`remainder-pending-${row.id}`}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                  >
                    <RadioGroupItem id={`remainder-pending-${row.id}`} value="pending" className="mt-0.5" />
                    <span className="space-y-0.5">
                      <span className="block text-sm font-medium text-foreground">Deixar pendente</span>
                      <span className="block text-xs text-muted-foreground">
                        A inscrição fica parcialmente paga e o restante continua a receber.
                      </span>
                    </span>
                  </label>
                  <label
                    htmlFor={`remainder-discount-${row.id}`}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                  >
                    <RadioGroupItem id={`remainder-discount-${row.id}`} value="discount" className="mt-0.5" />
                    <span className="space-y-0.5">
                      <span className="block text-sm font-medium text-foreground">
                        Isentar o restante
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        Registra isenção total ou parcial da taxa de inscrição.
                      </span>
                    </span>
                  </label>
                </RadioGroup>
              </fieldset>
            )}
            <div className="space-y-2">
              <Label htmlFor={`payment-reason-${row.id}`}>Justificativa (opcional)</Label>
              <Textarea id={`payment-reason-${row.id}`} value={reason} maxLength={500} disabled={busy} onChange={(event) => setReason(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`payment-receipt-${row.id}`}>Comprovante (opcional)</Label>
              <Input
                id={`payment-receipt-${row.id}`}
                type="file"
                accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                disabled={busy}
                onChange={(event) => void selectReceipt(event)}
              />
              {receipt && (
                <p className="text-xs text-muted-foreground">
                  Arquivo selecionado: {receipt.fileName}
                </p>
              )}
              {receiptError && (
                <p role="alert" className="text-sm text-destructive">
                  {receiptError}
                </p>
              )}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || Boolean(amountError) || Boolean(rafflePaidError) || receivedCents === null || (receivedCents === 0 && remainder !== "discount") || (receivedCents > 0 && Boolean(receiptError))}
              onClick={(event) => {
                event.preventDefault();
                if (receivedCents === null || originalAmountCents === null || amountError || rafflePaidError || (receivedCents === 0 && remainder !== "discount")) return;
                void onMarkPaid(row, receipt ?? undefined, {
                  amountCents: receivedCents,
                  remainder,
                  originalRegistrationPriceCents: originalAmountCents,
                  rafflePaidCents: parsedRafflePaidCents,
                  reason,
                }).then(
                  (success) => {
                    if (success) setConfirmMarkPaid(false);
                  },
                );
              }}
            >
              {receivedCents === 0 && remainder === "discount" ? "Registrar isenção" : "Salvar configuração"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Redefinir senha inicial?</AlertDialogTitle>
            <AlertDialogDescription>
              A pessoa poderá usar novamente a senha inicial no próximo acesso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() => void onReset(row).then(() => setConfirmReset(false))}
            >
              Confirmar redefinição
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {onCancel && !row.cancelledAt && (
        <AlertDialog
          open={confirmCancel}
          onOpenChange={(open) => {
            setConfirmCancel(open);
            if (!open) setRefundInput("");
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar inscrição?</AlertDialogTitle>
              <AlertDialogDescription>
                A inscrição de {row.name} passará para <strong>Cancelada</strong>. O valor já
                recebido permanece no saldo do coro, menos a devolução informada abaixo. Use
                <strong> 0,00</strong> quando não houver devolução.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <label htmlFor={`refund-${row.id}`} className="text-sm font-medium">
                Valor devolvido ao participante (R$)
              </label>
              <input
                id={`refund-${row.id}`}
                inputMode="decimal"
                autoComplete="off"
                value={refundInput}
                onChange={(event) => setRefundInput(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-xs text-muted-foreground">
                Status de pagamento intacto: só a situação administrativa muda.
              </p>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Voltar</AlertDialogCancel>
              <AlertDialogAction
                disabled={busy}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(event) => {
                  event.preventDefault();
                  const refundCents = parseReceivedAmount(refundInput);
                  if (refundCents === null) return;
                  void onCancel(row, refundCents).then((success) => {
                    if (success) {
                      setConfirmCancel(false);
                      setRefundInput("");
                    }
                  });
                }}
              >
                Cancelar inscrição
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {onDelete && (
        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir inscrição definitivamente?</AlertDialogTitle>
              <AlertDialogDescription>
                A inscrição de {row.name}, seus pagamentos, presenças, foto, comprovante e o
                acesso à área do participante serão apagados. Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <label htmlFor={`delete-cpf-${row.id}`} className="text-sm font-medium">
                Digite o CPF do participante para confirmar
              </label>
              <input
                id={`delete-cpf-${row.id}`}
                inputMode="numeric"
                autoComplete="off"
                maxLength={14}
                value={deleteCpf}
                onChange={(event) => setDeleteCpf(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={busy || deleteCpf.replace(/\D/g, "").length !== 11}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(event) => {
                  event.preventDefault();
                  void onDelete(row, deleteCpf).then((success) => {
                    if (success) setConfirmDelete(false);
                  });
                }}
              >
                Excluir definitivamente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {onToggleAdmin && (
        <AlertDialog open={confirmAdmin} onOpenChange={setConfirmAdmin}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {role?.isAdmin ? "Remover administrador?" : "Tornar administrador?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {role?.isAdmin
                  ? `${row.name} perderá o acesso à administração. A inscrição e a área do participante continuam iguais.`
                  : `${row.name} poderá acessar a administração com o mesmo login da área do participante.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={busy}
                onClick={() =>
                  void onToggleAdmin(row, !role?.isAdmin).then(() => setConfirmAdmin(false))
                }
              >
                {role?.isAdmin ? "Remover administrador" : "Tornar administrador"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

const editBlank = (value: string | null | undefined) =>
  !value || value === "Não informado" ? "" : value;

const OTHER_CHOIR_VALUE = "other";

function EditRegistrationDialog({
  row,
  choirs,
  busy,
  onOpenChange,
  onSave,
}: {
  row: AdminRegistrationRow | null;
  choirs: PublicChoirOption[];
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: AdminUpdateRegistrationInput) => Promise<string | null>;
}) {
  return (
    <Dialog open={row !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar dados da inscrição</DialogTitle>
          <DialogDescription>
            Corrija os dados cadastrais de {row?.name}. Valores, pagamento e foto não são
            alterados aqui.
          </DialogDescription>
        </DialogHeader>
        {row && (
          <EditRegistrationForm
            key={row.id}
            row={row}
            choirs={choirs}
            busy={busy}
            onSave={onSave}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditRegistrationForm({
  row,
  choirs,
  busy,
  onSave,
  onClose,
}: {
  row: AdminRegistrationRow;
  choirs: PublicChoirOption[];
  busy: boolean;
  onSave: (input: AdminUpdateRegistrationInput) => Promise<string | null>;
  onClose: () => void;
}) {
  const validDiocese = dioceseOptions.some((option) => option.value === row.diocese)
    ? (row.diocese as Diocese)
    : dioceseOptions[0].value;
  const validProfile = musicalProfileOptions.some((option) => option.value === row.musicalProfile)
    ? (row.musicalProfile as MusicalProfile)
    : "coralista";
  const validVoicePart = voicePartOptions.some((option) => option.value === row.voicePart)
    ? (row.voicePart as VoicePart)
    : "";
  const validGender = genderOptions.some((option) => option.value === row.gender)
    ? (row.gender as Gender)
    : "nao_informado";

  const [name, setName] = useState(row.name);
  const [badgeName, setBadgeName] = useState(row.badgeName ?? "");
  const [cpf, setCpf] = useState(row.cpf);
  const [email, setEmail] = useState(editBlank(row.email));
  const [phone, setPhone] = useState(row.phone);
  const [birthDate, setBirthDate] = useState(row.birthDate);
  const [diocese, setDiocese] = useState<Diocese>(validDiocese);
  const [choirChoice, setChoirChoice] = useState(row.choirId ?? OTHER_CHOIR_VALUE);
  const [otherChoirName, setOtherChoirName] = useState(
    row.otherChoirName ?? (row.choirId ? "" : row.choirName),
  );
  const [city, setCity] = useState(editBlank(row.city));
  const [institution, setInstitution] = useState(editBlank(row.institution));
  const [role, setRole] = useState(editBlank(row.role));
  const [musicalProfile, setMusicalProfile] = useState<MusicalProfile>(validProfile);
  const [gender, setGender] = useState<Gender>(validGender);
  const [voicePart, setVoicePart] = useState<VoicePart | "">(validVoicePart);
  const [observations, setObservations] = useState(editBlank(row.observations));
  const [error, setError] = useState("");

  const choirOptions =
    row.choirId && !choirs.some((choir) => choir.id === row.choirId)
      ? [...choirs, { id: row.choirId, name: row.choirName } as PublicChoirOption]
      : choirs;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    const parsed = adminUpdateRegistrationFormSchema.safeParse({
      registrationId: row.id,
      name,
      badgeName: badgeName.trim() === "" ? null : badgeName,
      cpf,
      email,
      phone,
      birthDate,
      diocese,
      choirId: choirChoice === OTHER_CHOIR_VALUE ? null : choirChoice,
      otherChoirName: choirChoice === OTHER_CHOIR_VALUE ? otherChoirName : null,
      city,
      institution,
      role,
      musicalProfile,
      gender,
      voicePart: musicalProfile === "coralista" && voicePart !== "" ? voicePart : null,
      observations,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revise os dados informados.");
      return;
    }
    const failure = await onSave(parsed.data);
    if (failure) {
      setError(failure);
      return;
    }
    onClose();
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="edit-name">Nome completo</Label>
          <Input
            id="edit-name"
            value={name}
            maxLength={100}
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-badge-name">Nome no crachá</Label>
          <Input
            id="edit-badge-name"
            value={badgeName}
            maxLength={60}
            disabled={busy}
            onChange={(event) => setBadgeName(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-cpf">CPF</Label>
          <Input
            id="edit-cpf"
            inputMode="numeric"
            value={cpf}
            maxLength={14}
            disabled={busy}
            onChange={(event) => setCpf(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-email">E-mail</Label>
          <Input
            id="edit-email"
            type="email"
            value={email}
            maxLength={254}
            disabled={busy}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-phone">WhatsApp</Label>
          <Input
            id="edit-phone"
            inputMode="tel"
            value={phone}
            maxLength={30}
            disabled={busy}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-birth-date">Data de nascimento</Label>
          <Input
            id="edit-birth-date"
            type="date"
            value={birthDate}
            disabled={busy}
            onChange={(event) => setBirthDate(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-diocese">Diocese</Label>
          <Select
            value={diocese}
            disabled={busy}
            onValueChange={(value) => setDiocese(value as Diocese)}
          >
            <SelectTrigger id="edit-diocese">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dioceseOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-choir">Coro</Label>
          <Select value={choirChoice} disabled={busy} onValueChange={setChoirChoice}>
            <SelectTrigger id="edit-choir">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {choirOptions.map((choir) => (
                <SelectItem key={choir.id} value={choir.id}>
                  {choir.name}
                </SelectItem>
              ))}
              <SelectItem value={OTHER_CHOIR_VALUE}>Outro coro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {choirChoice === OTHER_CHOIR_VALUE && (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="edit-other-choir">Nome do outro coro</Label>
            <Input
              id="edit-other-choir"
              value={otherChoirName}
              maxLength={120}
              disabled={busy}
              onChange={(event) => setOtherChoirName(event.target.value)}
            />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="edit-city">Cidade</Label>
          <Input
            id="edit-city"
            value={city}
            maxLength={100}
            disabled={busy}
            onChange={(event) => setCity(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-institution">Instituição</Label>
          <Input
            id="edit-institution"
            value={institution}
            maxLength={120}
            disabled={busy}
            onChange={(event) => setInstitution(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-role">Função</Label>
          <Input
            id="edit-role"
            value={role}
            maxLength={60}
            disabled={busy}
            onChange={(event) => setRole(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-musical-profile">Perfil musical</Label>
          <Select
            value={musicalProfile}
            disabled={busy}
            onValueChange={(value) => setMusicalProfile(value as MusicalProfile)}
          >
            <SelectTrigger id="edit-musical-profile">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {musicalProfileOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-gender">Gênero</Label>
          <Select
            value={gender}
            disabled={busy}
            onValueChange={(value) => setGender(value as Gender)}
          >
            <SelectTrigger id="edit-gender">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {genderOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {musicalProfile === "coralista" && (
          <div className="space-y-2">
            <Label htmlFor="edit-voice-part">Naipe vocal</Label>
            <Select
              value={voicePart}
              disabled={busy}
              onValueChange={(value) => setVoicePart(value as VoicePart)}
            >
              <SelectTrigger id="edit-voice-part">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {voicePartOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="edit-observations">Observações</Label>
          <Textarea
            id="edit-observations"
            value={observations}
            maxLength={500}
            rows={3}
            disabled={busy}
            onChange={(event) => setObservations(event.target.value)}
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Salvando…" : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}

/**
 * Summary of the meeting: registration counters, financial totals and the
 * financial breakdown per choir/diocese. It lives inside the registrations
 * screen so the administration has a single place for every indicator.
 */
const RegistrationSummaryCards = memo(function RegistrationSummaryCards({
  summary,
  prepareChoirPdf,
  onChoirSettled,
}: {
  summary: AdminRegistrationSummary;
  prepareChoirPdf: PrepareChoirPdf;
  onChoirSettled: () => void;
}) {
  const raffleReceivedCents = summary.rafflePaidCents ?? 0;
  const registrationReceivedCents = summary.receivedCents - raffleReceivedCents;
  const counters = [
    {
      label: "Inscrições",
      value: String(summary.total),
      detail: "Todas as inscrições cadastradas",
      icon: Users,
    },
    {
      label: "Pagamentos confirmados",
      value: String(summary.paid),
      detail: `${summary.paid} ${summary.paid === 1 ? "inscrição paga" : "inscrições pagas"}`,
      icon: CheckCircle2,
    },
    {
      label: "Pagamentos pendentes",
      value: String(summary.pending),
      detail: "Taxa de inscrição aguardando",
      icon: Clock3,
    },
    {
      label: "Inscrições isentas",
      value: String(summary.exempt ?? 0),
      detail: "Sem taxa de inscrição",
      icon: CircleOff,
    },
    {
      label: "Históricas",
      value: String(summary.legacy),
      detail: "Sem histórico de pagamento",
      icon: History,
    },
    {
      label: "Canceladas",
      value: String(summary.cancelled ?? 0),
      detail: "Canceladas pela administração",
      icon: Ban,
    },
  ];
  const financial = [
    {
      label: "Total recebido",
      value: money(summary.receivedCents),
      icon: Banknote,
      details: [
        { label: "Inscrições", value: money(registrationReceivedCents) },
        { label: "Rifas", value: money(raffleReceivedCents) },
        ...(summary.refundedCents
          ? [{ label: "Devoluções", value: `− ${money(summary.refundedCents)}` }]
          : []),
      ],
    },
    {
      label: "Pendente taxa de inscrição",
      value: money(summary.pendingCents),
      icon: Clock3,
    },
    {
      label: "Pendente em rifas",
      value: money(summary.rafflePendingCents ?? 0),
      detail: formatAdminRafflePending({
        cents: summary.rafflePendingCents ?? 0,
        tickets: summary.rafflePendingTickets ?? null,
      }),
      icon: Clock3,
    },
    {
      label: "Total previsto",
      value: money(summary.expectedCents),
      detail: "Recebido + taxas + rifas pendentes",
      icon: ChartNoAxesCombined,
    },
  ];
  return (
    <div className="space-y-2">
      <section
        aria-label="Indicadores do encontro"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
      >
        {counters.map((metric) => (
          <InternalMetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            detail={metric.detail}
            icon={metric.icon}
            dense
          />
        ))}
      </section>
      <div
        role="group"
        aria-label="Resumo financeiro"
        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
      >
        {financial.map((metric) => (
          <InternalMetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            detail={metric.detail}
            details={metric.details}
            icon={metric.icon}
            dense
          />
        ))}
      </div>
      <section aria-label="Visão geral das inscrições" className="space-y-1.5">
        <h2 className="text-xs font-semibold">Financeiro por coro/diocese</h2>
        {summary.byChoir.length ? (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {summary.byChoir.map((item) => (
              <AdminChoirSummaryCard
                key={item.choirName}
                item={item}
                preparePdf={prepareChoirPdf}
                onSettled={onChoirSettled}
              />
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum coro/diocese com inscrições.</p>
        )}
      </section>
    </div>
  );
});

const LIST_CACHE_TTL_MS = 60_000;

export function AdminRegistrationsPage({
  onSignedOut,
  onMissingSession,
  checkAdmin = getAdminAccess,
  loadInitialData,
  loadRegistrations = listAdminRegistrations,
  loadSummary = getAdminRegistrationSummary,
  loadPhotos = getAdminRegistrationPhotos,
  exportRegistrations = exportAdminRegistrations,
  exportPdfRegistrations,
  createPaymentLink = createAdminRegistrationCheckoutLink,
  markPaid = markAdminRegistrationPaid,
  deleteRegistration = deleteAdminRegistration,
  getReceiptUrl = getAdminRegistrationReceipt,
  openReceiptUrl = defaultOpenReceiptUrl,
  copyToClipboard = defaultCopyToClipboard,
  reprocessAccess = reprocessParticipantAccess,
  resetInitialPassword = resetParticipantInitialPassword,
  startBalanceCheckout,
  startCheckout,
  navigateToCheckout,
  getSession = defaultGetSession,
  signOut = defaultSignOut,
  navigateTo,
  updateRegistration = updateAdminRegistration,
  loadChoirs = getPublicRegistrationConfiguration,
  loadRoles = listAdminRegistrationRoles,
  grantAdmin = grantAdminFromRegistration,
  revokeAdmin = revokeAdminFromRegistration,
}: Props) {
  const exportPdfFn = useServerFn(exportAdminRegistrationsPdf);
  const preparePdf = exportPdfRegistrations ?? exportPdfFn;
  const [pdfFile, setPdfFile] = useState<{ blob: Blob; fileName: string; filterKey: string } | null>(null);
  const pdfRevision = useRef(0);
  const openBalanceCheckout = startBalanceCheckout ?? startCheckout ?? startComplementCheckout;
  const [gate, setGate] = useState<
    "checking" | "authorized" | "forbidden" | "error" | "expired" | "leaving"
  >("checking");
  const [gateErrorMessage, setGateErrorMessage] = useState("");
  const [result, setResult] = useState<AdminRegistrationPage | null>(null);
  const whatsApp = useAdminWhatsApp(gate === "authorized", result?.rows);
  const [whatsAppStatusFilter, setWhatsAppStatusFilter] = useState<"all" | "received" | "sent" | "pending" | "failed" | "review">("all");
  const whatsAppFilteredRows = (result?.rows ?? []).filter((row) => {
    if (whatsAppStatusFilter === "all") return true;
    const delivery = whatsApp.status.registrations[row.id] ?? "pending";
    return delivery === whatsAppStatusFilter;
  });
  const [summary, setSummary] = useState<AdminRegistrationSummary | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const filterKey = JSON.stringify([query.search, query.paymentStatus, query.choirId, query.musicalProfile, query.loginStatus]);
  const [searchDraft, setSearchDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [summaryError, setSummaryError] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [exporting, setExporting] = useState(false);
  const [participantActionBusy, setParticipantActionBusy] = useState(false);
  const [balanceTarget, setBalanceTarget] = useState<AdminRegistrationRow | null>(null);
  const [editTarget, setEditTarget] = useState<AdminRegistrationRow | null>(null);
  const [editChoirs, setEditChoirs] = useState<PublicChoirOption[]>([]);
  const [roles, setRoles] = useState<Record<string, RegistrationAdminRole>>({});
  const [rolesRetry, setRolesRetry] = useState(0);
  const [retry, setRetry] = useState(0);
  const listCache = useRef(new Map<string, { at: number; page: AdminRegistrationPage }>());
  const cacheRetry = useRef(0);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const requestedPhotos = useRef(new Set<string>());
  useEffect(() => {
    if (!result) return;
    const missing = result.rows
      .filter((row) => !row.photoUrl && !requestedPhotos.current.has(row.id))
      .map((row) => row.id);
    if (missing.length === 0) return;
    for (const id of missing) requestedPhotos.current.add(id);
    // Photos load after the table so signing never delays the list.
    void Promise.resolve()
      .then(() => loadPhotos({ data: { registrationIds: missing } }))
      .then((urls) => {
        if (urls && Object.keys(urls).length) setPhotoUrls((current) => ({ ...current, ...urls }));
      })
      .catch(() => {
        for (const id of missing) requestedPhotos.current.delete(id);
      });
  }, [loadPhotos, result]);
  useEffect(() => {
    pdfRevision.current += 1;
    setPdfFile(null);
  }, [filterKey, gate, retry]);
  const roleRowIds = result?.rows.map((row) => row.id).join(",") ?? "";
  useEffect(() => {
    if (gate !== "authorized" || !roleRowIds) return;
    let active = true;
    loadRoles({ data: { registrationIds: roleRowIds.split(",") } })
      .then((value) => {
        if (active) setRoles(value ?? {});
      })
      .catch(() => {
        if (active) setRoles({});
      });
    return () => {
      active = false;
    };
  }, [gate, roleRowIds, rolesRetry, loadRoles]);
  useEffect(() => {
    if (gate !== "authorized" || editChoirs.length > 0) return;
    let active = true;
    loadChoirs()
      .then((configuration) => {
        if (active) setEditChoirs(configuration.choirs);
      })
      .catch(() => {
        if (active) setEditChoirs([]);
      });
    return () => {
      active = false;
    };
  }, [gate, editChoirs.length, loadChoirs]);
  const [summaryRetry, setSummaryRetry] = useState(0);
  const refreshSummary = useCallback(() => setSummaryRetry((value) => value + 1), []);
  const [bootstrapDataReady, setBootstrapDataReady] = useState(false);
  const actionBusy = useRef(false);
  const revision = useRef(0);
  const invalidateAccess = useCallback(() => {
    revision.current++;
  }, []);

  const verifyAccess = useCallback(async () => {
    const current = ++revision.current;
    setGate("checking");
    setResult(null);
    setSummary(null);
    try {
      const access = await checkAdmin();
      if (current === revision.current) {
        setGateErrorMessage("");
        setGate(access.status);
      }
    } catch (error) {
      try {
        const session = await getSession();
        if (current !== revision.current) return;
        if (!session.error && !session.data.session) {
          setGate("expired");
          onMissingSession();
          return;
        }
      } catch {
        /* An unavailable local session cannot authorize or prove expiry. */
      }
      if (current === revision.current) {
        setGateErrorMessage(getAdminAccessErrorMessage(error));
        setGate("error");
      }
    }
  }, [checkAdmin, getSession, onMissingSession]);

  useEffect(() => {
    if (loadInitialData) {
      let active = true;
      setGate("checking");
      setLoading(true);
      setSummaryLoading(true);
      setListError("");
      setSummaryError("");
      // Without a local session the protected server fn would 401 and blank the page.
      const bootstrap = async () => {
        try {
          const session = await getSession();
          if (!session.error && !session.data.session) return null;
        } catch {
          /* An unavailable local session cannot prove expiry; try the server call. */
        }
        return loadInitialData();
      };
      void bootstrap()
        .then((result) => {
          if (!active) return;
          if (!result) {
            setGate("expired");
            onMissingSession();
            return;
          }
          if (result.access.status !== "authorized" || !result.data) {
            setGate(result.access.status);
            return;
          }
          setGateErrorMessage("");
          setResult(result.data.registrations);
          setSummary(result.data.summary);
          setBootstrapDataReady(true);
          setGate("authorized");
        })
        .catch(async (error) => {
          if (!active) return;
          try {
            const session = await getSession();
            if (!active) return;
            if (!session.error && !session.data.session) {
              setGate("expired");
              onMissingSession();
              return;
            }
          } catch {
            /* An unavailable local session cannot authorize or prove expiry. */
          }
          setGateErrorMessage(getAdminAccessErrorMessage(error));
          setGate("error");
        })
        .finally(() => {
          if (!active) return;
          setLoading(false);
          setSummaryLoading(false);
        });
      return () => {
        active = false;
      };
    }
    void verifyAccess();
    return invalidateAccess;
  }, [getSession, invalidateAccess, loadInitialData, onMissingSession, verifyAccess]);

  useEffect(() => {
    if (gate !== "authorized") return;
    if (loadInitialData && bootstrapDataReady && retry === 0 && query === initialQuery) return;
    let active = true;
    if (cacheRetry.current !== retry) {
      // Any administrative action bumps `retry`; cached pages may be outdated.
      listCache.current.clear();
      cacheRetry.current = retry;
    }
    const key = JSON.stringify(query);
    const cached = listCache.current.get(key);
    const fresh = cached && Date.now() - cached.at < LIST_CACHE_TTL_MS;
    if (fresh) setResult(cached.page);
    setLoading(!fresh);
    setListError("");
    if (fresh) return;
    void (async () => {
      try {
        const next = await loadRegistrations({ data: query });
        listCache.current.set(key, { at: Date.now(), page: next });
        if (active) setResult(next);
      } catch {
        try {
          const session = await getSession();
          if (!active) return;
          if (!session.error && !session.data.session) {
            setGate("expired");
            onMissingSession();
            return;
          }
        } catch {
          /* Keep transient failures retryable. */
        }
        if (active) setListError("Não foi possível carregar as inscrições. Tente novamente.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [
    bootstrapDataReady,
    gate,
    getSession,
    loadInitialData,
    loadRegistrations,
    onMissingSession,
    query,
    retry,
  ]);

  useEffect(() => {
    if (gate !== "authorized") return;
    if (loadInitialData && bootstrapDataReady && summaryRetry === 0) return;
    let active = true;
    setSummaryLoading(true);
    setSummaryError("");
    void loadSummary()
      .then((next) => {
        if (active) setSummary(next);
      })
      .catch(() => {
        if (active) setSummaryError("Não foi possível carregar os totais. Tente novamente.");
      })
      .finally(() => {
        if (active) setSummaryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [bootstrapDataReady, gate, loadInitialData, loadSummary, summaryRetry]);

  function search(event: FormEvent) {
    event.preventDefault();
    if (loading || actionBusy.current) return;
    setAnnouncement("");
    setQuery((previous) => ({ ...previous, search: searchDraft.trim(), page: 1 }));
  }

  async function exportPdf() {
    if (actionBusy.current || loading || gate !== "authorized") return;
    actionBusy.current = true;
    const current = pdfRevision.current;
    setExporting(true);
    setActionError("");
    setPdfFile(null);
    try {
      const file = await preparePdf({ data: {
        search: query.search, paymentStatus: query.paymentStatus,
        choirId: query.choirId, musicalProfile: query.musicalProfile, loginStatus: query.loginStatus,
      } });
      if (current !== pdfRevision.current) return;
      const bytes = Uint8Array.from(atob(file.base64), (char) => char.charCodeAt(0));
      setPdfFile({ blob: new Blob([bytes], { type: "application/pdf" }), fileName: file.fileName, filterKey });
      setAnnouncement("PDF pronto para baixar.");
    } catch {
      if (current === pdfRevision.current) setActionError("Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      actionBusy.current = false;
      setExporting(false);
    }
  }

  async function exportCsv() {
    if (actionBusy.current || loading || gate !== "authorized") return;
    actionBusy.current = true;
    const current = revision.current;
    setExporting(true);
    setActionError("");
    setAnnouncement("");
    try {
      const file = await exportRegistrations({
        data: {
          search: query.search,
          paymentStatus: query.paymentStatus,
          choirId: query.choirId,
          musicalProfile: query.musicalProfile,
          loginStatus: query.loginStatus,
        },
      });
      if (current !== revision.current) return;
      const url = URL.createObjectURL(new Blob([file.content], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      try {
        anchor.href = url;
        anchor.download = file.fileName;
        document.body.appendChild(anchor);
        anchor.click();
      } finally {
        anchor.remove();
        URL.revokeObjectURL(url);
      }
      setAnnouncement("CSV exportado.");
    } catch {
      if (current === revision.current)
        setActionError("Não foi possível exportar. Tente novamente.");
    } finally {
      actionBusy.current = false;
      if (current === revision.current) setExporting(false);
    }
  }

  async function runToggleAdmin(row: AdminRegistrationRow, makeAdmin: boolean): Promise<void> {
    if (actionBusy.current || gate !== "authorized") return;
    actionBusy.current = true;
    setParticipantActionBusy(true);
    setActionError("");
    setAnnouncement("");
    try {
      await (makeAdmin ? grantAdmin : revokeAdmin)({ data: { registrationId: row.id } });
      setAnnouncement(
        makeAdmin
          ? `${row.name} agora é administrador.`
          : `${row.name} não é mais administrador.`,
      );
      setRolesRetry((value) => value + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const known = [
        "Libere o acesso do participante primeiro.",
        "Você não pode remover seu próprio acesso.",
        "É preciso manter pelo menos um administrador.",
      ];
      setActionError(
        known.includes(message) ? message : "Não foi possível concluir. Tente novamente.",
      );
    } finally {
      actionBusy.current = false;
      setParticipantActionBusy(false);
    }
  }

  async function runParticipantAction(
    row: AdminRegistrationRow,
    action: "reprocess" | "reset",
  ): Promise<void> {
    if (actionBusy.current || gate !== "authorized") return;
    actionBusy.current = true;
    setParticipantActionBusy(true);
    setActionError("");
    setAnnouncement("");
    try {
      if (action === "reprocess") {
        await reprocessAccess({ data: { registrationId: row.id } });
        setAnnouncement("Acesso reprocessado.");
      } else {
        const result = await resetInitialPassword({ data: { registrationId: row.id } });
        if (result.sessionsRevoked !== false) throw new Error("Unexpected reset result");
        setAnnouncement("Senha redefinida. Sessões que já estavam abertas não foram encerradas.");
      }
      setRetry((value) => value + 1);
    } catch {
      setActionError("Não foi possível atualizar o acesso. Tente novamente.");
    } finally {
      actionBusy.current = false;
      setParticipantActionBusy(false);
    }
  }

  async function runPaymentLinkAction(row: AdminRegistrationRow): Promise<void> {
    if (actionBusy.current || gate !== "authorized") return;
    actionBusy.current = true;
    setParticipantActionBusy(true);
    setActionError("");
    setAnnouncement("");
    try {
      const result = await createPaymentLink({ data: { registrationId: row.id } });
      if (!isSafeCheckoutUrl(result.checkoutUrl)) throw new Error("unsafe checkout URL");
      await copyToClipboard(result.checkoutUrl);
      setAnnouncement(
        result.reused ? "Link de pagamento copiado." : "Novo link de pagamento gerado e copiado.",
      );
    } catch {
      setActionError("Não foi possível gerar o link de pagamento. Tente novamente.");
    } finally {
      actionBusy.current = false;
      setParticipantActionBusy(false);
    }
  }

  async function runMarkPaidAction(
    row: AdminRegistrationRow,
    receipt: ManualPaymentReceipt | undefined,
    payment: ManualPaymentChoice,
  ): Promise<boolean> {
    if (actionBusy.current || gate !== "authorized") return false;
    actionBusy.current = true;
    setParticipantActionBusy(true);
    setActionError("");
    setAnnouncement("");
    try {
      const due = manualPaymentDue(row);
      if (!due) {
        // Only raffle payments can be recorded here without touching the
        // registration fee.
        if (payment.rafflePaidCents !== undefined) {
          await setAdminRegistrationRafflePaid({
            data: {
              registrationId: row.id,
              rafflePaidCents: payment.rafflePaidCents ?? null,
            },
          });
        }
        setAnnouncement("Pagamento de rifas registrado.");
        setRetry((value) => value + 1);
        setSummaryRetry((value) => value + 1);
        return true;
      }
      const result = await markPaid({
        data: {
          registrationId: row.id,
          receipt,
          amountCents: payment.amountCents,
          remainder: payment.remainder,
          originalRegistrationPriceCents: payment.originalRegistrationPriceCents,
          rafflePaidCents: payment.rafflePaidCents,
          reason: payment.reason,
        },
      });
      if (result.status !== "paid") throw new Error("Unexpected payment result");
      const received = result.receivedCents ?? payment.amountCents;
      setAnnouncement(
        received === 0 && manualPaymentDue(row)?.mode !== "balance" && (result.discountCents ?? 0) > 0
          ? `Isenção total de ${money(result.discountCents ?? 0)} registrada.`
          : (result.pendingCents ?? 0) > 0
          ? `Pagamento de ${money(received)} registrado. Restam ${money(result.pendingCents ?? 0)} da taxa de inscrição.`
          : (result.discountCents ?? 0) > 0
            ? `Pagamento de ${money(received)} registrado com desconto de ${money(result.discountCents ?? 0)}.`
            : "Inscrição marcada como paga.",
      );
      setRetry((value) => value + 1);
      setSummaryRetry((value) => value + 1);
      return true;
    } catch {
      setActionError("Não foi possível marcar a inscrição como paga. Tente novamente.");
      return false;
    } finally {
      actionBusy.current = false;
      setParticipantActionBusy(false);
    }
  }

  async function runDeleteAction(row: AdminRegistrationRow, cpf: string): Promise<boolean> {
    if (actionBusy.current || gate !== "authorized") return false;
    actionBusy.current = true;
    setParticipantActionBusy(true);
    setActionError("");
    setAnnouncement("");
    try {
      const result = await deleteRegistration({ data: { registrationId: row.id, cpf } });
      if (result.status === "cpf_mismatch") {
        setActionError("O CPF informado não confere com o da inscrição.");
        return false;
      }
      setAnnouncement(`Inscrição de ${row.name} excluída.`);
      setRetry((value) => value + 1);
      setSummaryRetry((value) => value + 1);
      return true;
    } catch {
      setActionError("Não foi possível excluir a inscrição. Tente novamente.");
      return false;
    } finally {
      actionBusy.current = false;
      setParticipantActionBusy(false);
    }
  }

  async function runCancelAction(
    row: AdminRegistrationRow,
    refundCents: number,
  ): Promise<boolean> {
    if (actionBusy.current || gate !== "authorized") return false;
    actionBusy.current = true;
    setParticipantActionBusy(true);
    setActionError("");
    setAnnouncement("");
    try {
      await cancelAdminRegistration({
        data: { registrationId: row.id, refundCents },
      });
      setAnnouncement(
        refundCents > 0
          ? `Inscrição de ${row.name} cancelada com devolução de ${money(refundCents)}.`
          : `Inscrição de ${row.name} cancelada sem devolução.`,
      );
      setRetry((value) => value + 1);
      setSummaryRetry((value) => value + 1);
      return true;
    } catch {
      setActionError("Não foi possível cancelar a inscrição. Tente novamente.");
      return false;
    } finally {
      actionBusy.current = false;
      setParticipantActionBusy(false);
    }
  }

  function openEditDialog(row: AdminRegistrationRow) {
    setActionError("");
    setEditTarget(row);
    if (editChoirs.length > 0) return;
    void loadChoirs()
      .then((configuration) => setEditChoirs(configuration.choirs))
      .catch(() => setEditChoirs([]));
  }

  async function runEditAction(input: AdminUpdateRegistrationInput): Promise<string | null> {
    if (actionBusy.current || gate !== "authorized") {
      return "Não foi possível salvar. Tente novamente.";
    }
    actionBusy.current = true;
    setParticipantActionBusy(true);
    setActionError("");
    setAnnouncement("");
    try {
      await updateRegistration({ data: input });
      const phoneChanged = editTarget?.paymentStatus === "pending" && !editTarget.isFreeRegistration &&
        editTarget.phone.replace(/\D/g, "") !== input.phone.replace(/\D/g, "");
      setAnnouncement(phoneChanged
        ? "WhatsApp atualizado. Gere um novo link de pagamento para usar o número novo."
        : "Dados da inscrição atualizados.");
      setRetry((value) => value + 1);
      setSummaryRetry((value) => value + 1);
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const known = ["Já existe uma conta com esse e-mail.", "Selecione um coro válido."].find(
        (text) => message.includes(text),
      );
      return known ?? "Não foi possível salvar. Tente novamente.";
    } finally {
      actionBusy.current = false;
      setParticipantActionBusy(false);
    }
  }

  async function runReceiptAction(row: AdminRegistrationRow): Promise<void> {
    if (actionBusy.current || gate !== "authorized") return;
    actionBusy.current = true;
    setParticipantActionBusy(true);
    setActionError("");
    try {
      const result = await getReceiptUrl({ data: { registrationId: row.id } });
      openReceiptUrl(result.signedUrl);
    } catch {
      setActionError("Não foi possível abrir o comprovante. Tente novamente.");
    } finally {
      actionBusy.current = false;
      setParticipantActionBusy(false);
    }
  }

  async function logout() {
    if (actionBusy.current) return;
    actionBusy.current = true;
    revision.current++;
    setGate("leaving");
    setResult(null);
    setSummary(null);
    setSearchDraft("");
    setQuery(initialQuery);
    setActionError("");
    setAnnouncement("");
    try {
      const response = await signOut();
      if (response.error) throw response.error;
      onSignedOut();
    } catch {
      setGate("error");
      setActionError("Não foi possível sair. Tente novamente.");
    } finally {
      actionBusy.current = false;
    }
  }

  const pages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;
  const statusText =
    gate === "checking"
      ? "Verificando acesso…"
      : gate === "expired"
        ? "Sessão expirada. Redirecionando para entrar…"
        : gate === "leaving"
          ? "Saindo…"
          : gate === "authorized"
            ? loading
              ? "Carregando inscrições…"
              : result
                ? `${result.total} ${result.total === 1 ? "inscrição encontrada" : "inscrições encontradas"}`
                : ""
            : "";

  return (
    <main className="internal-app min-h-svh bg-[#f7f7f5] px-4 pb-24 pt-20 sm:px-6 md:pl-[calc(15rem+1.5rem)] md:pr-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Encontro de Coros · Administração
            </p>
            <h1 className="mt-2 font-display text-2xl">Inscrições</h1>
          </div>
          {["authorized", "forbidden", "error"].includes(gate) && (
            <div className="flex flex-wrap gap-2">
              {gate === "authorized" && (
                <Button size="sm" variant="outline" disabled={loading || exporting}
                  onClick={() => {
                    if (pdfFile && pdfFile.filterKey === filterKey) {
                      void deliverFile(pdfFile.blob, pdfFile.fileName).catch(() => setActionError("Não foi possível baixar o PDF. Tente novamente."));
                    } else void exportPdf();
                  }}>
                  <FileDown className="size-4" aria-hidden="true" />
                  {pdfFile && pdfFile.filterKey === filterKey ? "Baixar PDF" : "Exportar PDF"}
                </Button>
              )}
              {gate === "authorized" && pdfFile?.filterKey === filterKey && (
                <Button size="sm" variant="outline" onClick={() => openPreparedPdf(pdfFile.blob)}>
                  <ExternalLink className="size-4" aria-hidden="true" />Abrir PDF
                </Button>
              )}
              {gate === "authorized" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={exportCsv}
                  disabled={loading || exporting}
                >
                  {exporting ? "Exportando…" : "Exportar CSV"}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={logout} disabled={exporting}>
                Sair
              </Button>
            </div>
          )}
        </header>
        {gate === "authorized" && (
          <AdminNavigation current="registrations" navigateTo={navigateTo} />
        )}
        <div aria-live="polite" aria-atomic="true" className="text-sm text-muted-foreground">
          <p>{statusText}</p>
          {announcement && <p>{announcement}</p>}
        </div>
        {actionError && (
          <p role="alert" className="text-sm text-destructive">
            {actionError}
          </p>
        )}
        {gate === "checking" && <Skeleton className="h-32 w-full" />}
        {gate === "forbidden" && (
          <p role="alert" className="text-sm text-destructive">
            Acesso não autorizado.
          </p>
        )}
        {gate === "error" && (
          <Card>
            <CardContent className="space-y-3 p-5">
              <p role="alert" className="text-sm">
                {gateErrorMessage || "Não foi possível verificar seu acesso. Tente novamente."}
              </p>
              <Button
                size="sm"
                onClick={() => {
                  setActionError("");
                  void verifyAccess();
                }}
              >
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        )}
        {gate === "authorized" && (
          <>
            {summaryLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : summaryError ? (
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <p role="alert" className="text-sm">
                    {summaryError}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSummaryRetry((value) => value + 1)}
                  >
                    Tentar novamente
                  </Button>
                </CardContent>
              </Card>
            ) : (
              summary && (
                <RegistrationSummaryCards
                  summary={summary}
                  prepareChoirPdf={preparePdf}
                  onChoirSettled={refreshSummary}
                />
              )
            )}
            <AdminWhatsAppToolbar controller={whatsApp} rows={whatsAppFilteredRows} />
            <AdminBrevoCardEmail enabled={gate === "authorized"} />
            <form
              onSubmit={search}
              className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor="registration-search">Pesquisar inscrições</Label>
                <div className="flex gap-2">
                  <Input
                    id="registration-search"
                    type="search"
                    maxLength={100}
                    value={searchDraft}
                    onChange={(event) => setSearchDraft(event.target.value)}
                    placeholder="Nome, CPF, e-mail, telefone ou cidade"
                    disabled={loading || exporting}
                  />
                  <Button type="submit" disabled={loading || exporting}>
                    Pesquisar
                  </Button>
                </div>
              </div>
              <div className="space-y-2 sm:w-40">
                <Label htmlFor="registration-status">Situação</Label>
                <Select
                  value={query.paymentStatus}
                  disabled={loading || exporting}
                  onValueChange={(value: AdminRegistrationQuery["paymentStatus"]) => {
                    setAnnouncement("");
                    setQuery((previous) => ({ ...previous, paymentStatus: value, page: 1 }));
                  }}
                >
                  <SelectTrigger id="registration-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="pending">Pendentes</SelectItem>
                    <SelectItem value="paid">Pagas</SelectItem>
                    <SelectItem value="exempt">Isentas</SelectItem>
                    <SelectItem value="partially_paid">Parcialmente pagas</SelectItem>
                    <SelectItem value="legacy">Históricas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:w-48">
                <Label htmlFor="registration-choir">Coro</Label>
                <Select
                  value={query.choirId}
                  disabled={loading || exporting}
                  onValueChange={(value: AdminRegistrationQuery["choirId"]) => {
                    setAnnouncement("");
                    setQuery((previous) => ({ ...previous, choirId: value, page: 1 }));
                  }}
                >
                  <SelectTrigger id="registration-choir">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os coros</SelectItem>
                    {editChoirs.map((choir) => (
                      <SelectItem key={choir.id} value={choir.id}>
                        {choir.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="other">Outro coro (fora da lista)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:w-40">
                <Label htmlFor="registration-role">Função</Label>
                <Select
                  value={query.musicalProfile}
                  disabled={loading || exporting}
                  onValueChange={(value: AdminRegistrationQuery["musicalProfile"]) => {
                    setAnnouncement("");
                    setQuery((previous) => ({ ...previous, musicalProfile: value, page: 1 }));
                  }}
                >
                  <SelectTrigger id="registration-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as funções</SelectItem>
                    {musicalProfileOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:w-48">
                <Label htmlFor="registration-login">Acesso ao app</Label>
                <Select
                  value={query.loginStatus ?? "all"}
                  disabled={loading || exporting}
                  onValueChange={(value: NonNullable<AdminRegistrationQuery["loginStatus"]>) => {
                    setAnnouncement("");
                    setQuery((previous) => ({ ...previous, loginStatus: value, page: 1 }));
                  }}
                >
                  <SelectTrigger id="registration-login"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="never">Nunca fez login</SelectItem>
                    <SelectItem value="has">Já fez login</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:w-48">
                <Label htmlFor="registration-whatsapp-status">Envio pelo WhatsApp</Label>
                <Select value={whatsAppStatusFilter} disabled={!whatsApp.connected} onValueChange={(value: typeof whatsAppStatusFilter) => setWhatsAppStatusFilter(value)}>
                  <SelectTrigger id="registration-whatsapp-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="received">Recebimento confirmado</SelectItem>
                    <SelectItem value="sent">Enviado, sem confirmação</SelectItem>
                    <SelectItem value="pending">Não enviado</SelectItem>
                    <SelectItem value="failed">Falhou antes do envio</SelectItem>
                    <SelectItem value="review">Tentativa sem confirmação</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Filtra a página atual. “Enviado” não confirma entrega ou leitura.</p>
              </div>
            </form>
            {loading && result && (
              <p role="status" className="text-xs text-muted-foreground">Atualizando…</p>
            )}
            {loading && !result ? (
              <Skeleton className="h-32 w-full" />
            ) : listError ? (
              <Card>
                <CardContent className="space-y-3 p-5">
                  <p role="alert" className="text-sm">
                    {listError}
                  </p>
                  <Button size="sm" onClick={() => setRetry((value) => value + 1)}>
                    Tentar novamente
                  </Button>
                </CardContent>
              </Card>
            ) : (
              result &&
              (whatsAppFilteredRows.length ? (
                <RegistrationViews
                  whatsApp={whatsApp}
                  rows={whatsAppFilteredRows.map((row) =>
                    row.photoUrl || !photoUrls[row.id] ? row : { ...row, photoUrl: photoUrls[row.id] },
                  )}
                  participantActionBusy={participantActionBusy}
                  onReprocess={(row) => void runParticipantAction(row, "reprocess")}
                  onReset={(row) => runParticipantAction(row, "reset")}
                  onBalancePayment={setBalanceTarget}
                  onPaymentLink={(row) => void runPaymentLinkAction(row)}
                  onMarkPaid={runMarkPaidAction}
                  onDelete={runDeleteAction}
                  onCancel={runCancelAction}
                  onViewReceipt={(row) => void runReceiptAction(row)}
                  onEdit={openEditDialog}
                  roles={roles}
                  onToggleAdmin={runToggleAdmin}
                  onEventReportsChange={(id, enabled) => setRoles(current => ({ ...current, [id]: { ...current[id], isEventReports: enabled } }))}
                />
              ) : (
                <Card>
                  <CardContent className="p-6 text-center text-sm">
                    Nenhuma inscrição encontrada.
                  </CardContent>
                </Card>
              ))
            )}
            <EditRegistrationDialog
              row={editTarget}
              choirs={editChoirs}
              busy={participantActionBusy}
              onOpenChange={(open) => {
                if (!open) setEditTarget(null);
              }}
              onSave={runEditAction}
            />
            <BalancePaymentDialog
              target={
                balanceTarget && getAdminFinancialState(balanceTarget).status === "partially_paid"
                  ? {
                      id: balanceTarget.id,
                      name: balanceTarget.name,
                      balanceCents: getAdminFinancialState(balanceTarget).pendingCents ?? 0,
                    }
                  : null
              }
              open={balanceTarget !== null}
              onOpenChange={(open) => {
                if (!open) setBalanceTarget(null);
              }}
              startCheckout={openBalanceCheckout}
              navigateToCheckout={navigateToCheckout}
            />
            {result && (
              <nav
                aria-label="Paginação de inscrições"
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <p className="text-xs text-muted-foreground">
                    Página {result.page} de {pages}{whatsAppStatusFilter !== "all" ? ` · filtro WhatsApp: ${whatsAppFilteredRows.length} resultado(s) nesta página` : ""}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={loading || exporting || result.page <= 1}
                    onClick={() =>
                      setQuery((previous) => ({ ...previous, page: previous.page - 1 }))
                    }
                  >
                    Anterior
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={loading || exporting || result.page >= pages}
                    onClick={() =>
                      setQuery((previous) => ({ ...previous, page: previous.page + 1 }))
                    }
                  >
                    Próxima
                  </Button>
                </div>
              </nav>
            )}
          </>
        )}
      </div>
    </main>
  );
}
