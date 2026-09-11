import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  LockKeyhole,
  Mail,
  Music2,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import pixLogo from "@/assets/logo-pix.svg";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PublicRegistrationConfiguration } from "@/features/choirs/choir-pricing.domain";
import { getPublicRegistrationConfiguration } from "@/lib/choir-pricing.functions";
import {
  startRegistrationCheckout,
  type StartRegistrationCheckoutResult,
} from "@/lib/registration.functions";
import {
  getFortalezaCalendarDate,
  registrationSchema,
  type RegistrationInput,
} from "./registration.domain";

type RegistrationSectionProps = {
  loadConfiguration?: () => Promise<PublicRegistrationConfiguration>;
  startCheckout?: (input: RegistrationInput) => Promise<StartRegistrationCheckoutResult>;
  navigateToCheckout?: (url: string) => void;
};

type RegistrationForm = Omit<RegistrationInput, "choirId" | "displayedQuote"> & {
  choirId: string;
};

const formatCurrency = (valueInCents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valueInCents / 100);

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

const initialForm: RegistrationForm = {
  name: "",
  cpf: "",
  email: "",
  phone: "",
  birthDate: "",
  choirId: "",
};

const defaultLoadConfiguration = () => getPublicRegistrationConfiguration();

const inputClassName =
  "min-h-14 rounded-xl border-border bg-background pl-12 text-base shadow-sm transition-shadow focus-visible:ring-2 focus-visible:ring-teal/30";

