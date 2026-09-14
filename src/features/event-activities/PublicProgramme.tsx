import { useEffect, useState } from "react";
import { BadgeCheck, Calendar, Church, MapPinned, Music2, Presentation, Utensils, type LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import type { EventActivityCategory, PublicEventActivity } from "./eventActivity.domain";

export type PublicProgrammeResult =
  | { status: "ready"; activities: PublicEventActivity[] }
  | { status: "unavailable"; activities: PublicEventActivity[] };

type ProgrammeDay = { date: string; dateLabel: string; weekday: string; items: PublicEventActivity[] };

const presentation: Record<EventActivityCategory, { label: string; icon: LucideIcon; className: string }> = {
  welcome: { label: "Acolhimento", icon: BadgeCheck, className: "bg-sky-100 text-sky-700" },
  celebration: { label: "Celebração", icon: Church, className: "bg-violet-100 text-violet-700" },
  meal: { label: "Refeição", icon: Utensils, className: "bg-orange-100 text-orange-700" },
  conference: { label: "Conferência", icon: Presentation, className: "bg-blue-100 text-blue-700" },
  music: { label: "Música", icon: Music2, className: "bg-emerald/10 text-emerald" },
  visit: { label: "Visita", icon: MapPinned, className: "bg-rose-100 text-rose-700" },
};

const dayFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", timeZone: "UTC" });
const weekdayFormat = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" });
const monthFormat = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" });
const monthShortFormat = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });

function programmeDatePresentation(days: ProgrammeDay[]) {
  if (days.length === 0) {
    return {
      badge: "PROGRAMAÇÃO DO EVENTO",
      description: "Confira as atividades publicadas para o encontro.",
    };
  }

  const first = new Date(`${days[0].date}T12:00:00Z`);
  const last = new Date(`${days.at(-1)!.date}T12:00:00Z`);
  const firstDay = first.getUTCDate();
  const lastDay = last.getUTCDate();
  const firstMonth = monthFormat.format(first);
  const lastMonth = monthFormat.format(last);
  const firstMonthShort = monthShortFormat.format(first).replace(".", "").toUpperCase();
  const lastMonthShort = monthShortFormat.format(last).replace(".", "").toUpperCase();
  const firstYear = first.getUTCFullYear();
  const lastYear = last.getUTCFullYear();

  if (days.length === 1) {
    return {
      badge: `${firstDay} ${firstMonthShort} ${firstYear}`,
      description: `Confira as atividades do encontro em ${firstDay} de ${firstMonth} de ${firstYear}.`,
    };
  }

  if (firstYear === lastYear && first.getUTCMonth() === last.getUTCMonth()) {
    return {
      badge: `${firstDay}–${lastDay} ${firstMonthShort} ${firstYear}`,
      description: `Confira as atividades do encontro de ${firstDay} a ${lastDay} de ${firstMonth} de ${firstYear}.`,
    };
  }

  if (firstYear === lastYear) {
    return {
      badge: `${firstDay} ${firstMonthShort}–${lastDay} ${lastMonthShort} ${firstYear}`,
      description: `Confira as atividades do encontro de ${firstDay} de ${firstMonth} a ${lastDay} de ${lastMonth} de ${firstYear}.`,
    };
  }

  return {
    badge: `${firstDay} ${firstMonthShort} ${firstYear}–${lastDay} ${lastMonthShort} ${lastYear}`,
    description: `Confira as atividades do encontro de ${firstDay} de ${firstMonth} de ${firstYear} a ${lastDay} de ${lastMonth} de ${lastYear}.`,
  };
}

export function groupPublicProgramme(activities: PublicEventActivity[]): ProgrammeDay[] {
  const groups = new Map<string, PublicEventActivity[]>();
  for (const activity of activities) groups.set(activity.activityDate, [...(groups.get(activity.activityDate) ?? []), activity]);
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, items]) => {
    const parsed = new Date(`${date}T12:00:00Z`);
    const weekday = weekdayFormat.format(parsed);
    return {
      date,
      dateLabel: dayFormat.format(parsed),
      weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1),
      items: [...items].sort((left, right) => left.sortOrder - right.sortOrder || (left.startsAt ?? "99:99").localeCompare(right.startsAt ?? "99:99")),
    };
  });
}

