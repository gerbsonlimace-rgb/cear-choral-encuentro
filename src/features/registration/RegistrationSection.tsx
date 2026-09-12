import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Camera,
  Check,
  LockKeyhole,
  Mail,
  Music2,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import pixLogo from "@/assets/logo-pix.svg";
import eventLogoOnLight from "@/assets/logo-coros-branco.png";
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
  birthDateSchema,
  cpfSchema,
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
  "min-h-11 rounded-lg border-border bg-background pl-10 text-sm shadow-sm transition-shadow focus-visible:ring-2 focus-visible:ring-amber/30";

const stepFields: Record<1 | 2, RegistrationFormField[]> = {
  1: ["name", "cpf", "email", "phone", "birthDate", "photo"],
  2: ["choirId", "voicePart"],
};

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

function RegistrationBadgePreview({
  name,
  photo,
}: {
  name: string;
  photo: RegistrationPhotoInput | null;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?";
  const photoSrc = photo ? `data:${photo.contentType};base64,${photo.dataBase64}` : null;

  return (
    <aside aria-label="Prévia do crachá" className="mx-auto w-full max-w-[15rem] lg:sticky lg:top-24">
      <p className="mb-1 text-center text-[0.65rem] font-bold uppercase text-muted-foreground">Prévia do seu crachá</p>
      <div className="relative mx-auto h-12 w-28" aria-hidden="true">
        <span className="absolute left-4 top-0 h-12 w-1 origin-top rotate-12 rounded-full bg-amber" />
        <span className="absolute right-4 top-0 h-12 w-1 origin-top -rotate-12 rounded-full bg-amber" />
        <span className="absolute bottom-0 left-1/2 h-3 w-8 -translate-x-1/2 rounded-md border-2 border-amber bg-muted" />
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-background shadow-lg">
        <div className="h-2 bg-amber" aria-hidden="true" />
        <div className="px-4 py-4 text-center">
          <img src={eventLogoOnLight} alt="II Encontro de Coros" className="mx-auto h-12 w-auto object-contain" />
          <div className="mx-auto mt-3 grid size-20 place-items-center overflow-hidden rounded-full border-[3px] border-amber bg-muted font-display text-2xl font-extrabold text-foreground">
            {photoSrc ? <img src={photoSrc} alt="Foto do participante" className="size-full object-cover" /> : initials}
          </div>
          <p className="mt-3 break-words font-display text-lg font-extrabold leading-tight text-foreground">{name.trim() || "Seu nome"}</p>
          <p className="mt-1 text-[0.65rem] font-bold uppercase text-muted-foreground">Participante</p>
        </div>
        <div className="bg-foreground px-3 py-2 text-center text-[0.65rem] font-semibold text-background">
          Quixadá • 20–22 nov. 2026
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
  const [hasCpfConflict, setHasCpfConflict] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingConfiguration, setIsLoadingConfiguration] = useState(true);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
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

  const focusFirstError = (nextErrors: Partial<Record<RegistrationFormField, string>>) => {
    const firstField = Object.keys(nextErrors)[0];
    if (!firstField) return;
    window.requestAnimationFrame(() => document.getElementById(firstField)?.focus());
  };

  const validateStep = (step: 1 | 2) => {
    const nextErrors: Partial<Record<RegistrationFormField, string>> = {};

    if (step === 1) {
      if (form.name.trim().length < 2) nextErrors.name = "Informe seu nome completo.";
      const cpfResult = cpfSchema.safeParse(form.cpf);
      if (!cpfResult.success) nextErrors.cpf = cpfResult.error.issues[0]?.message;
      if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) nextErrors.email = "Informe um e-mail válido.";
      if (form.phone.trim().length < 8) nextErrors.phone = "Informe um WhatsApp válido.";
      const birthDateResult = birthDateSchema.safeParse(form.birthDate);
      if (!birthDateResult.success) nextErrors.birthDate = birthDateResult.error.issues[0]?.message;
      if (!photo) nextErrors.photo = "Envie uma foto do participante.";
    } else {
      if (!selectedChoir) nextErrors.choirId = "Selecione um coro/diocese.";
      if (!form.voicePart) nextErrors.voicePart = "Selecione seu perfil musical.";
    }

    setErrors((previous) => {
      const cleared = { ...previous };
      for (const field of stepFields[step]) delete cleared[field];
      return { ...cleared, ...nextErrors };
    });
    focusFirstError(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const goToNextStep = () => {
    if (currentStep === 1 && validateStep(1)) setCurrentStep(2);
    if (currentStep === 2 && validateStep(2)) setCurrentStep(3);
  };

  const goToPreviousStep = () => {
    setCheckoutError("");
    setCurrentStep((step) => (step === 3 ? 2 : 1));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    if (currentStep < 3) {
      goToNextStep();
      return;
    }
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
    setHasCpfConflict(false);
    setIsSubmitting(true);
    try {
      const checkout = await startCheckout(parsedForm.data);
      if (!checkout.ok) throw new Error(checkout.message);
      navigateToCheckout(checkout.checkoutUrl);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "";
      const normalizedMessage = message.toLocaleLowerCase("pt-BR");
      const cpfConflict = normalizedMessage.includes("já existe uma inscrição para este cpf");
      const externalCheckoutDisabled = normalizedMessage.includes(
        "checkout externo da infinitepay ainda não foi ativado",
      );
      const shouldRefresh =
        normalizedMessage.includes("configuração de preços mudou") ||
        normalizedMessage.includes("coro selecionado não está disponível");
      setCheckoutError(
        externalCheckoutDisabled
          ? message
          : cpfConflict
            ? "Já existe uma inscrição para este CPF."
            : shouldRefresh
              ? "A configuração de preços mudou. Confira o valor e tente novamente."
              : "Não foi possível preparar o pagamento. Tente novamente.",
      );
      setHasCpfConflict(cpfConflict);
      if (shouldRefresh) await refreshConfiguration(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      id="inscricao"
      className="relative isolate overflow-hidden bg-foreground px-4 py-6 text-background sm:px-6 lg:min-h-[calc(100dvh-4.5rem)] lg:py-7"
    >
      <div className="container-event">
        <div className="mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-amber px-3 py-1 text-xs font-bold uppercase tracking-wide text-foreground shadow-lg shadow-amber/20">
            <BadgeCheck className="size-4" aria-hidden="true" />
            Inscrição
          </span>
          <h2 className="mt-2 font-display text-[clamp(2rem,5vw,2.6rem)] font-bold leading-tight text-background">
            Realize sua inscrição
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-background/75 sm:text-base">
            São apenas três etapas. Você poderá conferir tudo antes de pagar.
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

        <Card className="relative mx-auto mt-5 max-w-5xl overflow-hidden rounded-2xl border-background/15 bg-card shadow-2xl shadow-foreground/30">
          <div className="h-1.5 bg-amber" aria-hidden="true" />
          <CardContent className="p-4 sm:p-6 lg:p-7">
            <nav aria-label="Etapas da inscrição" className="mb-5">
              <ol className="grid grid-cols-3 gap-2 sm:gap-4">
                {[
                  { number: 1, label: "Seus dados" },
                  { number: 2, label: "Participação" },
                  { number: 3, label: "Revisão" },
                ].map((step) => {
                  const active = currentStep === step.number;
                  const complete = currentStep > step.number;
                  return (
                    <li
                      key={step.number}
                      aria-current={active ? "step" : undefined}
                      className="min-w-0 text-center"
                    >
                      <div className="mb-2 flex items-center" aria-hidden="true">
                        <span className={`h-0.5 flex-1 ${step.number === 1 ? "bg-transparent" : complete || active ? "bg-amber" : "bg-border"}`} />
                        <span className={`grid size-8 shrink-0 place-items-center rounded-full border-2 text-xs font-extrabold ${active ? "border-amber bg-amber text-amber-foreground shadow-md" : complete ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground"}`}>
                          {complete ? <Check className="size-5" /> : step.number}
                        </span>
                        <span className={`h-0.5 flex-1 ${step.number === 3 ? "bg-transparent" : complete ? "bg-amber" : "bg-border"}`} />
                      </div>
                      <span className={`block truncate text-xs font-bold sm:text-sm ${active ? "text-foreground" : "text-muted-foreground"}`}>
                        {step.label}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </nav>

            <form onSubmit={handleSubmit} noValidate>
              {currentStep === 1 && (
                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_15rem]">
                <fieldset className="space-y-4">
                  <legend className="flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-foreground text-background">
                      <UserRound className="size-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span role="heading" aria-level={3} className="block font-display text-lg font-extrabold text-foreground sm:text-xl">
                        Conte-nos quem é você
                      </span>
                      <span className="block text-sm font-normal text-muted-foreground">Seus dados pessoais e de contato.</span>
                    </span>
                  </legend>

                  <div className="grid gap-x-4 gap-y-3 md:grid-cols-2">
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

                    <div className="space-y-1.5 md:col-span-2">
                      <Label htmlFor="photo" className="font-semibold">Foto do participante</Label>
                      <label htmlFor="photo" className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-muted/40 px-3 text-sm transition-colors hover:border-amber focus-within:ring-2 focus-within:ring-amber/30">
                        <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                          <Camera className="size-5 shrink-0 text-foreground" aria-hidden="true" />
                          <span className="truncate">{photoFileName || "JPG, PNG ou WebP • até 5 MB"}</span>
                        </span>
                        <span className="shrink-0 rounded-lg bg-amber/20 px-3 py-1.5 text-xs font-bold text-foreground">Escolher</span>
                        <input id="photo" type="file" accept="image/jpeg,image/png,image/webp" required aria-invalid={Boolean(errors.photo)} aria-describedby={errors.photo ? "photo-error" : undefined} className="sr-only" onChange={(event) => void handlePhotoChange(event.target.files?.[0])} />
                      </label>
                      {errors.photo && <p id="photo-error" role="alert" className="text-sm text-destructive">{errors.photo}</p>}
                    </div>

                  </div>
                </fieldset>
                <RegistrationBadgePreview name={form.name} photo={photo} />
                </div>
              )}

              {currentStep === 2 && (
                <div className="mx-auto max-w-2xl">
                  <fieldset className="space-y-6">
                    <legend className="flex items-center gap-3">
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-foreground text-background">
                        <Music2 className="size-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span role="heading" aria-level={3} className="block font-display text-xl font-extrabold text-foreground sm:text-2xl">Sua participação</span>
                        <span className="block text-sm font-normal text-muted-foreground">Escolha seu coro e perfil musical.</span>
                      </span>
                    </legend>
                    <div className="grid gap-5">
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
                          className="min-h-14 w-full rounded-xl border border-border bg-background pl-11 pr-10 text-base shadow-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-amber/30 disabled:cursor-not-allowed disabled:opacity-50"
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
                          className="min-h-14 w-full rounded-xl border border-border bg-background pl-11 pr-10 text-base shadow-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-amber/30"
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

                    </div>
                  </fieldset>
                </div>
              )}

              {currentStep === 3 && (
                <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-foreground text-background"><BadgeCheck className="size-5" aria-hidden="true" /></span>
                      <div className="min-w-0">
                        <h3 className="font-display text-xl font-extrabold text-foreground sm:text-2xl">Confira sua inscrição</h3>
                        <p className="text-sm text-muted-foreground">Revise os dados antes de seguir para o pagamento.</p>
                      </div>
                    </div>
                    <dl className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
                      {[
                        ["Nome", form.name], ["CPF", form.cpf], ["E-mail", form.email], ["WhatsApp", form.phone],
                        ["Nascimento", form.birthDate ? new Date(`${form.birthDate}T12:00:00`).toLocaleDateString("pt-BR") : ""],
                        ["Coro/Diocese", selectedChoir?.name ?? ""],
                        ["Perfil musical", voicePartOptions.find((option) => option.value === form.voicePart)?.label ?? ""],
                        ["Foto", photoFileName],
                      ].map(([label, value]) => (
                        <div key={label} className="min-w-0 bg-card p-4">
                          <dt className="text-xs font-bold uppercase text-muted-foreground">{label}</dt>
                          <dd className="mt-1 break-words text-sm font-semibold text-foreground">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  <RegistrationPriceSummary selectedChoir={selectedChoir} />
                </div>
              )}

                {checkoutError && (
                  <p role="alert" aria-live="polite" className="mt-5 rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
                    {checkoutError}
                    {hasCpfConflict && (
                      <>
                        {" "}
                        <a
                          href="#retomar-pagamento"
                          className="font-bold underline underline-offset-4"
                        >
                          Retomar pagamento
                        </a>
                      </>
                    )}
                  </p>
                )}

                <div className="mt-5 space-y-2 border-t border-border pt-4">
                  <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
                    {currentStep > 1 && (
                      <Button type="button" variant="outline" onClick={goToPreviousStep} className="min-h-14 rounded-xl px-7 text-base font-bold">
                        <ArrowLeft className="size-5" aria-hidden="true" /> Voltar
                      </Button>
                    )}
                  <Button
                    type={currentStep === 3 ? "submit" : "button"}
                    onClick={currentStep === 3 ? undefined : goToNextStep}
                    disabled={isSubmitting || !configuration || configuration.choirs.length === 0}
                    className="min-h-12 w-full rounded-lg bg-foreground px-7 text-base font-extrabold text-background hover:bg-foreground/90"
                  >
                    {isSubmitting ? "Preparando pagamento…" : currentStep === 3 ? "Ir para pagamento" : "Continuar"}
                    {!isSubmitting && <ArrowRight className="ml-2 size-5" aria-hidden="true" />}
                  </Button>
                  </div>
                  <p className="flex items-center justify-center gap-2 text-center text-xs leading-relaxed text-muted-foreground">
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
