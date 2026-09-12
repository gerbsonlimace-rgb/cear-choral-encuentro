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
          <article
            key={sponsor.id}
            className="flex min-h-24 items-center justify-center rounded-xl bg-white p-4 sm:p-5"
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
