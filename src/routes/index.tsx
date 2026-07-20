import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import shirtImage from "../assets/camisa-evento-musica-sacra.png";
import claytonImage from "../assets/clayton-dias.jpg";
import logoImage from "../assets/logo-coros-diocesanos.png";
import dioceseLogo from "../assets/apoio-diocese-quixada.png";
import coroLogo from "../assets/organizacao-coro-diocesano-quixada.png";
import pixLogo from "../assets/logo-pix.svg";
import ampliartLogo from "../assets/patrocinador-ampliart.png";
import culturaLogo from "../assets/patrocinador-cultura-quixada.png";
import nossoLogo from "../assets/patrocinador-nosso-atacarejo.png";
import pinheiroLogo from "../assets/patrocinador-pinheiro.png";
import unicatolicaLogo from "../assets/patrocinador-unicatolica.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
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
  Calendar,
  MapPin,
  Clock,
  Users,
  BookOpen,
  Mic2,
  Church,
  CheckCircle,
  ArrowRight,
} from "lucide-react";

type RegistrationInput = {
  name: string;
  email: string;
  phone: string;
  city: string;
  institution: string;
  role: string;
  includeShirt: boolean;
  shirtSize: string;
  observations: string;
};

const REGISTRATION_PRICE = 100;
const SHIRT_PRICE = 39.9;
const SITE_URL = "https://encontrocorosce.lovable.app";
const SOCIAL_IMAGE_URL = `${SITE_URL}/og-coros-diocesanos-v5.jpg`;
const MOCK_PIX_CODE =
  "00020126580014BR.GOV.BCB.PIX0136ii-ems-ce-pagamento-mockado5204000053039865406VALOR5802BR5925II EMS CE MOCK6008QUIXADA62070503***6304MOCK";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "II Encontro de Coros Diocesanos do Regional Nordeste 1 - CNBB — 20 a 22 de Novembro" },
      {
        name: "description",
        content:
          "Inscreva-se no II Encontro de Coros Diocesanos do Regional Nordeste 1 - CNBB. Três dias de formação, celebração e música em Quixadá.",
      },
      {
        property: "og:title",
        content: "II Encontro de Coros Diocesanos do Regional Nordeste 1 - CNBB — 20 a 22 de Novembro",
      },
      {
        property: "og:description",
        content:
          "Inscreva-se no II Encontro de Coros Diocesanos do Regional Nordeste 1 - CNBB. Três dias de formação, celebração e música em Quixadá.",
      },
      { property: "og:url", content: SITE_URL },
      { property: "og:image", content: SOCIAL_IMAGE_URL },
      { property: "og:image:secure_url", content: SOCIAL_IMAGE_URL },
      { property: "og:image:type", content: "image/jpeg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        property: "og:image:alt",
        content: "Logo do II Encontro de Coros Diocesanos do Regional Nordeste 1 - CNBB",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "II Encontro de Coros Diocesanos do Regional Nordeste 1 - CNBB" },
      {
        name: "twitter:description",
        content:
          "De 20 a 22 de novembro, em Quixadá. Inscreva-se no II Encontro de Coros Diocesanos do Regional Nordeste 1 - CNBB.",
      },
      { name: "twitter:image", content: SOCIAL_IMAGE_URL },
    ],
    links: [{ rel: "canonical", href: SITE_URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Event",
          name: "II Encontro de Coros Diocesanos do Regional Nordeste 1 - CNBB",
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
        <QuixadaSection />
        <ProgramSection />
        <RegistrationSection />
        <SponsorsSection />
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const updateHeader = () => setIsScrolled(window.scrollY > 80);

    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });

    return () => window.removeEventListener("scroll", updateHeader);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-teal/10 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/85">
      <div className="container-event flex h-14 items-center justify-between gap-3 px-4 lg:h-[4.5rem] lg:px-0">
        <Link
          to="/"
          className="flex min-w-0 items-center gap-2 font-display text-base font-bold text-foreground sm:gap-3 sm:text-lg"
        >
          <img
            src={logoImage}
            alt="II Encontro de Musica Sacra do Estado do Ceara"
            className={`h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-amber/50 transition-all duration-300 sm:h-11 sm:w-11 sm:opacity-100 ${
              isScrolled ? "scale-100 opacity-100" : "scale-75 opacity-0"
            }`}
          />
          <span
            className={`truncate transition-opacity duration-300 sm:opacity-100 ${
              isScrolled ? "opacity-100" : "opacity-0"
            }`}
          >
            II ECD-NE1
          </span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-semibold lg:flex">
          <a href="#sobre" className="text-muted-foreground transition-colors hover:text-teal">
            Sobre
          </a>
          <a
            href="#programacao"
            className="text-muted-foreground transition-colors hover:text-teal"
          >
            Programação
          </a>
          <a href="#quixada" className="text-muted-foreground transition-colors hover:text-teal">
            Quixadá
          </a>
          <a href="#camisa" className="text-muted-foreground transition-colors hover:text-teal">
            Camisa
          </a>
          <a href="#inscricao" className="text-muted-foreground transition-colors hover:text-teal">
            Inscrição
          </a>
        </nav>
        <Button
          asChild
          size="sm"
          className="h-9 shrink-0 rounded-full bg-amber px-4 text-sm font-bold text-amber-foreground hover:bg-amber/90 sm:h-10 sm:px-5"
        >
          <a href="#inscricao">Inscrever</a>
        </Button>
      </div>
      <nav className="scrollbar-none hidden gap-2 overflow-x-auto border-t border-teal/10 px-4 py-2 text-sm font-bold text-muted-foreground sm:flex lg:hidden">
        <a href="#sobre" className="shrink-0 rounded-full bg-white px-4 py-2 active:bg-teal/10">
          Sobre
        </a>
        <a href="#quixada" className="shrink-0 rounded-full bg-white px-4 py-2 active:bg-teal/10">
          Quixadá
        </a>
        <a
          href="#programacao"
          className="shrink-0 rounded-full bg-white px-4 py-2 active:bg-teal/10"
        >
          Programação
        </a>
        <a href="#camisa" className="shrink-0 rounded-full bg-white px-4 py-2 active:bg-teal/10">
          Camisa
        </a>
        <a
          href="#inscricao"
          className="shrink-0 rounded-full bg-amber px-4 py-2 text-amber-foreground active:bg-amber/80"
        >
          Inscrição
        </a>
      </nav>
    </header>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-teal">
      <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(5,18,61,0.98)_0%,rgba(0,81,186,0.94)_54%,rgba(4,19,73,0.98)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(0deg,rgba(247,249,255,0.98),rgba(247,249,255,0))]" />
      <div className="relative section-padding">
        <div className="container-event grid items-center gap-6 px-4 sm:gap-10 lg:grid-cols-2 lg:gap-12 lg:px-0">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <img
              src={logoImage}
              alt="Identidade visual do II Encontro de Coros Diocesanos do Regional Nordeste 1 - CNBB"
              width={240}
              height={240}
              className="mb-4 w-56 max-w-[72vw] rounded-md drop-shadow-2xl ring-1 ring-white/20 sm:hidden"
              fetchPriority="high"
            />
            <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-amber/40 bg-white/15 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm sm:px-4 sm:text-sm">
              <Calendar className="h-4 w-4" />
              20 a 22 de novembro de 2025
            </span>
            <h1 className="mt-4 max-w-2xl font-display text-[clamp(2rem,9.7vw,3.4rem)] font-extrabold leading-[1.02] text-white sm:mt-6 md:text-6xl">
              II Encontro de Coros Diocesanos do Regional Nordeste 1 - CNBB
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-white/90 sm:mt-6 sm:text-xl">
              Três dias de formação, celebração e espiritualidade pela música sacra em Quixadá.
            </p>
            <div className="mt-5 flex flex-col items-center justify-center gap-2 text-sm text-white/90 sm:mt-7 sm:flex-row sm:flex-wrap sm:gap-3 sm:text-base lg:justify-start">
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
            <div className="mt-6 flex w-full flex-col items-stretch justify-center gap-2 sm:mt-8 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 lg:justify-start">
              <Button
                asChild
                size="lg"
                className="h-12 w-full rounded-full bg-amber px-8 text-base font-extrabold text-amber-foreground shadow-md shadow-black/15 hover:bg-amber/90 sm:h-auto sm:w-auto sm:py-6 sm:text-lg"
              >
                <a href="#inscricao" className="justify-center">
                  Faça sua inscrição
                  <ArrowRight className="ml-2 h-5 w-5" />
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 w-full rounded-full border-2 border-white/80 bg-white px-8 text-base font-bold text-teal hover:bg-white/90 sm:h-auto sm:w-auto sm:py-6 sm:text-lg"
              >
                <a href="#programacao" className="justify-center">
                  Programação
                </a>
              </Button>
            </div>
          </div>
          <div className="hidden items-center justify-center sm:flex">
            <div className="relative w-full max-w-[18rem] sm:max-w-md lg:max-w-lg">
              <img
                src={logoImage}
                alt="Identidade visual do II Encontro de Coros Diocesanos do Regional Nordeste 1 - CNBB"
                width={512}
                height={512}
                className="relative w-full rounded-md drop-shadow-2xl ring-1 ring-white/20"
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
          <h2 className="mt-4 font-display text-[clamp(2rem,8vw,3rem)] font-bold leading-tight text-foreground md:text-5xl">
            Uma celebração da tradição musical sacra
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:mt-6 sm:text-lg">
            O II Encontro de Coros Diocesanos do Regional Nordeste 1 - CNBB reúne músicos, regentes, cantores,
            liturgistas e fiéis em um fim de semana dedicado à formação, ao aperfeiçoamento e à
            vivência da música sacra.
          </p>
        </div>

        <div className="mt-9 grid grid-cols-2 gap-3 sm:mt-12 sm:gap-6 lg:grid-cols-4">
          <Card className="border-border bg-card text-center transition-transform hover:-translate-y-1">
            <CardContent className="p-4 sm:p-6">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-teal/10 sm:h-14 sm:w-14">
                <BookOpen className="h-6 w-6 text-teal sm:h-7 sm:w-7" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-card-foreground">Formação</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Oficinas com músicos e liturgistas experientes.
              </p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card text-center transition-transform hover:-translate-y-1">
            <CardContent className="p-4 sm:p-6">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald/10 sm:h-14 sm:w-14">
                <Church className="h-6 w-6 text-emerald sm:h-7 sm:w-7" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-card-foreground">
                Celebração
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Missas e momentos de oração com música sacra.
              </p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card text-center transition-transform hover:-translate-y-1">
            <CardContent className="p-4 sm:p-6">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber/10 sm:h-14 sm:w-14">
                <Mic2 className="h-6 w-6 text-amber sm:h-7 sm:w-7" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-card-foreground">Concerto</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Apresentação especial do repertório sacro.
              </p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card text-center transition-transform hover:-translate-y-1">
            <CardContent className="p-4 sm:p-6">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-teal/10 sm:h-14 sm:w-14">
                <Users className="h-6 w-6 text-teal sm:h-7 sm:w-7" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-card-foreground">
                Comunidade
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Espaço de encontro entre grupos de todo o Ceará.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-12 grid items-center gap-8 rounded-xl border border-border bg-card p-5 shadow-sm shadow-teal/10 md:grid-cols-[0.8fr_1.2fr] md:p-7">
          <img
            src={claytonImage}
            alt="Clayton Dias em interior de igreja"
            width={1088}
            height={620}
            className="aspect-[4/3] w-full rounded-lg object-cover"
            loading="lazy"
          />
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-amber/10 px-4 py-1.5 text-sm font-bold text-amber">
              Participação especial
            </span>
            <h3 className="mt-4 font-display text-3xl font-extrabold leading-tight text-card-foreground">
              Clayton Dias aprofunda o eixo formativo do encontro
            </h3>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Maestro, pesquisador e professor, Clayton atua em música sacra, canto gregoriano,
              regência, história da música sacra e musicologia litúrgica. Sua presença conecta
              prática coral, tradição litúrgica e pesquisa musical.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-sm font-bold text-teal">
              <span className="rounded-full bg-teal/10 px-3 py-1">Canto gregoriano</span>
              <span className="rounded-full bg-teal/10 px-3 py-1">Regência coral</span>
              <span className="rounded-full bg-teal/10 px-3 py-1">Musicologia litúrgica</span>
            </div>
            <Button
              asChild
              variant="outline"
              className="mt-6 rounded-full border-2 border-teal font-bold text-teal hover:bg-teal hover:text-white"
            >
              <a href="https://claytondias.com/biografia/" target="_blank" rel="noreferrer">
                Ver biografia oficial
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

