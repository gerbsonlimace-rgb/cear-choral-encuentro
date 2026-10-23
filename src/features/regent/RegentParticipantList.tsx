import { useEffect, useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import {
  formatComplementCents,
  type ComplementPaymentRow,
  type PortalParticipant,
} from "./regent-payments.domain";

type Props = {
  participants: PortalParticipant[];
  onPay: (participant: PortalParticipant) => void;
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Fortaleza",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatCpf(cpf: string) {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf || "Não informado";
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (digits.length === 10) return digits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return phone || "Não informado";
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function isSafeCheckoutUrl(value: string | null): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "checkout.infinitepay.io" || url.hostname === "checkout.infinitepay.com.br")
    );
  } catch {
    return false;
  }
}

function ParticipantAvatar({ participant }: { participant: PortalParticipant }) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => setImageFailed(false), [participant.photoUrl]);

  return (
    <Avatar className="h-10 w-10 border bg-muted">
      {participant.photoUrl && !imageFailed ? (
        <img
          src={participant.photoUrl}
          alt={`Foto de ${participant.name}`}
          className="aspect-square h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <AvatarFallback
          role="img"
          aria-label={`Foto não disponível para ${participant.name}`}
          className="text-xs font-semibold"
        >
          {initials(participant.name)}
        </AvatarFallback>
      )}
    </Avatar>
  );
}

function RegistrationBadge({ participant }: { participant: PortalParticipant }) {
  const { status } = participant.financialState;
  const registrationDue = participant.registrationPendingCents ?? participant.financialState.pendingCents;
  const raffleDue = participant.rafflePendingCents ?? 0;
  const label = status === "legacy" ? "Histórico" : status === "exempt" && raffleDue === 0
    ? "Inscrição isenta" : registrationDue === 0 && raffleDue > 0
      ? "Aguardando rifas" : registrationDue === 0 && raffleDue === 0
        ? "Pagamento integral" : status === "partially_paid"
          ? "Pagamento parcial" : "Inscrição pendente";
  return (
    <Badge variant={registrationDue === 0 && raffleDue === 0 ? "default" : "secondary"} className="w-fit text-[11px]">
      {label}
    </Badge>
  );
}

function PaymentBadge({ payment }: { payment: ComplementPaymentRow }) {
  const label =
    payment.status === "paid"
      ? "Pago"
      : payment.status === "pending" || payment.status === "creating"
        ? "Pendente"
        : payment.status === "expired"
          ? "Expirado"
          : "Falhou";
  return <Badge variant={payment.status === "paid" ? "default" : "secondary"}>{label}</Badge>;
}

function PaymentHistory({ participant }: { participant: PortalParticipant }) {
  const [expanded, setExpanded] = useState(false);
  if (participant.payments.length === 0) {
    return <span className="text-xs text-muted-foreground">Sem parcelas</span>;
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-auto px-0 py-1"
        aria-expanded={expanded}
        aria-label={`${expanded ? "Ocultar" : "Ver"} histórico de ${participant.name}`}
        onClick={() => setExpanded((current) => !current)}
      >
        {expanded ? "Ocultar histórico" : `Ver histórico (${participant.payments.length})`}
      </Button>
      {expanded && (
        <ul className="space-y-2 border-l pl-3 text-xs">
          {participant.payments.map((payment) => (
            <li key={payment.id} className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <PaymentBadge payment={payment} />
                <span className="font-semibold">{formatComplementCents(payment.amountCents)}</span>
              </div>
              <p className="text-muted-foreground">
                {payment.initiatedByName} · {dateFormatter.format(new Date(payment.createdAt))}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Contact({ participant }: { participant: PortalParticipant }) {
  return (
    <div className="space-y-1 text-sm">
      <p>{formatCpf(participant.cpf)}</p>
      {participant.whatsappUrl ? (
        <a
          href={participant.whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-primary underline-offset-4 hover:underline"
          aria-label={`WhatsApp de ${participant.name}`}
        >
          WhatsApp · {formatPhone(participant.phone)}
        </a>
      ) : (
        <p className="text-muted-foreground">{participant.phone}</p>
      )}
    </div>
  );
}

function ComplementAction({
  participant,
  onPay,
}: {
  participant: PortalParticipant;
  onPay: Props["onPay"];
}) {
  if (participant.financialState.status !== "partially_paid" || !participant.complement.eligible) {
    return null;
  }

  const openPayment = participant.complement.openPayment;
  if (openPayment) {
    return isSafeCheckoutUrl(openPayment.checkoutUrl) ? (
      <Button asChild size="sm" variant="outline">
        <a href={openPayment.checkoutUrl}>Continuar pagamento</a>
      </Button>
    ) : (
      <span className="text-xs text-muted-foreground">Pagamento em processamento</span>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      aria-label={`Pagar saldo de ${formatComplementCents(participant.complement.balanceCents)}`}
      onClick={() => onPay(participant)}
    >
      Pagar saldo de {formatComplementCents(participant.complement.balanceCents)}
    </Button>
  );
}

function RegistrationPrices({ participant }: { participant: PortalParticipant }) {
  const standard =
    participant.standardPriceCents === null
      ? "Não disponível"
      : formatComplementCents(participant.standardPriceCents);
  const registration =
    participant.registrationPriceCents === null
      ? "Não disponível"
      : formatComplementCents(participant.registrationPriceCents);

  return (
    <div className="space-y-0.5 text-xs">
      <p>Valor normal: {standard}</p>
      <p>Valor da inscrição: {registration}</p>
    </div>
  );
}

export function RegentParticipantList({ participants, onPay }: Props) {
  return (
      <section aria-label="Cartões de participantes" className="grid grid-cols-1 gap-2 min-[370px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {participants.map((participant) => (
          <Card key={participant.id} className="min-w-0 gap-0 overflow-hidden py-0">
            <CardContent className="min-w-0 space-y-2 p-3">
              <div className="flex min-w-0 items-start gap-2">
                <ParticipantAvatar participant={participant} />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-xs font-semibold leading-tight sm:text-sm">{participant.name}</p>
                  {participant.voicePart && <p className="truncate text-[11px] text-muted-foreground">{participant.voicePart}</p>}
                  <RegistrationBadge participant={participant} />
                </div>
              </div>
              <div className="grid grid-cols-2 divide-x border-t pt-2 text-[11px]">
                <div className="min-w-0 pr-1.5">
                  <p className="leading-tight text-muted-foreground">Inscrição pendente</p>
                  <p className="mt-1 text-xs font-semibold">{participant.registrationPendingCents === null ? "Não disponível" : formatComplementCents(participant.registrationPendingCents ?? participant.financialState.pendingCents ?? 0)}</p>
                </div>
                <div className="min-w-0 pl-1.5">
                  <p className="leading-tight text-muted-foreground">Rifas pendentes</p>
                  <p className="mt-1 text-xs font-semibold">{participant.rafflePendingCents === null ? "Não disponível" : formatComplementCents(participant.rafflePendingCents ?? 0)}</p>
                </div>
              </div>
              <details className="border-t pt-1 text-xs">
                <summary className="cursor-pointer font-medium text-muted-foreground">Contato e detalhes</summary>
                <div className="space-y-2 pt-2">
                  <Contact participant={participant} />
                  <RegistrationPrices participant={participant} />
                  <PaymentHistory participant={participant} />
                  <ComplementAction participant={participant} onPay={onPay} />
                </div>
              </details>
            </CardContent>
          </Card>
        ))}
      </section>
  );
}
