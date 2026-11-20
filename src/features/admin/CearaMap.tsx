import type { JSX } from "react";

import { cn } from "@/lib/utils";

import { CEARA_PATH, CEARA_VIEWBOX, projectCeara } from "./cearaGeo";

export type CearaMapPoint = {
  id: string;
  label: string;
  value: number;
  latitude: number;
  longitude: number;
};

export function CearaMap({
  points,
  className,
  height,
}: {
  points: CearaMapPoint[];
  className?: string;
  height?: number;
}): JSX.Element {
  const maxValue = points.reduce((max, point) => Math.max(max, point.value), 0);
  const radiusFor = (value: number) => {
    const normalized = maxValue > 0 ? Math.max(0, Math.min(value / maxValue, 1)) : 0;
    return 6 + normalized * 28;
  };

  return (
    <svg
      viewBox={`0 0 ${CEARA_VIEWBOX.width} ${CEARA_VIEWBOX.height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Mapa do Ceará com participantes por diocese"
      className={cn("w-full", height == null && "h-auto", className)}
      style={height == null ? undefined : { height }}
    >
      <path d={CEARA_PATH} className="fill-primary/10 stroke-primary/40" strokeWidth={3} />

      {points.map((point) => {
        const position = projectCeara(point.latitude, point.longitude);
        return (
          <circle
            key={point.id}
            cx={position.x}
            cy={position.y}
            r={radiusFor(point.value)}
            className="fill-brand-gold stroke-brand-ink/50"
            strokeWidth={2}
          >
            <title>{`${point.label}: ${point.value}`}</title>
          </circle>
        );
      })}

      {points.length === 0 && (
        <text
          x={CEARA_VIEWBOX.width / 2}
          y={CEARA_VIEWBOX.height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-muted-foreground text-2xl"
        >
          Sem dados
        </text>
      )}
    </svg>
  );
}
