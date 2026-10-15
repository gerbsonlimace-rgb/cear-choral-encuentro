import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  BadgeCheck,
  Banknote,
  ChartNoAxesCombined,
  Clock3,
  ExternalLink,
  Link2,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  KeyRound,
  Trash2,
  CircleOff,
} from "lucide-react";
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
  getAdminAccess,
  getAdminRegistrationReceipt,
  getAdminRegistrationSummary,
  listAdminRegistrations,
  markAdminRegistrationPaid,
  markAdminRegistrationExempt,
  deleteAdminRegistration,
  reprocessParticipantAccess,
  resetParticipantInitialPassword,
  updateAdminRegistration,
  type AdminAccessState,
  type AdminRegistrationsBootstrap,
} from "@/lib/admin.functions";
import { getPublicRegistrationConfiguration } from "@/lib/choir-pricing.functions";
import type { PublicChoirOption } from "@/features/choirs/choir-pricing.domain";
import { dioceseOptions, type Diocese } from "@/features/dioceses/diocese.domain";
import {
  musicalProfileOptions,
  voicePartOptions,
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
  manualPaymentReceiptMimeTypeSchema,
  MAX_MANUAL_PAYMENT_RECEIPT_BYTES,
  type AdminUpdateRegistrationInput,
  type ManualPaymentReceipt,
} from "./admin.domain";
import { AdminNavigation, type AdminNavigationPath } from "./AdminNavigation";

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
  exportRegistrations?: (input: { data: AdminRegistrationExportQuery }) => Promise<AdminExportFile>;
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
    data: { registrationId: string; receipt: ManualPaymentReceipt };
  }) => Promise<{
    status: "paid";
    registrationId: string;
  }>;
  markExempt?: (input: { data: { registrationId: string } }) => Promise<{
    status: "exempt";
    registrationId: string;
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
};

const defaultGetSession = () => supabase.auth.getSession();
const defaultSignOut = () => supabase.auth.signOut();
const defaultCopyToClipboard = (value: string) => navigator.clipboard.writeText(value);
const defaultOpenReceiptUrl = (url: string) => window.open(url, "_blank", "noopener,noreferrer");
const initialQuery: AdminRegistrationQuery = {
  search: "",
  paymentStatus: "all",
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
      {row.photoUrl && <AvatarImage src={row.photoUrl} alt={`Foto de ${row.name}`} />}
      <AvatarFallback
        className={`bg-primary/10 font-semibold text-primary ${large ? "text-xl" : "text-xs"}`}
      >
        {nameInitials(row.name)}
      </AvatarFallback>
    </Avatar>
  );
}

function Status({ row }: { row: AdminRegistrationRow }) {
  const status = getAdminFinancialState(row).status;
  const freePending = row.paymentStatus === "pending" && row.isFreeRegistration;
  const label = freePending
    ? "Aguardando aprovação"
    : {
        legacy: "Histórico",
        pending: "Pendente",
        partially_paid: "Parcialmente pago",
        paid: "Pago",
        exempt: "Isento",
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
            {pending !== null && (
              <p>
                Pendente: <span className="font-medium text-foreground">{money(pending)}</span>
              </p>
            )}
            {received === null && pending === null && <p>Valores não informados</p>}
          </>
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
            : "Isenção administrativa"
          : "Não informado";
  const pricingType =
    financial.status === "exempt"
      ? "Isento"
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
            <DetailItem label="Pendente">{money(financial.pendingCents)}</DetailItem>
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
    Boolean(target.closest("button,a,input,select,textarea,[role='menuitem']"))
  );
}

