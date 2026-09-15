import { useEffect, useState } from "react";

import type { PublicSponsor } from "./sponsor.domain";
import { getPublicSponsors } from "@/lib/sponsor.functions";

export type PublicSponsorsSectionProps = {
  loadSponsors?: () => Promise<PublicSponsor[]>;
};

export function PublicSponsorsSection({
  loadSponsors = getPublicSponsors,
}: PublicSponsorsSectionProps) {
  const [sponsors, setSponsors] = useState<PublicSponsor[]>([]);

  useEffect(() => {
    let active = true;
    void loadSponsors()
      .then((items) => {
        if (active) setSponsors(items);
      })
      .catch(() => {
        if (active) setSponsors([]);
      });
    return () => {
      active = false;
    };
  }, [loadSponsors]);

  if (sponsors.length === 0) return null;

  return (
    <div aria-label="Patrocinadores">
      <div className="flex items-center gap-4">
        <p className="shrink-0 font-body text-xs font-extrabold uppercase text-muted-foreground">
          Patrocinadores
        </p>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
        {sponsors.map((sponsor) => (
          <figure
            key={sponsor.id}
            className="group flex aspect-square flex-col rounded-xl border border-border bg-background p-3 transition-all duration-300 hover:-translate-y-1.5 hover:border-amber hover:shadow-lg hover:shadow-amber/10 motion-reduce:transform-none motion-reduce:transition-none sm:p-4"
          >
            <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-border bg-muted/50 p-2 transition-colors duration-300 group-hover:border-amber/60 group-hover:bg-amber/5 motion-reduce:transition-none sm:p-3">
              <span className="flex max-h-full min-w-0 max-w-full overflow-hidden rounded-lg">
                <img
                  src={sponsor.logoUrl}
                  alt={`Logo de ${sponsor.name}`}
                  className="max-h-full w-auto max-w-full object-contain transition-transform duration-300 group-hover:scale-110 motion-reduce:transition-none"
                  loading="lazy"
                />
              </span>
            </div>
            <figcaption className="mt-3 flex min-h-9 items-center justify-center text-center text-xs font-bold leading-snug text-foreground line-clamp-2 sm:text-sm">
              {sponsor.name}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
