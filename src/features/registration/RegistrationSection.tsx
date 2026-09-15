import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Camera,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PublicRegistrationConfiguration } from "@/features/choirs/choir-pricing.domain";
import { getPublicRegistrationConfiguration } from "@/lib/choir-pricing.functions";
import {
  startRegistrationCheckout,
  type StartRegistrationCheckoutResult,
} from "@/lib/registration.functions";
import {
  getFortalezaCalendarDate,
  registrationSchema,
  voicePartOptions,
  type RegistrationInput,
  type RegistrationPhotoInput,
  type VoicePart,
} from "./registration.domain";
import { prepareRegistrationPhoto } from "./registration-photo";

type RegistrationSectionProps = {
  loadConfiguration?: () => Promise<PublicRegistrationConfiguration>;
  startCheckout?: (input: RegistrationInput) => Promise<StartRegistrationCheckoutResult>;
  navigateToCheckout?: (url: string) => void;
};

type RegistrationForm = Omit<
  RegistrationInput,
  "choirId" | "displayedQuote" | "photo" | "voicePart"
> & { choirId: string; voicePart: VoicePart | "" };

type RegistrationFormField = keyof RegistrationForm | "photo";

const formatCurrency = (valueInCents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valueInCents / 100);

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

const initialForm: Omit<RegistrationForm, "photo"> = {
  name: "",
  cpf: "",
  email: "",
  phone: "",
  birthDate: "",
  choirId: "",
  voicePart: "",
};

const defaultLoadConfiguration = () => getPublicRegistrationConfiguration();

const inputClassName =
  "min-h-11 rounded-xl border-border bg-background pl-10 text-sm shadow-sm transition-shadow focus-visible:ring-2 focus-visible:ring-amber/30";

