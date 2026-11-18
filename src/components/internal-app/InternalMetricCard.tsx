import type { ComponentType } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MetricIcon = ComponentType<{
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}>;

export type InternalMetricCardDetail = { label: string; value: string };

type InternalMetricCardProps = {
  label: string;
  value: string;
  icon?: MetricIcon;
  detail?: string;
  /** Optional breakdown rendered under the value, one line per entry. */
  details?: readonly InternalMetricCardDetail[];
  /** Compact layout for dense dashboards. */
  dense?: boolean;
  className?: string;
};

export function InternalMetricCard({
  label,
  value,
  icon: Icon,
  detail,
  details,
  dense = false,
  className,
}: InternalMetricCardProps) {
  return (
    <Card
      className={cn(
        "rounded-xl border-zinc-200 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04)]",
        className,
      )}
    >
      <CardContent
        className={cn(
          "flex items-start gap-3 p-4 sm:p-5",
          dense && "gap-2 p-2.5",
        )}
      >
        {Icon && (
          <span
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-xl bg-brand-gold-soft text-amber-700",
              dense && "size-7 rounded-lg",
            )}
          >
            <Icon
              aria-hidden="true"
              className={cn("size-5", dense && "size-3.5")}
            />
          </span>
        )}
        <div className="min-w-0">
          <p
            className={cn(
              "text-xs font-semibold text-zinc-500",
              dense && "text-[10px] leading-4",
            )}
          >
            {label}
          </p>
          <p
            className={cn(
              "app-metric mt-1 text-xl font-extrabold tracking-[-0.02em] text-brand-ink tabular-nums sm:text-2xl",
              dense && "mt-0.5 text-base sm:text-lg",
            )}
          >
            {value}
          </p>
          {detail && (
            <p
              className={cn(
                "mt-1 text-xs leading-5 text-zinc-500",
                dense && "mt-0.5 text-[10px] leading-4",
              )}
            >
              {detail}
            </p>
          )}
          {details && details.length > 0 && (
            <dl
              className={cn(
                "mt-1 space-y-0.5 text-[11px] leading-4 text-zinc-500",
                dense && "mt-0.5 text-[10px] leading-4",
              )}
            >
              {details.map((item) => (
                <div key={item.label} className="flex flex-wrap justify-between gap-x-2">
                  <dt>{item.label}</dt>
                  <dd className="font-medium tabular-nums">{item.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
