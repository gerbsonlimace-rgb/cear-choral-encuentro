import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";

import heroImage from "../assets/hero-sacred-music.jpg";
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
import { Separator } from "@/components/ui/separator";
import {
  submitRegistration,
  registrationSchema,
  type RegistrationInput,
} from "@/lib/registration.functions";
import {
  Calendar,
  MapPin,
  Music,
  Clock,
  Users,
  BookOpen,
  Mic2,
  Church,
  CheckCircle,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "II Encontro de Música Sacra do Ceará — 20 a 22 de Novembro" },
      {
        name: "description",
        content:
          "Inscreva-se no II Encontro de Música Sacra do Estado do Ceará. Três dias de formação, celebração e música em Quixadá.",
      },
      {
        property: "og:title",
        content: "II Encontro de Música Sacra do Ceará — 20 a 22 de Novembro",
      },
      {
        property: "og:description",
        content: "Inscreva-se no II Encontro de Música Sacra do Estado do Ceará. Três dias de formação, celebração e música em Quixadá.",
      },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Event",
          name: "II Encontro de Música Sacra do Estado do Ceará",
          startDate: "2025-11-20",
          endDate: "2025-11-22",
          eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
          eventStatus: "https://schema.org/EventScheduled",
          location: {
            "@type": "Place",
            name: "Quixadá",
            address: {
              "@type": "PostalAddress",
              addressLocality: "Quixadá",
              addressRegion: "CE",
              addressCountry: "BR",
            },
          },
          description:
            "Encontro de formação, celebração e música sacra no Estado do Ceará, com oficinas, missas, palestras e concertos.",
          image: heroImage,
        }),
      },
    ],
  }),
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <HeroSection />
        <AboutSection />
        <ProgramSection />
        <RegistrationSection />
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container-event flex h-16 items-center justify-between px-4 lg:px-0">
        <Link
          to="/"
          className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight text-foreground"
        >
          <Music className="h-5 w-5 text-gold" />
          <span>II EMS-CE</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
          <a href="#sobre" className="text-muted-foreground transition-colors hover:text-foreground">
            Sobre
          </a>
          <a href="#programacao" className="text-muted-foreground transition-colors hover:text-foreground">
            Programação
          </a>
          <a href="#inscricao" className="text-muted-foreground transition-colors hover:text-foreground">
            Inscrição
          </a>
        </nav>
        <Button asChild size="sm" className="bg-gold text-gold-foreground hover:bg-gold/90">
          <a href="#inscricao">Inscreva-se</a>
        </Button>
      </div>
    </header>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt="Coro e orquestra em igreja histórica iluminada por luz dourada"
          width={1920}
          height={912}
          className="h-full w-full object-cover"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-navy/80 via-navy/60 to-navy/90" />
      </div>
      <div className="relative section-padding">
        <div className="container-event flex flex-col items-center px-4 text-center lg:px-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-1.5 text-sm font-medium text-gold backdrop-blur-sm">
            <Calendar className="h-4 w-4" />
            <span>20 a 22 de novembro de 2025</span>
          </div>
          <h1 className="mt-6 max-w-4xl font-display text-4xl font-bold leading-[1.1] text-cream sm:text-5xl md:text-6xl lg:text-7xl">
            II Encontro de Música Sacra do Estado do Ceará
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-cream/90 sm:text-xl">
            Três dias de formação, celebração e espiritualidade pela música sacra em Quixadá.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-cream/80">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-gold" />
              <span className="font-medium">Quixadá, CE</span>
            </div>
            <div className="hidden h-5 w-px bg-cream/30 sm:block" />
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-gold" />
              <span className="font-medium">Músicos, regentes, cantores e fiéis</span>
            </div>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button asChild size="lg" className="bg-gold text-gold-foreground hover:bg-gold/90">
              <a href="#inscricao">
                Fazer inscrição
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-cream/50 bg-transparent text-cream hover:bg-cream/10 hover:text-cream"
            >
              <a href="#programacao">Ver programação</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function AboutSection() {
  return (
    <section id="sobre" className="section-padding bg-background">
      <div className="container-event px-4 lg:px-0">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="font-display text-sm font-semibold uppercase tracking-widest text-gold">
              Sobre o encontro
            </span>
            <h2 className="mt-3 font-display text-3xl font-bold text-foreground sm:text-4xl">
              Uma celebração da tradição musical sacra
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              O II Encontro de Música Sacra do Estado do Ceará reúne músicos, regentes, cantores,
              liturgistas e fiéis em um fim de semana dedicado à formação, ao aperfeiçoamento e à
              vivência da música sacra.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              Em Quixadá, entre os dias 20 e 22 de novembro, a programação inclui oficinas, palestras,
              ensaios, missas e um concerto sacro, promovendo a beleza litúrgica e o encontro
              comunitário através da arte.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/10">
                  <BookOpen className="h-5 w-5 text-gold" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-foreground">Formação</h3>
                  <p className="text-sm text-muted-foreground">Oficinas com músicos e liturgistas experientes.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/10">
                  <Church className="h-5 w-5 text-gold" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-foreground">Celebração</h3>
                  <p className="text-sm text-muted-foreground">Missas e momentos de oração com música sacra.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/10">
                  <Mic2 className="h-5 w-5 text-gold" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-foreground">Concerto</h3>
                  <p className="text-sm text-muted-foreground">Apresentação especial do repertório sacro.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/10">
                  <Users className="h-5 w-5 text-gold" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-foreground">Comunidade</h3>
                  <p className="text-sm text-muted-foreground">Espaço de encontro entre grupos de todo o Ceará.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[4/5] overflow-hidden rounded-2xl border border-border bg-muted">
              <img
                src={heroImage}
                alt="Detalhe do encontro de música sacra"
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="absolute -bottom-6 -left-6 max-w-xs rounded-xl border border-border bg-card p-5 shadow-lg">
              <p className="font-display text-4xl font-bold text-gold">3</p>
              <p className="font-display text-lg font-semibold text-card-foreground">dias de programação</p>
              <p className="text-sm text-muted-foreground">Palestras, oficinas, missas e concerto.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const schedule = [
  {
    date: "20 de novembro",
    weekday: "Quinta-feira",
    items: [
      { time: "14h", title: "Credenciamento e acolhida", description: "Entrega de materiais e ambientação." },
      { time: "15h", title: "Oficina de Canto Litúrgico", description: "Técnicas vocais e repertório para a celebração." },
      { time: "17h", title: "Palestra de abertura", description: "A música sacra na Igreja do Nordeste." },
      { time: "19h", title: "Missa de Abertura", description: "Celebração com participação dos corais." },
    ],
  },
  {
    date: "21 de novembro",
    weekday: "Sexta-feira",
    items: [
      { time: "08h30", title: "Saudação e oração da manhã", description: "Momento de espiritualidade e unidade." },
      { time: "09h", title: "Oficina de Regência Coral", description: "Gestos, respiração e condução do grupo." },
      { time: "14h", title: "Palestra: Liturgia e Música", description: "Os documentos da Igreja sobre a música sacra." },
      { time: "16h", title: "Ensaio geral do repertório", description: "Preparação para o concerto de encerramento." },
      { time: "20h", title: "Concerto Sacro", description: "Apresentação dos corais e instrumentistas." },
    ],
  },
  {
    date: "22 de novembro",
    weekday: "Sábado",
    items: [
      { time: "08h30", title: "Formação para instrumentistas", description: "Acompanhamento litúrgico e dinâmica de grupo." },
      { time: "10h30", title: "Roda de conversa", description: "Desafios e perspectivas da música sacra no Ceará." },
      { time: "14h", title: "Ensaio técnico final", description: "Últimos ajustes para a celebração." },
      { time: "17h", title: "Missa de Encerramento", description: "Celebração solene de encerramento do encontro." },
    ],
  },
];

function ProgramSection() {
  return (
    <section id="programacao" className="section-padding bg-muted/50">
      <div className="container-event px-4 lg:px-0">
        <div className="mx-auto max-w-3xl text-center">
          <span className="font-display text-sm font-semibold uppercase tracking-widest text-gold">
            Programação
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold text-foreground sm:text-4xl">
            Três dias de música, formação e fé
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            A programação está sujeita a ajustes. Confirme os horários no material de acolhida.
          </p>
        </div>
        <div className="mt-12 grid gap-8 lg:grid-cols-3">
          {schedule.map((day, index) => (
            <Card key={index} className="border-border bg-card">
              <CardContent className="p-6">
                <div className="mb-4 border-b border-border pb-4">
                  <p className="font-display text-sm font-semibold uppercase tracking-widest text-gold">
                    {day.weekday}
                  </p>
                  <h3 className="mt-1 font-display text-xl font-bold text-card-foreground">
                    {day.date}
                  </h3>
                </div>
                <div className="space-y-5">
                  {day.items.map((item, itemIndex) => (
                    <div key={itemIndex} className="flex gap-3">
                      <div className="flex shrink-0 flex-col items-center gap-1">
                        <Clock className="h-4 w-4 text-gold" />
                        <span className="text-xs font-semibold text-gold">{item.time}</span>
                      </div>
                      <div>
                        <h4 className="font-display font-semibold text-card-foreground">{item.title}</h4>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function RegistrationSection() {
  const submit = useServerFn(submitRegistration);
  const [form, setForm] = useState<RegistrationInput>({
    name: "",
    email: "",
    phone: "",
    city: "",
    institution: "",
    role: "participant",
    observations: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof RegistrationInput, string>>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleChange = (field: keyof RegistrationInput, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    const parse = registrationSchema.safeParse(form);
    if (!parse.success) {
      const fieldErrors: Partial<Record<keyof RegistrationInput, string>> = {};
      parse.error.issues.forEach((issue: z.ZodIssue) => {
        const field = issue.path[0] as keyof RegistrationInput;
        fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      setStatus("idle");
      return;
    }

    try {
      await submit({ data: form });
      setStatus("success");
      setForm({
        name: "",
        email: "",
        phone: "",
        city: "",
        institution: "",
        role: "participant",
        observations: "",
      });
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Erro ao enviar inscrição. Tente novamente.");
    }
  };

  return (
    <section id="inscricao" className="section-padding bg-background">
      <div className="container-event px-4 lg:px-0">
        <div className="mx-auto max-w-3xl text-center">
          <span className="font-display text-sm font-semibold uppercase tracking-widest text-gold">
            Inscrição
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold text-foreground sm:text-4xl">
            Garanta sua participação
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Preencha o formulário abaixo para se inscrever no II Encontro de Música Sacra do Ceará.
          </p>
        </div>

        <div className="mt-12 mx-auto max-w-2xl">
          <Card className="border-border bg-card shadow-lg">
            <CardContent className="p-6 sm:p-8">
              {status === "success" ? (
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gold/10">
                    <CheckCircle className="h-8 w-8 text-gold" />
                  </div>
                  <h3 className="mt-4 font-display text-2xl font-bold text-card-foreground">
                    Inscrição recebida!
                  </h3>
                  <p className="mt-2 text-muted-foreground">
                    Agradecemos pelo seu interesse. Em breve entraremos em contato com mais informações.
                  </p>
                  <Button
                    onClick={() => setStatus("idle")}
                    className="mt-6 bg-gold text-gold-foreground hover:bg-gold/90"
                  >
                    Nova inscrição
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-card-foreground">
                        Nome completo
                      </Label>
                      <Input
                        id="name"
                        value={form.name}
                        onChange={(e) => handleChange("name", e.target.value)}
                        placeholder="Seu nome completo"
                        className="bg-background"
                        aria-invalid={!!errors.name}
                      />
                      {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-card-foreground">
                        E-mail
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={form.email}
                        onChange={(e) => handleChange("email", e.target.value)}
                        placeholder="seu@email.com"
                        className="bg-background"
                        aria-invalid={!!errors.email}
                      />
                      {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-card-foreground">
                        Telefone
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={form.phone}
                        onChange={(e) => handleChange("phone", e.target.value)}
                        placeholder="(00) 00000-0000"
                        className="bg-background"
                        aria-invalid={!!errors.phone}
                      />
                      {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city" className="text-card-foreground">
                        Cidade
                      </Label>
                      <Input
                        id="city"
                        value={form.city}
                        onChange={(e) => handleChange("city", e.target.value)}
                        placeholder="Sua cidade"
                        className="bg-background"
                        aria-invalid={!!errors.city}
                      />
                      {errors.city && <p className="text-sm text-destructive">{errors.city}</p>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="institution" className="text-card-foreground">
                      Paróquia / Comunidade / Instituição
                    </Label>
                    <Input
                      id="institution"
                      value={form.institution}
                      onChange={(e) => handleChange("institution", e.target.value)}
                      placeholder="Opcional"
                      className="bg-background"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role" className="text-card-foreground">
                      Você participará como
                    </Label>
                    <Select
                      value={form.role}
                      onValueChange={(value) => handleChange("role", value)}
                    >
                      <SelectTrigger id="role" className="bg-background" aria-invalid={!!errors.role}>
                        <SelectValue placeholder="Selecione uma opção" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="participant">Participante geral</SelectItem>
                        <SelectItem value="musician">Músico / Instrumentista</SelectItem>
                        <SelectItem value="choir_member">Cantor / Coralista</SelectItem>
                        <SelectItem value="listener">Ouvinte</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.role && <p className="text-sm text-destructive">{errors.role}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="observations" className="text-card-foreground">
                      Observações
                    </Label>
                    <Textarea
                      id="observations"
                      value={form.observations}
                      onChange={(e) => handleChange("observations", e.target.value)}
                      placeholder="Restrições alimentares, necessidades especiais ou outras informações"
                      className="min-h-[100px] bg-background"
                      aria-invalid={!!errors.observations}
                    />
                    {errors.observations && <p className="text-sm text-destructive">{errors.observations}</p>}
                  </div>

                  {status === "error" && (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
                      {errorMessage}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={status === "submitting"}
                    className="w-full bg-gold text-gold-foreground hover:bg-gold/90"
                    size="lg"
                  >
                    {status === "submitting" ? "Enviando..." : "Confirmar inscrição"}
                  </Button>

                  <p className="text-center text-xs text-muted-foreground">
                    Ao se inscrever, você concorda em receber comunicações sobre o evento.
                  </p>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-navy text-cream">
      <div className="container-event section-padding px-4 lg:px-0">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <div className="flex items-center gap-2 font-display text-lg font-semibold">
              <Music className="h-5 w-5 text-gold" />
              <span>II EMS-CE</span>
            </div>
            <p className="mt-3 text-sm text-cream/80">
              II Encontro de Música Sacra do Estado do Ceará. Celebrando a fé, a formação e a tradição
              musical do nosso povo.
            </p>
          </div>
          <div>
            <h3 className="font-display font-semibold">Local e data</h3>
            <ul className="mt-3 space-y-2 text-sm text-cream/80">
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gold" />
                Quixadá, Ceará
              </li>
              <li className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gold" />
                20 a 22 de novembro de 2025
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-display font-semibold">Links rápidos</h3>
            <ul className="mt-3 space-y-2 text-sm text-cream/80">
              <li>
                <a href="#sobre" className="hover:text-gold">
                  Sobre
                </a>
              </li>
              <li>
                <a href="#programacao" className="hover:text-gold">
                  Programação
                </a>
              </li>
              <li>
                <a href="#inscricao" className="hover:text-gold">
                  Inscrição
                </a>
              </li>
            </ul>
          </div>
        </div>
        <Separator className="my-8 bg-cream/10" />
        <div className="flex flex-col items-center justify-between gap-4 text-sm text-cream/60 sm:flex-row">
          <p>© 2025 II Encontro de Música Sacra do Estado do Ceará.</p>
          <p>Quixadá, CE</p>
        </div>
      </div>
    </footer>
  );
}
