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

import eventLogo from "@/assets/logo-coros-preto.png";
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
  shirtSizeSchema,
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
  "choirId" | "displayedQuote" | "displayedShirtPriceCents" | "photo" | "voicePart"
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
  includeShirt: false,
  shirtSize: "",
};

const defaultLoadConfiguration = () => getPublicRegistrationConfiguration();

const inputClassName =
  "min-h-11 rounded-xl border-border bg-background pl-10 text-sm shadow-sm transition-shadow focus-visible:ring-2 focus-visible:ring-amber/30";

function RegistrationBadgePreview({
  name,
  choirName,
  voicePartLabel,
  photoPreviewUrl,
}: {
  name: string;
  choirName: string;
  voicePartLabel: string;
  photoPreviewUrl: string;
}) {
  const participantName = name.trim() || "Seu nome";

  return (
    <aside
      aria-label="Prévia do crachá"
      className="relative mx-auto flex min-h-[23rem] w-full max-w-sm items-center justify-center overflow-hidden rounded-2xl bg-muted/35 px-5 pb-4 pt-14"
    >
      <div
        className="absolute left-1/2 top-0 h-24 w-28 -translate-x-1/2 rounded-b-full border-[0.65rem] border-t-0 border-foreground"
        aria-hidden="true"
      />
      <div
        className="absolute left-1/2 top-[4.55rem] z-10 h-7 w-7 -translate-x-1/2 rounded-md bg-amber shadow-inner ring-4 ring-background/70"
        aria-hidden="true"
      />
      <div className="relative w-full max-w-[18.5rem] rounded-2xl border-2 border-foreground border-t-[0.65rem] border-t-amber bg-card px-5 pb-4 pt-3 shadow-[0.55rem_0.65rem_0_rgba(214,168,38,0.28)]">
        <img
          src={eventLogo}
          alt="Logo do Encontro de Coros"
          className="mx-auto h-10 w-auto object-contain"
        />
        <div className="mx-auto mt-2 h-32 w-32 overflow-hidden rounded-2xl border-4 border-amber bg-muted">
          {photoPreviewUrl ? (
            <img
              src={photoPreviewUrl}
              alt={`Foto de ${participantName} no crachá`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full place-items-center px-6 text-center text-muted-foreground">
              <span>
                <Camera className="mx-auto mb-2 size-10" aria-hidden="true" />
                <span className="text-xs">Sua foto aparece aqui</span>
              </span>
            </div>
          )}
        </div>
        <p className="mt-3 text-center text-[0.65rem] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Participante
        </p>
        <p className="truncate text-center font-display text-xl font-bold text-card-foreground">
          {participantName}
        </p>
        <p className="mx-auto mt-1 line-clamp-2 min-h-9 max-w-[15rem] text-center text-sm font-semibold leading-snug text-card-foreground">
          {choirName || "Seu coro/diocese"}
        </p>
        <p className="mt-1 text-center text-xs font-bold text-amber">
          {voicePartLabel || "Perfil musical"}
        </p>
        <span className="mx-auto mt-3 block w-fit rounded-full bg-foreground px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-amber">
          Quixadá • 2026
        </span>
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
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
  const [photoFileName, setPhotoFileName] = useState("");
  const [errors, setErrors] = useState<Partial<Record<RegistrationFormField, string>>>({});
  const [checkoutError, setCheckoutError] = useState("");
  const [hasCpfConflict, setHasCpfConflict] = useState(false);
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
  const shirtPriceCents = configuration?.shirtPriceCents ?? null;
  const selectedVoicePartLabel =
    voicePartOptions.find((option) => option.value === form.voicePart)?.label ?? "";
  const totalAmount =
    registrationPriceCents === null
      ? null
      : registrationPriceCents +
        (form.includeShirt && shirtPriceCents !== null ? shirtPriceCents : 0);

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    if (errors[field]) setErrors((previous) => ({ ...previous, [field]: undefined }));
  };

  const handlePhotoChange = async (file: File | undefined) => {
    setPhoto(null);
    setPhotoPreviewUrl("");
    setPhotoFileName("");
    if (!file) return;

    try {
      const prepared = await prepareRegistrationPhoto(file);
      setPhoto(prepared.payload);
      setPhotoPreviewUrl(prepared.previewUrl);
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
      displayedShirtPriceCents: shirtPriceCents,
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
      className="bg-background px-4 py-5 sm:px-6 lg:min-h-[calc(100dvh-4.5rem)] lg:py-6"
    >
      <div className="container-event">
        <div className="mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-amber/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber">
            <BadgeCheck className="size-4" aria-hidden="true" />
            Inscrição
          </span>
          <h2 className="mt-2 font-display text-[clamp(1.8rem,6vw,2.65rem)] font-bold leading-tight text-foreground">
            Garanta sua participação
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Preencha seus dados para participar do II Encontro de Coros Diocesanos e Litúrgicos do
            Regional Nordeste 1 - CNBB.
          </p>
          <div className="mx-auto mt-3 flex max-w-sm flex-col items-center justify-center gap-1.5 rounded-2xl border border-amber/40 bg-amber/10 px-4 py-2.5 sm:inline-flex sm:max-w-none sm:flex-row sm:flex-wrap sm:gap-3 sm:rounded-full sm:py-2">
            <span className="text-xs font-bold text-muted-foreground">Inscrição</span>
            <span className="font-display text-2xl font-extrabold leading-none text-foreground">
              {registrationPriceCents === null
                ? "Selecione seu coro"
                : formatCurrency(registrationPriceCents)}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-foreground">
              <img src={pixLogo} alt="" className="h-4 w-auto" aria-hidden="true" /> Pix sem taxa •
              cartão em até 12x
            </span>
          </div>
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

        <Card className="relative mx-auto mt-5 max-w-7xl overflow-hidden rounded-3xl border-border bg-card shadow-xl shadow-foreground/10">
          <div className="h-1.5 bg-amber" aria-hidden="true" />
          <CardContent className="p-4 sm:p-5 lg:p-6">
            <form
              onSubmit={handleSubmit}
              noValidate
              className="grid items-center gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(17rem,0.75fr)] lg:gap-7"
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

                    {shirtPriceCents !== null && (
                      <div id="camisa" className="space-y-1.5">
                        <span className="block text-sm font-semibold text-foreground">
                          Camisa oficial
                        </span>
                        <div className="flex min-h-11 items-center gap-2 rounded-xl border border-amber/35 bg-amber/10 px-3">
                          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              aria-label="Incluir camisa oficial"
                              checked={form.includeShirt}
                              onChange={(event) => {
                                setForm((previous) => ({
                                  ...previous,
                                  includeShirt: event.target.checked,
                                  shirtSize: event.target.checked ? previous.shirtSize : "",
                                }));
                                setErrors((previous) => ({
                                  ...previous,
                                  shirtSize: undefined,
                                }));
                              }}
                              className="size-4 shrink-0 rounded border-border accent-foreground"
                            />
                            <span className="truncate text-xs text-foreground">
                              <strong>Incluir</strong> por {formatCurrency(shirtPriceCents)}
                            </span>
                          </label>
                          {form.includeShirt && (
                            <div className="w-24 shrink-0">
                              <Label htmlFor="shirtSize" className="sr-only">
                                Tamanho da camisa
                              </Label>
                              <Select
                                value={form.shirtSize}
                                onValueChange={(value) => {
                                  const parsed = shirtSizeSchema.safeParse(value);
                                  if (parsed.success) {
                                    setForm((previous) => ({
                                      ...previous,
                                      shirtSize: parsed.data,
                                    }));
                                    setErrors((previous) => ({
                                      ...previous,
                                      shirtSize: undefined,
                                    }));
                                  }
                                }}
                              >
                                <SelectTrigger
                                  id="shirtSize"
                                  className="min-h-8 rounded-lg border-border bg-background text-xs"
                                >
                                  <SelectValue placeholder="Tamanho" />
                                </SelectTrigger>
                                <SelectContent>
                                  {["P", "M", "G", "GG", "XG"].map((size) => (
                                    <SelectItem key={size} value={size}>
                                      {size}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                        {errors.shirtSize && (
                          <p className="text-xs text-destructive">{errors.shirtSize}</p>
                        )}
                      </div>
                    )}
                  </div>
                </fieldset>

                {selectedChoir?.pricingType === "promotional" && (
                  <div
                    role="status"
                    className="rounded-xl border border-amber/40 bg-amber/10 p-2.5 text-xs leading-relaxed text-foreground"
                  >
                    Este é um{" "}
                    <strong>
                      valor promocional de {formatCurrency(selectedChoir.registrationPriceCents)}
                    </strong>{" "}
                    porque o coralista deverá vender rifas para subsidiar o valor restante da
                    inscrição de {formatCurrency(selectedChoir.standardPriceCents)}.
                  </div>
                )}

                {registrationPriceCents !== null && totalAmount !== null && (
                  <div className="flex flex-col gap-2 rounded-xl border border-amber/30 bg-amber/5 p-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="grid size-8 place-items-center rounded-full bg-foreground text-background shadow-sm">
                        <ShieldCheck className="size-4" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="font-bold text-foreground">Total da inscrição</p>
                        <p className="text-xs text-muted-foreground">
                          {form.includeShirt ? "Inscrição + camisa oficial" : "Pagamento seguro"}
                        </p>
                      </div>
                    </div>
                    <span className="font-display text-2xl font-extrabold leading-none text-foreground">
                      {formatCurrency(totalAmount)}
                    </span>
                  </div>
                )}

                {checkoutError && (
                  <p role="alert" aria-live="polite" className="text-sm text-destructive">
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

              <RegistrationBadgePreview
                name={form.name}
                choirName={selectedChoir?.name ?? ""}
                voicePartLabel={selectedVoicePartLabel}
                photoPreviewUrl={photoPreviewUrl}
              />
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
