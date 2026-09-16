import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { ParticipantRegistrationView } from "./participant.domain";

export function ChoristerWelcomeCard({
  participant,
}: {
  participant: ParticipantRegistrationView;
}) {
  const { identity, registration } = participant;
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);

  return (
    <section aria-label="Boas-vindas e inscrição">
      <header className="relative isolate flex items-center gap-3 overflow-hidden rounded-2xl bg-[#ffd43b] px-4 py-4 sm:px-5">
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 600 180"
          preserveAspectRatio="xMidYMid slice"
          className="pointer-events-none absolute inset-0 -z-10 size-full"
        >
          <path d="M0 0h600v180H0z" fill="#ffd43b" />
          <path
            d="M-40 154C105 12 259 197 416 64S581 30 650-38"
            fill="none"
            stroke="#fff3bf"
            strokeWidth="90"
            opacity=".55"
          />
          <path
            d="M365 200C371 89 496 151 495 35S625-2 647-49"
            fill="none"
            stroke="#e6aa00"
            strokeWidth="58"
            opacity=".35"
          />
          <g fill="none" stroke="#6b5000" strokeWidth="1" opacity=".16">
            <path d="M345 24c110 97 127-18 265 44M340 34c110 97 127-18 265 44M335 44c110 97 127-18 265 44M330 54c110 97 127-18 265 44M325 64c110 97 127-18 265 44" />
          </g>
          <g fill="#6b5000" opacity=".2">
            <ellipse cx="443" cy="74" rx="8" ry="5" transform="rotate(-20 443 74)" />
            <path d="M449 73V37l23-5v30h-3V42l-17 4v27z" />
            <ellipse cx="465" cy="63" rx="8" ry="5" transform="rotate(-20 465 63)" />
            <path d="m555 110 3 7 8 3-8 3-3 8-3-8-7-3 7-3z" />
          </g>
        </svg>
        <Avatar className="order-2 size-12 shrink-0 border-2 border-white/80 bg-white shadow-sm">
          {identity.photoUrl && failedPhoto !== identity.photoUrl ? (
            <img
              src={identity.photoUrl}
              alt={`Foto de ${identity.name}`}
              className="h-full w-full object-cover"
              onError={() => setFailedPhoto(identity.photoUrl ?? null)}
            />
          ) : (
            <AvatarFallback
              role="img"
              aria-label="Foto não disponível"
              className="bg-white/90 text-sm font-semibold text-zinc-800"
            >
              {identity.name
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase())
                .join("")}
            </AvatarFallback>
          )}
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] leading-4 text-zinc-700">Bem-vindo</p>
          <h1
            id="chorister-home-title"
            className="mt-0.5 break-words text-base font-bold leading-5 tracking-tight text-zinc-950 sm:text-lg sm:leading-6"
          >
            {identity.name}
          </h1>
          <p className="mt-1 break-words text-xs leading-4 text-zinc-700">
            {registration.choirName || "Coral não informado"}
          </p>
        </div>
      </header>
    </section>
  );
}
