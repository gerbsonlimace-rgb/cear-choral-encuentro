import { useEffect, useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  formatComplementCents,
  type ComplementIneligibilityReason,
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
    <Avatar className="h-11 w-11 border bg-muted">
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

function RegistrationBadge({ status }: { status: PortalParticipant["paymentStatus"] }) {
  const label = status === "paid" ? "Pago" : status === "pending" ? "Pendente" : "Histórico";
  return <Badge variant={status === "paid" ? "default" : "secondary"}>{label}</Badge>;
}

const ineligibleLabels: Record<ComplementIneligibilityReason, string> = {
  awaiting_participant_payment: "Aguardando pagamento do participante",
  standard_price: "Inscrição sem complemento",
  missing_snapshot: "Valores da inscrição indisponíveis",
  settled: "Complemento quitado",
};

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
  if (!participant.complement.eligible) {
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
      aria-label={`Pagar complemento de ${participant.name}`}
      onClick={() => onPay(participant)}
    >
      Pagar complemento
    </Button>
  );
}

function ComplementAmounts({ participant }: { participant: PortalParticipant }) {
  if (!participant.complement.eligible) return null;
  return (
    <div className="space-y-0.5 text-xs">
      <p>Pago: {formatComplementCents(participant.complement.paidCents)}</p>
      <p className="font-semibold">
        Saldo: {formatComplementCents(participant.complement.balanceCents)}
      </p>
    </div>
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
    <>
      <Card className="hidden overflow-hidden md:block">
        <CardContent className="p-0">
          <Table aria-label="Participantes">
            <TableHeader>
              <TableRow>
                <TableHead>Participante</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Inscrição</TableHead>
                <TableHead>Valores da inscrição</TableHead>
                <TableHead>Complemento</TableHead>
                <TableHead>Parcelas</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {participants.map((participant) => (
                <TableRow key={participant.id}>
                  <TableCell>
                    <div className="flex min-w-44 items-center gap-3">
                      <ParticipantAvatar participant={participant} />
                      <p className="font-semibold">{participant.name}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Contact participant={participant} />
                  </TableCell>
                  <TableCell>
                    <RegistrationBadge status={participant.paymentStatus} />
                  </TableCell>
                  <TableCell>
                    <RegistrationPrices participant={participant} />
                  </TableCell>
                  <TableCell>
                    <ComplementAmounts participant={participant} />
                    {!participant.complement.eligible && (
                      <span className="text-xs text-muted-foreground">
                        {ineligibleLabels[participant.complement.reason]}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <PaymentHistory participant={participant} />
                  </TableCell>
                  <TableCell className="text-right">
                    <ComplementAction participant={participant} onPay={onPay} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <section aria-label="Cartões de participantes" className="grid gap-3 md:hidden">
        {participants.map((participant) => (
          <Card key={participant.id}>
            <CardContent className="space-y-4 p-4">
              <div className="flex items-start gap-3">
                <ParticipantAvatar participant={participant} />
                <div className="min-w-0 flex-1">
                  <p className="break-words font-semibold">{participant.name}</p>
                  <Contact participant={participant} />
                </div>
                <RegistrationBadge status={participant.paymentStatus} />
              </div>
              <RegistrationPrices participant={participant} />
              <div className="flex flex-wrap items-end justify-between gap-3 border-t pt-3">
                <div className="min-w-0 flex-1">
                  <ComplementAmounts participant={participant} />
                  {!participant.complement.eligible && (
                    <p className="text-xs text-muted-foreground">
                      {ineligibleLabels[participant.complement.reason]}
                    </p>
                  )}
                  <PaymentHistory participant={participant} />
                </div>
                <ComplementAction participant={participant} onPay={onPay} />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </>
  );
}
