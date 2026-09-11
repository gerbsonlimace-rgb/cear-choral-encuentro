import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { getParticipantAccess, getParticipantRegistration } from "@/lib/participant.functions";

import type { ParticipantAccess } from "./participant-auth.server";
import type { ParticipantRegistrationView } from "./participant.domain";

const sections = ["Identificação", "Playlist", "Partituras e Manuais", "Certificado"] as const;
type Section = (typeof sections)[number];

type Props = {
  onMissingAccess: () => void;
  onSignedOut: () => void;
  checkAccess?: () => Promise<ParticipantAccess>;
  loadRegistration?: () => Promise<ParticipantRegistrationView>;
  signOut?: () => Promise<{ error: unknown }>;
};

const defaultSignOut: NonNullable<Props["signOut"]> = () => supabase.auth.signOut();
const moneyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const paidDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Fortaleza",
});

function formatBirthDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatMoney(value: number) {
  return moneyFormatter.format(value / 100);
}

function formatPaidDate(value: string) {
  return paidDateFormatter.format(new Date(value));
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-b py-3 last:border-b-0 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-medium">{children}</dd>
    </div>
  );
}

function SectionNavigation({
  selected,
  onSelect,
  className,
  orientation,
}: {
  selected: Section;
  onSelect: (section: Section) => void;
  className: string;
  orientation: "horizontal" | "vertical";
}) {
  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | undefined;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (index + 1) % sections.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (index - 1 + sections.length) % sections.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = sections.length - 1;
    }
    if (nextIndex === undefined) return;

    event.preventDefault();
    onSelect(sections[nextIndex]);
    const navigation = event.currentTarget.closest("nav");
    navigation?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus();
  }

  return (
    <nav aria-label="Seções da área do participante" className={className}>
      <div
        role="tablist"
        aria-orientation={orientation}
        className="flex min-w-max gap-1 md:min-w-0 md:flex-col"
      >
        {sections.map((section, index) => (
          <button
            key={section}
            type="button"
            role="tab"
            aria-selected={selected === section}
            aria-controls="participant-section-panel"
            tabIndex={selected === section ? 0 : -1}
            onClick={() => onSelect(section)}
            onKeyDown={(event) => moveFocus(event, index)}
            className="rounded-lg px-3 py-2 text-left text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
            data-selected={selected === section}
          >
            {section}
          </button>
        ))}
      </div>
    </nav>
  );
}

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

function Identification({ view }: { view: ParticipantRegistrationView }) {
  const { identity, registration, payment } = view;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center gap-4 space-y-0">
          <Avatar className="h-20 w-20 border bg-muted">
            {identity.photoUrl ? (
              <img
                src={identity.photoUrl}
                alt={`Foto de ${identity.name}`}
                className="aspect-square h-full w-full object-cover"
              />
            ) : (
              <AvatarFallback
                role="img"
                aria-label="Foto não disponível"
                className="text-lg font-semibold"
              >
                {getInitials(identity.name)}
              </AvatarFallback>
            )}
          </Avatar>
          <div className="min-w-0">
            <CardTitle className="break-words text-xl">{identity.name}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Dados da inscrição confirmada</p>
          </div>
        </CardHeader>
        <CardContent>
          <h2 className="font-display text-lg">Dados pessoais</h2>
          <dl className="mt-2">
            <Detail label="Nome">{identity.name}</Detail>
            <Detail label="CPF">{identity.cpf}</Detail>
            <Detail label="Data de nascimento">{formatBirthDate(identity.birthDate)}</Detail>
            {identity.email != null && <Detail label="E-mail">{identity.email}</Detail>}
            {identity.phone != null && <Detail label="Telefone">{identity.phone}</Detail>}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Inscrição</CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
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
            <Detail label="Camisa">{registration.includeShirt ? "Sim" : "Não"}</Detail>
            {registration.shirtSize != null && (
              <Detail label="Tamanho da camisa">{registration.shirtSize}</Detail>
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
            {registration.shirtPriceCents != null && (
              <Detail label="Valor da camisa">{formatMoney(registration.shirtPriceCents)}</Detail>
            )}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Pagamento</CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
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
                  className="text-primary underline underline-offset-4"
                >
                  Abrir comprovante
                </a>
              </Detail>
            )}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

function PortalSection({
  selected,
  view,
}: {
  selected: Section;
  view: ParticipantRegistrationView;
}) {
  return (
    <section id="participant-section-panel" role="tabpanel" aria-label={selected} tabIndex={0}>
      {selected === "Identificação" ? (
        <Identification view={view} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">{selected}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {selected === "Playlist"
              ? "A playlist do encontro será disponibilizada em breve."
              : selected === "Partituras e Manuais"
                ? "As partituras e os materiais de orientação serão disponibilizados em breve."
                : "Seu certificado estará disponível após o evento."}
          </CardContent>
        </Card>
      )}
    </section>
  );
}

