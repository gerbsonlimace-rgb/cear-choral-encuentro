import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Camera,
  Check,
  CircleHelp,
  CreditCard,
  Fingerprint,
  LockKeyhole,
  Mail,
  MapPin,
  Mic2,
  Music2,
  Phone,
  Piano,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";

import pixLogo from "@/assets/logo-pix.svg";
import infinitePayLogo from "@/assets/logo-infinitepay.svg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  applyRaffleChoice,
  type DisplayedQuote,
  type PublicChoirOption,
  type PublicRegistrationConfiguration,
  type RaffleChoice,
} from "@/features/choirs/choir-pricing.domain";
import { getPublicRegistrationConfiguration } from "@/lib/choir-pricing.functions";
import {
  lookupRegistration,
  startRegistrationCheckout,
  type StartRegistrationCheckoutResult,
} from "@/lib/registration.functions";
import {
  birthDateSchema,
  cpfSchema,
  dioceseOptions,
  isValidBrazilianMobilePhone,
  musicalProfileOptions,
  registrationLookupSchema,
  registrationSchema,
  voicePartOptions,
  type RegistrationInput,
  type RegistrationPhotoInput,
  type Diocese,
  type MusicalProfile,
  type ParticipationType,
  type VoicePart,
} from "./registration.domain";
import type { RegistrationLookupResult } from "./registration.domain";
import { prepareRegistrationPhoto } from "./registration-photo";
import { loadRegistrationDraft, saveRegistrationDraft } from "./registration-draft";
import { RegistrationInstallments } from "./RegistrationInstallments";
import { RafflePrizeHighlight } from "./RafflePrizeHighlight";

type RegistrationSectionProps = {
  loadConfiguration?: () => Promise<PublicRegistrationConfiguration>;
  startCheckout?: (input: RegistrationInput) => Promise<StartRegistrationCheckoutResult>;
  lookupRegistration?: (input: {
    cpf: string;
    birthDate: string;
  }) => Promise<RegistrationLookupResult>;
  navigateToCheckout?: (url: string) => void;
  /** Kept for compatibility with callers using the previous prop. */
  checkAvailability?: (input: { cpf: string; email: string }) => Promise<unknown>;
};

type RegistrationForm = Omit<
  RegistrationInput,
  | "choirId"
  | "otherChoirName"
  | "diocese"
  | "displayedQuote"
  | "photo"
  | "raffleChoice"
  | "musicalProfile"
  | "voicePart"
> & {
  choirId: string;
  otherChoirName: string;
  diocese: "" | Diocese;
  raffleChoice: "" | RaffleChoice;
  musicalProfile: MusicalProfile | "";
  voicePart: VoicePart | "";
};

type RegistrationFormField = keyof RegistrationForm | "photo";
type RegistrationStep = 1 | 2 | 3 | 4;

const OTHER_CHOIR_VALUE = "other";

const formatCurrency = (valueInCents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valueInCents / 100);

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.replace(/^(\d{1,2})/, "($1");
  if (digits.length <= 6) return digits.replace(/^(\d{2})(\d+)/, "($1) $2");
  if (digits.length <= 10) return digits.replace(/^(\d{2})(\d{4})(\d+)/, "($1) $2-$3");
  return digits.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
}

