import {
  BadgeCheck,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Mic2,
  Ticket,
  UserRound,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { ParticipantRegistrationView } from "./participant.domain";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const voiceLabels = {
  soprano: "Soprano",
  contralto: "Contralto",
  tenor: "Tenor",
  baixo: "Baixo",
  nao_sei_informar: "Não informado",
};

export function ChoristerWelcomeCard({
  participant,
}: {
  participant: ParticipantRegistrationView;
}) {
  const { identity, registration, payment } = participant;
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const financial = payment.financialState;
  const known = financial != null && financial.status !== "legacy";
  const paid = known && financial.status === "paid";
  const partial = known && financial.status === "partially_paid";
  const raffles = registration.pricingType === "promotional";
  const total = known ? financial.confirmedPrincipalCents + financial.pendingCents : 0;
  const progress =
    known && total > 0 ? Math.round((financial.confirmedPrincipalCents / total) * 100) : 0;
  const StatusIcon = paid ? CheckCircle2 : known ? Clock3 : CircleHelp;
  const status = paid
    ? "Pago"
    : partial
      ? "Parcialmente pago"
      : known
        ? "Pendente"
        : "Saldo indisponível";
  const tone = paid
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : known
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-zinc-200 bg-zinc-50 text-zinc-600";

  return (
    <section
      aria-label="Boas-vindas e inscrição"
      className="overflow-hidden rounded-3xl border border-zinc-200 bg-white"
    >
      <div className="p-5 sm:p-6">
        <header className="flex items-center gap-4">
          <Avatar className="size-16 shrink-0 border border-zinc-200 bg-zinc-50 sm:size-20">
            {identity.photoUrl && failedPhoto !== identity.photoUrl ? (
              <img
                src={identity.photoUrl}
                alt={`Foto de ${identity.name}`}
                className="h-full w-full object-cover"
                onError={() => setFailedPhoto(identity.photoUrl ?? null)}
              />
            ) : (
              <AvatarFallback
                role="img"
                aria-label="Foto não disponível"
                className="bg-zinc-100 text-xl font-semibold text-zinc-700"
              >
                {identity.name
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase())
                  .join("")}
              </AvatarFallback>
            )}
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-500">Bem-vindo</p>
            <h1
              id="chorister-home-title"
              className="mt-1 break-words text-2xl font-semibold leading-tight tracking-tight text-zinc-950 sm:text-3xl"
            >
              {identity.name}
            </h1>
          </div>
        </header>

        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="flex min-w-0 items-start gap-3 rounded-2xl bg-zinc-50 p-3.5 sm:col-span-2">
            <Users aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-zinc-500" />
            <div className="min-w-0">
              <dt className="text-xs text-zinc-500">Meu coral</dt>
              <dd className="mt-0.5 break-words text-sm font-semibold text-zinc-900">
                {registration.choirName || "Não informado"}
              </dd>
            </div>
          </div>
          <div className="flex min-w-0 items-start gap-3 px-3.5 py-1.5">
            <UserRound aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-zinc-400" />
            <div className="min-w-0">
              <dt className="text-xs text-zinc-500">
                {(registration.regentNames?.length ?? 0) > 1 ? "Regentes" : "Regente"}
              </dt>
              <dd className="mt-0.5 break-words text-sm font-medium text-zinc-900">
                {registration.regentNames?.join(", ") || "Não informado"}
              </dd>
            </div>
          </div>
          <div className="flex min-w-0 items-start gap-3 px-3.5 py-1.5">
            <Mic2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-zinc-400" />
            <div className="min-w-0">
              <dt className="text-xs text-zinc-500">Meu naipe</dt>
              <dd className="mt-1 inline-flex rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-800">
                {registration.voicePart ? voiceLabels[registration.voicePart] : "Não informado"}
              </dd>
            </div>
          </div>
        </dl>
      </div>

      <section aria-label="Situação da inscrição" className="border-t border-zinc-200 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900">Minha inscrição</h2>
          <span
            role="status"
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${tone}`}
          >
            <StatusIcon aria-hidden="true" className="size-4" />
            {status}
          </span>
        </div>
        <div className="mt-4 flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-zinc-100 text-zinc-600">
            {raffles ? (
              <Ticket aria-hidden="true" className="size-5" />
            ) : (
              <BadgeCheck aria-hidden="true" className="size-5" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-zinc-500">
              {raffles
                ? "Programa de rifas"
                : registration.pricingType === "standard"
                  ? "Inscrição integral"
                  : "Pagamento da inscrição"}
            </p>
            {known ? (
              <>
                <p className="mt-1 break-words text-3xl font-semibold tracking-tight text-zinc-950 tabular-nums">
                  {money.format(financial.pendingCents / 100)}
                </p>
                <p
                  className={`mt-0.5 text-xs font-medium ${paid ? "text-emerald-700" : "text-amber-800"}`}
                >
                  {paid ? (raffles ? "Rifas quitadas" : "Inscrição quitada") : "Valor pendente"}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-zinc-600">
                Consulte seu regente para conferir o saldo.
              </p>
            )}
          </div>
        </div>
        {known && (
          <div className="mt-5 space-y-2">
            <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-zinc-500">
              <span>
                Pago{" "}
                <strong className="font-semibold text-zinc-800">
                  {money.format(financial.confirmedPrincipalCents / 100)}
                </strong>
              </span>
              <span>Total {money.format(total / 100)}</span>
            </div>
            <div
              role="progressbar"
              aria-label="Pagamento da inscrição"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              className="h-2 overflow-hidden rounded-full bg-zinc-100"
            >
              <div
                className={`h-full rounded-full ${paid ? "bg-emerald-500" : "bg-amber-400"}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            {partial && (
              <p className="pt-1 text-xs leading-relaxed text-zinc-500">
                Sua vaga será confirmada após a quitação do saldo.
              </p>
            )}
          </div>
        )}
      </section>
    </section>
  );
}
