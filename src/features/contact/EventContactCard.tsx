import { Headset, Phone, MessageCircle } from "lucide-react";

import {
  CONTACT_PHONE_DISPLAY,
  CONTACT_PERSON_NAME,
  CONTACT_TEL_HREF,
  CONTACT_WHATSAPP_HREF,
} from "./event-contact";

type EventContactCardProps = {
  className?: string;
};

export function EventContactCard({ className = "" }: EventContactCardProps) {
  return (
    <section
      aria-labelledby="event-contact-title"
      className={`rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-6 ${className}`.trim()}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal/10 text-teal">
            <Headset className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="event-contact-title" className="font-display text-lg font-bold">
              Problemas ou informações sobre a inscrição
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Fale com {CONTACT_PERSON_NAME} pelo WhatsApp ou telefone.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <a
            href={CONTACT_WHATSAPP_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-teal px-4 text-sm font-bold text-teal-foreground transition-colors hover:bg-teal/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            {CONTACT_PHONE_DISPLAY}
          </a>
          <a
            href={CONTACT_TEL_HREF}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm font-bold text-card-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Phone className="size-4" aria-hidden="true" />
            Ligar
          </a>
        </div>
      </div>
    </section>
  );
}
