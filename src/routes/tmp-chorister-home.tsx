import { createFileRoute } from "@tanstack/react-router";

import { ChoristerHomeTab } from "@/features/participant/ChoristerHomeTab";
import type { ParticipantRegistrationView } from "@/features/participant/participant.domain";

export const Route = createFileRoute("/tmp-chorister-home")({
  component: () => (
    <main className="chorister-app mx-auto max-w-3xl px-4 py-8">
      <ChoristerHomeTab
        participant={
          {
            identity: {
              name: "Maria da Silva",
              cpf: "***.***.***-25" as ParticipantRegistrationView["identity"]["cpf"],
              birthDate: "1990-01-15",
            },
            registration: {
              choirName: "Coral Santa Cecília",
              diocese: "Quixadá",
              voicePart: "soprano",
              pricingType: "promotional",
              regentNames: ["João de Souza"],
            },
            payment: {
              status: "paid",
              financialState: {
                status: "partially_paid",
                pendingCents: 8000,
                confirmedPrincipalCents: 32000,
              },
            },
          } satisfies ParticipantRegistrationView
        }
      />
    </main>
  ),
});
