import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatComplementCents, type PortalParticipant } from "./regent-payments.domain";

export type RegentParticipantListProps = {
  rows: PortalParticipant[];
  onPay: (row: PortalParticipant) => void;
};

function cpf(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 11
    ? digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
    : value || "Não informado";
}
function statusLabel(status: PortalParticipant["paymentStatus"]) {
  return status === "paid" ? "Pago" : status === "pending" ? "Pendente" : "Legado";
}
function StatusBadge({ status }: { status: PortalParticipant["paymentStatus"] }) {
  return <Badge variant={status === "paid" ? "default" : "secondary"}>{statusLabel(status)}</Badge>;
}

function Details({ row }: { row: PortalParticipant }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <button
        type="button"
        className="text-xs underline"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded ? "Ocultar histórico" : "Ver histórico"}
      </button>
      {expanded && (
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          {row.payments.length === 0
            ? "Nenhuma parcela."
            : row.payments.map((payment) => (
                <div key={payment.id}>
                  {formatComplementCents(payment.amountCents)} · {payment.status} ·{" "}
                  {new Date(payment.createdAt).toLocaleDateString("pt-BR")} ·{" "}
                  {payment.initiatedByName}
                </div>
              ))}
        </div>
      )}
    </>
  );
}

function Action({
  row,
  onPay,
}: {
  row: PortalParticipant;
  onPay: (row: PortalParticipant) => void;
}) {
  if (row.complement.eligible) {
    if (row.complement.openPayment?.checkoutUrl)
      return (
        <Button size="sm" asChild>
          <a href={row.complement.openPayment.checkoutUrl}>Continuar pagamento</a>
        </Button>
      );
    return (
      <Button size="sm" onClick={() => onPay(row)}>
        Pagar complemento
      </Button>
    );
  }
  if (row.complement.reason === "awaiting_participant_payment")
    return (
      <span className="text-xs text-muted-foreground">Aguardando pagamento do participante</span>
    );
  return <span className="text-xs text-muted-foreground">Sem complemento disponível</span>;
}

export function RegentParticipantList({ rows, onPay }: RegentParticipantListProps) {
  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Participante</TableHead>
              <TableHead>CPF</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>Complemento</TableHead>
              <TableHead>Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar>
                      <AvatarImage src={row.photoUrl ?? undefined} alt="" />
                      <AvatarFallback>{row.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span>{row.name}</span>
                  </div>
                </TableCell>
                <TableCell>{cpf(row.cpf)}</TableCell>
                <TableCell>
                  {row.whatsappUrl ? (
                    <a
                      className="text-primary underline"
                      href={row.whatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      WhatsApp
                    </a>
                  ) : (
                    row.phone
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge status={row.paymentStatus} />
                </TableCell>
                <TableCell>
                  {row.complement.eligible ? (
                    <div>
                      <div>Normal: {formatComplementCents(row.standardPriceCents ?? 0)}</div>
                      <div>
                        Promocional: {formatComplementCents(row.registrationPriceCents ?? 0)}
                      </div>
                      <div>{formatComplementCents(row.complement.paidCents)} pagos</div>
                      <div>{formatComplementCents(row.complement.balanceCents)} saldo</div>
                    </div>
                  ) : (
                    <div>
                      <div>
                        Normal:{" "}
                        {row.standardPriceCents
                          ? formatComplementCents(row.standardPriceCents)
                          : "—"}
                      </div>
                      <div>
                        Promocional:{" "}
                        {row.registrationPriceCents
                          ? formatComplementCents(row.registrationPriceCents)
                          : "—"}
                      </div>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Action row={row} onPay={onPay} />
                  <div className="mt-1">
                    <Details row={row} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <div key={row.id} className="rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={row.photoUrl ?? undefined} alt="" />
                <AvatarFallback>{row.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{row.name}</p>
                <p className="text-sm text-muted-foreground">{cpf(row.cpf)}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={row.paymentStatus} />
              {row.whatsappUrl && (
                <a className="text-sm text-primary underline" href={row.whatsappUrl}>
                  WhatsApp
                </a>
              )}
            </div>
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">
                Normal:{" "}
                {row.standardPriceCents ? formatComplementCents(row.standardPriceCents) : "—"} ·
                Promocional:{" "}
                {row.registrationPriceCents
                  ? formatComplementCents(row.registrationPriceCents)
                  : "—"}
              </p>
              <Action row={row} onPay={onPay} />
              <div className="mt-2">
                <Details row={row} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
