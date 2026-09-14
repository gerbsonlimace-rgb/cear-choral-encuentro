import type { ComponentType } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MetricIcon = ComponentType<{
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}>;

type InternalMetricCardProps = {
  label: string;
  value: string;
  icon?: MetricIcon;
  detail?: string;
  className?: string;
};

export function InternalMetricCard({
  label,
  value,
  icon: Icon,
  detail,
  className,
}: InternalMetricCardProps) {
  return (
    <Card className={cn("rounded-xl border-zinc-200 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04)]", className)}>
      <CardContent className="flex items-start gap-3 p-4 sm:p-5">
        {Icon && (
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-gold-soft text-amber-700">
            <Icon aria-hidden="true" className="size-5" />
          </span>
        )}
        <div className="min-w-0">
          <p className="text-xs font-semibold text-zinc-500">{label}</p>
          <p className="app-metric mt-1 text-xl font-extrabold tracking-[-0.02em] text-brand-ink tabular-nums sm:text-2xl">{value}</p>
          {detail && <p className="mt-1 text-xs leading-5 text-zinc-500">{detail}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
