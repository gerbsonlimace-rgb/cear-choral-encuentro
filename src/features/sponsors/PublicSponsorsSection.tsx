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
      <p className="text-sm font-bold text-amber">Patrocinadores</p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {sponsors.map((sponsor) => (
          <figure
            key={sponsor.id}
            className="flex flex-col rounded-xl border border-border bg-background p-4 sm:p-5"
          >
            <div className="flex h-20 items-center justify-center rounded-xl border border-border bg-muted/50 p-2 sm:h-24">
              <span className="flex max-h-full min-w-0 max-w-full overflow-hidden rounded-lg">
                <img
                  src={sponsor.logoUrl}
                  alt={`Logo de ${sponsor.name}`}
                  className="max-h-full w-auto max-w-full object-contain"
                  loading="lazy"
                />
              </span>
            </div>
            <figcaption className="mt-3 flex min-h-10 items-start justify-center text-center text-sm font-semibold leading-snug text-foreground line-clamp-2">
              {sponsor.name}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
