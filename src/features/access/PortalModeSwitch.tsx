import { ArrowLeftRight } from "lucide-react";
import { useEffect, useState } from "react";

import { getPortalModes, type PortalModes } from "@/lib/portal-access.functions";

export type PortalModeDestination = "/admin/resumo" | "/participante";

type Props = {
  mode: "admin" | "participant";
  onNavigate?: (destination: PortalModeDestination) => void;
  loadModes?: () => Promise<PortalModes>;
};

export function PortalModeSwitch({ mode, onNavigate, loadModes = getPortalModes }: Props) {
  const [modes, setModes] = useState<PortalModes | null>(null);

  useEffect(() => {
    let active = true;
    setModes(null);
    void (async () => {
      try {
        const result = await loadModes();
        if (active) setModes(result);
      } catch {
        if (active) setModes(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadModes]);

  if (!modes?.admin || !modes.participant) return null;

  const destination = mode === "admin" ? "/participante" : "/admin/resumo";
  const label = mode === "admin" ? "Ir para participante" : "Ir para admin";

  return (
    <a
      href={destination}
      aria-label={label}
      title={label}
      className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 text-xs font-semibold text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
      onClick={(event) => {
        if (
          onNavigate &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey &&
          event.button === 0
        ) {
          event.preventDefault();
          onNavigate(destination);
        }
      }}
    >
      <ArrowLeftRight aria-hidden="true" className="size-4" />
      <span>
        <span className="hidden sm:inline">Ir para </span>
        {mode === "admin" ? "Participante" : "Admin"}
      </span>
    </a>
  );
}
