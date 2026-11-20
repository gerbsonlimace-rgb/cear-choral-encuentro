import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
} from "recharts";
import { FileDown, MapPin, Music2, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { InternalMetricCard } from "@/components/internal-app/InternalMetricCard";
import { deliverFile } from "@/lib/file-download";
import { getAdminParticipantMap, prepareAdminParticipantMapInfographic } from "@/lib/admin.functions";
import type { ParticipantCount, ParticipantMapData } from "./participantMap.domain";
import { CearaMap } from "./CearaMap";
import { AdminNavigation, type AdminNavigationPath } from "./AdminNavigation";

const GENDER_COLORS: Readonly<Record<string, string>> = {
  masculino: "#2563eb",
  feminino: "#c026d3",
  nao_informado: "#94a3b8",
};
const CHART_COLORS = ["#1d4ed8", "#0f766e", "#b45309", "#7c3aed", "#be123c", "#65a30d"];

type PreparedPdf = { blob: Blob; fileName: string };

function initials(name: string | null): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

function countLabel(items: ParticipantCount[]): string {
  return items.map((item) => `${item.label}: ${item.value}`).join(" · ") || "Sem dados";
}

export function ParticipantMapPage({
  navigateTo,
}: {
  navigateTo?: (to: AdminNavigationPath) => void;
}) {
  const loadMap = useServerFn(getAdminParticipantMap);
  const preparePdf = useServerFn(prepareAdminParticipantMapInfographic);
  const [data, setData] = useState<ParticipantMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [pdf, setPdf] = useState<PreparedPdf | null>(null);
  const [preparingPdf, setPreparingPdf] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [pdfAttempt, setPdfAttempt] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    setForbidden(false);
    setPdf(null);
    setPdfError("");
    try {
      const result = await loadMap();
      if (result.access.status !== "authorized" || !result.data) {
        setForbidden(true);
        return;
      }
      setData(result.data);
    } catch {
      setError("Não foi possível carregar o mapa dos participantes. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [loadMap]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Prepare the file before the final click so mobile browsers keep user activation.
  useEffect(() => {
    if (!data || forbidden) return;
    let active = true;
    setPreparingPdf(true);
    setPdfError("");
    void preparePdf()
      .then((file) => {
        if (!active) return;
        const bytes = Uint8Array.from(atob(file.base64), (char) => char.charCodeAt(0));
        setPdf({ blob: new Blob([bytes], { type: "application/pdf" }), fileName: file.fileName });
      })
      .catch(() => {
        if (active) setPdfError("Não foi possível preparar o PDF. Tente novamente.");
      })
      .finally(() => {
        if (active) setPreparingPdf(false);
      });
    return () => {
      active = false;
    };
  }, [data, forbidden, pdfAttempt, preparePdf]);

  const male = data?.genders.find((item) => item.key === "masculino")?.value ?? 0;
  const female = data?.genders.find((item) => item.key === "feminino")?.value ?? 0;
  const unknownGender = data?.genders.find((item) => item.key === "nao_informado")?.value ?? 0;
  const topChoirs = useMemo(() => data?.choirs.slice(0, 12) ?? [], [data]);
  const mapPoints = useMemo(
    () =>
      (data?.dioceses ?? []).map((seat) => ({
        id: seat.diocese,
        label: `${seat.city} — ${seat.total} participante(s)`,
        value: seat.total,
        latitude: seat.latitude,
        longitude: seat.longitude,
      })),
    [data],
  );
  const ageTreemap = useMemo(
    () => (data?.ageBands ?? []).map((item) => ({ name: item.label, size: item.value })),
    [data],
  );
  const voiceChart = useMemo(
    () => (data?.voices ?? []).map((item) => ({ label: item.label, value: item.value })),
    [data],
  );

  return (
    <main className="internal-app min-h-svh bg-[#f7f7f5] px-4 pb-24 pt-20 sm:px-6 md:pl-[calc(15rem+1.5rem)] md:pr-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Encontro de Coros · Administração
            </p>
            <h1 className="mt-2 font-display text-2xl">Mapa dos participantes</h1>
            <p className="text-sm text-muted-foreground">
              Visão geral, distribuição por coro e localização por sede diocesana.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={!pdf || preparingPdf}
            onClick={() => {
              if (pdf) void deliverFile(pdf.blob, pdf.fileName);
            }}
          >
            {preparingPdf ? <RefreshCw className="size-4 animate-spin" /> : <FileDown className="size-4" />}
            {preparingPdf ? "Preparando PDF…" : "Baixar PDF infográfico"}
          </Button>
        </header>
        <AdminNavigation current="participantMap" navigateTo={navigateTo} />

        {pdfError && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <span>{pdfError}</span>
            <Button size="sm" variant="outline" onClick={() => setPdfAttempt((value) => value + 1)}>
              Tentar novamente
            </Button>
          </div>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {forbidden && <p role="alert" className="text-sm text-destructive">Acesso não autorizado.</p>}

        {loading && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-24 rounded-xl" />
            ))}
          </div>
        )}

        {data && (
          <>
            <section aria-labelledby="participant-map-general" className="space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="participant-map-general" className="font-display text-xl">
                  Mapa geral
                </h2>
                <p className="text-xs text-muted-foreground">
                  {data.total} confirmações · {data.choirs.length} coros · {data.dioceses.length} dioceses
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <InternalMetricCard dense label="Participantes" value={String(data.total)} icon={Users} />
                <InternalMetricCard dense label="Homens" value={String(male)} />
                <InternalMetricCard dense label="Mulheres" value={String(female)} />
                <InternalMetricCard dense label="Não informado" value={String(unknownGender)} />
                <InternalMetricCard dense label="Coros" value={String(data.choirs.length)} icon={Music2} />
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Homens e mulheres</CardTitle>
                    <CardDescription>{countLabel(data.genders)}</CardDescription>
                  </CardHeader>
                  <CardContent className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.genders}
                          dataKey="value"
                          nameKey="label"
                          innerRadius={45}
                          outerRadius={80}
                          paddingAngle={2}
                        >
                          {data.genders.map((item) => (
                            <Cell key={item.key} fill={GENDER_COLORS[item.key] ?? "#94a3b8"} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Participantes por naipe</CardTitle>
                    <CardDescription>{countLabel(data.voices)}</CardDescription>
                  </CardHeader>
                  <CardContent className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={voiceChart} layout="vertical" margin={{ left: 8, right: 16 }}>
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="value" name="Participantes" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Mapa de faixa de idade</CardTitle>
                    <CardDescription>{countLabel(data.ageBands)}</CardDescription>
                  </CardHeader>
                  <CardContent className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <Treemap
                        data={ageTreemap}
                        dataKey="size"
                        nameKey="name"
                        stroke="#fff"
                        aspectRatio={4 / 3}
                      >
                        {ageTreemap.map((item, index) => (
                          <Cell key={item.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Treemap>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Participantes por coro</CardTitle>
                  <CardDescription>Comparativo entre os coros com inscrições confirmadas.</CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topChoirs} layout="vertical" margin={{ left: 8, right: 24 }}>
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis type="category" dataKey="choirName" width={190} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="total" name="Participantes" fill={CHART_COLORS[1]} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </section>

            <section aria-labelledby="participant-map-ceara" className="space-y-4">
              <h2 id="participant-map-ceara" className="font-display text-xl">
                Mapa do Ceará
              </h2>
              <Card>
                <CardContent className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,380px)_1fr]">
                  <div className="mx-auto w-full max-w-sm">
                    <CearaMap points={mapPoints} height={420} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Cada ponto representa a sede da diocese. O tamanho acompanha o número de participantes confirmados.
                    </p>
                    <ul className="divide-y rounded-lg border">
                      {data.dioceses.map((seat) => (
                        <li key={seat.diocese} className="flex items-center justify-between gap-3 p-3 text-sm">
                          <div className="flex min-w-0 items-center gap-2">
                            <MapPin className="size-4 shrink-0 text-amber-600" />
                            <div className="min-w-0">
                              <p className="truncate font-medium">{seat.city}</p>
                              <p className="truncate text-xs text-muted-foreground">{seat.diocese}</p>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-semibold tabular-nums">{seat.total}</p>
                            <p className="text-xs text-muted-foreground">{seat.choirs} coro(s)</p>
                          </div>
                        </li>
                      ))}
                      {data.dioceses.length === 0 && (
                        <li className="p-3 text-sm text-muted-foreground">Nenhuma diocese com dados confirmados.</li>
                      )}
                    </ul>
                    {data.unlocated > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {data.unlocated} participante(s) sem diocese identificada não aparecem no mapa.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </section>

            <section aria-labelledby="participant-map-choirs" className="space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="participant-map-choirs" className="font-display text-xl">
                  Participantes por coro
                </h2>
                <p className="text-xs text-muted-foreground">
                  Naipes e regente de cada coro.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {data.choirs.map((choir) => (
                  <Card key={choir.choirName} className="overflow-hidden">
                    <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-3">
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base">{choir.choirName}</CardTitle>
                        <CardDescription className="mt-1">
                          {choir.total} participante(s) · {choir.diocese ?? "Sem diocese"}
                        </CardDescription>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Avatar className="size-11">
                          {choir.regentPhotoUrl && (
                            <AvatarImage src={choir.regentPhotoUrl} alt={choir.regentName ?? "Regente"} />
                          )}
                          <AvatarFallback className="bg-brand-gold-soft text-xs font-bold text-amber-800">
                            {initials(choir.regentName)}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Regente</p>
                        <p className="truncate text-sm font-medium">{choir.regentName ?? "Não informado"}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Naipes</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {choir.voices.map((voice, index) => (
                            <span
                              key={voice.key}
                              className="rounded-full bg-muted px-2 py-1 text-xs font-medium tabular-nums"
                              style={{ color: CHART_COLORS[index % CHART_COLORS.length] }}
                            >
                              {voice.label}: {voice.value}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="h-28">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={choir.voices} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                            <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={0} />
                            <Tooltip />
                            <Bar dataKey="value" name="Participantes" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {data.choirs.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum coro com inscrições confirmadas.</p>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
