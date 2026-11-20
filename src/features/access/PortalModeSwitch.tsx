import { ArrowLeftRight, UsersRound } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { getPortalModes, type PortalModes } from "@/lib/portal-access.functions";

export type PortalModeDestination = "/admin/inscricoes" | "/participante" | "/participante/previa" | "/regente";

type Props = {
  mode: "admin" | "participant";
  onNavigate?: (destination: PortalModeDestination) => void;
  loadModes?: () => Promise<PortalModes>;
};

function ModeLink({
  destination,
  label,
  shortLabel,
  icon,
  onNavigate,
}: {
  destination: PortalModeDestination;
  label: string;
  shortLabel: string;
  icon: ReactNode;
  onNavigate?: (destination: PortalModeDestination) => void;
}) {
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
      {icon}
      <span className="hidden sm:inline">Ir para {shortLabel}</span>
    </a>
  );
}

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

  if (!modes) return null;

  const showAdminSwitch = modes.admin && modes.participant;
  const showParticipantPreview = mode === "admin" && modes.admin && !modes.participant;
  const showRegentLink = modes.regent && mode === "participant";
  if (!showAdminSwitch && !showParticipantPreview && !showRegentLink) return null;

  return (
    <div className="flex items-center gap-2">
      {showRegentLink && (
        <ModeLink
          destination="/regente"
          label="Ir para as inscrições do meu coro"
          shortLabel="Meu coro"
          icon={<UsersRound aria-hidden="true" className="size-4" />}
          onNavigate={onNavigate}
        />
      )}
      {showAdminSwitch && (
        <ModeLink
          destination={mode === "admin" ? "/participante" : "/admin/inscricoes"}
          label={mode === "admin" ? "Ir para participante" : "Ir para admin"}
          shortLabel={mode === "admin" ? "Participante" : "Admin"}
          icon={<ArrowLeftRight aria-hidden="true" className="size-4" />}
          onNavigate={onNavigate}
        />
      )}
      {showParticipantPreview && (
        <ModeLink
          destination="/participante/previa"
          label="Prévia do participante"
          shortLabel="Prévia participante"
          icon={<UsersRound aria-hidden="true" className="size-4" />}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}
