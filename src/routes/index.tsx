import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";

import logoImage from "../assets/logo-musica-sacra.png";
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
        content:
          "Inscreva-se no II Encontro de Música Sacra do Estado do Ceará. Três dias de formação, celebração e música em Quixadá.",
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
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-white/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/60">
      <div className="container-event flex h-16 items-center justify-between px-4 lg:px-0">
        <Link
          to="/"
          className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-foreground"
        >
          <Music className="h-5 w-5 text-teal" />
          <span>II EMS-CE</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-semibold md:flex">
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
        <Button asChild size="sm" className="rounded-full bg-emerald px-5 font-semibold text-emerald-foreground hover:bg-emerald/90">
          <a href="#inscricao">Inscreva-se</a>
        </Button>
      </div>
    </header>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-linear-to-br from-teal via-teal-600 to-emerald">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-amber blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-white blur-3xl" />
      </div>
      <div className="relative section-padding">
        <div className="container-event grid items-center gap-12 px-4 lg:grid-cols-2 lg:px-0">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur-sm">
              <Calendar className="h-4 w-4" />
              20 a 22 de novembro de 2025
            </span>
            <h1 className="mt-6 max-w-2xl font-display text-4xl font-extrabold leading-[1.05] text-white sm:text-5xl md:text-6xl">
              II Encontro de Música Sacra do Estado do Ceará
            </h1>
            <p className="mt-6 max-w-xl text-lg text-white/90 sm:text-xl">
              Três dias de formação, celebração e espiritualidade pela música sacra em Quixadá.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-white/90 lg:justify-start">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-amber" />
                <span className="font-semibold">Quixadá, CE</span>
              </div>
              <div className="hidden h-5 w-px bg-white/30 sm:block" />
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-amber" />
                <span className="font-semibold">Músicos, regentes, cantores e fiéis</span>
              </div>
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-amber px-8 py-6 text-lg font-bold text-amber-foreground shadow-lg shadow-amber/25 hover:bg-amber/90"
              >
                <a href="#inscricao">
                  Faça sua inscrição
                  <ArrowRight className="ml-2 h-5 w-5" />
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-full border-2 border-white bg-white px-8 py-6 text-lg font-bold text-teal hover:bg-white/90"
              >
                <a href="#programacao">Programação</a>
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <div className="relative w-full max-w-md">
              <div className="absolute inset-0 rounded-full bg-white/10 blur-2xl" />
              <img
                src={logoImage}
                alt="Identidade visual do II Encontro de Música Sacra do Ceará"
                width={512}
                height={512}
                className="relative w-full drop-shadow-2xl"
                fetchPriority="high"
              />
            </div>
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
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-teal/10 px-4 py-1.5 text-sm font-bold text-teal">
            Sobre o encontro
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold text-foreground sm:text-4xl md:text-5xl">
            Uma celebração da tradição musical sacra
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            O II Encontro de Música Sacra do Estado do Ceará reúne músicos, regentes, cantores,
            liturgistas e fiéis em um fim de semana dedicado à formação, ao aperfeiçoamento e à
            vivência da música sacra.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border bg-card text-center transition-transform hover:-translate-y-1">
            <CardContent className="p-6">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal/10">
                <BookOpen className="h-7 w-7 text-teal" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-card-foreground">Formação</h3>
              <p className="mt-2 text-sm text-muted-foreground">Oficinas com músicos e liturgistas experientes.</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card text-center transition-transform hover:-translate-y-1">
            <CardContent className="p-6">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald/10">
                <Church className="h-7 w-7 text-emerald" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-card-foreground">Celebração</h3>
              <p className="mt-2 text-sm text-muted-foreground">Missas e momentos de oração com música sacra.</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card text-center transition-transform hover:-translate-y-1">
            <CardContent className="p-6">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber/10">
                <Mic2 className="h-7 w-7 text-amber" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-card-foreground">Concerto</h3>
              <p className="mt-2 text-sm text-muted-foreground">Apresentação especial do repertório sacro.</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card text-center transition-transform hover:-translate-y-1">
            <CardContent className="p-6">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal/10">
                <Users className="h-7 w-7 text-teal" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-card-foreground">Comunidade</h3>
              <p className="mt-2 text-sm text-muted-foreground">Espaço de encontro entre grupos de todo o Ceará.</p>
            </CardContent>
          </Card>
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
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald/10 px-4 py-1.5 text-sm font-bold text-emerald">
            Programação
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold text-foreground sm:text-4xl md:text-5xl">
            Três dias de música, formação e fé
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            A programação está sujeita a ajustes. Confirme os horários no material de acolhida.
          </p>
        </div>
        <div className="mt-12 grid gap-8 lg:grid-cols-3">
          {schedule.map((day, index) => (
            <Card key={index} className="border-border bg-card overflow-hidden">
              <div className="bg-gradient-to-r from-teal to-emerald p-4">
                <p className="font-display text-sm font-bold uppercase tracking-widest text-white/80">
                  {day.weekday}
                </p>
                <h3 className="mt-1 font-display text-xl font-bold text-white">
                  {day.date}
                </h3>
              </div>
              <CardContent className="p-6">
                <div className="space-y-5">
                  {day.items.map((item, itemIndex) => (
                    <div key={itemIndex} className="flex gap-3">
                      <div className="flex shrink-0 flex-col items-center gap-1">
                        <Clock className="h-4 w-4 text-teal" />
                        <span className="text-xs font-bold text-teal">{item.time}</span>
                      </div>
                      <div>
                        <h4 className="font-display font-bold text-card-foreground">{item.title}</h4>
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
          <span className="inline-flex items-center gap-2 rounded-full bg-amber/10 px-4 py-1.5 text-sm font-bold text-amber">
            Inscrição
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold text-foreground sm:text-4xl md:text-5xl">
            Garanta sua participação
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Preencha o formulário abaixo para se inscrever no II Encontro de Música Sacra do Ceará.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-2xl">
          <Card className="border-border bg-card shadow-xl shadow-teal/5">
            <CardContent className="p-6 sm:p-8">
              {status === "success" ? (
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald/10">
                    <CheckCircle className="h-8 w-8 text-emerald" />
                  </div>
                  <h3 className="mt-4 font-display text-2xl font-bold text-card-foreground">
                    Inscrição recebida!
                  </h3>
                  <p className="mt-2 text-muted-foreground">
                    Agradecemos pelo seu interesse. Em breve entraremos em contato com mais informações.
                  </p>
                  <Button
                    onClick={() => setStatus("idle")}
                    className="mt-6 rounded-full bg-teal font-semibold text-white hover:bg-teal/90"
                  >
                    Nova inscrição
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="font-semibold">
                        Nome completo
                      </Label>
                      <Input
                        id="name"
                        value={form.name}
                        onChange={(e) => handleChange("name", e.target.value)}
                        placeholder="Seu nome"
                        className="rounded-xl border-border bg-background"
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
                        onChange={(e) => handleChange("email", e.target.value)}
                        placeholder="seu@email.com"
                        className="rounded-xl border-border bg-background"
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
                        value={form.phone}
                        onChange={(e) => handleChange("phone", e.target.value)}
                        placeholder="(88) 99999-9999"
                        className="rounded-xl border-border bg-background"
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
                        onChange={(e) => handleChange("city", e.target.value)}
                        placeholder="Quixadá"
                        className="rounded-xl border-border bg-background"
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
                        onChange={(e) => handleChange("institution", e.target.value)}
                        placeholder="Onde você atua"
                        className="rounded-xl border-border bg-background"
                      />
                      {errors.institution && <p className="text-sm text-destructive">{errors.institution}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role" className="font-semibold">
                        Função
                      </Label>
                      <Select value={form.role} onValueChange={(value) => handleChange("role", value)}>
                        <SelectTrigger id="role" className="rounded-xl border-border bg-background">
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

                  <div className="space-y-2">
                    <Label htmlFor="observations" className="font-semibold">
                      Observações
                    </Label>
                    <Textarea
                      id="observations"
                      value={form.observations}
                      onChange={(e) => handleChange("observations", e.target.value)}
                      placeholder="Restrições alimentares, necessidades especiais ou outras informações"
                      rows={4}
                      className="rounded-xl border-border bg-background"
                    />
                    {errors.observations && <p className="text-sm text-destructive">{errors.observations}</p>}
                  </div>

                  {status === "error" && (
                    <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
                      {errorMessage}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={status === "submitting"}
                    className="w-full rounded-full bg-gradient-to-r from-teal to-emerald py-6 text-lg font-bold text-white hover:opacity-90 disabled:opacity-60"
                  >
                    {status === "submitting" ? "Enviando..." : "Enviar inscrição"}
                  </Button>
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
    <footer className="bg-foreground py-16 text-white">
      <div className="container-event px-4 lg:px-0">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <div className="flex items-center gap-2 font-display text-lg font-bold">
              <Music className="h-5 w-5 text-amber" />
              <span>II EMS-CE</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/70">
              II Encontro de Música Sacra do Estado do Ceará. Celebrando a fé, a formação e a tradição musical do nosso povo.
            </p>
          </div>
          <div>
            <h4 className="font-display font-bold">Local e data</h4>
            <ul className="mt-4 space-y-3 text-sm text-white/70">
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-amber" />
                Quixadá, Ceará
              </li>
              <li className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-amber" />
                20 a 22 de novembro de 2025
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-display font-bold">Links rápidos</h4>
            <ul className="mt-4 space-y-3 text-sm text-white/70">
              <li>
                <a href="#sobre" className="transition-colors hover:text-white">Sobre</a>
              </li>
              <li>
                <a href="#programacao" className="transition-colors hover:text-white">Programação</a>
              </li>
              <li>
                <a href="#inscricao" className="transition-colors hover:text-white">Inscrição</a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-sm text-white/60 sm:flex-row">
          <p>© 2025 II Encontro de Música Sacra do Estado do Ceará.</p>
          <p>Quixadá, CE</p>
        </div>
      </div>
    </footer>
  );
}
