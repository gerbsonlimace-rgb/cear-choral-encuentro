import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type InternalPageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

export function InternalPageHeader({
  title,
  description,
  actions,
  className,
}: InternalPageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-3 border-b border-zinc-200 pb-5 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="font-body text-2xl font-extrabold tracking-[-0.025em] text-brand-ink sm:text-[1.75rem]">
          {title}
        </h1>
        {description && <p className="mt-1 max-w-[70ch] text-sm leading-6 text-zinc-600">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
