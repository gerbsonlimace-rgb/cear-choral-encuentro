import { useState, type FormEvent } from "react";

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
import { Textarea } from "@/components/ui/textarea";
import {
  REGISTRATION_PRICE_CENTS,
  SHIRT_PRICE_CENTS,
  registrationSchema,
  type RegistrationInput,
} from "./registration.domain";
import { startRegistrationCheckout } from "@/lib/registration.functions";

type RegistrationSectionProps = {
  startCheckout?: (input: RegistrationInput) => Promise<{ checkoutUrl: string; orderNsu: string }>;
  navigateToCheckout?: (url: string) => void;
};

const formatCurrency = (valueInCents: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valueInCents / 100);

const initialForm: RegistrationInput = {
  name: "",
  email: "",
  phone: "",
  city: "",
  institution: "",
  role: "participant",
  includeShirt: false,
  shirtSize: "",
  observations: "",
};

export function RegistrationSection({
  startCheckout = (input) => startRegistrationCheckout({ data: input }),
  navigateToCheckout = (url) => window.location.assign(url),
}: RegistrationSectionProps) {
  const [form, setForm] = useState<RegistrationInput>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof RegistrationInput, string>>>({});
  const [checkoutError, setCheckoutError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const totalAmount = REGISTRATION_PRICE_CENTS + (form.includeShirt ? SHIRT_PRICE_CENTS : 0);

  const handleChange = (field: keyof RegistrationInput, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    if (errors[field]) {
      setErrors((previous) => ({ ...previous, [field]: undefined }));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const parsedForm = registrationSchema.safeParse(form);
    if (!parsedForm.success) {
      const nextErrors: Partial<Record<keyof RegistrationInput, string>> = {};
      for (const issue of parsedForm.error.issues) {
        const field = issue.path[0] as keyof RegistrationInput | undefined;
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
    } catch {
      setCheckoutError("Não foi possível preparar o pagamento. Tente novamente.");
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
            Preencha o formulário abaixo para se inscrever no II Encontro de Coros Diocesanos do
            Regional Nordeste 1 - CNBB.
          </p>
          <div className="mx-auto mt-6 flex max-w-sm flex-col items-center justify-center gap-2 rounded-xl border border-amber/40 bg-amber/10 px-5 py-4 sm:inline-flex sm:max-w-none sm:flex-row sm:flex-wrap sm:gap-3 sm:rounded-full sm:py-3">
            <span className="text-sm font-bold text-muted-foreground">Inscrição</span>
            <span className="font-display text-3xl font-extrabold leading-none text-foreground">
              {formatCurrency(REGISTRATION_PRICE_CENTS)}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-bold text-teal">
              <img src={pixLogo} alt="" className="h-4 w-auto" aria-hidden="true" />
              Pix sem taxa • cartão em até 12x
            </span>
          </div>
        </div>

        <div className="mx-auto mt-9 grid max-w-6xl gap-6 sm:mt-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-8">
          <article
            id="camisa"
            className="order-2 overflow-hidden rounded-xl bg-foreground text-white shadow-md shadow-teal/15 lg:order-1"
          >
            <img
              src={shirtAsset.url}
              alt="Camisa polo oficial preta com gola dourada do II Encontro de Coros Diocesanos"
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
                Polo preta com gola dourada e a arte oficial do encontro bordada no peito. Escolha o
                tamanho no formulario de inscricao.
              </p>
              <div className="mt-5 flex items-end gap-3">
                <span className="text-sm font-bold text-white/60">Camisa</span>
                <span className="font-display text-4xl font-extrabold leading-none text-amber">
                  {formatCurrency(SHIRT_PRICE_CENTS)}
                </span>
              </div>
            </div>
          </article>

          <Card className="order-1 border-border bg-card shadow-sm shadow-teal/10 lg:order-2">
            <CardContent className="p-4 sm:p-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="font-semibold">
                      Nome completo
                    </Label>
                    <Input
                      id="name"
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
                      value={form.email}
                      onChange={(event) => handleChange("email", event.target.value)}
                      placeholder="seu@email.com"
                      className="min-h-12 rounded-xl border-border bg-background text-base"
                    />
                    {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="font-semibold">
                      Telefone
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={form.phone}
                      onChange={(event) => handleChange("phone", event.target.value)}
                      placeholder="(88) 99999-9999"
                      className="min-h-12 rounded-xl border-border bg-background text-base"
                    />
                    {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city" className="font-semibold">
                      Cidade
                    </Label>
                    <Input
                      id="city"
                      value={form.city}
                      onChange={(event) => handleChange("city", event.target.value)}
                      placeholder="Quixadá"
                      className="min-h-12 rounded-xl border-border bg-background text-base"
                    />
                    {errors.city && <p className="text-sm text-destructive">{errors.city}</p>}
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="institution" className="font-semibold">
                      Paróquia / Instituição
                    </Label>
                    <Input
                      id="institution"
                      value={form.institution}
                      onChange={(event) => handleChange("institution", event.target.value)}
                      placeholder="Onde você atua"
                      className="min-h-12 rounded-xl border-border bg-background text-base"
                    />
                    {errors.institution && (
                      <p className="text-sm text-destructive">{errors.institution}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role" className="font-semibold">
                      Função
                    </Label>
                    <Select
                      value={form.role}
                      onValueChange={(value) => handleChange("role", value)}
                    >
                      <SelectTrigger
                        id="role"
                        className="min-h-12 rounded-xl border-border bg-background text-base"
                      >
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="participant">Participante</SelectItem>
                        <SelectItem value="musician">Músico</SelectItem>
                        <SelectItem value="singer">Cantor/Coralista</SelectItem>
                        <SelectItem value="conductor">Regente</SelectItem>
                        <SelectItem value="liturgist">Liturgista</SelectItem>
                        <SelectItem value="priest">Padre/Clero</SelectItem>
                        <SelectItem value="other">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.role && <p className="text-sm text-destructive">{errors.role}</p>}
                  </div>
                </div>

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
                        Adicione a camisa do encontro por {formatCurrency(SHIRT_PRICE_CENTS)}.
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
                          setForm((previous) => ({ ...previous, shirtSize: value }));
                          setErrors((previous) => ({ ...previous, shirtSize: undefined }));
                        }}
                      >
                        <SelectTrigger
                          id="shirtSize"
                          className="min-h-12 rounded-xl border-border bg-background text-base"
                        >
                          <SelectValue placeholder="Selecione o tamanho" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="P">P</SelectItem>
                          <SelectItem value="M">M</SelectItem>
                          <SelectItem value="G">G</SelectItem>
                          <SelectItem value="GG">GG</SelectItem>
                          <SelectItem value="XG">XG</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.shirtSize && (
                        <p className="text-sm text-destructive">{errors.shirtSize}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-teal/20 bg-teal/5 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">Inscricao</span>
                    <span className="font-bold text-foreground">
                      {formatCurrency(REGISTRATION_PRICE_CENTS)}
                    </span>
                  </div>
                  {form.includeShirt && (
                    <div className="mt-2 flex items-center justify-between gap-4 text-sm">
                      <span className="text-muted-foreground">Camisa oficial</span>
                      <span className="font-bold text-foreground">
                        {formatCurrency(SHIRT_PRICE_CENTS)}
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

                <div className="space-y-2">
                  <Label htmlFor="observations" className="font-semibold">
                    Observações
                  </Label>
                  <Textarea
                    id="observations"
                    value={form.observations}
                    onChange={(event) => handleChange("observations", event.target.value)}
                    placeholder="Informe restricoes, necessidades ou observacoes. O pagamento pode ser via Pix ou cartão."
                    rows={4}
                    className="min-h-28 rounded-xl border-border bg-background text-base"
                  />
                  {errors.observations && (
                    <p className="text-sm text-destructive">{errors.observations}</p>
                  )}
                </div>

                {checkoutError && (
                  <p aria-live="polite" className="text-sm text-destructive">
                    {checkoutError}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitting}
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
