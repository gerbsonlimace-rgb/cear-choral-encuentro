import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import claytonImage from "../assets/clayton-dias.jpg";
import heroChoirFocusImage from "../assets/hero-choir-focus.jpg";
import logoImage from "../assets/logo-coros-preto.png";
import logoImageLight from "../assets/logo-coros-branco.png";
import dioceseLogo from "../assets/apoio-diocese-quixada.png";
import coroLogo from "../assets/organizacao-coro-diocesano-quixada.png";
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
  type CarouselApi,
} from "@/components/ui/carousel";
import { RegistrationSection } from "@/features/registration/RegistrationSection";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Calendar,
  Church,
  MapPin,
  MapPinned,
  Mic2,
  Music2,
  Presentation,
  Users,
  Utensils,
  type LucideIcon,
} from "lucide-react";
const SITE_URL = "https://encontrocorosce.lovable.app";
const SOCIAL_IMAGE_URL = `${SITE_URL}/og-coros-diocesanos-v7.jpg`;

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      {
        title:
          "II Encontro de Coros Diocesanos e Litúrgicos do Regional Nordeste 1 - CNBB — 20 a 22 de Novembro de 2026",
      },
      {
        name: "description",
        content:
          "Inscreva-se no II Encontro de Coros Diocesanos e Litúrgicos do Regional Nordeste 1 - CNBB, de 20 a 22 de novembro de 2026, em Quixadá.",
      },
      {
        property: "og:title",
        content:
          "II Encontro de Coros Diocesanos e Litúrgicos do Regional Nordeste 1 - CNBB — 20 a 22 de Novembro de 2026",
      },
      {
        property: "og:description",
        content:
          "Inscreva-se no II Encontro de Coros Diocesanos e Litúrgicos do Regional Nordeste 1 - CNBB, de 20 a 22 de novembro de 2026, em Quixadá.",
      },
      { property: "og:url", content: SITE_URL },
      { property: "og:image", content: SOCIAL_IMAGE_URL },
      { property: "og:image:secure_url", content: SOCIAL_IMAGE_URL },
      { property: "og:image:type", content: "image/jpeg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        property: "og:image:alt",
        content:
          "Logo do II Encontro de Coros Diocesanos e Litúrgicos do Regional Nordeste 1 - CNBB",
      },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: "II Encontro de Coros Diocesanos e Litúrgicos do Regional Nordeste 1 - CNBB",
      },
      {
        name: "twitter:description",
        content:
          "De 20 a 22 de novembro de 2026, em Quixadá. Inscreva-se no II Encontro de Coros Diocesanos e Litúrgicos do Regional Nordeste 1 - CNBB.",
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
          name: "II Encontro de Coros Diocesanos e Litúrgicos do Regional Nordeste 1 - CNBB",
          startDate: "2026-11-20",
          endDate: "2026-11-22",
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
            src={logoImageLight}
            alt="II Encontro de Coros Diocesanos e Litúrgicos do Regional Nordeste 1 - CNBB"
            className={`h-9 w-auto shrink-0 transition-all duration-300 sm:h-11 sm:opacity-100 ${
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
          <a href="#inscricao" className="text-muted-foreground transition-colors hover:text-teal">
            Inscrição
          </a>
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-10 min-h-10 rounded-full px-3 text-xs font-bold sm:h-11 sm:px-4 sm:text-sm lg:h-10"
          >
            <Link to="/acessar">Acessar portal</Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="h-10 min-h-10 rounded-full bg-amber px-4 text-sm font-bold text-amber-foreground hover:bg-amber/90 sm:h-11 sm:px-5 lg:h-10"
          >
            <a href="#inscricao">Inscrever</a>
          </Button>
        </div>
      </div>
      <nav
        aria-label="Atalhos mobile"
        className="scrollbar-none flex gap-1.5 overflow-x-auto border-t border-teal/10 px-4 py-2 text-xs font-bold text-muted-foreground sm:gap-2 lg:hidden"
      >
        <a href="#sobre" className="shrink-0 rounded-full bg-white px-4 py-2.5 active:bg-teal/10">
          Sobre
        </a>
        <a
          href="#quixada"
          className="shrink-0 rounded-full bg-white px-4 py-2.5 active:bg-teal/10"
        >
          Quixadá
        </a>
        <a
          href="#programacao"
          className="shrink-0 rounded-full bg-white px-4 py-2.5 active:bg-teal/10"
        >
          Programação
        </a>
        <a
          href="#inscricao"
          className="shrink-0 rounded-full bg-amber px-4 py-2.5 text-amber-foreground active:bg-amber/80"
        >
          Inscrição
        </a>
      </nav>
    </header>
  );
}

function HeroSection() {
  const heroActions = (
    <div
      data-hero-actions
      className="order-3 mt-6 flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center lg:order-none lg:mt-8"
    >
      <Button
        asChild
        size="lg"
        className="h-12 w-full rounded-full bg-amber px-7 text-base font-extrabold text-amber-foreground hover:bg-amber/90 sm:h-14 sm:w-auto sm:px-8"
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
        className="h-12 w-full rounded-full border-2 border-white bg-white px-7 text-base font-bold text-teal hover:bg-white/90 sm:h-14 sm:w-auto sm:px-8"
      >
        <a href="#programacao" className="justify-center">
          Programação
        </a>
      </Button>
    </div>
  );

  return (
    <section
      data-hero-prototype="colunas"
      data-hero-layout="two-columns"
      className="relative isolate overflow-hidden bg-[#070a08] text-white"
    >
      <div data-hero-photo-position="full-background" className="absolute inset-0">
        <img
          src={heroChoirFocusImage}
          alt="Participantes do Encontro de Coros reunidos diante da igreja"
          width={2304}
          height={864}
          className="h-full w-full object-cover object-center"
          fetchPriority="high"
        />
      </div>

      <div className="absolute inset-0 bg-[rgba(3,7,6,0.66)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,7,6,0.22)_0%,rgba(3,7,6,0.42)_54%,rgba(3,7,6,0.92)_100%)]" />

      <div
        data-hero-frame
        className="relative z-10 mx-auto grid min-h-[calc(100svh-4rem)] w-full max-w-[90rem] gap-7 px-5 py-10 sm:min-h-[calc(100svh-3.5rem)] sm:px-8 sm:py-14 lg:min-h-[46rem] lg:grid-cols-[minmax(0,1.12fr)_minmax(22rem,0.88fr)] lg:items-stretch lg:gap-10 lg:px-12 lg:py-16"
      >
        <div
          data-hero-copy
          className="order-2 flex min-w-0 flex-col justify-center lg:order-1 lg:max-w-[48rem] lg:items-start lg:text-left"
        >
          <div>
            <div
              aria-label="Informações principais do evento"
              className="grid border-y border-white/20 sm:grid-cols-2"
            >
              <div className="flex items-center gap-3 py-3 pr-4 sm:py-4 sm:pr-6">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber text-amber-foreground">
                  <Calendar aria-hidden="true" className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-[0.6875rem] font-extrabold uppercase tracking-[0.18em] text-amber">
                    Data
                  </span>
                  <span className="mt-0.5 block text-sm font-extrabold leading-tight text-white sm:text-base">
                    20 a 22 de novembro de 2026
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-3 border-t border-white/20 py-3 sm:border-l sm:border-t-0 sm:py-4 sm:pl-6">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber text-amber-foreground">
                  <MapPin aria-hidden="true" className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-[0.6875rem] font-extrabold uppercase tracking-[0.18em] text-amber">
                    Cidade
                  </span>
                  <span className="mt-0.5 block text-sm font-extrabold leading-tight text-white sm:text-base">
                    Quixadá, CE
                  </span>
                </span>
              </div>
            </div>

            <h1 className="mt-7 max-w-[17ch] font-display text-[clamp(2.15rem,7.8vw,3.5rem)] font-extrabold leading-[1.04] tracking-[-0.025em] text-white sm:mt-8 lg:text-[clamp(2.9rem,3.35vw,4rem)]">
              II Encontro de Coros Diocesanos e Litúrgicos do Regional Nordeste 1 - CNBB
            </h1>
          </div>

          <blockquote className="relative mt-7 w-fit max-w-[40rem] border-t border-amber/55 pt-5 sm:mt-8 sm:pt-6">
            <span
              aria-hidden="true"
              className="absolute -top-3 left-0 bg-[#070a08] pr-3 font-display text-4xl leading-none text-amber"
            >
              “
            </span>
            <p className="max-w-[35rem] font-display text-base font-bold italic leading-relaxed text-white sm:text-lg">
              <span className="block">Cantai para o Senhor um canto novo,</span>
              <span className="block">com arte sustentai a louvação!</span>
            </p>
            <cite className="mt-3 inline-flex rounded-full bg-amber px-3 py-1 font-body text-xs font-extrabold not-italic tracking-wide text-amber-foreground sm:text-sm">
              Sl 32 (33), 3
            </cite>
            <span
              aria-hidden="true"
              className="ml-3 font-display text-3xl leading-none text-amber/65"
            >
              ”
            </span>
          </blockquote>

          <div className="mt-7 sm:mt-8">
            <div className="flex items-center gap-2 text-sm font-semibold text-white/90 sm:text-base">
              <Users aria-hidden="true" className="h-5 w-5 shrink-0 text-amber" />
              <span>Coralistas, Instrumentistas e Regentes</span>
            </div>
          </div>
        </div>

        <div
          data-hero-visuals
          className="contents min-w-0 lg:order-2 lg:flex lg:min-h-full lg:flex-col lg:items-center lg:justify-center lg:pl-10"
        >
          <div
            data-hero-logo-position="column-right"
            className="order-1 flex min-h-0 items-center justify-center lg:order-none"
          >
            <img
              src={logoImage}
              alt="Identidade visual do II Encontro de Coros Diocesanos e Litúrgicos do Regional Nordeste 1 - CNBB"
              width={605}
              height={342}
              className="h-auto w-full max-w-[18rem] object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)] sm:max-w-[22rem] lg:max-w-[31rem]"
              fetchPriority="high"
            />
          </div>
          {heroActions}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-16 bg-[linear-gradient(0deg,rgba(247,249,255,0.98),rgba(247,249,255,0))]" />
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
          <div className="mt-5 space-y-4 text-base leading-relaxed text-muted-foreground sm:mt-6 sm:text-lg">
            <p>
              O Encontro de Coros do Regional Nordeste 1 da CNBB – Ceará nasceu para fortalecer a
              música litúrgica e promover a comunhão entre os coros diocesanos. A iniciativa partiu
              de Dom Francisco Edimilson Neves Ferreira, Bispo de Tianguá e Bispo Referencial da
              Comissão Episcopal para a Liturgia do Regional Nordeste 1, e foi idealizada e
              organizada pelo Pe. Michael Johnny da Silva Souza.
            </p>
            <p>
              Realizada pela primeira vez em 2025, em Viçosa do Ceará, a iniciativa reuniu regentes,
              coralistas e instrumentistas em uma experiência de formação, partilha e fraternidade.
              Em 2026, essa caminhada continua em Quixadá com o II Encontro, fortalecendo a
              integração entre as dioceses e valorizando a música como parte essencial da liturgia e
              instrumento de evangelização.
            </p>
          </div>
        </div>

        <div className="mt-9 grid grid-cols-1 gap-3 sm:mt-12 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
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
              Palestrante Principal
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
    name: "Catedral Jesus, Maria e José",
    description:
      "Igreja-mãe da Diocese de Quixadá, a catedral acolhe celebrações e encontros que marcam a vida religiosa da cidade.",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Catedral%20Quixad%C3%A1.jpg",
    credit: "Foto: GLandovsky / Wikimedia Commons",
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

type ScheduleCategory = "welcome" | "celebration" | "meal" | "conference" | "music" | "visit";

type ScheduleDay = {
  date: string;
  weekday: string;
  items: Array<{
    time?: string;
    title: string;
    category: ScheduleCategory;
  }>;
};

const scheduleCategoryPresentation: Record<
  ScheduleCategory,
  { label: string; icon: LucideIcon; className: string }
> = {
  welcome: {
    label: "Acolhimento",
    icon: BadgeCheck,
    className: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
  },
  celebration: {
    label: "Celebração",
    icon: Church,
    className: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  },
  meal: {
    label: "Refeição",
    icon: Utensils,
    className: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
  },
  conference: {
    label: "Conferência",
    icon: Presentation,
    className: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  },
  music: {
    label: "Música",
    icon: Music2,
    className: "bg-emerald/10 text-emerald",
  },
  visit: {
    label: "Visita",
    icon: MapPinned,
    className: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  },
};

const schedule: ScheduleDay[] = [
  {
    date: "20 de novembro",
    weekday: "Sexta-feira",
    items: [
      {
        time: "16h–18h",
        title: "Credenciamento",
        category: "welcome",
      },
      {
        time: "18h",
        title: "Vésperas",
        category: "celebration",
      },
      {
        time: "18h30",
        title: "Jantar",
        category: "meal",
      },
      {
        time: "19h30",
        title: "Abertura oficial",
        category: "welcome",
      },
      {
        time: "20h–21h",
        title: "1ª Conferência",
        category: "conference",
      },
      {
        title: "Completas",
        category: "celebration",
      },
    ],
  },
  {
    date: "21 de novembro",
    weekday: "Sábado",
    items: [
      {
        time: "07h",
        title: "Santa Missa",
        category: "celebration",
      },
      {
        time: "08h",
        title: "Café da manhã",
        category: "meal",
      },
      {
        time: "09h",
        title: "2ª Conferência",
        category: "conference",
      },
      {
        time: "10h",
        title: "Coffee break",
        category: "meal",
      },
      {
        time: "10h30",
        title: "3ª Conferência",
        category: "conference",
      },
      {
        time: "11h30",
        title: "Ensaio 1",
        category: "music",
      },
      {
        time: "12h30",
        title: "Almoço",
        category: "meal",
      },
      {
        time: "14h",
        title: "4ª Conferência",
        category: "conference",
      },
      {
        time: "15h",
        title: "Ensaio 2",
        category: "music",
      },
      {
        time: "16h",
        title: "Coffee break",
        category: "meal",
      },
      {
        title: "Visita ao Santuário",
        category: "visit",
      },
      {
        time: "20h",
        title: "Concerto na Catedral",
        category: "music",
      },
      {
        title: "Jantar",
        category: "meal",
      },
    ],
  },
  {
    date: "22 de novembro",
    weekday: "Domingo",
    items: [
      {
        time: "07h30",
        title: "Laudes",
        category: "celebration",
      },
      {
        time: "08h",
        title: "Café da manhã",
        category: "meal",
      },
      {
        time: "09h",
        title: "Ensaio 3",
        category: "music",
      },
      {
        time: "10h",
        title: "Missa Solene na Catedral",
        category: "celebration",
      },
      {
        time: "12h",
        title: "Almoço e despedida",
        category: "meal",
      },
    ],
  },
];

function ProgramSection() {
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [carouselHeight, setCarouselHeight] = useState<number>();

  useEffect(() => {
    if (!carouselApi) return;

    const updateCarouselHeight = () => {
      const selectedSlide = carouselApi.slideNodes()[carouselApi.selectedScrollSnap()];
      setCarouselHeight(selectedSlide?.offsetHeight);
    };

    updateCarouselHeight();
    carouselApi.on("select", updateCarouselHeight);
    carouselApi.on("reInit", updateCarouselHeight);

    return () => {
      carouselApi.off("select", updateCarouselHeight);
      carouselApi.off("reInit", updateCarouselHeight);
    };
  }, [carouselApi]);

  return (
    <section id="programacao" className="bg-muted/50 py-12 sm:py-14 lg:py-16">
      <div className="container-event px-4 lg:px-0">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald/10 px-4 py-1.5 text-sm font-bold text-emerald">
            <Calendar aria-hidden="true" className="h-4 w-4" />
            20–22 NOV 2026
          </span>
          <h2 className="mt-3 font-body text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            Programação
          </h2>
          <p className="mt-2 text-base text-muted-foreground sm:text-lg">
            Confira as atividades do encontro de 20 a 22 de novembro de 2026.
          </p>
        </div>
        <Carousel
          opts={{ align: "start", loop: false }}
          setApi={setCarouselApi}
          style={{ height: carouselHeight }}
          className="mx-auto mt-6 w-full overflow-hidden transition-[height] duration-300 lg:hidden"
        >
          <CarouselContent className="items-start">
            {schedule.map((day, index) => (
              <CarouselItem key={index} className="basis-[92%] sm:basis-[88%]">
                <ProgramDayCard day={day} />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        <div className="mt-8 hidden items-start gap-6 lg:grid lg:grid-cols-3">
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
    <Card className="overflow-hidden border-border/80 bg-card shadow-sm">
      <div className="bg-teal px-5 py-3.5">
        <p className="font-body text-xs font-semibold tracking-wide text-white/75">{day.weekday}</p>
        <h3 className="mt-0.5 font-body text-lg font-extrabold tracking-tight text-white">
          {day.date}
        </h3>
      </div>
      <CardContent className="p-4 sm:p-5">
        <div className="divide-y divide-border/70">
          {day.items.map((item, itemIndex) => {
            const category = scheduleCategoryPresentation[item.category];
            const ActivityIcon = category.icon;

            return (
              <div
                key={itemIndex}
                className="grid grid-cols-[3.75rem_1.55rem_minmax(0,1fr)] items-center gap-2.5 py-2.5 transition-colors first:pt-0 last:pb-0 hover:bg-muted/45"
              >
                <span className="whitespace-nowrap font-body text-xs font-bold tabular-nums text-teal">
                  {item.time ?? "Na sequência"}
                </span>
                <span
                  role="img"
                  aria-label={category.label}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg ${category.className}`}
                >
                  <ActivityIcon aria-hidden="true" className="h-4 w-4" strokeWidth={2.25} />
                </span>
                <h4 className="min-w-0 font-body text-sm font-semibold leading-snug text-card-foreground sm:text-[0.95rem]">
                  {item.title}
                </h4>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function SponsorsSection() {
  return (
    <section id="patrocinadores" className="section-padding bg-muted/50">
      <div className="container-event px-4 lg:px-0">
        <div className="grid gap-6 rounded-xl bg-foreground p-5 text-white sm:p-7 lg:grid-cols-[0.75fr_1.25fr] lg:gap-8">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-amber/15 px-4 py-1.5 text-sm font-bold text-amber">
              Apoio, organização e patrocínio
            </span>
            <h2 className="mt-4 font-display text-[clamp(2rem,8vw,2.5rem)] font-extrabold leading-tight sm:text-4xl">
              Instituições que conduzem o encontro
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/72 sm:text-lg">
              A realização nasce do trabalho conjunto entre o Coro Diocesano de Quixadá e a Diocese
              de Quixadá, com parceiros que valorizam cultura, formação e vida comunitária.
            </p>
          </div>

          <div className="space-y-6">
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

            <PublicSponsorsSection />
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
              II Encontro de Coros Diocesanos e Litúrgicos do Regional Nordeste 1 - CNBB. Celebrando
              a fé, a formação e a tradição musical do nosso povo.
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
                20 a 22 de novembro de 2026
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
          <p>© 2026 II Encontro de Coros Diocesanos e Litúrgicos do Regional Nordeste 1 - CNBB.</p>
          <p>Quixadá, CE</p>
        </div>
      </div>
    </footer>
  );
}
