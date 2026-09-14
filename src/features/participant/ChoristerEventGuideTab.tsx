import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, MapPin, ScanLine } from "lucide-react";

import type { ChoristerPortalCollection } from "@/features/chorister-app/choristerApp.domain";
import type { ParticipantGuideActivity } from "@/features/event-activities/eventActivity.domain";
import { getParticipantEventActivities } from "@/lib/event-activity.functions";

export type { ParticipantGuideActivity } from "@/features/event-activities/eventActivity.domain";

type Event = ChoristerPortalCollection["events"][number];
type GuideDay = { date: string; day: string; month: string; weekday: string; year: string };

const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  timeZone: "UTC",
});
const monthFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  timeZone: "UTC",
});
const shortMonthFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
  timeZone: "UTC",
});

function toGuideDay(date: string): GuideDay {
  const parsed = new Date(`${date}T12:00:00.000Z`);
  return {
    date,
    day: String(parsed.getUTCDate()),
    month: monthFormatter.format(parsed),
    weekday: weekdayFormatter.format(parsed).replace("-feira", ""),
    year: String(parsed.getUTCFullYear()),
  };
}

function programmePeriod(days: GuideDay[]) {
  if (days.length === 0) return "Programação do encontro";
  const first = days[0];
  const last = days.at(-1) ?? first;
  const firstMonth = shortMonthFormatter
    .format(new Date(`${first.date}T12:00:00.000Z`))
    .replace(".", "");
  const lastMonth = shortMonthFormatter
    .format(new Date(`${last.date}T12:00:00.000Z`))
    .replace(".", "");
  if (first.date === last.date) return `${first.day} ${firstMonth} ${first.year}`;
  if (firstMonth === lastMonth && first.year === last.year) {
    return `${first.day}–${last.day} ${firstMonth} ${first.year}`;
  }
  return `${first.day} ${firstMonth} ${first.year} – ${last.day} ${lastMonth} ${last.year}`;
}

type Props = {
  events: Event[];
  loadActivities?: () => Promise<ParticipantGuideActivity[]>;
};

function activityTime(activity: ParticipantGuideActivity) {
  if (!activity.startsAt) return "Na sequência";
  return activity.endsAt ? `${activity.startsAt}–${activity.endsAt}` : activity.startsAt;
}

