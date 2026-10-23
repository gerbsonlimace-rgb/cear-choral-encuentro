import { CalendarDays, FileMusic, Files, Home, Ticket, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { InternalAppShell } from "@/components/internal-app/InternalAppShell";
import { getAdminAccess, type AdminAccessState } from "@/lib/admin.functions";

type PreviewTab = "home" | "guia" | "cantos" | "documentos" | "perfil";

type Props = {
  checkAccess?: () => Promise<AdminAccessState>;
  onUnauthorized: () => void;
  onReturnAdmin: () => void;
};

const tabs = [
  { id: "home", label: "Home", icon: Home },
  { id: "guia", label: "Agenda", icon: CalendarDays },
  { id: "cantos", label: "Áudios", icon: FileMusic },
  { id: "documentos", label: "Partituras", icon: Files },
  { id: "perfil", label: "Meu Perfil", icon: UserRound },
] as const;

export function ParticipantPreviewPage({
  checkAccess = getAdminAccess,
  onUnauthorized,
  onReturnAdmin,
}: Props) {
  const [authorized, setAuthorized] = useState(false);
  const [tab, setTab] = useState<PreviewTab>("home");

  useEffect(() => {
    let active = true;
    void checkAccess()
      .then((access) => {
        if (!active) return;
        if (access.status === "authorized") setAuthorized(true);
        else onUnauthorized();
      })
      .catch(() => {
        if (active) onUnauthorized();
      });
    return () => {
      active = false;
    };
  }, [checkAccess, onUnauthorized]);

  if (!authorized) {
    return (
      <main className="chorister-app grid min-h-svh place-items-center bg-white p-6" role="status">
        Verificando acesso à prévia…
      </main>
    );
  }

  return (
    <InternalAppShell
      moduleLabel="Participante · Prévia"
      navItems={tabs}
      mobilePrimaryCount={4}
      activeId={tab}
      onNavigate={(id) => setTab(id as PreviewTab)}
      profileName="Participante Exemplo"
      profileDetail="Coro de Demonstração"
      topbarActions={
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 text-white hover:bg-white/10 hover:text-brand-gold"
          onClick={onReturnAdmin}
        >
          Voltar à administração
        </Button>
      }
    >
      <div className="chorister-app mx-auto max-w-5xl space-y-5 text-zinc-950">
        <aside className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-zinc-800">
          <strong>Prévia do participante.</strong> Esta tela usa dados fictícios. Pagamentos e alterações de cadastro ficam indisponíveis aqui.
        </aside>

        {tab === "home" && (
          <section className="space-y-5" aria-label="Início da prévia">
            <header>
              <h1 className="text-2xl font-bold tracking-tight">Olá, Participante Exemplo!</h1>
              <p className="mt-1 text-sm text-zinc-600">Acompanhe o encontro e suas rifas em um só lugar.</p>
            </header>
            <div className="grid gap-3 sm:grid-cols-3">
              <PreviewCard title="Minha inscrição" description="Coro de Demonstração · Diocese de Exemplo" />
              <PreviewCard title="Agenda" description="20 a 22 de novembro de 2026 · Quixadá, Ceará" />
              <PreviewCard title="Materiais" description="Áudios, letras e partituras do encontro" />
            </div>
            <section aria-label="Suas rifas" className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2">
                <Ticket aria-hidden="true" className="size-5 text-amber-800" />
                <h2 className="font-semibold">Suas rifas</h2>
              </div>
              <p className="mt-2 text-sm text-zinc-700">Exemplo: 20 rifas no total · 0 vendidas · R$ 200,00 pendentes.</p>
              <Button type="button" className="mt-3 min-h-11" disabled>
                Pagamento indisponível na prévia
              </Button>
            </section>
          </section>
        )}

        {tab === "guia" && <PreviewSection title="Agenda" description="A programação aparecerá aqui para quem estiver inscrito no encontro." />}
        {tab === "cantos" && <PreviewSection title="Áudios" description="Os cantos e áudios publicados aparecerão aqui para os participantes." />}
        {tab === "documentos" && <PreviewSection title="Partituras" description="As partituras e os materiais publicados aparecerão aqui." />}
        {tab === "perfil" && (
          <section className="space-y-4" aria-label="Perfil de demonstração">
            <h1 className="text-2xl font-bold tracking-tight">Meu Perfil</h1>
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <h2 className="font-semibold">Dados pessoais de exemplo</h2>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div><dt className="text-zinc-500">Nome</dt><dd>Participante Exemplo</dd></div>
                <div><dt className="text-zinc-500">Coro</dt><dd>Coro de Demonstração</dd></div>
              </dl>
              <p className="mt-4 text-sm text-zinc-600">Para alterar sua senha real, volte à administração e abra Meu perfil.</p>
            </div>
          </section>
        )}
      </div>
    </InternalAppShell>
  );
}

function PreviewCard({ title, description }: { title: string; description: string }) {
  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-4">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-zinc-600">{description}</p>
    </article>
  );
}

function PreviewSection({ title, description }: { title: string; description: string }) {
  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">{description}</p>
    </section>
  );
}