function activityTime(activity: PublicEventActivity) {
  if (!activity.startsAt) return "Na sequência";
  const start = activity.startsAt.replace(":", "h");
  return activity.endsAt ? `${start}–${activity.endsAt.replace(":", "h")}` : start;
}

function ProgrammeDayCard({ day }: { day: ProgrammeDay }) {
  return (
    <Card className="overflow-hidden border-border/80 bg-card shadow-sm">
      <div className="bg-teal px-5 py-3.5"><p className="font-body text-xs font-semibold tracking-wide text-white/75">{day.weekday}</p><h3 className="mt-0.5 font-body text-lg font-extrabold tracking-tight text-white">{day.dateLabel}</h3></div>
      <CardContent className="programme-day-content p-4 sm:p-5"><div className="divide-y divide-border/70">{day.items.map((activity) => {
        const category = presentation[activity.category];
        const Icon = category.icon;
        return <article key={activity.id} className="grid grid-cols-[5.25rem_1.75rem_minmax(0,1fr)] items-center gap-2 py-2.5 first:pt-0 last:pb-0"><time dateTime={`${activity.activityDate}${activity.startsAt ? `T${activity.startsAt}` : ""}`} className="whitespace-normal break-words font-body text-xs font-bold tabular-nums text-teal">{activityTime(activity)}</time><span role="img" aria-label={category.label} className={`flex size-7 items-center justify-center rounded-lg ${category.className}`}><Icon aria-hidden="true" className="size-4" strokeWidth={2.25} /></span><div className="min-w-0"><h4 className="font-body text-sm font-semibold leading-snug text-card-foreground sm:text-[0.95rem]">{activity.title}</h4>{activity.location && <p className="mt-0.5 text-xs text-muted-foreground">{activity.location}</p>}</div></article>;
      })}</div></CardContent>
    </Card>
  );
}

export function PublicProgramme({ result }: { result: PublicProgrammeResult }) {
  const days = groupPublicProgramme(result.activities);
  const datePresentation = programmeDatePresentation(days);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [carouselHeight, setCarouselHeight] = useState<number>();
  useEffect(() => {
    if (!carouselApi) return;
    const update = () => setCarouselHeight(carouselApi.slideNodes()[carouselApi.selectedScrollSnap()]?.offsetHeight);
    update(); carouselApi.on("select", update); carouselApi.on("reInit", update);
    return () => { carouselApi.off("select", update); carouselApi.off("reInit", update); };
  }, [carouselApi]);

  return <section id="programacao" className="bg-muted/50 py-12 sm:py-14 lg:py-16"><div className="container-event px-4 lg:px-0"><div className="mx-auto max-w-3xl text-center"><span className="inline-flex items-center gap-2 rounded-full bg-emerald/10 px-4 py-1.5 text-sm font-bold text-emerald"><Calendar aria-hidden="true" className="size-4" />{datePresentation.badge}</span><h2 className="mt-3 font-body text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl md:text-5xl">Programação</h2><p className="mt-2 text-base text-muted-foreground sm:text-lg">{datePresentation.description}</p></div>
    {result.status === "unavailable" && <p role="alert" className="mx-auto mt-8 max-w-2xl rounded-xl bg-card px-5 py-4 text-center text-sm text-muted-foreground">Não foi possível carregar a programação agora. Tente novamente em alguns instantes.</p>}
    {result.status === "ready" && days.length === 0 && <p className="mt-8 text-center text-sm text-muted-foreground">A programação será publicada em breve.</p>}
    {days.length > 0 && <><Carousel opts={{ align: "start", loop: false }} setApi={setCarouselApi} style={{ height: carouselHeight }} className="mx-auto mt-6 w-full overflow-hidden transition-[height] duration-300 lg:hidden"><CarouselContent className="items-start">{days.map((day) => <CarouselItem key={day.date} className="basis-[92%] sm:basis-[88%]"><ProgrammeDayCard day={day} /></CarouselItem>)}</CarouselContent></Carousel><div className="mt-8 hidden items-start gap-6 lg:grid lg:grid-cols-3">{days.map((day) => <ProgrammeDayCard key={day.date} day={day} />)}</div></>}
  </div></section>;
}
