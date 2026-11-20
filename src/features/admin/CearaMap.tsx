import type { JSX } from "react";

import { cn } from "@/lib/utils";

import { CEARA_PATH, CEARA_VIEWBOX, projectCeara } from "./cearaGeo";

export type CearaMapPoint = {
  id: string;
  label: string;
  value: number;
  latitude: number;
  longitude: number;
  isCentral?: boolean;
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
    return 12 + normalized * 22;
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
      <path
        d={CEARA_PATH}
        fill="#edf2f7"
        stroke="#18181b"
        strokeWidth={4}
        strokeLinejoin="round"
      />

      {points.map((point) => {
        const position = projectCeara(point.latitude, point.longitude);
        const radius = radiusFor(point.value);
        return (
          <g key={point.id}>
            {point.isCentral && (
              <circle
                cx={position.x}
                cy={position.y}
                r={radius + 7}
                fill="none"
                stroke="#18181b"
                strokeWidth={3}
              />
            )}
            <circle
              cx={position.x}
              cy={position.y}
              r={radius}
              fill="#d5a900"
              stroke="#18181b"
              strokeWidth={point.isCentral ? 3 : 1.5}
            >
              <title>{`${point.label}: ${point.value}${point.isCentral ? " · sede central do encontro" : ""}`}</title>
            </circle>
            <text
              x={position.x}
              y={position.y + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#18181b"
              fontSize={16}
              fontWeight={700}
              pointerEvents="none"
            >
              {point.value}
            </text>
            {point.isCentral && (
              <text
                x={position.x + radius + 8}
                y={position.y + radius + 12}
                fill="#18181b"
                stroke="#edf2f7"
                strokeWidth={4}
                strokeLinejoin="round"
                paintOrder="stroke"
                fontSize={21}
                fontWeight={700}
                pointerEvents="none"
              >
                Quixadá · sede central
              </text>
            )}
          </g>
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
