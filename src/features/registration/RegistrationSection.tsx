import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import shirtAsset from "@/assets/camisa-polo-evento.png.asset.json";
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
import { startRegistrationCheckout } from "@/lib/registration.functions";
import {
  getFortalezaCalendarDate,
  registrationSchema,
  shirtSizeSchema,
  type RegistrationInput,
} from "./registration.domain";

type RegistrationSectionProps = {
  loadConfiguration?: () => Promise<PublicRegistrationConfiguration>;
  startCheckout?: (input: RegistrationInput) => Promise<{ checkoutUrl: string; orderNsu: string }>;
  navigateToCheckout?: (url: string) => void;
};

type RegistrationForm = Omit<
  RegistrationInput,
  "choirId" | "displayedQuote" | "displayedShirtPriceCents"
> & { choirId: string };

const formatCurrency = (valueInCents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valueInCents / 100);

const initialForm: RegistrationForm = {
  name: "",
  email: "",
  phone: "",
  birthDate: "",
  choirId: "",
  includeShirt: false,
  shirtSize: "",
};

const defaultLoadConfiguration = () => getPublicRegistrationConfiguration();

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
          includeShirt: next.shirtPriceCents === null ? false : previous.includeShirt,
          shirtSize: next.shirtPriceCents === null ? "" : previous.shirtSize,
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
  const shirtPriceCents = configuration?.shirtPriceCents ?? null;
  const registrationPriceCents = selectedChoir?.registrationPriceCents ?? null;
  const totalAmount =
    registrationPriceCents === null
      ? null
      : registrationPriceCents +
        (form.includeShirt && shirtPriceCents !== null ? shirtPriceCents : 0);

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

    const candidate = {
      ...form,
      displayedQuote: {
        pricingType: selectedChoir.pricingType,
        standardPriceCents: selectedChoir.standardPriceCents,
        registrationPriceCents: selectedChoir.registrationPriceCents,
      },
      displayedShirtPriceCents: shirtPriceCents,
    };
    const parsedForm = registrationSchema.safeParse(candidate);
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
      const { checkoutUrl } = await startCheckout(parsedForm.data);
      navigateToCheckout(checkoutUrl);
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
      <div className="container-event px-4 lg:px-0">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-amber/10 px-4 py-1.5 text-sm font-bold text-amber">
            Inscrição
          </span>
          <h2 className="mt-4 font-display text-[clamp(2rem,8vw,3rem)] font-bold leading-tight text-foreground md:text-5xl">
            Garanta sua participação
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Preencha o formulário abaixo para se inscrever no II Encontro de Coros Diocesanos e
            Litúrgicos do Regional Nordeste 1 - CNBB.
          </p>
          <div className="mx-auto mt-6 flex max-w-sm flex-col items-center justify-center gap-2 rounded-xl border border-amber/40 bg-amber/10 px-5 py-4 sm:inline-flex sm:max-w-none sm:flex-row sm:flex-wrap sm:gap-3 sm:rounded-full sm:py-3">
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
          <div className="mx-auto mt-8 flex max-w-3xl flex-col items-center gap-3 text-center">
            <p role="alert" className="text-destructive">
              {configurationError}
            </p>
            <Button type="button" variant="outline" onClick={() => void refreshConfiguration()}>
              Tentar novamente
            </Button>
          </div>
        )}
        <div
          className={`mx-auto mt-9 grid max-w-6xl gap-6 sm:mt-12 ${shirtPriceCents === null ? "max-w-3xl" : "lg:grid-cols-[0.85fr_1.15fr] lg:gap-8"}`}
        >
          {shirtPriceCents !== null && (
            <article
              id="camisa"
              className="order-2 overflow-hidden rounded-xl bg-foreground text-white shadow-md shadow-teal/15 lg:order-1"
            >
              <img
                src={shirtAsset.url}
                alt="Camisa polo oficial preta com gola dourada do II Encontro de Coros Diocesanos e Litúrgicos"
                width={1120}
                height={1394}
                className="aspect-[4/3] w-full object-cover sm:aspect-square"
                loading="lazy"
              />
              <div className="p-5 sm:p-6">
                <span className="inline-flex rounded-full bg-amber/15 px-3 py-1 text-sm font-bold text-amber">
                  Camisa oficial
                </span>
                <h3 className="mt-4 font-display text-2xl font-extrabold leading-tight sm:text-3xl">
                  Adquira junto com sua inscrição
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-white/72">
                  Polo preta com gola dourada e a arte oficial do encontro bordada no peito. Escolha
                  o tamanho no formulário de inscrição.
                </p>
                <div className="mt-5 flex items-end gap-3">
                  <span className="text-sm font-bold text-white/60">Camisa</span>
                  <span className="font-display text-4xl font-extrabold leading-none text-amber">
                    {formatCurrency(shirtPriceCents)}
                  </span>
                </div>
              </div>
            </article>
          )}

          <Card className="order-1 border-border bg-card shadow-sm shadow-teal/10 lg:order-2">
            <CardContent className="p-4 sm:p-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="font-semibold">
                      Nome Completo
                    </Label>
                    <Input
                      id="name"
                      required
                      value={form.name}
                      onChange={(event) => handleChange("name", event.target.value)}
                      placeholder="Seu nome"
                      className="min-h-12 rounded-xl border-border bg-background text-base"
                    />
                    {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="font-semibold">
                      E-mail
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={form.email}
                      onChange={(event) => handleChange("email", event.target.value)}
                      placeholder="seunome@email.com"
                      className="min-h-12 rounded-xl border-border bg-background text-base"
                    />
                    {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                  </div>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="font-semibold">
                      WhatsApp
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      required
                      autoComplete="tel"
                      value={form.phone}
                      onChange={(event) => handleChange("phone", event.target.value)}
                      placeholder="(88) 99999-9999"
                      className="min-h-12 rounded-xl border-border bg-background text-base"
                    />
                    {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="birthDate" className="font-semibold">
                      Data de Nascimento
                    </Label>
                    <Input
                      id="birthDate"
                      type="date"
                      required
                      max={getFortalezaCalendarDate()}
                      value={form.birthDate}
                      onChange={(event) => handleChange("birthDate", event.target.value)}
                      className="min-h-12 rounded-xl border-border bg-background text-base"
                    />
                    {errors.birthDate && (
                      <p className="text-sm text-destructive">{errors.birthDate}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="choirId" className="font-semibold">
                    Coro/Diocese
                  </Label>
                  <select
                    id="choirId"
                    required
                    value={form.choirId}
                    onChange={(event) => handleChange("choirId", event.target.value)}
                    disabled={!configuration || configuration.choirs.length === 0}
                    className="min-h-12 w-full rounded-xl border border-border bg-background px-3 text-base"
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
                    className="rounded-xl border border-amber/40 bg-amber/10 p-4 text-sm leading-relaxed text-foreground"
                  >
                    Este é um{" "}
                    <strong>
                      valor promocional de {formatCurrency(selectedChoir.registrationPriceCents)}
                    </strong>{" "}
                    porque o coralista deverá vender rifas para subsidiar o valor restante da
                    inscrição de {formatCurrency(selectedChoir.standardPriceCents)}.
                  </div>
                )}

                {shirtPriceCents !== null && (
                  <div className="rounded-xl border border-amber/35 bg-amber/10 p-4 sm:p-5">
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={form.includeShirt}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            includeShirt: event.target.checked,
                            shirtSize: event.target.checked ? previous.shirtSize : "",
                          }))
                        }
                        className="mt-1 size-5 shrink-0 rounded border-border accent-teal"
                      />
                      <span>
                        <span className="block font-bold text-foreground">
                          Incluir camisa oficial
                        </span>
                        <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                          Adicione a camisa do encontro por {formatCurrency(shirtPriceCents)}.
                        </span>
                      </span>
                    </label>
                    {form.includeShirt && (
                      <div className="mt-4 space-y-2">
                        <Label htmlFor="shirtSize" className="font-semibold">
                          Tamanho da camisa
                        </Label>
                        <Select
                          value={form.shirtSize}
                          onValueChange={(value) => {
                            const parsed = shirtSizeSchema.safeParse(value);
                            if (parsed.success) {
                              setForm((previous) => ({ ...previous, shirtSize: parsed.data }));
                              setErrors((previous) => ({ ...previous, shirtSize: undefined }));
                            }
                          }}
                        >
                          <SelectTrigger
                            id="shirtSize"
                            className="min-h-12 rounded-xl border-border bg-background text-base"
                          >
                            <SelectValue placeholder="Selecione o tamanho" />
                          </SelectTrigger>
                          <SelectContent>
                            {["P", "M", "G", "GG", "XG"].map((size) => (
                              <SelectItem key={size} value={size}>
                                {size}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.shirtSize && (
                          <p className="text-sm text-destructive">{errors.shirtSize}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {registrationPriceCents !== null && totalAmount !== null && (
                  <div className="rounded-xl border border-teal/20 bg-teal/5 p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="text-muted-foreground">Inscrição</span>
                      <span className="font-bold text-foreground">
                        {formatCurrency(registrationPriceCents)}
                      </span>
                    </div>
                    {form.includeShirt && shirtPriceCents !== null && (
                      <div className="mt-2 flex items-center justify-between gap-4 text-sm">
                        <span className="text-muted-foreground">Camisa oficial</span>
                        <span className="font-bold text-foreground">
                          {formatCurrency(shirtPriceCents)}
                        </span>
                      </div>
                    )}
                    <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-teal/15 pt-4">
                      <span className="font-bold text-foreground">Total</span>
                      <span className="font-display text-3xl font-extrabold leading-none text-teal">
                        {formatCurrency(totalAmount)}
                      </span>
                    </div>
                  </div>
                )}
                {checkoutError && (
                  <p aria-live="polite" className="text-sm text-destructive">
                    {checkoutError}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={isSubmitting || !configuration || configuration.choirs.length === 0}
                  className="min-h-14 w-full rounded-full bg-teal py-6 text-base font-extrabold text-white hover:bg-teal/90 sm:text-lg"
                >
                  {isSubmitting ? "Preparando pagamento…" : "Continuar para pagamento"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
