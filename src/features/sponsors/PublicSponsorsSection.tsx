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
    <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr] lg:items-center lg:gap-8">
      <div>
        <span className="inline-flex items-center gap-2 rounded-full bg-teal/10 px-4 py-1.5 text-sm font-bold text-teal">
          Patrocinadores
        </span>
        <h2 className="mt-4 font-display text-[clamp(2rem,8vw,2.5rem)] font-extrabold leading-tight text-foreground sm:text-4xl">
          Quem ajuda esta música a chegar mais longe
        </h2>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
          O encontro também é construído por parceiros que valorizam cultura, formação e vida
          comunitária em Quixadá.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        {sponsors.map((sponsor) => (
          <article
            key={sponsor.id}
            className="flex min-h-24 items-center justify-center rounded-xl border border-border bg-card p-4 sm:min-h-32 sm:p-5"
          >
            <img
              src={sponsor.logoUrl}
              alt={sponsor.name}
              className="max-h-16 w-full object-contain sm:max-h-20"
              loading="lazy"
            />
          </article>
        ))}
      </div>
    </div>
  );
}
