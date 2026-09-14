import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminActivityAttendance } from "./eventActivity.domain";

type Props = {
  open: boolean;
  activity: { id: string; title: string; attendanceCount: number } | null;
  onOpenChange(open: boolean): void;
  loadAttendances(input: { data: { activityId: string } }): Promise<AdminActivityAttendance[]>;
};

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Fortaleza",
});

export function AdminActivityAttendancesDialog({ open, activity, onOpenChange, loadAttendances }: Props) {
  const [items, setItems] = useState<AdminActivityAttendance[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !activity) return;
    let active = true;
    setItems(null);
    setError("");
    void loadAttendances({ data: { activityId: activity.id } })
      .then((result) => active && setItems(result))
      .catch(() => active && setError("Não foi possível carregar as presenças desta atividade."));
    return () => { active = false; };
  }, [activity, loadAttendances, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Presenças · {activity?.title}</DialogTitle>
          <DialogDescription>
            {activity?.attendanceCount ?? 0} registro{activity?.attendanceCount === 1 ? "" : "s"} confirmado{activity?.attendanceCount === 1 ? "" : "s"}.
          </DialogDescription>
        </DialogHeader>
        {items === null && !error && <Skeleton className="h-40 w-full" />}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {items?.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma presença registrada.</p>}
        {items && items.length > 0 && (
          <div className="divide-y rounded-xl border">
            {items.map((item) => (
              <article key={item.id} className="space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">{item.participantName}</h3>
                  <time className="text-sm tabular-nums text-muted-foreground">{dateTime.format(new Date(item.checkedInAt))}</time>
                </div>
                {item.latitude !== null && item.longitude !== null ? (
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    {item.distanceMeters !== null && <Badge variant="secondary">{Math.round(item.distanceMeters)} m do local</Badge>}
                    {item.accuracyMeters !== null && <span>Precisão {Math.round(item.accuracyMeters)} m</span>}
                    <span className="tabular-nums">{item.latitude}, {item.longitude}</span>
                    <a
                      className="font-medium text-primary underline underline-offset-4"
                      href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir localização no mapa
                    </a>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Atividade sem verificação de local.</p>
                )}
              </article>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