export function ChoristerEventGuideTab({
  events,
  loadActivities = getParticipantEventActivities,
}: Props) {
  const [selectedDate, setSelectedDate] = useState("");
  const dayButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const [activities, setActivities] = useState<ParticipantGuideActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void loadActivities()
      .then((loaded) => {
        if (active) {
          setActivities(loaded);
          const dates = [...new Set(loaded.map((activity) => activity.activityDate))].sort();
          setSelectedDate((current) => (dates.includes(current) ? current : (dates[0] ?? "")));
        }
      })
      .catch(() => {
        if (active) {
          setError("Não foi possível carregar a programação agora. Tente novamente em instantes.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadActivities]);

  const guideDays = useMemo(
    () => [...new Set(activities.map((activity) => activity.activityDate))].sort().map(toGuideDay),
    [activities],
  );

  const selectedActivities = useMemo(() => {
    return activities
      .filter((activity) => activity.activityDate === selectedDate)
      .sort(
        (left, right) =>
          left.sortOrder - right.sortOrder ||
          (left.startsAt ?? "99:99").localeCompare(right.startsAt ?? "99:99"),
      );
  }, [activities, selectedDate]);
  const selectedDay = guideDays.find((day) => day.date === selectedDate);
  const guideNotes = events.flatMap((event) =>
    event.guide?.notes ? [{ id: event.id, name: event.name, notes: event.guide.notes }] : [],
  );

  return (
    <section aria-labelledby="event-guide-title" className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          {programmePeriod(guideDays)}
        </p>
        <h1 id="event-guide-title" className="mt-1 text-2xl font-semibold tracking-tight">
          Guia do evento
        </h1>
      </div>

      {guideDays.length > 0 && (
        <div
          role="tablist"
          aria-label="Dias da programação"
          className="grid grid-cols-[repeat(auto-fit,minmax(6rem,1fr))] gap-2"
        >
          {guideDays.map((day, index) => {
            const selected = day.date === selectedDate;
            return (
              <button
                key={day.date}
                type="button"
                role="tab"
                ref={(element) => {
                  dayButtons.current[index] = element;
                }}
                tabIndex={selected ? 0 : -1}
                aria-selected={selected}
                aria-controls="event-day-agenda"
                aria-label={`${day.day} de ${day.month}, ${day.weekday}`}
                onClick={() => setSelectedDate(day.date)}
                onKeyDown={(event) => {
                  let nextIndex: number;
                  if (event.key === "ArrowRight") nextIndex = (index + 1) % guideDays.length;
                  else if (event.key === "ArrowLeft")
                    nextIndex = (index + guideDays.length - 1) % guideDays.length;
                  else if (event.key === "Home") nextIndex = 0;
                  else if (event.key === "End") nextIndex = guideDays.length - 1;
                  else return;
                  event.preventDefault();
                  setSelectedDate(guideDays[nextIndex].date);
                  dayButtons.current[nextIndex]?.focus();
                }}
                className={`min-h-20 rounded-2xl border px-2 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 ${
                  selected
                    ? "border-zinc-400 bg-zinc-50 font-semibold text-zinc-950 ring-1 ring-zinc-400"
                    : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                <span className="block text-3xl font-semibold leading-none">{day.day}</span>
                <span className="mt-1 block text-[11px] font-bold uppercase tracking-wide">
                  {day.weekday}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <section
        id="event-day-agenda"
        role={selectedDay ? "tabpanel" : undefined}
        aria-label={
          selectedDay
            ? `Programação de ${selectedDay.day} de ${selectedDay.month}`
            : "Programação do evento"
        }
        className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"
      >
        {selectedDay && (
          <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-950">
            <p className="text-xs font-semibold tracking-wide text-zinc-500">
              {selectedDay.weekday}
            </p>
            <h2 className="text-lg font-bold">
              {selectedDay.day} de {selectedDay.month}
            </h2>
          </div>
        )}

        {loading && (
          <p role="status" className="px-4 py-6 text-sm text-muted-foreground">
            Atualizando programação…
          </p>
        )}
        {error && (
          <p role="alert" className="px-4 py-6 text-sm text-red-700">
            {error}
          </p>
        )}
        {!loading && selectedActivities.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            Nenhuma atividade publicada para este dia.
          </p>
        )}

        {selectedActivities.length > 0 && (
          <ol className="divide-y divide-border/70 px-3">
            {selectedActivities.map((activity) => (
              <li key={activity.id} className="flex items-start gap-2.5 py-3">
                <time
                  dateTime={`${activity.activityDate}${activity.startsAt ? `T${activity.startsAt}` : ""}`}
                  className="w-[4.35rem] shrink-0 pt-0.5 text-xs font-bold tabular-nums text-zinc-700"
                >
                  {activityTime(activity)}
                </time>
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
                  <CalendarDays aria-hidden="true" className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold leading-5 text-card-foreground">
                    {activity.title}
                  </h3>
                  {activity.location && (
                    <p className="mt-0.5 flex items-start gap-1 text-xs leading-5 text-muted-foreground">
                      <MapPin aria-hidden="true" className="mt-1 size-3 shrink-0" />
                      <span>{activity.location}</span>
                    </p>
                  )}
                  {activity.description && (
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {activity.description}
                    </p>
                  )}
                </div>
                {activity.requiresQr && (
                  <a
                    href="/participante/presenca"
                    aria-label={`Registrar presença em ${activity.title}`}
                    className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
                  >
                    <ScanLine aria-hidden="true" className="size-5" />
                  </a>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {guideNotes.length > 0 ? (
        <section
          aria-labelledby="guide-notes-title"
          className="rounded-2xl border border-zinc-200 bg-white p-4"
        >
          <h2 id="guide-notes-title" className="text-sm font-semibold">
            Orientações do evento
          </h2>
          <div className="mt-2 space-y-2">
            {guideNotes.map((guide) => (
              <p key={guide.id} className="text-sm leading-6 text-muted-foreground">
                <span className="font-semibold text-foreground">{guide.name}:</span> {guide.notes}
              </p>
            ))}
          </div>
        </section>
      ) : (
        <p className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-muted-foreground">
          Outras orientações e informações da cidade serão disponibilizadas aqui.
        </p>
      )}
    </section>
  );
}
