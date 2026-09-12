import { Download, KeyRound, LogOut } from "lucide-react";
import { useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

import type { ParticipantRegistrationView } from "./participant.domain";

type Action = () => void | Promise<void>;

type ChoristerProfileTabProps = {
  participant: ParticipantRegistrationView;
  onChangePassword: Action;
  onDownloadReceipt: (participant: ParticipantRegistrationView) => void | Promise<void>;
  onLogout: Action;
};

const moneyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const paidDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Fortaleza",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const voicePartLabels: Record<
  NonNullable<ParticipantRegistrationView["registration"]["voicePart"]>,
  string
> = {
  soprano: "Soprano",
  contralto: "Contralto",
  tenor: "Tenor",
  baixo: "Baixo",
  nao_sei_informar: "Não sei informar",
};

function formatBirthDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatMoney(value: number) {
  return moneyFormatter.format(value / 100);
}

function formatPaidDate(value: string) {
  const parts = paidDateFormatter.formatToParts(new Date(value));
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  return `${read("day")}/${read("month")}/${read("year")} às ${read("hour")}:${read("minute")}`;
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-zinc-100 py-3 last:border-b-0 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-sm text-zinc-600">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-medium text-zinc-950">{children}</dd>
    </div>
  );
}

export function ChoristerProfileTab({
  participant,
  onChangePassword,
  onDownloadReceipt,
  onLogout,
}: ChoristerProfileTabProps) {
  const [receiptState, setReceiptState] = useState<"idle" | "working" | "error">("idle");
  const [leaving, setLeaving] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const { identity, registration, payment } = participant;
  const canDownloadReceipt =
    Boolean(payment.orderNsu?.trim()) && payment.paidAmountCents != null && Boolean(payment.paidAt);

  async function downloadReceipt() {
    if (receiptState === "working") return;
    setReceiptState("working");
    try {
      await onDownloadReceipt(participant);
      setReceiptState("idle");
    } catch {
      setReceiptState("error");
    }
  }

  function logout() {
    if (leaving) return;
    setLeaving(true);
    void onLogout();
  }

  if (leaving) {
    return (
      <section
        aria-live="polite"
        className="rounded-xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600"
      >
        Saindo…
      </section>
    );
  }

  return (
    <section aria-labelledby="chorister-profile-title" className="space-y-5">
      <header>
        <p className="text-sm font-medium text-amber-700">Área segura do participante</p>
        <h1
          id="chorister-profile-title"
          className="mt-1 font-display text-2xl font-semibold text-zinc-950"
        >
          Meu Perfil
        </h1>
      </header>

      <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <Avatar className="size-14 border border-zinc-200 bg-zinc-50">
            {identity.photoUrl && !photoFailed ? (
              <img
                src={identity.photoUrl}
                alt={`Foto de ${identity.name}`}
                className="aspect-square h-full w-full object-cover"
                onError={() => setPhotoFailed(true)}
              />
            ) : (
              <AvatarFallback role="img" aria-label="Foto não disponível" className="font-semibold">
                {getInitials(identity.name)}
              </AvatarFallback>
            )}
          </Avatar>
          <h2 className="font-display text-lg font-semibold text-zinc-950">Dados pessoais</h2>
        </div>
        <dl className="mt-2">
          <Detail label="Nome">{identity.name}</Detail>
          <Detail label="CPF">{identity.cpf}</Detail>
          <Detail label="Data de nascimento">{formatBirthDate(identity.birthDate)}</Detail>
          {identity.email != null && <Detail label="E-mail">{identity.email}</Detail>}
          {identity.phone != null && <Detail label="Telefone">{identity.phone}</Detail>}
        </dl>
      </article>

      <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-zinc-950">Inscrição</h2>
        <dl className="mt-2">
          <Detail label="Coro">{registration.choirName}</Detail>
          <Detail label="Diocese">{registration.diocese}</Detail>
          {registration.city != null && <Detail label="Cidade">{registration.city}</Detail>}
          {registration.institution != null && (
            <Detail label="Instituição">{registration.institution}</Detail>
          )}
          {registration.role != null && <Detail label="Função">{registration.role}</Detail>}
          {registration.voicePart != null && (
            <Detail label="Parte vocal">{voicePartLabels[registration.voicePart]}</Detail>
          )}
          {registration.pricingType != null && (
            <Detail label="Tipo do valor">
              {registration.pricingType === "promotional" ? "Promocional" : "Normal"}
            </Detail>
          )}
          {registration.standardPriceCents != null && (
            <Detail label="Valor normal">{formatMoney(registration.standardPriceCents)}</Detail>
          )}
          {registration.registrationPriceCents != null && (
            <Detail label="Valor da inscrição">
              {formatMoney(registration.registrationPriceCents)}
            </Detail>
          )}
        </dl>
      </article>

      <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-zinc-950">Pagamento</h2>
        <dl className="mt-2">
          <Detail label="Situação do pagamento">Pago</Detail>
          {payment.amountCents != null && (
            <Detail label="Valor da cobrança">{formatMoney(payment.amountCents)}</Detail>
          )}
          {payment.paidAmountCents != null && (
            <Detail label="Valor pago">{formatMoney(payment.paidAmountCents)}</Detail>
          )}
          {payment.paymentMethod != null && (
            <Detail label="Forma de pagamento">
              {payment.paymentMethod === "pix" ? "Pix" : "Cartão de crédito"}
            </Detail>
          )}
          {payment.installments != null && (
            <Detail label="Parcelas">{payment.installments}x</Detail>
          )}
          {payment.paidAt != null && (
            <Detail label="Pago em">{formatPaidDate(payment.paidAt)}</Detail>
          )}
          {payment.orderNsu != null && <Detail label="Pedido">{payment.orderNsu}</Detail>}
          {payment.receiptUrl != null && (
            <Detail label="Comprovante">
              <a
                href={payment.receiptUrl}
                target="_blank"
                rel="noreferrer"
                className="text-amber-800 underline underline-offset-4"
              >
                Abrir comprovante
              </a>
            </Detail>
          )}
        </dl>
        {canDownloadReceipt && (
          <div className="mt-5 space-y-2 border-t border-zinc-100 pt-5">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={receiptState === "working"}
              onClick={() => void downloadReceipt()}
            >
              <Download aria-hidden="true" className="size-4" />
              {receiptState === "working" ? "Gerando PDF…" : "Baixar comprovante em PDF"}
            </Button>
            {receiptState === "error" && (
              <p role="alert" className="text-sm text-zinc-700">
                Não foi possível gerar o comprovante em PDF. Tente novamente.
              </p>
            )}
          </div>
        )}
      </article>

      <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-zinc-950">Acesso</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => void onChangePassword()}
          >
            <KeyRound aria-hidden="true" className="size-4" />
            Alterar senha
          </Button>
          <Button type="button" variant="outline" className="min-h-11" onClick={logout}>
            <LogOut aria-hidden="true" className="size-4" />
            Sair
          </Button>
        </div>
      </article>
    </section>
  );
}