export function RegistrationSection({
  loadConfiguration = defaultLoadConfiguration,
  startCheckout = (input) => startRegistrationCheckout({ data: input }),
  navigateToCheckout = (url) => window.location.assign(url),
}: RegistrationSectionProps) {
  const [configuration, setConfiguration] = useState<PublicRegistrationConfiguration | null>(null);
  const [configurationError, setConfigurationError] = useState("");
  const [form, setForm] = useState<RegistrationForm>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof RegistrationForm, string>>>({});
  const [checkoutError, setCheckoutError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingConfiguration, setIsLoadingConfiguration] = useState(true);
  const mounted = useRef(false);

  const refreshConfiguration = useCallback(
    async (clearSelection = false) => {
      setConfigurationError("");
      setIsLoadingConfiguration(true);
      if (clearSelection) setConfiguration(null);
      try {
        const next = await loadConfiguration();
        if (!mounted.current) return;
        setConfiguration(next);
        setForm((previous) => ({
          ...previous,
          choirId:
            !clearSelection && next.choirs.some((choir) => choir.id === previous.choirId)
              ? previous.choirId
              : "",
        }));
      } catch {
        if (mounted.current) {
          setConfigurationError("Não foi possível carregar os coros e valores da inscrição.");
        }
      } finally {
        if (mounted.current) setIsLoadingConfiguration(false);
      }
    },
    [loadConfiguration],
  );

  useEffect(() => {
    mounted.current = true;
    void refreshConfiguration();
    return () => {
      mounted.current = false;
    };
  }, [refreshConfiguration]);

  const selectedChoir = useMemo(
    () => configuration?.choirs.find((choir) => choir.id === form.choirId) ?? null,
    [configuration, form.choirId],
  );
  const registrationPriceCents = selectedChoir?.registrationPriceCents ?? null;

  const handleChange = (field: keyof RegistrationForm, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    if (errors[field]) setErrors((previous) => ({ ...previous, [field]: undefined }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    if (!selectedChoir) {
      setErrors((previous) => ({ ...previous, choirId: "Selecione um coro/diocese." }));
      return;
    }

    const parsedForm = registrationSchema.safeParse({
      ...form,
      displayedQuote: {
        pricingType: selectedChoir.pricingType,
        standardPriceCents: selectedChoir.standardPriceCents,
        registrationPriceCents: selectedChoir.registrationPriceCents,
      },
    });
    if (!parsedForm.success) {
      const nextErrors: Partial<Record<keyof RegistrationForm, string>> = {};
      for (const issue of parsedForm.error.issues) {
        const field = issue.path[0] as keyof RegistrationForm | undefined;
        if (field && !nextErrors[field]) nextErrors[field] = issue.message;
      }
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setCheckoutError("");
    setIsSubmitting(true);
    try {
      const result = await startCheckout(parsedForm.data);
      if (!result.ok) {
        const normalizedMessage = result.message.toLocaleLowerCase("pt-BR");
        const shouldRefresh =
          normalizedMessage.includes("configuração de preços mudou") ||
          normalizedMessage.includes("coro selecionado não está disponível");
        setCheckoutError(result.message);
        if (shouldRefresh) await refreshConfiguration(true);
        return;
      }
      navigateToCheckout(result.checkoutUrl);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "";
      const normalizedMessage = message.toLocaleLowerCase("pt-BR");
      const shouldRefresh =
        normalizedMessage.includes("configuração de preços mudou") ||
        normalizedMessage.includes("coro selecionado não está disponível");
      setCheckoutError(
        shouldRefresh
          ? "A configuração de preços mudou. Confira o valor e tente novamente."
          : "Não foi possível preparar o pagamento. Tente novamente.",
      );
      if (shouldRefresh) await refreshConfiguration(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="inscricao" className="section-padding bg-background">
      <div className="container-event px-5 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-amber/10 px-4 py-1.5 text-sm font-bold text-amber">
            <BadgeCheck className="size-4" aria-hidden="true" />
            Inscrição
          </span>
          <h2 className="mt-4 font-display text-[clamp(2rem,8vw,3rem)] font-bold leading-tight text-foreground md:text-5xl">
            Garanta sua participação
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Preencha seus dados para participar do II Encontro de Coros Diocesanos e Litúrgicos do
            Regional Nordeste 1 - CNBB.
          </p>
          <div className="mx-auto mt-6 flex max-w-sm flex-col items-center justify-center gap-2 rounded-2xl border border-amber/40 bg-amber/10 px-5 py-4 sm:inline-flex sm:max-w-none sm:flex-row sm:flex-wrap sm:gap-3 sm:rounded-full sm:py-3">
            <span className="text-sm font-bold text-muted-foreground">Inscrição</span>
            <span className="font-display text-3xl font-extrabold leading-none text-foreground">
              {registrationPriceCents === null
                ? "Selecione seu coro"
                : formatCurrency(registrationPriceCents)}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-bold text-teal">
              <img src={pixLogo} alt="" className="h-4 w-auto" aria-hidden="true" /> Pix sem taxa •
              cartão em até 12x
            </span>
          </div>
        </div>

        {configurationError && (
          <div className="mx-auto mt-8 flex max-w-4xl flex-col items-center gap-3 text-center">
            <p role="alert" className="text-destructive">
              {configurationError}
            </p>
            <Button type="button" variant="outline" onClick={() => void refreshConfiguration()}>
              Tentar novamente
            </Button>
          </div>
        )}

        <Card className="relative mx-auto mt-9 max-w-5xl overflow-hidden rounded-3xl border-border bg-card shadow-xl shadow-teal/10 sm:mt-12">
          <div className="h-1.5 bg-teal" aria-hidden="true" />
          <CardContent className="p-5 sm:p-8 lg:p-10">
            <form onSubmit={handleSubmit} className="space-y-9">
              <fieldset className="space-y-5">
                <legend className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-teal/10 text-teal">
                    <UserRound className="size-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span
                      role="heading"
                      aria-level={3}
                      className="block font-display text-xl font-extrabold text-foreground sm:text-2xl"
                    >
                      Dados pessoais
                    </span>
                    <span className="mt-0.5 block text-sm font-normal text-muted-foreground">
                      Informe os dados da pessoa participante.
                    </span>
                  </span>
                </legend>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="font-semibold">
                      Nome completo
                    </Label>
                    <div className="relative">
                      <UserRound
                        className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <Input
                        id="name"
                        required
                        autoComplete="name"
                        value={form.name}
                        onChange={(event) => handleChange("name", event.target.value)}
                        placeholder="Seu nome e sobrenome"
                        className={inputClassName}
                      />
                    </div>
                    {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cpf" className="font-semibold">
                      CPF
                    </Label>
                    <div className="relative">
                      <BadgeCheck
                        className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <Input
                        id="cpf"
                        required
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={14}
                        aria-invalid={Boolean(errors.cpf)}
                        aria-describedby={errors.cpf ? "cpf-error" : undefined}
                        value={form.cpf}
                        onChange={(event) => handleChange("cpf", formatCpf(event.target.value))}
                        placeholder="000.000.000-00"
                        className={inputClassName}
                      />
                    </div>
                    {errors.cpf && (
                      <p id="cpf-error" role="alert" className="text-sm text-destructive">
                        {errors.cpf}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="font-semibold">
                      E-mail
                    </Label>
                    <div className="relative">
                      <Mail
                        className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <Input
                        id="email"
                        type="email"
                        required
                        autoComplete="email"
                        value={form.email}
                        onChange={(event) => handleChange("email", event.target.value)}
                        placeholder="seunome@email.com"
                        className={inputClassName}
                      />
                    </div>
                    {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="font-semibold">
                      WhatsApp
                    </Label>
                    <div className="relative">
                      <Phone
                        className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <Input
                        id="phone"
                        type="tel"
                        required
                        autoComplete="tel"
                        value={form.phone}
                        onChange={(event) => handleChange("phone", event.target.value)}
                        placeholder="(88) 99999-9999"
                        className={inputClassName}
                      />
                    </div>
                    {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="birthDate" className="font-semibold">
                      Data de nascimento
                    </Label>
                    <div className="relative md:max-w-[calc(50%-0.625rem)]">
                      <CalendarDays
                        className="pointer-events-none absolute left-4 top-1/2 z-10 size-5 -translate-y-1/2 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <Input
                        id="birthDate"
                        type="date"
                        required
                        max={getFortalezaCalendarDate()}
                        value={form.birthDate}
                        onChange={(event) => handleChange("birthDate", event.target.value)}
                        className={inputClassName}
                      />
                    </div>
                    {errors.birthDate && (
                      <p className="text-sm text-destructive">{errors.birthDate}</p>
                    )}
                  </div>
                </div>
              </fieldset>

              <div className="h-px bg-border" aria-hidden="true" />

              <fieldset className="space-y-5">
                <legend className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-amber/15 text-amber">
                    <Music2 className="size-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span
                      role="heading"
                      aria-level={3}
                      className="block font-display text-xl font-extrabold text-foreground sm:text-2xl"
                    >
                      Participação
                    </span>
                    <span className="mt-0.5 block text-sm font-normal text-muted-foreground">
                      Selecione o coro ou diocese para confirmar o valor.
                    </span>
                  </span>
                </legend>

                <div className="space-y-2">
                  <Label htmlFor="choirId" className="font-semibold">
                    Coro/Diocese
                  </Label>
                  <div className="relative">
                    <Music2
                      className="pointer-events-none absolute left-4 top-1/2 z-10 size-5 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <select
                      id="choirId"
                      required
                      value={form.choirId}
                      onChange={(event) => handleChange("choirId", event.target.value)}
                      disabled={!configuration || configuration.choirs.length === 0}
                      className="min-h-14 w-full rounded-xl border border-border bg-background pl-12 pr-10 text-base shadow-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-teal/30 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">
                        {isLoadingConfiguration ? "Carregando coros…" : "Selecione o coro/diocese"}
                      </option>
                      {configuration?.choirs.map((choir) => (
                        <option key={choir.id} value={choir.id}>
                          {choir.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {configuration?.choirs.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      As inscrições estarão disponíveis após o cadastro dos coros e valores.
                    </p>
                  )}
                  {errors.choirId && <p className="text-sm text-destructive">{errors.choirId}</p>}
                </div>

                {selectedChoir?.pricingType === "promotional" && (
                  <div
                    role="status"
                    className="rounded-2xl border border-amber/40 bg-amber/10 p-4 text-sm leading-relaxed text-foreground sm:p-5"
                  >
                    Este é um{" "}
                    <strong>
                      valor promocional de {formatCurrency(selectedChoir.registrationPriceCents)}
                    </strong>{" "}
                    porque o coralista deverá vender rifas para subsidiar o valor restante da
                    inscrição de {formatCurrency(selectedChoir.standardPriceCents)}.
                  </div>
                )}
              </fieldset>

              {registrationPriceCents !== null && (
                <div className="flex flex-col gap-4 rounded-2xl border border-teal/20 bg-teal/5 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-full bg-white text-teal shadow-sm">
                      <ShieldCheck className="size-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="font-bold text-foreground">Valor da inscrição</p>
                      <p className="text-sm text-muted-foreground">
                        Pagamento processado com segurança
                      </p>
                    </div>
                  </div>
                  <span className="font-display text-3xl font-extrabold leading-none text-teal">
                    {formatCurrency(registrationPriceCents)}
                  </span>
                </div>
              )}

              {checkoutError && (
                <p aria-live="polite" className="text-sm text-destructive">
                  {checkoutError}
                </p>
              )}

              <div className="space-y-3">
                <Button
                  type="submit"
                  disabled={isSubmitting || !configuration || configuration.choirs.length === 0}
                  className="min-h-14 w-full rounded-full bg-teal px-6 text-base font-extrabold text-white hover:bg-teal/90 sm:text-lg"
                >
                  {isSubmitting ? "Preparando pagamento…" : "Continuar para pagamento"}
                  {!isSubmitting && <ArrowRight className="ml-2 size-5" aria-hidden="true" />}
                </Button>
                <p className="flex items-center justify-center gap-2 text-center text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  <LockKeyhole className="size-4 shrink-0" aria-hidden="true" /> Seus dados serão
                  usados apenas para processar a inscrição.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
