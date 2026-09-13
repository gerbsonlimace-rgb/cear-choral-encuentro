import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, MapPin, ScanLine } from "lucide-react";

import type { ChoristerPortalCollection } from "@/features/chorister-app/choristerApp.domain";
import type { ParticipantGuideActivity } from "@/features/event-activities/eventActivity.domain";
import { getParticipantEventActivities } from "@/lib/event-activity.functions";

export type { ParticipantGuideActivity } from "@/features/event-activities/eventActivity.domain";

// Additional agenda entries come from the configurable programme while the
// existing signed CoroApp feed keeps its published celebrations visible.

type Event = ChoristerPortalCollection["events"][number];
type GuideDay = { date: string; day: string; weekday: string };

const GUIDE_DAYS: GuideDay[] = [
  { date: "2026-11-20", day: "20", weekday: "sexta" },
  { date: "2026-11-21", day: "21", weekday: "sábado" },
  { date: "2026-11-22", day: "22", weekday: "domingo" },
];

type Props = {
  events: Event[];
  loadActivities?: () => Promise<ParticipantGuideActivity[]>;
};

function activityTime(activity: ParticipantGuideActivity) {
  if (!activity.startsAt) return "Na sequência";
  return activity.endsAt ? `${activity.startsAt}–${activity.endsAt}` : activity.startsAt;
}

export function ChoristerEventGuideTab({ events, loadActivities = getParticipantEventActivities }: Props) {
  const [selectedDate, setSelectedDate] = useState(GUIDE_DAYS[0].date);
  const dayButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const [activities, setActivities] = useState<ParticipantGuideActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void loadActivities()
      .then((loaded) => {
        if (active) setActivities(loaded);
      })
      .catch(() => {
        if (active) {
          setError(
            "Não foi possível carregar a programação completa. As celebrações publicadas continuam disponíveis.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadActivities]);

  const selectedActivities = useMemo(() => {
    const activityKeys = new Set(
      activities.map(
        (activity) =>
          `${activity.activityDate}:${activity.title.trim().toLocaleLowerCase("pt-BR")}`,
      ),
    );
    const coroAppActivities: ParticipantGuideActivity[] = events
      .filter(
        (event) =>
          GUIDE_DAYS.some((day) => day.date === event.date) &&
          !activityKeys.has(`${event.date}:${event.name.trim().toLocaleLowerCase("pt-BR")}`),
      )
      .map((event, index) => ({
        id: `coroapp-${event.id}`,
        title: event.name,
        activityDate: event.date,
        startsAt: null,
        endsAt: null,
        location: event.location,
        description: null,
        category: "music",
        sortOrder: 900 + index,
        requiresQr: false,
      }));

    return [...activities, ...coroAppActivities]
      .filter((activity) => activity.activityDate === selectedDate)
      .sort(
        (left, right) =>
          left.sortOrder - right.sortOrder ||
          (left.startsAt ?? "99:99").localeCompare(right.startsAt ?? "99:99"),
      );
  }, [activities, events, selectedDate]);
  const selectedDay = GUIDE_DAYS.find((day) => day.date === selectedDate) ?? GUIDE_DAYS[0];
  const guideNotes = events.flatMap((event) =>
    event.guide?.notes ? [{ id: event.id, name: event.name, notes: event.guide.notes }] : [],
  );

  return (
    <section aria-labelledby="event-guide-title" className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          20–22 nov 2026
        </p>
        <h1 id="event-guide-title" className="mt-1 text-2xl font-semibold tracking-tight">
          Guia do evento
        </h1>
      </div>

      <div role="tablist" aria-label="Dias da programação" className="grid grid-cols-3 gap-2">
        {GUIDE_DAYS.map((day, index) => {
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
              aria-label={`${day.day} de novembro, ${day.weekday}`}
              onClick={() => setSelectedDate(day.date)}
              onKeyDown={(event) => {
                let nextIndex: number;
                if (event.key === "ArrowRight") nextIndex = (index + 1) % GUIDE_DAYS.length;
                else if (event.key === "ArrowLeft")
                  nextIndex = (index + GUIDE_DAYS.length - 1) % GUIDE_DAYS.length;
                else if (event.key === "Home") nextIndex = 0;
                else if (event.key === "End") nextIndex = GUIDE_DAYS.length - 1;
                else return;
                event.preventDefault();
                setSelectedDate(GUIDE_DAYS[nextIndex].date);
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

      <section
        id="event-day-agenda"
        role="tabpanel"
        aria-label={`Programação de ${selectedDay.day} de novembro`}
        className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"
      >
        <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-950">
          <p className="text-xs font-semibold tracking-wide text-zinc-500">{selectedDay.weekday}</p>
          <h2 className="text-lg font-bold">{selectedDay.day} de novembro</h2>
        </div>

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
