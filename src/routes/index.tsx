import { createFileRoute, Link } from "@tanstack/react-router";

import claytonImage from "../assets/clayton-dias.jpg";
import heroChoirFocusImage from "../assets/hero-choir-focus.jpg";
import logoImage from "../assets/logo-coros-preto.png";

import dioceseLogo from "../assets/apoio-diocese-quixada.png";
import coroLogo from "../assets/organizacao-coro-diocesano-quixada.png";
import { PublicSponsorsSection } from "@/features/sponsors/PublicSponsorsSection";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { RegistrationCallout } from "@/features/registration/RegistrationCallout";
import { PublicProgramme } from "@/features/event-activities/PublicProgramme";
import { getPublicEventProgramme } from "@/lib/event-activity.functions";
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Church,
  MapPin,
  Menu,
  Mic2,
  Music2,
  Users,
} from "lucide-react";
const SITE_URL = "https://encontrocorosce.lovable.app";
const SOCIAL_IMAGE_URL = `${SITE_URL}/og-coros-diocesanos-v7.jpg`;

export const Route = createFileRoute("/")({
  loader: () => getPublicEventProgramme(),
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
  const programme = Route.useLoaderData();
  return (
    <div className="public-event-page min-h-screen bg-background">
      <Header />
      <main>
        <HeroSection />
        <AboutSection />
        <QuixadaSection />
        <PublicProgramme result={programme} />
        <RegistrationCallout />
        <SponsorsSection />
      </main>
      <Footer />
    </div>
  );
}
function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-teal/10 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/85">
      <div className="container-event flex h-14 items-center justify-end gap-3 px-4 lg:h-[4.5rem] lg:px-0">
        <nav
          aria-label="Navegação principal"
          className="hidden items-center gap-6 text-sm font-semibold lg:flex"
        >
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
            className="hidden h-10 min-h-10 rounded-full px-3 text-xs font-bold sm:px-4 sm:text-sm lg:inline-flex lg:h-10"
          >
            <Link to="/acessar">Acessar portal</Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="h-10 min-h-10 rounded-full bg-amber px-3 text-xs font-bold text-amber-foreground hover:bg-amber/90 sm:h-11 sm:px-5 sm:text-sm lg:h-10"
          >
            <Link to="/inscricao">Inscrever-se agora</Link>
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Abrir menu"
                className="size-10 shrink-0 rounded-full border-teal/20 text-teal hover:bg-teal/10 hover:text-teal lg:hidden"
              >
                <Menu className="size-5" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              aria-label="Menu principal"
              className="w-[min(88vw,22rem)] border-teal/10 bg-background px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6"
            >
              <SheetHeader className="pr-8 text-left">
                <SheetTitle className="font-display text-xl font-extrabold">
                  Menu principal
                </SheetTitle>
                <SheetDescription>Explore o encontro ou acesse sua inscrição.</SheetDescription>
              </SheetHeader>
              <nav aria-label="Navegação mobile" className="mt-6 grid gap-2">
                {[
                  ["Sobre", "#sobre"],
                  ["Programação", "#programacao"],
                  ["Quixadá", "#quixada"],
                  ["Inscrição", "#inscricao"],
                ].map(([label, href]) => (
                  <SheetClose key={href} asChild>
                    <a
                      href={href}
                      className="flex min-h-12 items-center rounded-xl border border-border px-4 text-base font-bold text-foreground transition-colors hover:border-teal hover:bg-teal/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
                    >
                      {label}
                    </a>
                  </SheetClose>
                ))}
              </nav>
              <div className="mt-6 border-t border-border pt-5">
                <SheetClose asChild>
                  <Link
                    to="/acessar"
                    className="flex min-h-12 items-center justify-center rounded-xl border-2 border-teal px-4 text-base font-bold text-teal transition-colors hover:bg-teal hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
                  >
                    Acessar portal
                  </Link>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
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
        <Link to="/inscricao" className="justify-center">
          Inscrever-se agora
          <ArrowRight className="ml-2 h-5 w-5" />
        </Link>
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
              <span>Regentes coralistas e instrumentistas
</span>
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
            Fé, música e comunhão
          </h2>
          <div className="mx-auto mt-5 max-w-3xl space-y-4 text-left text-base leading-relaxed text-muted-foreground sm:mt-6 sm:text-lg">
            <p>
              O Encontro de Coros do Regional Nordeste 1 da CNBB – Ceará nasceu do desejo de
              fortalecer a música litúrgica e promover a comunhão entre os músicos que, nas
              diversas dioceses do Ceará, colocam seus dons a serviço da liturgia.
            </p>
            <p>
              A iniciativa partiu de Dom Francisco Edimilson Neves Ferreira, Bispo de Tianguá e
              Bispo Referencial da Comissão Episcopal para a Liturgia do Regional Nordeste 1, que
              incentivou a criação de um espaço dedicado ao encontro, à formação e à integração
              dos coros diocesanos. A proposta foi idealizada e organizada pelo Pe. Michael Johnny
              da Silva Souza, que colaborou decisivamente para que esse projeto se tornasse
              realidade.
            </p>
            <p>
              A primeira edição aconteceu em 2025, na cidade de Viçosa do Ceará, reunindo
              regentes, coralistas e instrumentistas das dioceses do Ceará. O encontro foi
              promovido pela Comissão Episcopal para a Liturgia do Regional Nordeste 1 e
              proporcionou aos participantes uma rica experiência de formação, partilha,
              fraternidade e convivência.
            </p>
            <p>
              Mais do que um encontro de músicos, a iniciativa tornou-se um espaço de
              aprofundamento eclesial e formativo, favorecendo o conhecimento e a reflexão sobre
              aspectos da música sacra e da música litúrgica, bem como sobre a missão daqueles que
              exercem o ministério do canto e da música nas celebrações. Foi também uma
              oportunidade para estreitar laços, compartilhar experiências e reconhecer a riqueza
              dos diferentes coros que servem à Igreja no Ceará.
            </p>
            <p>
              Em 2026, essa caminhada de comunhão e formação tem continuidade com a realização do
              II Encontro de Coros Diocesanos do Regional Nordeste 1, que tem como sede a Diocese
              de Quixadá. A segunda edição reafirma o compromisso de promover a formação dos
              músicos, fortalecer a integração entre os coros das dioceses e valorizar a música
              como parte essencial da ação litúrgica e como instrumento de evangelização.
            </p>
            <p>
              De Viçosa do Ceará a Quixadá, o Encontro de Coros segue construindo uma história de
              fé, música, formação, fraternidade e comunhão, fazendo ressoar, através da
              diversidade de vozes, a unidade da Igreja presente nas dioceses do Ceará.
            </p>
          </div>
        </div>

        <div className="about-pillars mt-9 grid grid-cols-1 gap-3 sm:mt-12 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          <Card className="border-border bg-card text-center transition-transform hover:-translate-y-1">
            <CardContent className="about-pillar-content p-4 sm:p-6">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-teal/10 sm:h-14 sm:w-14">
                <BookOpen className="h-6 w-6 text-teal sm:h-7 sm:w-7" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-card-foreground">Formação</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Conferências e ensaios com o Prof. Clayton Dias.
              </p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card text-center transition-transform hover:-translate-y-1">
            <CardContent className="about-pillar-content p-4 sm:p-6">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald/10 sm:h-14 sm:w-14">
                <Church className="h-6 w-6 text-emerald sm:h-7 sm:w-7" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-card-foreground">
                Celebração
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Missas e Liturgias das Horas.
              </p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card text-center transition-transform hover:-translate-y-1">
            <CardContent className="about-pillar-content p-4 sm:p-6">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber/10 sm:h-14 sm:w-14">
                <Mic2 className="h-6 w-6 text-amber sm:h-7 sm:w-7" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-card-foreground">
                Grande Concerto
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Coros participantes do evento.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="about-speaker mt-12 grid items-center gap-8 rounded-xl border border-border bg-card p-5 shadow-sm shadow-teal/10 md:grid-cols-[0.8fr_1.2fr] md:p-7">
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
              Clayton Dias
            </h3>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Prof. Dr. Clayton Júnior Dias Doutor em Música (2016), Mestre em Música (2012) e Bacharel em Música com habilitação em Voz (2009) pela Universidade Estadual de Campinas (Unicamp). Atualmente está realizando o estágio de pós-doutorado como pesquisador colaborador do Departamento de História na Unicamp, desenvolvendo pesquisas sobre a música monódica medieval e a arte da memória. Especializou-se em Canto Gregoriano no Centro Francescano Studi di Canto Gregoriano (Assisi – Itália) e atualmente cursa o Master of Advanced Studies em Canto Gregoriano, Paleografia e Semiologia na Scuola Universitaria di Musica della Svizzera Italiana (Lugano – Suíça)
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
              Conheça Quixadá
            </h2>
          </div>
          <div className="space-y-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            <p>
              Entre igrejas, o Açude Cedro e os monólitos, Quixadá reúne fé, cultura e paisagens
              marcantes do sertão cearense.
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

function SponsorsSection() {
  return (
    <section id="patrocinadores" className="section-padding bg-muted/50">
      <div className="container-event px-4 lg:px-0">
        <div className="rounded-xl border border-border bg-card p-5 sm:p-7 lg:p-10">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-amber/15 px-4 py-1.5 text-sm font-bold text-amber">
              Apoio, organização e patrocínio
            </span>
            <h2 className="mt-4 font-display text-[clamp(2rem,8vw,2.75rem)] font-extrabold leading-tight text-foreground sm:text-4xl">
              Quem realiza o encontro
            </h2>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground sm:text-lg">
              Uma realização do Coro Diocesano de Quixadá e da Diocese de Quixadá, com o apoio de
              nossos parceiros.
            </p>
          </div>

          <div className="mt-9 space-y-9 sm:mt-11 sm:space-y-11">
            <div>
              <div className="flex items-center gap-4">
                <h3 className="shrink-0 font-body text-xs font-extrabold uppercase text-muted-foreground">
                  Organização e apoio institucional
                </h3>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                {institutionalPartners.map((partner) => (
                  <article
                    key={partner.name}
                    className="group flex items-center gap-4 rounded-xl border border-border bg-background p-4 text-left text-foreground transition-all duration-300 hover:-translate-y-1.5 hover:border-amber hover:shadow-lg hover:shadow-amber/10 motion-reduce:transform-none motion-reduce:transition-none sm:gap-6 sm:p-6"
                  >
                    <div className="flex h-20 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted/40 p-2 transition-colors duration-300 group-hover:bg-amber/5 sm:h-24 sm:w-32 sm:p-3">
                      <img
                        src={partner.logo}
                        alt={partner.name}
                        className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-110 motion-reduce:transition-none"
                        loading="lazy"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="font-body text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground sm:text-xs">
                        {partner.role}
                      </p>
                      <h4 className="mt-1 font-display text-base font-extrabold leading-tight sm:text-xl">
                        {partner.name}
                      </h4>
                    </div>
                  </article>
                ))}
              </div>
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