function RegistrationPriceSummary({
  selectedChoir,
}: {
  selectedChoir: PublicRegistrationConfiguration["choirs"][number] | null;
}) {
  const discountCents = selectedChoir
    ? selectedChoir.standardPriceCents - selectedChoir.registrationPriceCents
    : null;

  return (
    <aside
      aria-label="Resumo do valor da inscrição"
      className="relative overflow-hidden rounded-2xl bg-foreground p-5 text-background shadow-lg shadow-foreground/20 lg:sticky lg:top-24"
    >
      <div
        className="absolute -right-10 -top-12 size-36 rounded-full bg-amber/20 blur-2xl"
        aria-hidden="true"
      />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber">
            Resumo do investimento
          </p>
          <ShieldCheck className="size-5 text-amber" aria-hidden="true" />
        </div>

        {selectedChoir ? (
          <>
            <p className="mt-3 text-sm text-background/70">{selectedChoir.name}</p>
            {selectedChoir.pricingType === "promotional" && discountCents !== null ? (
              <div className="mt-4 space-y-2 border-t border-background/15 pt-4 text-sm">
                <div className="flex items-center justify-between gap-4 text-background/70">
                  <span>Valor normal</span>
                  <span className="line-through">
                    {formatCurrency(selectedChoir.standardPriceCents)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 text-amber">
                  <span>Desconto das rifas</span>
                  <span className="font-bold">− {formatCurrency(discountCents)}</span>
                </div>
                <div className="mt-3 flex items-end justify-between gap-4 border-t border-background/15 pt-3">
                  <span className="font-bold">Você paga agora</span>
                  <span className="font-display text-3xl font-extrabold">
                    {formatCurrency(selectedChoir.registrationPriceCents)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex items-end justify-between gap-4 border-t border-background/15 pt-4">
                <span className="font-bold">Valor da inscrição</span>
                <span className="font-display text-3xl font-extrabold">
                  {formatCurrency(selectedChoir.registrationPriceCents)}
                </span>
              </div>
            )}

            {selectedChoir.pricingType === "promotional" && discountCents !== null && (
              <div
                role="status"
                className="mt-5 rounded-xl border border-amber/35 bg-amber/10 p-3 text-xs leading-relaxed text-background/90"
              >
                <p className="font-bold text-amber">Programa de venda de rifas</p>
                <p className="mt-1">
                  Prezado coralista, o <strong>{selectedChoir.name}</strong> aderiu ao programa de
                  venda de rifas. Para conseguir este desconto, você deve vender um total de 25
                  rifas. O valor arrecadado deve ser repassado ao seu regente, que ficará
                  responsável por coletá-lo e pagar o valor restante da inscrição.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-background/25 p-4 text-center text-sm text-background/70">
            Selecione seu coro/diocese para ver o valor da inscrição.
          </div>
        )}

        <div className="mt-5 flex items-center gap-2 border-t border-background/15 pt-4 text-xs text-background/65">
          <img src={pixLogo} alt="" className="h-4 w-auto brightness-0 invert" aria-hidden="true" />
          Pix sem taxa • cartão em até 12x
        </div>
      </div>
    </aside>
  );
}

export function RegistrationSection({
  loadConfiguration = defaultLoadConfiguration,
  startCheckout = (input) => startRegistrationCheckout({ data: input }),
  navigateToCheckout = (url) => window.location.assign(url),
}: RegistrationSectionProps) {
  const [configuration, setConfiguration] = useState<PublicRegistrationConfiguration | null>(null);
  const [configurationError, setConfigurationError] = useState("");
  const [form, setForm] = useState<RegistrationForm>(initialForm);
  const [photo, setPhoto] = useState<RegistrationPhotoInput | null>(null);
  const [photoFileName, setPhotoFileName] = useState("");
  const [errors, setErrors] = useState<Partial<Record<RegistrationFormField, string>>>({});
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
  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    if (errors[field]) setErrors((previous) => ({ ...previous, [field]: undefined }));
  };

  const handlePhotoChange = async (file: File | undefined) => {
    setPhoto(null);
    setPhotoFileName("");
    if (!file) return;

    try {
      const prepared = await prepareRegistrationPhoto(file);
      setPhoto(prepared.payload);
      setPhotoFileName(file.name);
      setErrors((previous) => ({ ...previous, photo: undefined }));
    } catch (caught) {
      setErrors((previous) => ({
        ...previous,
        photo: caught instanceof Error ? caught.message : "Não foi possível ler a foto.",
      }));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    if (!selectedChoir) {
      setErrors((previous) => ({ ...previous, choirId: "Selecione um coro/diocese." }));
      return;
    }
    if (!photo) {
      setErrors((previous) => ({ ...previous, photo: "Envie uma foto do participante." }));
      return;
    }

    const parsedForm = registrationSchema.safeParse({
      ...form,
      photo,
      displayedQuote: {
        pricingType: selectedChoir.pricingType,
        standardPriceCents: selectedChoir.standardPriceCents,
        registrationPriceCents: selectedChoir.registrationPriceCents,
      },
    });
    if (!parsedForm.success) {
      const nextErrors: Partial<Record<RegistrationFormField, string>> = {};
      for (const issue of parsedForm.error.issues) {
        const field = issue.path[0] as RegistrationFormField | undefined;
        if (field && !nextErrors[field]) nextErrors[field] = issue.message;
      }
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setCheckoutError("");
    setIsSubmitting(true);
    try {
      const checkout = await startCheckout(parsedForm.data);
      if (!checkout.ok) throw new Error(checkout.message);
      navigateToCheckout(checkout.checkoutUrl);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "";
      const normalizedMessage = message.toLocaleLowerCase("pt-BR");
      const externalCheckoutDisabled = normalizedMessage.includes(
        "checkout externo da infinitepay ainda não foi ativado",
      );
      const shouldRefresh =
        normalizedMessage.includes("configuração de preços mudou") ||
        normalizedMessage.includes("coro selecionado não está disponível");
      setCheckoutError(
        externalCheckoutDisabled
          ? message
          : shouldRefresh
            ? "A configuração de preços mudou. Confira o valor e tente novamente."
            : "Não foi possível preparar o pagamento. Tente novamente.",
      );
      if (shouldRefresh) await refreshConfiguration(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      id="inscricao"
      className="relative isolate overflow-hidden bg-[radial-gradient(circle_at_15%_0%,rgba(244,193,54,0.3),transparent_32%),linear-gradient(135deg,#14120f_0%,#3b2a16_52%,#17130f_100%)] px-4 py-8 text-white sm:px-6 lg:min-h-[calc(100dvh-4.5rem)] lg:py-10"
    >
      <div className="container-event">
        <div className="mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-amber px-3 py-1 text-xs font-bold uppercase tracking-wide text-foreground shadow-lg shadow-amber/20">
            <BadgeCheck className="size-4" aria-hidden="true" />
            Inscrição
          </span>
          <h2 className="mt-3 font-display text-[clamp(2rem,6vw,3.2rem)] font-bold leading-tight text-white">
            Realize sua inscrição
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-white/75 sm:text-base">
            Preencha seus dados para participar do II Encontro de Coros Diocesanos e Litúrgicos do
            Regional Nordeste 1 - CNBB.
          </p>
        </div>

        {configurationError && (
          <div className="mx-auto mt-3 flex max-w-4xl flex-col items-center justify-center gap-2 text-center sm:flex-row">
            <p role="alert" className="text-sm text-destructive">
              {configurationError}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refreshConfiguration()}
            >
              Tentar novamente
            </Button>
          </div>
        )}

        <Card className="relative mx-auto mt-7 max-w-7xl overflow-hidden rounded-3xl border-white/15 bg-card shadow-2xl shadow-black/30">
          <div className="h-1.5 bg-amber" aria-hidden="true" />
          <CardContent className="p-4 sm:p-5 lg:p-6">
            <form
              onSubmit={handleSubmit}
              noValidate
              className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.8fr)] lg:gap-8"
            >
              <div className="min-w-0 space-y-3">
                <fieldset className="space-y-3">
                  <legend className="flex items-center gap-2.5">
                    <span className="grid size-8 place-items-center rounded-lg bg-foreground text-background">
                      <UserRound className="size-4" aria-hidden="true" />
                    </span>
                    <span>
                      <span
                        role="heading"
                        aria-level={3}
                        className="block font-display text-lg font-extrabold text-foreground"
                      >
                        Dados pessoais
                      </span>
                      <span className="block text-xs font-normal text-muted-foreground">
                        Informe os dados da pessoa participante.
                      </span>
                    </span>
                  </legend>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="font-semibold">
                        Nome completo
                      </Label>
                      <div className="relative">
                        <UserRound
                          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
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

                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="font-semibold">
                        E-mail
                      </Label>
                      <div className="relative">
                        <Mail
                          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
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

                    <div className="space-y-1.5">
                      <Label htmlFor="cpf" className="font-semibold">
                        CPF
                      </Label>
                      <Input
                        id="cpf"
                        required
                        inputMode="numeric"
                        autoComplete="off"
                        value={form.cpf}
                        onChange={(event) => handleChange("cpf", formatCpf(event.target.value))}
                        placeholder="000.000.000-00"
                        className={inputClassName}
                      />
                      {errors.cpf && <p className="text-sm text-destructive">{errors.cpf}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="phone" className="font-semibold">
                        WhatsApp
                      </Label>
                      <div className="relative">
                        <Phone
                          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
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

                    <div className="space-y-1.5">
                      <Label htmlFor="birthDate" className="font-semibold">
                        Data de nascimento
                      </Label>
                      <div className="relative">
                        <CalendarDays
                          className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground"
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

                    <div className="space-y-1.5">
                      <Label htmlFor="choirId" className="font-semibold">
                        Coro/Diocese
                      </Label>
                      <div className="relative">
                        <Music2
                          className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <select
                          id="choirId"
                          required
                          value={form.choirId}
                          onChange={(event) => handleChange("choirId", event.target.value)}
                          disabled={!configuration || configuration.choirs.length === 0}
                          className="min-h-11 w-full rounded-xl border border-border bg-background pl-10 pr-9 text-sm shadow-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-amber/30 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="">
                            {isLoadingConfiguration
                              ? "Carregando coros…"
                              : "Selecione o coro/diocese"}
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
                      {errors.choirId && (
                        <p className="text-sm text-destructive">{errors.choirId}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="voicePart" className="font-semibold">
                        Perfil musical
                      </Label>
                      <div className="relative">
                        <Music2
                          className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <select
                          id="voicePart"
                          required
                          value={form.voicePart}
                          onChange={(event) => handleChange("voicePart", event.target.value)}
                          className="min-h-11 w-full rounded-xl border border-border bg-background pl-10 pr-9 text-sm shadow-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-amber/30"
                        >
                          <option value="">Selecione seu perfil</option>
                          {voicePartOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      {errors.voicePart && (
                        <p className="text-sm text-destructive">{errors.voicePart}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="photo" className="font-semibold">
                        Foto do participante
                      </Label>
                      <label
                        htmlFor="photo"
                        className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 text-sm shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-amber/30"
                      >
                        <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                          <Camera className="size-4 shrink-0 text-foreground" aria-hidden="true" />
                          <span className="truncate">
                            {photoFileName || "JPG, PNG ou WebP • até 5 MB"}
                          </span>
                        </span>
                        <span className="shrink-0 rounded-lg bg-amber/20 px-2.5 py-1 text-xs font-bold text-foreground">
                          Escolher
                        </span>
                        <input
                          id="photo"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          required
                          aria-invalid={Boolean(errors.photo)}
                          aria-describedby={errors.photo ? "photo-error" : undefined}
                          className="sr-only"
                          onChange={(event) => void handlePhotoChange(event.target.files?.[0])}
                        />
                      </label>
                      {errors.photo && (
                        <p id="photo-error" role="alert" className="text-sm text-destructive">
                          {errors.photo}
                        </p>
                      )}
                    </div>
                  </div>
                </fieldset>

                {checkoutError && (
                  <p role="alert" aria-live="polite" className="text-sm text-destructive">
                    {checkoutError}
                  </p>
                )}

                <div className="space-y-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting || !configuration || configuration.choirs.length === 0}
                    className="min-h-11 w-full rounded-full bg-foreground px-6 text-sm font-extrabold text-background hover:bg-foreground/90"
                  >
                    {isSubmitting ? "Preparando pagamento…" : "Continuar para pagamento"}
                    {!isSubmitting && <ArrowRight className="ml-2 size-5" aria-hidden="true" />}
                  </Button>
                  <p className="flex items-center justify-center gap-2 text-center text-xs leading-relaxed text-muted-foreground">
                    <LockKeyhole className="size-4 shrink-0" aria-hidden="true" /> Seus dados serão
                    usados apenas para processar a inscrição.
                  </p>
                </div>
              </div>

              <RegistrationPriceSummary selectedChoir={selectedChoir} />
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