function formatBirthDateInput(value: string): string {
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;

  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function birthDateInputToIso(value: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
}

const initialForm: Omit<RegistrationForm, "photo"> = {
  name: "",
  badgeName: "",
  cpf: "",
  email: "",
  phone: "",
  birthDate: "",
  diocese: "",
  choirId: "",
  otherChoirName: "",
  participationType: "complete",
  raffleChoice: "",
  musicalProfile: "",
  voicePart: "",
};

const defaultLoadConfiguration = () => getPublicRegistrationConfiguration();

const inputClassName =
  "min-h-11 rounded-lg border-border bg-background pl-10 text-base shadow-sm transition-shadow focus-visible:ring-2 focus-visible:ring-amber/30";

const stepFields: Record<1 | 2 | 3, RegistrationFormField[]> = {
  1: ["cpf", "name", "badgeName", "email", "phone", "birthDate", "diocese", "photo"],
  2: ["choirId", "otherChoirName", "musicalProfile", "voicePart"],
  3: ["raffleChoice"],
};

const registrationSteps = [
  { number: 1, label: "Meus dados" },
  { number: 2, label: "Coro e perfil" },
  { number: 3, label: "Tipo de inscrição" },
  { number: 4, label: "Revisão" },
] as const;

const photoDataUrl = (photo: RegistrationPhotoInput | null) =>
  photo ? `data:${photo.contentType};base64,${photo.dataBase64}` : null;

function RegistrationPriceSummary({
  selectedChoir,
  appliedQuote,
  raffleChoice,
}: {
  selectedChoir: PublicChoirOption | null;
  appliedQuote: DisplayedQuote | null;
  raffleChoice: "" | RaffleChoice;
}) {
  const remainingCents =
    appliedQuote && raffleChoice === "participate"
      ? (appliedQuote.remainingPriceCents ??
        appliedQuote.standardPriceCents - appliedQuote.registrationPriceCents)
      : null;

  return (
    <aside
      aria-label="Resumo do valor da inscrição"
      className="registration-surface relative order-first overflow-hidden p-5 lg:order-last lg:sticky lg:top-24"
    >
      <div className="relative">
        <div className="flex items-center justify-between gap-3 border-b border-registration-line pb-3">
          <h3
            role="heading"
            aria-level={3}
            aria-label={appliedQuote?.pricingType === "free" ? "Resumo da inscrição" : "Pagamento de hoje"}
            className="text-xs font-bold uppercase tracking-[0.12em] text-registration-ink"
          >
            {appliedQuote?.pricingType === "free" ? "Resumo da inscrição" : "Pagamento de hoje"}
          </h3>
          <ShieldCheck className="size-5 text-amber-600" aria-hidden="true" />
        </div>

        {selectedChoir && appliedQuote ? (
          <>
            <p className="mt-3 text-sm text-registration-muted">{selectedChoir.name}</p>
            {appliedQuote.pricingType === "free" ? (
              <div className="registration-investment-panel mt-4 space-y-3">
                <p className="text-3xl font-extrabold text-registration-ink">Gratuita</p>
                <p className="text-sm text-registration-muted">
                  Envie seus dados sem pagamento. A inscrição ficará aguardando a aprovação do administrador.
                </p>
              </div>
            ) : raffleChoice === "participate" && remainingCents !== null ? (
              <div className="registration-investment-panel mt-4 space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-bold">Você paga hoje:</span>
                    <span className="text-3xl font-extrabold text-registration-ink">
                      {formatCurrency(appliedQuote.registrationPriceCents)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-registration-line pt-3">
                    <span className="font-semibold">Meta das rifas:</span>
                    <span className="font-bold text-registration-ink">{formatCurrency(remainingCents)}</span>
                  </div>
                </div>
                <p className="rounded-xl border border-amber/35 bg-amber/10 p-3 text-xs leading-relaxed text-registration-ink">
                  Você está aderindo ao Programa de Venda de Rifas do seu coro. Faça sua
                  pré-inscrição no valor de{" "}
                  <strong>{formatCurrency(appliedQuote.registrationPriceCents)}</strong> agora e
                  assuma o compromisso de arrecadar{" "}
                  <strong>{formatCurrency(remainingCents)} com 20 rifas</strong> junto ao seu coro.
                </p>
              </div>
            ) : (
              <div className="registration-investment-panel mt-4 space-y-3">
                <div className="flex items-end justify-between gap-4">
                  <span className="font-bold">Você paga hoje</span>
                  <span className="text-3xl font-extrabold text-registration-ink">
                    {formatCurrency(appliedQuote.registrationPriceCents)}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-registration-muted">
                  O pagamento integral será realizado agora e sua vaga será confirmada após a
                  confirmação desse pagamento.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-registration-line p-4 text-center text-sm text-registration-muted">
            Selecione seu coro para ver o valor da inscrição.
          </div>
        )}

        {appliedQuote?.pricingType !== "free" && <div className="mt-4 flex flex-wrap gap-2 text-xs text-registration-muted">
          <ul className="contents">
            <li className="registration-payment-chip">
              <img
                src={pixLogo}
                alt=""
                className="h-4 w-auto"
                aria-hidden="true"
              />
              Pix sem taxa • cobrança imediata
            </li>
            <li className="registration-payment-chip">
              <CreditCard className="size-4" aria-hidden="true" />
              Cartão em até 5x
            </li>
          </ul>
          <div className="mt-2 flex w-full items-center gap-3 rounded-xl border border-amber/40 bg-amber-50/70 p-3">
            <span className="registration-icon-box size-9 bg-white">
              <ShieldCheck className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-registration-ink">InfinitePay · ambiente oficial</p>
              <p className="text-xs text-registration-muted">Checkout seguro para concluir o pagamento.</p>
            </div>
          </div>
        </div>}
      </div>
    </aside>
  );
}

export function RegistrationSection({
  loadConfiguration = defaultLoadConfiguration,
  startCheckout = (input) => startRegistrationCheckout({ data: input }),
  lookupRegistration: lookupSavedRegistration = (input) => lookupRegistration({ data: input }),
  navigateToCheckout = (url) => window.location.assign(url),
}: RegistrationSectionProps) {
  const [configuration, setConfiguration] = useState<PublicRegistrationConfiguration | null>(null);
  const [configurationError, setConfigurationError] = useState("");
  const [form, setForm] = useState<RegistrationForm>(initialForm);
  const [birthDateInput, setBirthDateInput] = useState("");
  const [photo, setPhoto] = useState<RegistrationPhotoInput | null>(null);
  const [photoFileName, setPhotoFileName] = useState("");
  const [errors, setErrors] = useState<Partial<Record<RegistrationFormField, string>>>({});
  const [checkoutError, setCheckoutError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [freeSubmissionComplete, setFreeSubmissionComplete] = useState(false);
  const [isLoadingConfiguration, setIsLoadingConfiguration] = useState(true);
  const [currentStep, setCurrentStep] = useState<RegistrationStep>(1);
  const [choirQuery, setChoirQuery] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "found" | "not_found">(
    "idle",
  );
  const lookupKey = useRef("");
  const mounted = useRef(false);
  const paymentButtonClick = useRef(false);

  const actionBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = actionBarRef.current;
    const formElement = bar?.closest("form");
    if (!bar || !formElement) return;
    const measure = () => {
      formElement.style.setProperty(
        "--registration-actions-height",
        `${bar.getBoundingClientRect().height}px`,
      );
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(bar);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

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
            !clearSelection &&
            (previous.choirId === OTHER_CHOIR_VALUE ||
              next.choirs.some((choir) => choir.id === previous.choirId))
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
    const draft = loadRegistrationDraft();
    if (draft) {
      setForm({ ...draft.form, participationType: draft.form.participationType ?? "complete" });
      setBirthDateInput(draft.birthDateInput ?? formatBirthDateInput(draft.form.birthDate));
      setPhoto(draft.photo);
      setPhotoFileName(draft.photoFileName);
      setCurrentStep(draft.currentStep);
    }
    setDraftReady(true);
    void refreshConfiguration();
    return () => {
      mounted.current = false;
    };
  }, [refreshConfiguration]);

  useEffect(() => {
    if (!draftReady) return;
    saveRegistrationDraft({ form, photo, photoFileName, birthDateInput, currentStep });
  }, [birthDateInput, currentStep, draftReady, form, photo, photoFileName]);

  const selectedChoir = useMemo(
    () => configuration?.choirs.find((choir) => choir.id === form.choirId) ?? null,
    [configuration, form.choirId],
  );
  const isOtherChoir = form.choirId === OTHER_CHOIR_VALUE;
  const displayedChoir = useMemo<PublicChoirOption | null>(() => {
    if (selectedChoir) return selectedChoir;
    if (
      !isOtherChoir ||
      !configuration ||
      (form.participationType === "complete" && configuration.standardPriceCents === null)
    ) {
      return null;
    }
    return {
      id: OTHER_CHOIR_VALUE,
      name: form.otherChoirName.trim() || "Outro",
      diocese: form.diocese || null,
      pricingType: "standard",
      standardPriceCents: configuration.standardPriceCents ?? configuration.eventPriceCents,
      registrationPriceCents: configuration.standardPriceCents ?? configuration.eventPriceCents,
    };
  }, [configuration, form.diocese, form.otherChoirName, form.participationType, isOtherChoir, selectedChoir]);
  const displayedQuote = useMemo(() => {
    if (!displayedChoir) return null;
    if (form.participationType === "event" && displayedChoir.pricingType !== "free") {
      if (!configuration) return null;
      return {
        pricingType: "standard" as const,
        standardPriceCents: configuration.eventPriceCents,
        registrationPriceCents: configuration.eventPriceCents,
      };
    }
    const availableQuote: DisplayedQuote = {
      pricingType: displayedChoir.pricingType,
      standardPriceCents: displayedChoir.standardPriceCents,
      registrationPriceCents: displayedChoir.registrationPriceCents,
      ...(displayedChoir.remainingPriceCents !== undefined
        ? { remainingPriceCents: displayedChoir.remainingPriceCents }
        : {}),
    };
    const raffleChoice =
      displayedChoir.pricingType === "promotional" ? form.raffleChoice : "full_price";
    return raffleChoice ? applyRaffleChoice(availableQuote, raffleChoice) : null;
  }, [configuration, displayedChoir, form.participationType, form.raffleChoice]);
  const reviewPaymentAmount =
    displayedQuote && displayedQuote.pricingType !== "free"
      ? formatCurrency(displayedQuote.registrationPriceCents)
      : null;

  const filteredChoirs = useMemo(() => {
    const query = choirQuery.trim().toLocaleLowerCase("pt-BR");
    if (!configuration || !query) return configuration?.choirs ?? [];
    return configuration.choirs.filter((choir) =>
      `${choir.name} ${choir.diocese ?? ""}`.toLocaleLowerCase("pt-BR").includes(query),
    );
  }, [choirQuery, configuration]);

  useEffect(() => {
    if (!configuration || currentStep !== 4 || displayedChoir) return;
    setErrors((previous) => ({
      ...previous,
      choirId: "Selecione um coro.",
    }));
    setCurrentStep(2);
  }, [configuration, currentStep, displayedChoir]);

  const handleDioceseChange = (diocese: "" | Diocese) => {
    setForm((previous) => ({
      ...previous,
      diocese,
    }));
    setErrors((previous) => ({
      ...previous,
      diocese: undefined,
    }));
  };

  const handleChoirChange = (choirId: string) => {
    setForm((previous) => {
      const previousChoir = configuration?.choirs.find((choir) => choir.id === previous.choirId);
      const nextChoir = configuration?.choirs.find((choir) => choir.id === choirId);
      const keepsExplicitChoice =
        previousChoir?.pricingType === "promotional" && nextChoir?.pricingType === "promotional";
      const raffleChoice =
        previous.participationType === "event" ||
        choirId === OTHER_CHOIR_VALUE ||
        nextChoir?.pricingType === "standard" ||
        nextChoir?.pricingType === "free"
          ? "full_price"
          : keepsExplicitChoice
            ? previous.raffleChoice
            : "";
      return {
        ...previous,
        choirId,
        otherChoirName: "",
        raffleChoice,
      };
    });
    setErrors((previous) => ({
      ...previous,
      choirId: undefined,
      otherChoirName: undefined,
      raffleChoice: undefined,
    }));
  };

  const handleParticipationTypeChange = (participationType: ParticipationType) => {
    setForm((previous) => {
      const choir = configuration?.choirs.find((candidate) => candidate.id === previous.choirId);
      return {
        ...previous,
        participationType,
        raffleChoice:
          participationType === "event" || choir?.pricingType !== "promotional" ? "full_price" : "",
      };
    });
    setErrors((previous) => ({ ...previous, raffleChoice: undefined }));
  };

  const handleRegistrationOptionChange = (option: "event" | "raffle" | "full_price") => {
    if (option === "event") {
      handleParticipationTypeChange("event");
      return;
    }

    if (option === "raffle" && selectedChoir?.pricingType !== "promotional") return;

    handleParticipationTypeChange("complete");
    setForm((previous) => ({
      ...previous,
      raffleChoice: option === "raffle" ? "participate" : "full_price",
    }));
  };

  const handleMusicalProfileChange = (musicalProfile: MusicalProfile) => {
    setForm((previous) => ({
      ...previous,
      musicalProfile,
      voicePart: musicalProfile === "coralista" ? previous.voicePart : "",
    }));
    setErrors((previous) => ({
      ...previous,
      musicalProfile: undefined,
      voicePart: undefined,
    }));
  };

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    if (field === "cpf") {
      lookupKey.current = "";
      setLookupState("idle");
    }
    if (errors[field]) setErrors((previous) => ({ ...previous, [field]: undefined }));
  };

  const handleBirthDateChange = (value: string) => {
    const formatted = formatBirthDateInput(value);
    setBirthDateInput(formatted);
    setForm((previous) => ({
      ...previous,
      birthDate: birthDateInputToIso(formatted),
    }));
    lookupKey.current = "";
    setLookupState("idle");
    if (errors.birthDate) {
      setErrors((previous) => ({ ...previous, birthDate: undefined }));
    }
  };

  const lookupSavedData = async () => {
    const parsed = registrationLookupSchema.safeParse({
      cpf: form.cpf,
      birthDate: form.birthDate,
    });
    if (!parsed.success) return;
    const key = `${parsed.data.cpf}:${parsed.data.birthDate}`;
    if (lookupKey.current === key) return;
    lookupKey.current = key;
    const choirIdAtLookupStart = form.choirId;
    setLookupState("loading");
    try {
      const result = await lookupSavedRegistration(parsed.data);
      if (result.status === "found") {
        const savedMusicalProfile =
          result.musicalProfile ?? (result.voicePart ? ("coralista" as const) : null);
        const savedChoirId =
          result.choirId && configuration?.choirs.some((choir) => choir.id === result.choirId)
            ? result.choirId
            : result.otherChoirName
              ? OTHER_CHOIR_VALUE
              : null;
        setForm((previous) => ({
          ...previous,
          name: result.name,
          badgeName: result.badgeName ?? previous.badgeName,
          email: result.email,
          phone: result.phone,
          diocese: result.diocese ?? previous.diocese,
          choirId:
            previous.choirId === choirIdAtLookupStart
              ? (savedChoirId ?? previous.choirId)
              : previous.choirId,
          otherChoirName:
            previous.choirId === choirIdAtLookupStart
              ? (result.otherChoirName ?? "")
              : previous.otherChoirName,
          musicalProfile: savedMusicalProfile ?? previous.musicalProfile,
          voicePart:
            savedMusicalProfile === "regente" || savedMusicalProfile === "instrumentista"
              ? ""
              : (result.voicePart ?? previous.voicePart),
        }));
        setLookupState("found");
      } else {
        setLookupState("not_found");
      }
    } catch {
      lookupKey.current = "";
      setLookupState("idle");
    }
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

  const validateStep = (step: 1 | 2 | 3) => {
    const nextErrors: Partial<Record<RegistrationFormField, string>> = {};

    if (step === 1) {
      if (form.name.trim().length < 2) nextErrors.name = "Informe seu nome completo.";
      if (form.badgeName.trim().length < 2) {
        nextErrors.badgeName = "Informe o nome para o crachá.";
      }
      const cpfResult = cpfSchema.safeParse(form.cpf);
      if (!cpfResult.success) nextErrors.cpf = cpfResult.error.issues[0]?.message;
      if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) nextErrors.email = "Informe um e-mail válido.";
      if (!isValidBrazilianMobilePhone(form.phone)) {
        nextErrors.phone = "Informe um WhatsApp brasileiro válido.";
      }
      const birthDateResult = birthDateSchema.safeParse(form.birthDate);
      if (!birthDateResult.success) nextErrors.birthDate = birthDateResult.error.issues[0]?.message;
      if (!form.diocese) nextErrors.diocese = "Selecione sua diocese.";
      if (!photo) nextErrors.photo = "Envie uma foto do participante.";
    } else if (step === 2) {
      if (!selectedChoir && !isOtherChoir) nextErrors.choirId = "Selecione um coro.";
      if (isOtherChoir && form.otherChoirName.trim().length < 2) {
        nextErrors.otherChoirName = "Informe o nome do coro.";
      }
      if (!form.musicalProfile) nextErrors.musicalProfile = "Selecione seu perfil musical.";
      if (form.musicalProfile === "coralista" && !form.voicePart) {
        nextErrors.voicePart = "Selecione seu naipe vocal.";
      }
    } else if (
      form.participationType === "complete" &&
      selectedChoir?.pricingType === "promotional" &&
      !form.raffleChoice
    ) {
      nextErrors.raffleChoice = "Escolha um tipo de inscrição para continuar.";
    }

    setErrors((previous) => {
      const cleared = { ...previous };
      for (const field of stepFields[step]) delete cleared[field];
      return { ...cleared, ...nextErrors };
    });
    focusFirstError(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const goToNextStep = async () => {
    if (currentStep === 1) {
      if (!validateStep(1)) return;
      await lookupSavedData();
      setCurrentStep(2);
      return;
    }
    if (currentStep === 2 && validateStep(2)) {
      setCurrentStep(3);
      return;
    }
    if (currentStep === 3 && validateStep(3)) setCurrentStep(4);
  };

  const goToPreviousStep = () => {
    setCheckoutError("");
    setCurrentStep((step) => (step === 4 ? 3 : step === 3 ? 2 : 1));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    if (currentStep === 4) {
      const wasPaymentButtonClicked = paymentButtonClick.current;
      paymentButtonClick.current = false;
      if (!wasPaymentButtonClicked) return;
    }
    if (currentStep < 4) {
      void goToNextStep();
      return;
    }
    if (!selectedChoir && !isOtherChoir) {
      setErrors((previous) => ({ ...previous, choirId: "Selecione um coro." }));
      setCurrentStep(2);
      return;
    }
    if (!photo) {
      setErrors((previous) => ({ ...previous, photo: "Envie uma foto do participante." }));
      return;
    }
    if (!displayedQuote) {
      const raffleChoiceError = "Escolha um tipo de inscrição para continuar.";
      setErrors((previous) => ({ ...previous, raffleChoice: raffleChoiceError }));
      focusFirstError({ raffleChoice: raffleChoiceError });
      return;
    }

    const parsedForm = registrationSchema.safeParse({
      ...form,
      choirId: isOtherChoir ? null : form.choirId,
      otherChoirName: isOtherChoir ? form.otherChoirName : null,
      voicePart: form.musicalProfile === "coralista" ? form.voicePart || null : null,
      photo,
      displayedQuote,
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
      if ("checkoutUrl" in checkout) {
        navigateToCheckout(checkout.checkoutUrl);
      } else {
        setFreeSubmissionComplete(true);
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "";
      const normalizedMessage = message.toLocaleLowerCase("pt-BR");
      const externalCheckoutDisabled = normalizedMessage.includes(
        "checkout externo da infinitepay ainda não foi ativado",
      );
      const shouldRefresh =
        normalizedMessage.includes("configuração de preços mudou") ||
        normalizedMessage.includes("coro selecionado não está disponível");
      const emailConflict = normalizedMessage.includes("já existe um acesso com este e-mail");
      const cpfConflict = normalizedMessage.includes("já existe uma inscrição para este cpf");
      setCheckoutError(
        externalCheckoutDisabled
          ? message
          : emailConflict
            ? message
            : cpfConflict && selectedChoir?.pricingType === "free"
              ? message
            : shouldRefresh
              ? "A configuração de preços mudou. Confira o valor e tente novamente."
              : selectedChoir?.pricingType === "free"
                ? "Não foi possível enviar a inscrição. Tente novamente."
                : "Não foi possível preparar o pagamento. Tente novamente.",
      );
      if (shouldRefresh) await refreshConfiguration(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (freeSubmissionComplete) {
    return (
      <section id="inscricao" className="registration-shell bg-registration-surface px-4 py-12">
        <div role="status" className="registration-surface mx-auto max-w-2xl p-6 text-center">
          <BadgeCheck className="mx-auto size-12 text-amber-600" aria-hidden="true" />
          <h2 className="mt-4 font-display text-2xl font-bold">Inscrição enviada</h2>
          <p className="mt-3 text-sm text-registration-muted">
            Sua inscrição gratuita foi recebida e aguarda aprovação do administrador.
            Você não precisa realizar pagamento. Consulte a administração do evento para acompanhar a aprovação.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      id="inscricao"
      data-testid="registration-shell"
      data-theme="light"
      className="registration-shell relative isolate overflow-x-clip bg-registration-surface px-4 py-6 text-registration-ink sm:px-6 lg:min-h-[calc(100dvh-4.5rem)] lg:py-7"
    >
      <div className="container-event">
        <div className="registration-intro mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-700 shadow-sm">
            <BadgeCheck className="size-4" aria-hidden="true" />
            Inscrição
          </span>
          <h2 className="mt-2 font-display text-[clamp(2rem,5vw,2.6rem)] font-bold leading-tight text-registration-ink">
            Realize sua inscrição
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-registration-muted sm:text-base">
            São apenas quatro etapas. Você poderá conferir tudo antes de enviar.
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

        <div className="registration-card relative mx-auto mt-5 max-w-6xl overflow-visible rounded-2xl border border-registration-line bg-white shadow-registration-card">
          <div className="h-1.5 rounded-t-2xl bg-amber" aria-hidden="true" />
          <div className="registration-card-content p-4 sm:p-6 lg:p-7">
            <p className="registration-progress-mobile md:hidden" aria-live="polite">
              Etapa {currentStep} de {registrationSteps.length} ·{" "}
              {currentStep === 3 && selectedChoir?.pricingType === "free" ? "Gratuidade" : registrationSteps[currentStep - 1].label}
            </p>
            <nav aria-label="Etapas da inscrição" className="mb-5">
              <ol className="registration-progress-desktop grid grid-cols-4 gap-2 sm:gap-4">
                {[
                  { number: 1, label: "Meus dados" },
                  { number: 2, label: "Coro e perfil" },
                  { number: 3, label: selectedChoir?.pricingType === "free" ? "Gratuidade" : "Tipo de inscrição" },
                  { number: 4, label: "Revisão" },
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
                        <span
                          className={`h-0.5 flex-1 ${step.number === 1 ? "bg-transparent" : complete || active ? "bg-amber" : "bg-border"}`}
                        />
                        <span
                          className={`grid size-8 shrink-0 place-items-center rounded-full border-2 text-xs font-extrabold ${active ? "border-amber bg-amber text-amber-foreground shadow-md" : complete ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground"}`}
                        >
                          {complete ? <Check className="size-5" /> : step.number}
                        </span>
                        <span
                          className={`h-0.5 flex-1 ${step.number === 4 ? "bg-transparent" : complete ? "bg-amber" : "bg-border"}`}
                        />
                      </div>
                      <span
                        className={`block truncate text-xs font-bold sm:text-sm ${active ? "text-foreground" : "text-muted-foreground"}`}
                      >
                        {step.label}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </nav>

            <form onSubmit={handleSubmit} noValidate>
              {currentStep === 1 && (
                <div className="registration-personal-layout grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_15rem]">
                  <fieldset className="registration-step-fieldset min-w-0 space-y-4">
                    <legend className="registration-step-legend flex items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-foreground text-background">
                        <UserRound className="size-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span
                          role="heading"
                          aria-level={3}
                          className="block font-display text-xl font-extrabold text-registration-ink sm:text-2xl"
                        >
                          Dados do participante
                        </span>
                        <span
                          role="heading"
                          aria-level={3}
                          className="sr-only"
                        >
                          Conte-nos quem é você
                        </span>
                        <span className="block text-sm font-normal text-muted-foreground">
                          Seus dados pessoais e de contato.
                        </span>
                      </span>
                    </legend>

                    <div className="registration-personal-fields grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2">
                      <div className="registration-subsection-heading order-0 md:col-span-2">
                        <Fingerprint className="size-4" aria-hidden="true" />
                        <span role="heading" aria-level={4}>
                          Identificação civil
                        </span>
                      </div>
                      <div className="order-1 space-y-1.5">
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

                      <div className="order-3 space-y-1.5">
                        <Label htmlFor="name" className="font-semibold">
                          Nome completo para certificado
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
                        <p className="text-xs text-muted-foreground">
                          Nome completo usado no certificado.
                        </p>
                        {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                      </div>

                      <div className="order-4 space-y-1.5">
                        <Label htmlFor="badgeName" className="font-semibold">
                          Nome para o crachá
                        </Label>
                        <div className="relative">
                          <BadgeCheck
                            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <Input
                            id="badgeName"
                            required
                            autoComplete="nickname"
                            value={form.badgeName}
                            onChange={(event) => handleChange("badgeName", event.target.value)}
                            placeholder="Antonio Lima"
                            className={inputClassName}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Nome curto que aparecerá no crachá. Ex.: Antonio Lima.
                        </p>
                        {errors.badgeName && (
                          <p className="text-sm text-destructive">{errors.badgeName}</p>
                        )}
                      </div>

                      <div className="registration-subsection-heading order-5 md:col-span-2">
                        <MapPin className="size-4" aria-hidden="true" />
                        <span role="heading" aria-level={4}>
                          Contato e diocese
                        </span>
                      </div>

                      <div className="order-6 space-y-1.5">
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

                      <div className="order-6 space-y-1.5">
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
                            onChange={(event) =>
                              handleChange("phone", formatPhone(event.target.value))
                            }
                            placeholder="(88) 99999-9999"
                            inputMode="numeric"
                            maxLength={15}
                            className={inputClassName}
                          />
                        </div>
                        {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
                      </div>

                      <div className="order-2 space-y-1.5">
                        <Label htmlFor="birthDate" className="font-semibold">
                          Data de nascimento
                        </Label>
                        <Input
                          id="birthDate"
                          type="text"
                          required
                          inputMode="numeric"
                          autoComplete="bday"
                          maxLength={10}
                          value={birthDateInput}
                          onChange={(event) => handleBirthDateChange(event.target.value)}
                          onBlur={() => void lookupSavedData()}
                          placeholder="dd/mm/aaaa"
                          className="min-h-11 rounded-lg border-border bg-background px-3 text-base shadow-sm transition-shadow focus-visible:ring-2 focus-visible:ring-amber/30"
                        />
                        {errors.birthDate && (
                          <p className="text-sm text-destructive">{errors.birthDate}</p>
                        )}
                      </div>

                      <div className="order-6 space-y-1.5">
                        <Label htmlFor="diocese" className="font-semibold">
                          Diocese
                        </Label>
                        <div className="relative">
                          <ShieldCheck
                            className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <select
                            id="diocese"
                            required
                            value={form.diocese}
                            onChange={(event) =>
                              handleDioceseChange(event.target.value as "" | Diocese)
                            }
                            className="min-h-11 w-full rounded-lg border border-border bg-background pl-10 pr-10 text-base shadow-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-amber/30"
                          >
                            <option value="">Selecione sua diocese</option>
                            {dioceseOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        {errors.diocese && (
                          <p className="text-sm text-destructive">{errors.diocese}</p>
                        )}
                      </div>

                      <div className="order-8 space-y-1.5 md:col-span-2">
                        <Label htmlFor="photo" className="font-semibold">
                          Foto do participante
                        </Label>
                        <label
                          htmlFor="photo"
                          className="flex min-h-12 min-w-0 cursor-pointer items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-muted/40 px-3 text-sm transition-colors hover:border-amber focus-within:ring-2 focus-within:ring-amber/30"
                        >
                          {photo && (
                            <img
                              src={photoDataUrl(photo) ?? undefined}
                              alt="Prévia da foto de perfil"
                              className="registration-photo-preview size-14 shrink-0 rounded-full object-cover"
                            />
                          )}
                          <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                            <Camera
                              className="size-5 shrink-0 text-foreground"
                              aria-hidden="true"
                            />
                            <span className="truncate">
                              {photoFileName || "JPG, PNG ou WebP • até 5 MB"}
                            </span>
                          </span>
                          <span className="shrink-0 rounded-lg bg-amber/20 px-3 py-1.5 text-xs font-bold text-foreground">
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
                        <p className="text-xs text-muted-foreground">
                          Foto recente, de frente, mostrando apenas o rosto.
                        </p>
                        {errors.photo && (
                          <p id="photo-error" role="alert" className="text-sm text-destructive">
                            {errors.photo}
                          </p>
                        )}
                      </div>
                    </div>
                  </fieldset>
                  {lookupState === "loading" && (
                    <p role="status" className="text-sm text-muted-foreground">
                      Consultando seus dados salvos…
                    </p>
                  )}
                  {lookupState === "found" && (
                    <p role="status" className="text-sm text-emerald-foreground">
                      Encontramos seus dados salvos e preenchemos o formulário.
                    </p>
                  )}
                </div>
              )}

              {(currentStep === 2 || currentStep === 3) && (
                <div className={`registration-step-panel mx-auto ${currentStep === 3 ? "registration-step-panel--types max-w-none" : "max-w-2xl"}`}>
                  <fieldset className="registration-step-fieldset space-y-6">
                    <legend className="registration-step-legend flex items-center gap-3">
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-foreground text-background">
                        <Music2 className="size-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span
                          role="heading"
                          aria-level={3}
                          className="block font-display text-xl font-extrabold text-foreground sm:text-2xl"
                        >
                          {currentStep === 3
                            ? selectedChoir?.pricingType === "free"
                              ? "Inscrição gratuita"
                              : "Tipo de inscrição"
                            : "Sua participação"}
                        </span>
                        <span className="block text-sm font-normal text-muted-foreground">
                          {currentStep === 3
                            ? selectedChoir?.pricingType === "free"
                              ? "Sua inscrição será analisada pelo administrador, sem cobrança."
                              : "Escolha o tipo de inscrição (modalidade) que combina com a sua participação. No próximo passo, você verá a forma de pagamento disponível para o seu coro."
                            : "Escolha seu coro e perfil musical."}
                        </span>
                      </span>
                    </legend>
                    <div className="grid gap-5">
                      <div className={currentStep === 3 ? "hidden" : "space-y-1.5"}>
                        <div className="flex items-center justify-between gap-3">
                          <p id="choir-label" className="font-semibold">
                            <span aria-hidden="true">Selecione o seu Coro</span>
                            <span className="sr-only">Coro</span>
                          </p>
                          {configuration && (
                            <span className="registration-count-badge">
                              {configuration?.choirs.length ?? 0} coros
                            </span>
                          )}
                        </div>
                        <div className="relative mt-3">
                          <Search
                            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-registration-muted"
                            aria-hidden="true"
                          />
                          <Input
                            id="choir-search"
                            type="search"
                            aria-label="Buscar coro ou diocese"
                            value={choirQuery}
                            onChange={(event) => setChoirQuery(event.target.value)}
                            placeholder="Buscar paróquia ou diocese..."
                            className="registration-search-input min-h-11 rounded-xl pl-10 pr-10 text-base"
                          />
                          {choirQuery && (
                            <button
                              type="button"
                              aria-label="Limpar busca"
                              onClick={() => setChoirQuery("")}
                              className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-registration-muted hover:bg-registration-subtle hover:text-registration-ink"
                            >
                              <X className="size-4" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                        {isLoadingConfiguration ? (
                          <p className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                            Carregando coros…
                          </p>
                        ) : (
                          <div
                            id="choirId"
                            role="radiogroup"
                            aria-labelledby="choir-label"
                            aria-required="true"
                            aria-invalid={Boolean(errors.choirId)}
                            aria-describedby={errors.choirId ? "choirId-error" : undefined}
                            tabIndex={-1}
                            data-selection-layout="list"
                            className="registration-choir-list"
                          >
                            {filteredChoirs.map((choir) => {
                              const selected = form.choirId === choir.id;
                              return (
                                <label
                                  key={choir.id}
                                  data-surface="clear"
                                  className={`registration-choir-option flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border p-4 text-left transition-colors focus-within:ring-2 focus-within:ring-amber/40 ${
                                    selected
                                      ? "border-amber bg-amber/10 shadow-sm"
                                      : "border-registration-line bg-white hover:border-amber/60"
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name="choirId"
                                    value={choir.id}
                                    checked={selected}
                                    disabled={
                                      form.participationType === "complete" &&
                                      configuration?.standardPriceCents === null &&
                                      choir.pricingType !== "free"
                                    }
                                    onChange={() => handleChoirChange(choir.id)}
                                    className="sr-only"
                                  />
                                  <span
                                    className={`grid size-6 shrink-0 place-items-center rounded-full border-2 ${
                                      selected
                                        ? "border-amber bg-amber text-amber-foreground"
                                        : "border-muted-foreground/40 bg-card"
                                    }`}
                                    aria-hidden="true"
                                  >
                                    {selected && <Check className="size-4" />}
                                  </span>
                                  <span className="font-semibold leading-snug text-foreground">
                                    {choir.name}
                                  </span>
                                </label>
                              );
                            })}
                            {filteredChoirs.length === 0 && (
                              <p className="rounded-xl border border-dashed border-registration-line bg-registration-subtle p-4 text-sm text-registration-muted">
                                Nenhum coro encontrado. Você pode selecionar “Outro” e informar o nome manualmente.
                              </p>
                            )}
                            <label
                              data-surface="clear"
                              className={`registration-choir-option flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border p-4 text-left transition-colors focus-within:ring-2 focus-within:ring-amber/40 ${
                                isOtherChoir
                                  ? "border-amber bg-amber/10 shadow-sm"
                                  : "border-registration-line bg-white hover:border-amber/60"
                              }`}
                            >
                              <input
                                type="radio"
                                name="choirId"
                                value={OTHER_CHOIR_VALUE}
                                checked={isOtherChoir}
                                disabled={
                                  !configuration ||
                                  (form.participationType === "complete" &&
                                    configuration.standardPriceCents === null)
                                }
                                onChange={() => handleChoirChange(OTHER_CHOIR_VALUE)}
                                className="sr-only"
                              />
                              <span
                                className={`grid size-6 shrink-0 place-items-center rounded-full border-2 ${
                                  isOtherChoir
                                    ? "border-amber bg-amber text-amber-foreground"
                                    : "border-muted-foreground/40 bg-card"
                                }`}
                                aria-hidden="true"
                              >
                                {isOtherChoir && <Check className="size-4" />}
                              </span>
                              <span className="font-semibold text-foreground">Outro</span>
                            </label>
                          </div>
                        )}
                        {form.participationType === "complete" &&
                          configuration?.standardPriceCents === null &&
                          !configuration.choirs.some((choir) => choir.pricingType === "free") && (
                          <p className="text-sm text-muted-foreground">
                            As inscrições estarão disponíveis após o cadastro do valor normal.
                          </p>
                        )}
                        {errors.choirId && (
                          <p id="choirId-error" role="alert" className="text-sm text-destructive">
                            {errors.choirId}
                          </p>
                        )}
                      </div>

                      {currentStep === 2 && isOtherChoir && (
                        <div className="space-y-1.5">
                          <Label htmlFor="otherChoirName" className="font-semibold">
                            Informe o nome do coro
                          </Label>
                          <div className="relative">
                            <Music2
                              className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground"
                              aria-hidden="true"
                            />
                            <Input
                              id="otherChoirName"
                              required
                              minLength={2}
                              maxLength={120}
                              value={form.otherChoirName}
                              onChange={(event) =>
                                handleChange("otherChoirName", event.target.value)
                              }
                              placeholder="Digite o nome do coro"
                              className="min-h-14 rounded-xl pl-11 text-base"
                            />
                          </div>
                          {errors.otherChoirName && (
                            <p className="text-sm text-destructive">{errors.otherChoirName}</p>
                          )}
                        </div>
                      )}

                      <div className={currentStep === 3 ? "hidden" : "space-y-1.5"}>
                        <div className="registration-voice-heading">
                          <Music2 className="size-4" aria-hidden="true" />
                          <span id="musicalProfile-label" className="font-semibold">
                            Perfil musical
                          </span>
                        </div>
                        <div
                          id="musicalProfile"
                          role="radiogroup"
                          aria-labelledby="musicalProfile-label"
                          aria-required="true"
                          aria-invalid={Boolean(errors.musicalProfile)}
                          aria-describedby={
                            errors.musicalProfile ? "musicalProfile-error" : undefined
                          }
                          tabIndex={-1}
                          data-selection-layout="list"
                          className="registration-profile-list mt-3"
                        >
                          {musicalProfileOptions.map((option) => {
                            const selected = form.musicalProfile === option.value;
                            return (
                              <label
                                key={option.value}
                                data-surface="clear"
                                className={`registration-profile-option ${
                                  selected ? "registration-profile-option--selected" : ""
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="musicalProfile"
                                  value={option.value}
                                  aria-label={option.label}
                                  checked={selected}
                                  onChange={() => handleMusicalProfileChange(option.value)}
                                  className="sr-only"
                                />
                                <span className="flex min-w-0 items-center gap-3">
                                  <span
                                    data-testid="musical-profile-icon"
                                    className="registration-icon-box size-9"
                                    aria-hidden="true"
                                  >
                                    {option.value === "regente" ? (
                                      <Mic2 className="size-4" />
                                    ) : option.value === "instrumentista" ? (
                                      <Piano className="size-4" />
                                    ) : (
                                      <UsersRound className="size-4" />
                                    )}
                                  </span>
                                  <span className="min-w-0">
                                    <span className="block text-sm font-bold text-registration-ink">
                                      {option.label}
                                    </span>
                                    {option.value === "coralista" && (
                                      <span className="mt-0.5 block text-xs text-registration-muted">
                                        Escolha seu naipe vocal em seguida.
                                      </span>
                                    )}
                                  </span>
                                </span>
                                <span className="registration-radio-indicator" aria-hidden="true">
                                  {selected && <Check className="size-3.5" />}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                        {errors.musicalProfile && (
                          <p id="musicalProfile-error" className="text-sm text-destructive">
                            {errors.musicalProfile}
                          </p>
                        )}
                      </div>

                      {currentStep === 3 && displayedChoir?.pricingType !== "free" && (
                        <fieldset
                          id="raffleChoice"
                          role="radiogroup"
                          tabIndex={-1}
                          aria-describedby={errors.raffleChoice ? "raffleChoice-error" : undefined}
                          className="space-y-3"
                        >
                          <legend className="font-semibold text-foreground">Escolha o tipo de inscrição</legend>
                          <div className="grid items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
                            <label
                              data-testid="registration-option-event"
                              data-surface="clear"
                              data-selected={form.participationType === "event"}
                              className={`flex cursor-pointer flex-col rounded-xl border p-3 transition-colors focus-within:ring-2 focus-within:ring-amber/40 ${
                                form.participationType === "event"
                                  ? "border-amber bg-amber/10 shadow-sm"
                                  : "border-registration-line bg-white hover:border-amber/60"
                              }`}
                            >
                              <input
                                type="radio"
                                name="registrationOption"
                                value="event"
                                aria-label="Inscrição no Evento"
                                checked={form.participationType === "event"}
                                onChange={() => handleRegistrationOptionChange("event")}
                                className="sr-only"
                              />
                              <span className="flex items-start justify-between gap-4">
                                <span className="min-w-0">
                                  <span className="block text-[0.68rem] font-bold uppercase tracking-[0.14em] text-registration-muted">
                                    PARTICIPAÇÃO INDIVIDUAL
                                  </span>
                                  <strong className="mt-1 block font-display text-lg font-extrabold leading-tight text-registration-ink">
                                    Inscrição no Evento
                                  </strong>
                                  <span className="mt-1 block text-xs text-registration-muted">
                                    Acesso às formações, kit e certificado oficial
                                  </span>
                                  <span className="mt-3 block rounded-lg bg-stone-100 px-2.5 py-2">
                                    <span className="block text-[0.68rem] font-bold uppercase tracking-[0.12em] text-registration-muted">Investimento</span>
                                    <span className="mt-1 flex flex-wrap items-baseline gap-2">
                                      <strong className="font-display text-2xl text-registration-ink">{formatCurrency(configuration?.eventPriceCents ?? 8000)}</strong>
                                      <span className="text-xs font-semibold text-registration-muted">• à vista</span>
                                    </span>
                                    <span className="mt-0.5 block text-xs text-registration-muted">Sem custos de hospedagem inclusos</span>
                                    <RegistrationInstallments amountCents={configuration?.eventPriceCents ?? 8_000} />
                                  </span>
                                  <span className="mt-3 block text-xs font-bold text-registration-muted">O que está incluso:</span>
                                  <ul className="mt-1.5 space-y-1.5 text-sm text-registration-ink">
                                    <li>Acesso integral a todas as formações litúrgicas</li>
                                    <li>Kit oficial do participante com partituras impressas</li>
                                    <li>Certificado de participação diocesano (horas acadêmicas)</li>
                                  </ul>
                                </span>
                                {form.participationType === "event" && <Check className="size-5 shrink-0 text-amber-700" aria-hidden="true" />}
                              </span>
                              <span className={`mt-4 flex min-h-9 items-center justify-center gap-2 border-t pt-2 text-sm font-bold ${
                                form.participationType === "event" ? "border-amber-200 text-amber-800" : "border-stone-200 text-stone-600"
                              }`}>
                                {form.participationType === "event" ? (
                                  <>
                                    <span className="grid size-5 place-items-center rounded-full bg-amber-700 text-white">
                                      <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                                    </span>
                                    Tipo de inscrição selecionado
                                  </>
                                ) : (
                                  <>
                                    <span className="size-4 rounded-full border-2 border-stone-300" aria-hidden="true" />
                                    Selecionar este tipo de inscrição
                                  </>
                                )}
                              </span>
                            </label>

                            <label
                              data-testid="registration-option-raffle"
                              data-surface="clear"
                              data-selected={form.participationType === "complete" && form.raffleChoice === "participate"}
                              className={`flex flex-col rounded-xl border p-3 transition-colors focus-within:ring-2 focus-within:ring-amber/40 ${
                                form.participationType === "complete" && form.raffleChoice === "participate"
                                  ? "border-amber bg-amber/10 shadow-sm"
                                  : selectedChoir?.pricingType === "promotional"
                                    ? "cursor-pointer border-registration-line bg-white hover:border-amber/60"
                                    : "cursor-not-allowed border-registration-line bg-muted/30 opacity-65"
                              }`}
                            >
                              <input
                                type="radio"
                                name="registrationOption"
                                value="raffle"
                                aria-label="Inscrição + Hospedagem e Alimentação — Entrada com programa de rifas"
                                checked={form.participationType === "complete" && form.raffleChoice === "participate"}
                                disabled={selectedChoir?.pricingType !== "promotional"}
                                onChange={() => handleRegistrationOptionChange("raffle")}
                                className="sr-only"
                              />
                              <span className="flex items-start justify-between gap-4">
                                <span className="min-w-0">
                                  <span className="block text-[0.68rem] font-bold uppercase tracking-[0.14em] text-amber-700">
                                    EXPERIÊNCIA COMPLETA SUBSIDIADA
                                  </span>
                                  <strong className="mt-1 block font-display text-lg font-extrabold leading-tight text-registration-ink">
                                    Inscrição + Hospedagem e Alimentação
                                  </strong>
                                  <span className="mt-1 block text-xs text-registration-muted">Entrada facilitada com programa diocesano de rifas</span>
                                  <span className="mt-3 block rounded-lg bg-amber-50 px-2.5 py-2">
                                    <span className="block text-[0.68rem] font-bold uppercase leading-tight tracking-[0.12em] text-amber-800">Entrada inicial hoje</span>
                                    <span className="mt-1 flex flex-wrap items-baseline gap-2">
                                      <strong className="font-display text-2xl text-registration-ink">{formatCurrency(selectedChoir?.registrationPriceCents ?? 10000)}</strong>
                                      <span className="text-xs font-semibold text-registration-muted">hoje no ato</span>
                                    </span>
                                    <span className="mt-1 inline-flex rounded-md bg-amber-700 px-2 py-1 text-xs font-black leading-tight text-white">20 Rifas Cobrem o Resto</span>
                                    <span className="mt-1 block text-xs text-registration-muted">Total nominal do pacote: R$ 300,00</span>
                                    <RegistrationInstallments amountCents={selectedChoir?.registrationPriceCents ?? 10_000} />
                                  </span>
                                  <div className="mt-2 rounded-lg bg-stone-100 p-2.5 text-sm text-registration-ink">
                                    <strong className="block">Como funciona o subsídio:</strong>
                                    <span className="mt-1 block text-xs leading-relaxed">Você paga apenas R$ 100 agora e recebe 20 rifas de R$ 10,00. As vendas cobrem integralmente os R$ 200,00 restantes do retiro!</span>
                                  </div>
                                  <RafflePrizeHighlight compact />
                                  <span className="mt-3 block text-xs font-bold text-registration-muted">Tudo incluído no seu retiro:</span>
                                  <ul className="mt-1.5 space-y-1.5 text-sm text-registration-ink">
                                    <li>Acesso integral a todas as formações litúrgicas</li>
                                    <li>Kit oficial do participante com partituras impressas</li>
                                    <li>Certificado de participação diocesano (horas acadêmicas)</li>
                                    <li>Hospedagem no Centro Diocesano de Pastoral</li>
                                    <li>Alimentação completa durante todos os dias (pensão total)</li>
                                  </ul>
                                  {selectedChoir?.pricingType !== "promotional" && (
                                    <span className="mt-3 block text-xs text-registration-muted">Disponível apenas para coros participantes do programa de rifas.</span>
                                  )}
                                </span>
                                {form.participationType === "complete" && form.raffleChoice === "participate" && <Check className="size-5 shrink-0 text-amber-700" aria-hidden="true" />}
                              </span>
                              <span className={`mt-4 flex min-h-9 items-center justify-center gap-2 border-t pt-2 text-sm font-bold ${
                                form.participationType === "complete" && form.raffleChoice === "participate" ? "border-amber-200 text-amber-800" : "border-stone-200 text-stone-600"
                              }`}>
                                {form.participationType === "complete" && form.raffleChoice === "participate" ? (
                                  <>
                                    <span className="grid size-5 place-items-center rounded-full bg-amber-700 text-white">
                                      <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                                    </span>
                                    Tipo de inscrição selecionado
                                  </>
                                ) : (
                                  <>
                                    <span className="size-4 rounded-full border-2 border-stone-300" aria-hidden="true" />
                                    Selecionar este tipo de inscrição
                                  </>
                                )}
                              </span>
                            </label>

                            <label
                              data-testid="registration-option-full-price"
                              data-surface="clear"
                              data-selected={form.participationType === "complete" && form.raffleChoice === "full_price"}
                              className={`flex cursor-pointer flex-col rounded-xl border p-3 transition-colors focus-within:ring-2 focus-within:ring-amber/40 ${
                                form.participationType === "complete" && form.raffleChoice === "full_price"
                                  ? "border-amber bg-amber/10 shadow-sm"
                                  : "border-registration-line bg-white hover:border-amber/60"
                              }`}
                            >
                              <input
                                type="radio"
                                name="registrationOption"
                                value="full_price"
                                aria-label="Inscrição + Hospedagem e Alimentação — Pagamento integral"
                                checked={form.participationType === "complete" && form.raffleChoice === "full_price"}
                                onChange={() => handleRegistrationOptionChange("full_price")}
                                className="sr-only"
                              />
                              <span className="flex items-start justify-between gap-4">
                                <span className="min-w-0">
                                  <span className="block text-[0.68rem] font-bold uppercase tracking-[0.14em] text-registration-muted">SEM GESTÃO DE RIFAS</span>
                                  <strong className="mt-1 block font-display text-lg font-extrabold leading-tight text-registration-ink">
                                    Inscrição + Hospedagem e Alimentação
                                  </strong>
                                  <span className="mt-1 block text-xs text-registration-muted">Pagamento integral direto (sem necessidade de venda de rifas)</span>
                                  <span className="mt-3 block rounded-lg bg-stone-100 px-2.5 py-2">
                                    <span className="block text-[0.68rem] font-bold uppercase tracking-[0.12em] text-registration-muted">Valor total único</span>
                                    <span className="mt-1 flex flex-wrap items-baseline gap-2">
                                      <strong className="font-display text-2xl text-registration-ink">{formatCurrency(displayedChoir?.standardPriceCents ?? 30000)}</strong>
                                      <span className="text-xs font-semibold text-registration-muted">• à vista ou até 12x</span>
                                    </span>
                                    <span className="mt-0.5 block text-xs text-registration-muted">Quitação completa imediata</span>
                                    <RegistrationInstallments amountCents={displayedChoir?.standardPriceCents ?? 30_000} />
                                  </span>
                                  <span className="mt-3 block text-xs font-bold text-registration-muted">O que está incluso:</span>
                                  <ul className="mt-1.5 space-y-1.5 text-sm text-registration-ink">
                                    <li>Acesso integral a todas as formações litúrgicas</li>
                                    <li>Kit oficial do participante com partituras impressas</li>
                                    <li>Certificado de participação diocesano (horas acadêmicas)</li>
                                    <li>Hospedagem no Centro Diocesano de Pastoral</li>
                                    <li>Alimentação completa durante todos os dias (pensão total)</li>
                                  </ul>
                                </span>
                                {form.participationType === "complete" && form.raffleChoice === "full_price" && <Check className="size-5 shrink-0 text-amber-700" aria-hidden="true" />}
                              </span>
                              <span className={`mt-4 flex min-h-9 items-center justify-center gap-2 border-t pt-2 text-sm font-bold ${
                                form.participationType === "complete" && form.raffleChoice === "full_price" ? "border-amber-200 text-amber-800" : "border-stone-200 text-stone-600"
                              }`}>
                                {form.participationType === "complete" && form.raffleChoice === "full_price" ? (
                                  <>
                                    <span className="grid size-5 place-items-center rounded-full bg-amber-700 text-white">
                                      <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                                    </span>
                                    Tipo de inscrição selecionado
                                  </>
                                ) : (
                                  <>
                                    <span className="size-4 rounded-full border-2 border-stone-300" aria-hidden="true" />
                                    Selecionar este tipo de inscrição
                                  </>
                                )}
                              </span>
                            </label>
                          </div>
                          {errors.raffleChoice && (
                            <p id="raffleChoice-error" role="alert" className="mt-3 text-sm text-destructive">
                              {errors.raffleChoice}
                            </p>
                          )}
                        </fieldset>
                      )}

                      {currentStep === 3 && displayedChoir?.pricingType === "free" && (
                        <div className="mx-auto max-w-2xl rounded-xl border border-amber/35 bg-amber/10 p-5 text-sm text-registration-ink">
                          <strong>Inscrição gratuita</strong>
                          <p className="mt-2">Após o envio, o administrador analisará e aprovará sua inscrição. Nenhum pagamento será solicitado.</p>
                        </div>
                      )}

                      {currentStep === 2 && form.musicalProfile === "coralista" && (
                        <div className="space-y-1.5">
                          <div className="registration-voice-heading">
                            <Music2 className="size-4" aria-hidden="true" />
                            <span id="voicePart-label" className="font-semibold">
                              Naipe vocal
                            </span>
                          </div>
                          <div
                            role="radiogroup"
                            aria-labelledby="voicePart-label"
                            aria-required="true"
                            aria-describedby={errors.voicePart ? "voicePart-error" : undefined}
                            data-selection-layout="list"
                            className="registration-voice-list mt-3"
                          >
                            {voicePartOptions.map((option) => {
                              const selected = form.voicePart === option.value;
                              return (
                                <label
                                  key={option.value}
                                  data-surface="clear"
                                  className={`registration-voice-option ${selected ? "registration-voice-option--selected" : ""}`}
                                >
                                  <input
                                    type="radio"
                                    name="voicePartCard"
                                    value={option.value}
                                    aria-label={option.label}
                                    checked={selected}
                                    onChange={(event) => handleChange("voicePart", event.target.value)}
                                    className="sr-only"
                                  />
                                  <span className="flex min-w-0 items-center gap-3">
                                    <span className="registration-icon-box size-8" aria-hidden="true">
                                      {option.value === "nao_sei_informar" ? (
                                        <CircleHelp className="size-4" />
                                      ) : (
                                        <Music2 className="size-4" />
                                      )}
                                    </span>
                                    <span className="text-sm font-bold text-registration-ink">
                                      {option.label}
                                    </span>
                                  </span>
                                  <span className="registration-radio-indicator" aria-hidden="true">
                                    {selected && <Check className="size-3.5" />}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                          {errors.voicePart && (
                            <p id="voicePart-error" className="text-sm text-destructive">
                              {errors.voicePart}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </fieldset>
                </div>
              )}

              {currentStep === 4 && (
                <div className="registration-review grid items-start gap-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
                  <RegistrationPriceSummary
                    selectedChoir={displayedChoir}
                    appliedQuote={displayedQuote}
                    raffleChoice={form.raffleChoice}
                  />
                  <div className="order-last space-y-6 lg:order-first">
                    <div className="flex items-center gap-3">
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-foreground text-background">
                        <BadgeCheck className="size-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-display text-xl font-extrabold text-foreground sm:text-2xl">
                          Confira sua inscrição
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {displayedQuote?.pricingType === "free" ? "Revise os dados antes de enviar para aprovação." : "Revise os dados antes de seguir para o pagamento."}
                        </p>
                      </div>
                    </div>
                    <div className="registration-review-section-heading">
                      <div className="flex items-center gap-2">
                        <span className="registration-icon-box size-8">
                          <BadgeCheck className="size-4" aria-hidden="true" />
                        </span>
                        <span role="heading" aria-level={4} className="text-xs font-extrabold uppercase tracking-[0.12em] text-registration-ink">
                          Confira seus dados
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(1)}
                        className="registration-edit-button"
                      >
                        Editar dados pessoais
                      </button>
                    </div>
                    <dl className="registration-review-list grid gap-2 sm:grid-cols-2">
                      {[
                        ["Nome completo para certificado", form.name],
                        ["Nome para o crachá", form.badgeName],
                        ["CPF", form.cpf],
                        ["E-mail", form.email],
                        ["WhatsApp", form.phone],
                        [
                          "Nascimento",
                          form.birthDate
                            ? new Date(`${form.birthDate}T12:00:00`).toLocaleDateString("pt-BR")
                            : "",
                        ],
                        ["Diocese", form.diocese],
                        ["Coro", displayedChoir?.name ?? ""],
                        [
                          "Perfil musical",
                          musicalProfileOptions.find((option) => option.value === form.musicalProfile)
                            ?.label ?? "",
                        ],
                        ...(form.musicalProfile === "coralista"
                          ? [
                              [
                                "Naipe vocal",
                                voicePartOptions.find((option) => option.value === form.voicePart)
                                  ?.label ?? "",
                              ],
                            ]
                          : []),
                        [
                          "Formato de inscrição",
                          form.participationType === "event"
                            ? "Inscrição no evento"
                            : "Inscrição no evento, hospedagem e alimentação",
                        ],
                        ...(form.participationType === "complete"
                          ? [
                              [
                                "Programa de rifas",
                                displayedQuote?.pricingType === "free"
                                  ? "Não se aplica"
                                  : form.raffleChoice === "participate"
                                    ? "Participarei"
                                    : "Pagamento integral",
                              ],
                            ]
                          : []),
                        ["Foto", photoFileName],
                      ].map(([label, value]) => (
                        <div key={label} className="min-w-0 rounded-xl border border-registration-line bg-white p-3">
                          <dt className="text-xs font-bold uppercase text-registration-muted">
                            {label}
                          </dt>
                          <dd className="mt-1 break-words text-sm font-semibold text-registration-ink">
                            {value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <div className="registration-review-section-heading registration-review-edit-panel">
                      <div className="flex items-center gap-2">
                        <span className="registration-icon-box size-8">
                          <Music2 className="size-4" aria-hidden="true" />
                        </span>
                        <span role="heading" aria-level={4} className="text-xs font-extrabold uppercase tracking-[0.12em] text-registration-ink">
                          Precisa ajustar algo?
                        </span>
                      </div>
                      <div className="registration-review-edit-actions">
                        <button
                          type="button"
                          onClick={() => setCurrentStep(2)}
                          className="registration-edit-button"
                        >
                          Editar coro e perfil
                        </button>
                        <button
                          type="button"
                          onClick={() => setCurrentStep(3)}
                          className="registration-edit-button"
                        >
                          Editar tipo de inscrição
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {checkoutError && (
                <p
                  role="alert"
                  aria-live="polite"
                  className="mt-5 rounded-xl bg-destructive/10 p-4 text-sm text-destructive"
                >
                  {checkoutError}
                </p>
              )}

              <div
                ref={actionBarRef}
                role="group"
                aria-label="Ações da inscrição"
                className="registration-actions registration-actions--sticky mt-5 space-y-2 border-t border-border pt-4"
              >
                <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={goToPreviousStep}
                    disabled={currentStep === 1 || isSubmitting}
                    className="min-h-12 rounded-lg px-5 text-base font-bold sm:min-h-14 sm:px-7"
                  >
                    <ArrowLeft className="size-5" aria-hidden="true" /> Voltar
                  </Button>
                  <Button
                    type={currentStep === 4 ? "submit" : "button"}
                    onClick={
                      currentStep === 4
                        ? () => {
                            paymentButtonClick.current = true;
                          }
                        : () => void goToNextStep()
                    }
                    disabled={
                      isSubmitting ||
                      !configuration ||
                      (form.participationType === "complete" &&
                        configuration.standardPriceCents === null &&
                        !configuration.choirs.some((choir) => choir.pricingType === "free")) ||
                      (currentStep === 4 && (!displayedChoir || !displayedQuote))
                    }
                    className="min-h-12 w-full rounded-lg bg-foreground px-7 text-base font-extrabold text-background hover:bg-foreground/90"
                  >
                    <span className="min-w-0 break-words">
                      {isSubmitting
                        ? displayedQuote?.pricingType === "free" ? "Enviando inscrição…" : "Preparando seu pagamento…"
                        : currentStep === 4
                          ? displayedQuote?.pricingType === "free"
                            ? "Enviar inscrição gratuita"
                            : reviewPaymentAmount
                              ? `Ir para pagamento de ${reviewPaymentAmount} na InfinitePay`
                              : "Ir para pagamento na InfinitePay"
                          : "Continuar"}
                    </span>
                    {!isSubmitting && <ArrowRight className="ml-2 size-5" aria-hidden="true" />}
                  </Button>
                </div>
                {currentStep === 4 && displayedQuote?.pricingType !== "free" && (
                  <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs leading-relaxed text-muted-foreground">
                    <img src={infinitePayLogo} alt="InfinitePay" className="h-4 w-auto" />
                    <span>
                      Você será direcionado para pagar {reviewPaymentAmount} no ambiente seguro da InfinitePay.
                    </span>
                  </p>
                )}
                <p className="flex items-center justify-center gap-2 text-center text-xs leading-relaxed text-muted-foreground">
                  <LockKeyhole className="size-4 shrink-0" aria-hidden="true" /> Seus dados serão
                  usados apenas para processar a inscrição.
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