const quixadaSpots = [
  {
    name: "Açude Cedro e Galinha Choca",
    description:
      "Cartão-postal de Quixadá, reúne a barragem histórica do Cedro e a formação rochosa mais famosa da cidade.",
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/A%C3%A7ude%20Cedro%20-%20Pedra%20da%20Galinha%20Choca.jpg",
    credit: "Foto: Wikimedia Commons",
  },
  {
    name: "Santuário Rainha do Sertão",
    description:
      "No alto da serra, o santuário oferece uma vista ampla da cidade, dos monólitos e do sertão ao redor.",
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Quixad%C3%A1%20CE%20Brasil%20-%20Santu%C3%A1rio%20Rainha%20do%20Sert%C3%A3o%20-%20panoramio%20%281%29.jpg",
    credit: "Foto: Jorge Colares / Wikimedia Commons",
  },
  {
    name: "Terra dos monólitos",
    description:
      "As formações de pedra desenham a paisagem de Quixadá e fazem da cidade um destino marcante para contemplação, trilhas e aventura.",
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Mon%C3%B3litos%20em%20Quixad%C3%A1.jpg",
    credit: "Foto: deltafrut / Wikimedia Commons",
  },
];

const sponsors = [
  { name: "Unicatolica", logo: unicatolicaLogo },
  { name: "Pinheiro Supermercado", logo: pinheiroLogo },
  { name: "Nosso Atacarejo", logo: nossoLogo },
  { name: "Cultura Quixada", logo: culturaLogo },
  { name: "Ampliart", logo: ampliartLogo },
];