function RegistrationViews({
  rows,
  participantActionBusy,
  onReprocess,
  onReset,
  onBalancePayment,
  onPaymentLink,
  onMarkPaid,
  onMarkExempt,
  onDelete,
  onViewReceipt,
  onEdit,
}: {
  rows: AdminRegistrationRow[];
  participantActionBusy: boolean;
  onReprocess: (row: AdminRegistrationRow) => void;
  onReset: (row: AdminRegistrationRow) => Promise<void>;
  onBalancePayment: (row: AdminRegistrationRow) => void;
  onPaymentLink: (row: AdminRegistrationRow) => void;
  onMarkPaid: (row: AdminRegistrationRow, receipt: ManualPaymentReceipt) => Promise<boolean>;
  onMarkExempt: (row: AdminRegistrationRow) => Promise<boolean>;
  onDelete?: (row: AdminRegistrationRow, cpf: string) => Promise<boolean>;
  onViewReceipt: (row: AdminRegistrationRow) => void;
  onEdit?: (row: AdminRegistrationRow) => void;
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
                  if (!isInteractiveTarget(event.target)) setSelectedRow(row);
                }}
                onKeyDown={(event) => openWithKeyboard(event, row)}
              >
                <TableCell className="whitespace-nowrap align-top">
                  <time dateTime={row.createdAt}>{dateTime(row.createdAt)}</time>
                </TableCell>
                <TableCell className="max-w-56 align-top">
                  <div className="flex items-center gap-3">
                    <ParticipantAvatar row={row} />
                    <div className="min-w-0">
                      <p className="break-words font-medium">{row.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">CPF {row.cpf}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="align-top">{musicalProfileLabel(row)}</TableCell>
                <TableCell className="max-w-52 break-all align-top">{row.email}</TableCell>
                <TableCell className="min-w-36 align-top">
                  <PaymentSummary row={row} />
                </TableCell>
                <TableCell className="max-w-40 align-top">{row.phone}</TableCell>
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
                    onMarkExempt={onMarkExempt}
                    onDelete={onDelete}
                    onViewReceipt={onViewReceipt}
                    onEdit={onEdit}
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
              if (!isInteractiveTarget(event.target)) setSelectedRow(row);
            }}
            onKeyDown={(event) => openWithKeyboard(event, row)}
          >
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <ParticipantAvatar row={row} />
                  <div className="min-w-0">
                    <h2 className="break-words text-sm font-semibold">{row.name}</h2>
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
                  onMarkExempt={onMarkExempt}
                    onDelete={onDelete}
                  onViewReceipt={onViewReceipt}
                  onEdit={onEdit}
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
                  <dd>{row.phone}</dd>
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
  onMarkExempt,
  onDelete,
  onViewReceipt,
  onEdit,
  busy,
}: {
  row: AdminRegistrationRow;
  onReprocess: (row: AdminRegistrationRow) => void;
  onReset: (row: AdminRegistrationRow) => Promise<void>;
  onBalancePayment: (row: AdminRegistrationRow) => void;
  onPaymentLink: (row: AdminRegistrationRow) => void;
  onMarkPaid: (row: AdminRegistrationRow, receipt: ManualPaymentReceipt) => Promise<boolean>;
  onMarkExempt: (row: AdminRegistrationRow) => Promise<boolean>;
  onDelete?: (row: AdminRegistrationRow, cpf: string) => Promise<boolean>;
  onViewReceipt: (row: AdminRegistrationRow) => void;
  onEdit?: (row: AdminRegistrationRow) => void;
  busy: boolean;
}) {
  const [confirmMarkPaid, setConfirmMarkPaid] = useState(false);
  const [confirmExempt, setConfirmExempt] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteCpf, setDeleteCpf] = useState("");
  const [receipt, setReceipt] = useState<ManualPaymentReceipt | null>(null);
  const [receiptError, setReceiptError] = useState("");
  const state = getAdminFinancialState(row);
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
    setConfirmMarkPaid(true);
  };
  const hasActions =
    Boolean(onEdit) ||
    row.hasManualReceipt ||
    (typeof openUrl === "string" && isSafeCheckoutUrl(openUrl)) ||
    state.status === "pending" ||
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
                <Link2 aria-hidden="true" /> Gerar link de pagamento
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={openMarkPaid}>
                <BadgeCheck aria-hidden="true" /> Marcar como pago
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setConfirmExempt(true)}>
                <CircleOff aria-hidden="true" /> Marcar como isento
              </DropdownMenuItem>
            </>
          )}
          {state.status === "pending" && row.isFreeRegistration && (
            <DropdownMenuItem onSelect={() => setConfirmExempt(true)}>
              <BadgeCheck aria-hidden="true" /> Aprovar como isento
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar inscrição como paga?</AlertDialogTitle>
            <AlertDialogDescription>
              Confirme que o valor de {money(pendingAmountCents(row))} foi recebido e anexe o
              comprovante antes de concluir esta ação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`payment-receipt-${row.id}`}>Comprovante de pagamento</Label>
            <Input
              id={`payment-receipt-${row.id}`}
              type="file"
              accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
              aria-required="true"
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
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || !receipt}
              onClick={(event) => {
                event.preventDefault();
                if (!receipt) return;
                void onMarkPaid(row, receipt).then((success) => {
                  if (success) setConfirmMarkPaid(false);
                });
              }}
            >
              Confirmar pagamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmExempt} onOpenChange={setConfirmExempt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{row.isFreeRegistration ? "Aprovar como isento?" : "Marcar participante como isento?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {row.isFreeRegistration
                ? `A inscrição de ${row.name} será aprovada como isenta e o acesso poderá ser preparado.`
                : `A inscrição de ${row.name} será confirmada sem cobrança. Todos os valores ficarão em ${money(0)} e o link de pagamento será cancelado.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                void onMarkExempt(row).then((success) => {
                  if (success) setConfirmExempt(false);
                });
              }}
            >
              {row.isFreeRegistration ? "Aprovar isenção" : "Confirmar isenção"}
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

function RegistrationFinancialSummary({ summary }: { summary: AdminRegistrationSummary }) {
  const financial = [
    {
      label: "Recebido",
      value: money(summary.receivedCents),
      hint: `${summary.paid} ${summary.paid === 1 ? "inscrição paga" : "inscrições pagas"}`,
      icon: Banknote,
    },
    {
      label: "Pendente",
      value: money(summary.pendingCents),
      hint: `${summary.pending} ${summary.pending === 1 ? "inscrição aguardando" : "inscrições aguardando"}`,
      icon: Clock3,
    },
    {
      label: "Total previsto",
      value: money(summary.expectedCents),
      hint: "Recebido + pendente",
      icon: ChartNoAxesCombined,
    },
  ];
  return (
    <div role="group" aria-label="Resumo financeiro" className="grid gap-3 sm:grid-cols-3">
      {financial.map((metric) => (
        <InternalMetricCard
          key={metric.label}
          label={metric.label}
          value={metric.value}
          detail={metric.hint}
          icon={metric.icon}
        />
      ))}
    </div>
  );
}

export function AdminRegistrationsPage({
  onSignedOut,
  onMissingSession,
  checkAdmin = getAdminAccess,
  loadInitialData,
  loadRegistrations = listAdminRegistrations,
  loadSummary = getAdminRegistrationSummary,
  exportRegistrations = exportAdminRegistrations,
  createPaymentLink = createAdminRegistrationCheckoutLink,
  markPaid = markAdminRegistrationPaid,
  markExempt = markAdminRegistrationExempt,
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
}: Props) {
  const openBalanceCheckout = startBalanceCheckout ?? startCheckout ?? startComplementCheckout;
  const [gate, setGate] = useState<
    "checking" | "authorized" | "forbidden" | "error" | "expired" | "leaving"
  >("checking");
  const [result, setResult] = useState<AdminRegistrationPage | null>(null);
  const [summary, setSummary] = useState<AdminRegistrationSummary | null>(null);
  const [query, setQuery] = useState(initialQuery);
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
  const [retry, setRetry] = useState(0);
  const [summaryRetry, setSummaryRetry] = useState(0);
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
      if (current === revision.current) setGate(access.status);
    } catch {
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
      if (current === revision.current) setGate("error");
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
          setResult(result.data.registrations);
          setSummary(result.data.summary);
          setBootstrapDataReady(true);
          setGate("authorized");
        })
        .catch(async () => {
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
    setLoading(true);
    setResult(null);
    setListError("");
    void (async () => {
      try {
        const next = await loadRegistrations({ data: query });
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

  async function exportCsv() {
    if (actionBusy.current || loading || gate !== "authorized") return;
    actionBusy.current = true;
    const current = revision.current;
    setExporting(true);
    setActionError("");
    setAnnouncement("");
    try {
      const file = await exportRegistrations({
        data: { search: query.search, paymentStatus: query.paymentStatus },
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
    receipt: ManualPaymentReceipt,
  ): Promise<boolean> {
    if (actionBusy.current || gate !== "authorized") return false;
    actionBusy.current = true;
    setParticipantActionBusy(true);
    setActionError("");
    setAnnouncement("");
    try {
      const result = await markPaid({ data: { registrationId: row.id, receipt } });
      if (result.status !== "paid") throw new Error("Unexpected payment result");
      setAnnouncement("Inscrição marcada como paga.");
      setRetry((value) => value + 1);
      return true;
    } catch {
      setActionError("Não foi possível marcar a inscrição como paga. Tente novamente.");
      return false;
    } finally {
      actionBusy.current = false;
      setParticipantActionBusy(false);
    }
  }

  async function runMarkExemptAction(row: AdminRegistrationRow): Promise<boolean> {
    if (actionBusy.current || gate !== "authorized") return false;
    actionBusy.current = true;
    setParticipantActionBusy(true);
    setActionError("");
    setAnnouncement("");
    try {
      const result = await markExempt({ data: { registrationId: row.id } });
      if (result.status !== "exempt") throw new Error("Unexpected exemption result");
      setAnnouncement(row.isFreeRegistration ? "Inscrição aprovada como isenta." : "Participante marcado como isento. Valores zerados.");
      setRetry((value) => value + 1);
      setSummaryRetry((value) => value + 1);
      return true;
    } catch {
      setActionError(row.isFreeRegistration ? "Não foi possível aprovar a inscrição. Tente novamente." : "Não foi possível marcar o participante como isento. Tente novamente.");
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
      setAnnouncement("Dados da inscrição atualizados.");
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
            <div className="flex gap-2">
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
                Não foi possível verificar seu acesso. Tente novamente.
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
              summary && <RegistrationFinancialSummary summary={summary} />
            )}
            <form
              onSubmit={search}
              className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-end"
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
              <div className="space-y-2 sm:w-44">
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
            </form>
            {loading ? (
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
              (result.rows.length ? (
                <RegistrationViews
                  rows={result.rows}
                  participantActionBusy={participantActionBusy}
                  onReprocess={(row) => void runParticipantAction(row, "reprocess")}
                  onReset={(row) => runParticipantAction(row, "reset")}
                  onBalancePayment={setBalanceTarget}
                  onPaymentLink={(row) => void runPaymentLinkAction(row)}
                  onMarkPaid={runMarkPaidAction}
                  onMarkExempt={runMarkExemptAction}
                  onDelete={runDeleteAction}
                  onViewReceipt={(row) => void runReceiptAction(row)}
                  onEdit={openEditDialog}
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
                  Página {result.page} de {pages}
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