export function ParticipantPortalPage({
  onMissingAccess,
  onSignedOut,
  checkAccess = getParticipantAccess,
  loadRegistration = getParticipantRegistration,
  signOut = defaultSignOut,
}: Props) {
  const [gate, setGate] = useState<
    "checking" | "loading" | "ready" | "error" | "redirecting" | "leaving"
  >("checking");
  const [view, setView] = useState<ParticipantRegistrationView | null>(null);
  const [selected, setSelected] = useState<Section>("Identificação");
  const revision = useRef(0);
  const mounted = useRef(true);
  const signingOut = useRef(false);

  const loadPortal = useCallback(async () => {
    const current = ++revision.current;
    setView(null);
    setGate("checking");
    try {
      const access = await checkAccess();
      if (current !== revision.current || !mounted.current) return;
      if (access.status !== "authorized") {
        setGate("redirecting");
        onMissingAccess();
        return;
      }

      setGate("loading");
      const registration = await loadRegistration();
      if (current !== revision.current || !mounted.current) return;
      setView(registration);
      setGate("ready");
    } catch {
      if (current === revision.current && mounted.current) setGate("error");
    }
  }, [checkAccess, loadRegistration, onMissingAccess]);

  useEffect(() => {
    mounted.current = true;
    void loadPortal();
    return () => {
      mounted.current = false;
    };
  }, [loadPortal]);

  async function logout() {
    if (signingOut.current) return;
    signingOut.current = true;
    revision.current++;
    setView(null);
    setGate("leaving");
    try {
      const result = await signOut();
      if (result.error) throw result.error;
      onSignedOut();
    } catch {
      setGate("error");
    } finally {
      signingOut.current = false;
    }
  }

  if (gate !== "ready" || !view) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
        <div
          className="w-full max-w-md space-y-4 text-center"
          aria-live="polite"
          aria-atomic="true"
        >
          {gate === "checking" && (
            <>
              <p className="text-sm text-muted-foreground">Verificando acesso…</p>
              <Skeleton className="h-28 w-full" />
            </>
          )}
          {gate === "loading" && (
            <>
              <p className="text-sm text-muted-foreground">Carregando seus dados…</p>
              <Skeleton className="h-28 w-full" />
            </>
          )}
          {gate === "redirecting" && (
            <p className="text-sm text-muted-foreground">Redirecionando para entrar…</p>
          )}
          {gate === "leaving" && <p className="text-sm text-muted-foreground">Saindo…</p>}
          {gate === "error" && (
            <Card>
              <CardContent className="space-y-3 p-5">
                <p role="alert" className="text-sm">
                  Não foi possível carregar seus dados. Tente novamente.
                </p>
                <Button size="sm" onClick={() => void loadPortal()}>
                  Tentar novamente
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-svh bg-muted/30 px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4 rounded-xl border bg-background p-4 sm:p-5">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              II Encontro de Coros · Área do participante
            </p>
            <h1 className="mt-2 break-words font-display text-2xl">{view.identity.name}</h1>
          </div>
          <Button size="sm" variant="outline" onClick={() => void logout()}>
            Sair
          </Button>
        </header>

        <SectionNavigation
          selected={selected}
          onSelect={setSelected}
          className="overflow-x-auto pb-1 md:hidden"
          orientation="horizontal"
        />

        <div className="grid items-start gap-5 md:grid-cols-[13rem_minmax(0,1fr)]">
          <SectionNavigation
            selected={selected}
            onSelect={setSelected}
            className="hidden rounded-xl border bg-background p-2 md:block"
            orientation="vertical"
          />
          <PortalSection selected={selected} view={view} />
        </div>
      </div>
    </main>
  );
}