const institutionalPartners = [
  { role: "Organização", name: "Coro Diocesano de Quixadá", logo: coroLogo },
  { role: "Apoio institucional", name: "Diocese de Quixadá", logo: dioceseLogo },
];

function QuixadaSection() {
  return (
    <section id="quixada" className="section-padding bg-muted/50">
      <div className="container-event px-4 lg:px-0">
        <div className="grid gap-6 sm:gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-teal/10 px-4 py-1.5 text-sm font-bold text-teal">
              Quixadá, Ceará
            </span>
            <h2 className="mt-5 font-display text-[clamp(2rem,8vw,3rem)] font-extrabold leading-tight text-foreground md:text-5xl">
              Uma cidade histórica cercada por monólitos
            </h2>
          </div>
          <div className="space-y-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            <p>
              Fundada e emancipada em 27 de outubro de 1870, Quixadá chega aos 155 anos como uma das
              paisagens mais reconhecíveis do sertão cearense.
            </p>
            <p>
              A cidade mistura fé, música, literatura, natureza e aventura: entre o Açude Cedro, a
              Pedra da Galinha Choca, o Santuário Rainha do Sertão e seus grandes monólitos, cada
              visita tem um cenário próprio.
            </p>
          </div>
        </div>

        <Carousel opts={{ align: "start", loop: true }} className="mx-auto mt-9 w-full sm:mt-12">
          <CarouselContent>
            {quixadaSpots.map((spot) => (
              <CarouselItem key={spot.name} className="basis-[86%] sm:basis-[58%] lg:basis-1/3">
                <article className="h-full overflow-hidden rounded-xl border border-border bg-card">
                  <img
                    src={spot.image}
                    alt={spot.name}
                    className="aspect-[4/3] w-full object-cover"
                    loading="lazy"
                  />
                  <div className="p-5">
                    <h3 className="font-display text-xl font-bold text-card-foreground">
                      {spot.name}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {spot.description}
                    </p>
                    <p className="mt-4 text-xs font-semibold text-muted-foreground">
                      {spot.credit}
                    </p>
                  </div>
                </article>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="-left-3 hidden border-teal bg-background text-teal hover:bg-teal hover:text-white sm:flex md:-left-5" />
          <CarouselNext className="-right-3 hidden border-teal bg-background text-teal hover:bg-teal hover:text-white sm:flex md:-right-5" />
        </Carousel>
      </div>
    </section>
  );
}

const schedule = [
  {
    date: "20 de novembro",
    weekday: "Quinta-feira",
    items: [
      {
        time: "14h",
        title: "Credenciamento e acolhida",
        description: "Entrega de materiais e ambientação.",
      },
      {
        time: "15h",
        title: "Oficina de Canto Litúrgico",
        description: "Técnicas vocais e repertório para a celebração.",
      },
      {
        time: "17h",
        title: "Palestra de abertura",
        description: "A música sacra na Igreja do Nordeste.",
      },
      {
        time: "19h",
        title: "Missa de Abertura",
        description: "Celebração com participação dos corais.",
      },
    ],
  },
  {
    date: "21 de novembro",
    weekday: "Sexta-feira",
    items: [
      {
        time: "08h30",
        title: "Saudação e oração da manhã",
        description: "Momento de espiritualidade e unidade.",
      },
      {
        time: "09h",
        title: "Oficina de Regência Coral",
        description: "Gestos, respiração e condução do grupo.",
      },
      {
        time: "14h",
        title: "Palestra: Liturgia e Música",
        description: "Os documentos da Igreja sobre a música sacra.",
      },
      {
        time: "16h",
        title: "Ensaio geral do repertório",
        description: "Preparação para o concerto de encerramento.",
      },
      {
        time: "20h",
        title: "Concerto Sacro",
        description: "Apresentação dos corais e instrumentistas.",
      },
    ],
  },
  {
    date: "22 de novembro",
    weekday: "Sábado",
    items: [
      {
        time: "08h30",
        title: "Formação para instrumentistas",
        description: "Acompanhamento litúrgico e dinâmica de grupo.",
      },
      {
        time: "10h30",
        title: "Roda de conversa",
        description: "Desafios e perspectivas da música sacra no Ceará.",
      },
      {
        time: "14h",
        title: "Ensaio técnico final",
        description: "Últimos ajustes para a celebração.",
      },
      {
        time: "17h",
        title: "Missa de Encerramento",
        description: "Celebração solene de encerramento do encontro.",
      },
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
        <Carousel opts={{ align: "start", loop: false }} className="mx-auto mt-8 w-full lg:hidden">
          <CarouselContent>
            {schedule.map((day, index) => (
              <CarouselItem key={index} className="basis-[88%]">
                <ProgramDayCard day={day} />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        <div className="mt-12 hidden gap-8 lg:grid lg:grid-cols-3">
          {schedule.map((day, index) => (
            <ProgramDayCard key={index} day={day} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ProgramDayCard({ day }: { day: (typeof schedule)[number] }) {
  return (
    <Card className="h-full overflow-hidden border-border bg-card">
      <div className="bg-teal p-4">
        <p className="font-body text-sm font-bold text-white/80">{day.weekday}</p>
        <h3 className="mt-1 font-display text-xl font-bold text-white">{day.date}</h3>
      </div>
      <CardContent className="p-5 sm:p-6">
        <div className="space-y-4 sm:space-y-5">
          {day.items.map((item, itemIndex) => (
            <div key={itemIndex} className="flex gap-3">
              <div className="flex shrink-0 flex-col items-center gap-1">
                <Clock className="h-4 w-4 text-teal" />
                <span className="text-xs font-bold text-teal">{item.time}</span>
              </div>
              <div>
                <h4 className="font-display font-bold leading-tight text-card-foreground">
                  {item.title}
                </h4>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RegistrationSection() {
  const [form, setForm] = useState<RegistrationInput>({
    name: "",
    email: "",
    phone: "",
    city: "",
    institution: "",
    role: "participant",
    includeShirt: false,
    shirtSize: "",
    observations: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof RegistrationInput, string>>>({});
  const [status, setStatus] = useState<"idle" | "payment">("idle");
  const [copiedPix, setCopiedPix] = useState(false);
  const totalAmount = REGISTRATION_PRICE + (form.includeShirt ? SHIRT_PRICE : 0);

  const handleChange = (field: keyof RegistrationInput, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = () => {
    const nextErrors: Partial<Record<keyof RegistrationInput, string>> = {};

    if (!form.name.trim()) {
      nextErrors.name = "Informe seu nome completo.";
    }
    if (!form.email.trim()) {
      nextErrors.email = "Informe seu e-mail.";
    }
    if (!form.phone.trim()) {
      nextErrors.phone = "Informe seu telefone.";
    }
    if (!form.city.trim()) {
      nextErrors.city = "Informe sua cidade.";
    }
    if (form.includeShirt && !form.shirtSize) {
      nextErrors.shirtSize = "Escolha o tamanho da camisa.";
    }

    return nextErrors;
  };

  const resetRegistration = () => {
    setForm({
      name: "",
      email: "",
      phone: "",
      city: "",
      institution: "",
      role: "participant",
      includeShirt: false,
      shirtSize: "",
      observations: "",
    });
    setErrors({});
    setCopiedPix(false);
    setStatus("idle");
  };

  const copyMockPixCode = async () => {
    await navigator.clipboard?.writeText(MOCK_PIX_CODE);
    setCopiedPix(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors = validateForm();

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setCopiedPix(false);
    setStatus("payment");
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
            Preencha o formulário abaixo para se inscrever no II Encontro de Coros Diocesanos do Regional Nordeste 1 - CNBB.
          </p>
          <div className="mx-auto mt-6 flex max-w-sm flex-col items-center justify-center gap-2 rounded-xl border border-amber/40 bg-amber/10 px-5 py-4 sm:inline-flex sm:max-w-none sm:flex-row sm:flex-wrap sm:gap-3 sm:rounded-full sm:py-3">
            <span className="text-sm font-bold text-muted-foreground">Inscrição</span>
            <span className="font-display text-3xl font-extrabold leading-none text-foreground">
              {formatCurrency(REGISTRATION_PRICE)}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-bold text-teal">
              <img src={pixLogo} alt="" className="h-4 w-auto" aria-hidden="true" />
              pagamento via Pix
            </span>
          </div>
        </div>

        <div className="mx-auto mt-9 grid max-w-6xl gap-6 sm:mt-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-8">
          <article
            id="camisa"
            className="order-2 overflow-hidden rounded-xl bg-foreground text-white shadow-md shadow-teal/15 lg:order-1"
          >
            <img
              src={shirtImage}
              alt="Camisa oficial azul do II Encontro de Musica Sacra do Ceara"
              width={1536}
              height={1536}
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
                Azul royal, arte oficial do encontro e detalhes em dourado. Escolha o tamanho no
                formulario de inscricao.
              </p>
              <div className="mt-5 flex items-end gap-3">
                <span className="text-sm font-bold text-white/60">Camisa</span>
                <span className="font-display text-4xl font-extrabold leading-none text-amber">
                  R$ 39,90
                </span>
              </div>
            </div>
          </article>

          <Card className="order-1 border-border bg-card shadow-sm shadow-teal/10 lg:order-2">
            <CardContent className="p-4 sm:p-8">
              {status === "payment" ? (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald/10">
                      <CheckCircle className="h-8 w-8 text-emerald" />
                    </div>
                    <h3 className="mt-4 font-display text-2xl font-bold text-card-foreground">
                      Pagamento Pix seguro
                    </h3>
                    <p className="mt-2 text-muted-foreground">
                      Esta pagina Pix e uma demonstracao mockada. Nenhum pagamento real sera gerado
                      nesta versao estatica.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[0.8fr_1.2fr] md:gap-5">
                    <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-teal/20 bg-teal/5 p-4 text-center sm:min-h-56 sm:p-5">
                      <img src={pixLogo} alt="Pix" className="h-10 w-auto sm:h-12" />
                      <div className="mt-4 grid size-32 place-items-center rounded-lg border border-teal/20 bg-white p-3 sm:mt-5 sm:size-36 sm:p-4">
                        <span className="font-display text-xl font-extrabold text-teal sm:text-2xl">
                          QR MOCK
                        </span>
                      </div>
                      <p className="mt-3 text-xs font-semibold text-muted-foreground">
                        QR Code ilustrativo
                      </p>
                    </div>

                    <div className="rounded-xl border border-border bg-background p-4 sm:p-5">
                      <p className="text-sm font-bold text-muted-foreground">Total a pagar</p>
                      <p className="mt-1 font-display text-3xl font-extrabold text-foreground sm:text-4xl">
                        {formatCurrency(totalAmount)}
                      </p>
                      <div className="mt-5 space-y-3 text-sm">
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Inscricao</span>
                          <span className="font-bold text-foreground">
                            {formatCurrency(REGISTRATION_PRICE)}
                          </span>
                        </div>
                        {form.includeShirt && (
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">
                              Camisa oficial {form.shirtSize && `(${form.shirtSize})`}
                            </span>
                            <span className="font-bold text-foreground">
                              {formatCurrency(SHIRT_PRICE)}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="mt-5 rounded-lg bg-muted p-3">
                        <p className="text-xs font-bold text-muted-foreground">
                          Codigo Pix copia e cola
                        </p>
                        <p className="mt-2 break-all font-mono text-xs leading-relaxed text-foreground">
                          {MOCK_PIX_CODE}
                        </p>
                      </div>
                      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                        <Button
                          type="button"
                          onClick={copyMockPixCode}
                          className="min-h-12 flex-1 rounded-full bg-teal font-bold text-white hover:bg-teal/90"
                        >
                          {copiedPix ? "Codigo copiado" : "Copiar codigo Pix"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={resetRegistration}
                          className="min-h-12 flex-1 rounded-full border-2 border-teal font-bold text-teal hover:bg-teal hover:text-white"
                        >
                          Nova inscricao
                        </Button>
                      </div>
                    </div>
                  </div>
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
                        onChange={(e) => handleChange("email", e.target.value)}
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
                        onChange={(e) => handleChange("phone", e.target.value)}
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
                        onChange={(e) => handleChange("city", e.target.value)}
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
                        onChange={(e) => handleChange("institution", e.target.value)}
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
                          setForm((prev) => ({
                            ...prev,
                            includeShirt: event.target.checked,
                            shirtSize: event.target.checked ? prev.shirtSize : "",
                          }))
                        }
                        className="mt-1 size-5 shrink-0 rounded border-border accent-teal"
                      />
                      <span>
                        <span className="block font-bold text-foreground">
                          Incluir camisa oficial
                        </span>
                        <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                          Adicione a camisa do encontro por {formatCurrency(SHIRT_PRICE)}.
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
                            setForm((prev) => ({ ...prev, shirtSize: value }));
                            setErrors((prev) => ({ ...prev, shirtSize: undefined }));
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
                        {formatCurrency(REGISTRATION_PRICE)}
                      </span>
                    </div>
                    {form.includeShirt && (
                      <div className="mt-2 flex items-center justify-between gap-4 text-sm">
                        <span className="text-muted-foreground">Camisa oficial</span>
                        <span className="font-bold text-foreground">
                          {formatCurrency(SHIRT_PRICE)}
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
                      onChange={(e) => handleChange("observations", e.target.value)}
                      placeholder="Informe restricoes, necessidades ou observacoes. O pagamento sera via Pix."
                      rows={4}
                      className="min-h-28 rounded-xl border-border bg-background text-base"
                    />
                    {errors.observations && (
                      <p className="text-sm text-destructive">{errors.observations}</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="min-h-14 w-full rounded-full bg-teal py-6 text-base font-extrabold text-white hover:bg-teal/90 sm:text-lg"
                  >
                    Ir para pagamento Pix
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

function SponsorsSection() {
  return (
    <section id="patrocinadores" className="section-padding bg-muted/50">
      <div className="container-event space-y-8 px-4 lg:px-0">
        <div className="grid gap-6 rounded-xl bg-foreground p-5 text-white sm:p-7 lg:grid-cols-[0.75fr_1.25fr] lg:items-center lg:gap-8">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-amber/15 px-4 py-1.5 text-sm font-bold text-amber">
              Apoio e organização
            </span>
            <h2 className="mt-4 font-display text-[clamp(2rem,8vw,2.5rem)] font-extrabold leading-tight sm:text-4xl">
              Instituições que conduzem o encontro
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/72 sm:text-lg">
              A realização nasce do trabalho conjunto entre o Coro Diocesano de Quixadá e a Diocese
              de Quixadá.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            {institutionalPartners.map((partner) => (
              <article
                key={partner.name}
                className="flex min-h-36 flex-col justify-between rounded-xl bg-white p-5 text-foreground"
              >
                <span className="text-sm font-bold text-teal">{partner.role}</span>
                <div className="mt-4 flex min-h-24 items-center justify-center">
                  <img
                    src={partner.logo}
                    alt={partner.name}
                    className="max-h-24 w-full object-contain"
                    loading="lazy"
                  />
                </div>
                <h3 className="mt-4 font-display text-xl font-extrabold leading-tight">
                  {partner.name}
                </h3>
              </article>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr] lg:items-center lg:gap-8">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-teal/10 px-4 py-1.5 text-sm font-bold text-teal">
              Patrocinadores
            </span>
            <h2 className="mt-4 font-display text-[clamp(2rem,8vw,2.5rem)] font-extrabold leading-tight text-foreground sm:text-4xl">
              Quem ajuda esta musica chegar mais longe
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              O encontro tambem e construido por parceiros que valorizam cultura, formacao e vida
              comunitaria em Quixada.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
            {sponsors.map((sponsor) => (
              <article
                key={sponsor.name}
                className="flex min-h-24 items-center justify-center rounded-xl border border-border bg-card p-4 sm:min-h-32 sm:p-5"
              >
                <img
                  src={sponsor.logo}
                  alt={sponsor.name}
                  className="max-h-16 w-full object-contain sm:max-h-20"
                  loading="lazy"
                />
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-foreground py-12 text-white sm:py-16">
      <div className="container-event px-4 lg:px-0">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 lg:gap-12">
          <div>
            <div className="flex items-center gap-3 font-display text-lg font-bold">
              <img
                src={logoImage}
                alt="II Encontro de Musica Sacra do Estado do Ceara"
                className="h-11 w-11 rounded-full object-cover ring-1 ring-amber/50"
              />
              <span>II ECD-NE1</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/70">
              II Encontro de Coros Diocesanos do Regional Nordeste 1 - CNBB. Celebrando a fé, a formação e a
              tradição musical do nosso povo.
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
                <a href="#sobre" className="transition-colors hover:text-white">
                  Sobre
                </a>
              </li>
              <li>
                <a href="#programacao" className="transition-colors hover:text-white">
                  Programação
                </a>
              </li>
              <li>
                <a href="#inscricao" className="transition-colors hover:text-white">
                  Inscrição
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 pb-[env(safe-area-inset-bottom)] text-center text-sm text-white/60 sm:mt-12 sm:flex-row sm:gap-4 sm:pt-8 sm:text-left">
          <p>© 2025 II Encontro de Coros Diocesanos do Regional Nordeste 1 - CNBB.</p>
          <p>Quixadá, CE</p>
        </div>
      </div>
    </footer>
  );
}
