import { useCallback, useEffect, useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { dioceseOptions, type Diocese } from "@/features/dioceses/diocese.domain";
import type { AdminAccessState } from "@/lib/admin.functions";
import {
  createAdminChoir,
  getAdminChoirPricing,
  type AdminChoirPricingBootstrap,
  saveAdminPricingSettings,
  setAdminChoirActive,
  updateAdminChoir,
} from "@/lib/choir-pricing.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  formatCentsForInput,
  parseCurrencyToCents,
  choirMutationSchema,
  pricingSettingsSchema,
  type AdminChoir,
  type ChoirMutation,
  type PricingSettings,
} from "@/features/choirs/choir-pricing.domain";
import type { AdminChoirPricing } from "@/features/choirs/choir-pricing.server";
import { getAdminAccess } from "@/lib/admin.functions";
import { AdminNavigation, type AdminNavigationPath } from "./AdminNavigation";
import { AdminRegentsPanel } from "./AdminRegentsPanel";
import { AdminCoroAppIntegrationPage } from "./AdminCoroAppIntegrationPage";

type ServerMutation<TInput, TOutput> = (input: { data: TInput }) => Promise<TOutput>;

export type AdminChoirsPageProps = {
  section?: "choirs" | "settings";
  onSignedOut: () => void;
  onMissingSession: () => void;
  checkAdmin?: () => Promise<AdminAccessState>;
  loadInitialData?: () => Promise<AdminChoirPricingBootstrap>;
  loadData?: () => Promise<AdminChoirPricing>;
  saveSettings?: ServerMutation<PricingSettings, PricingSettings>;
  createChoir?: ServerMutation<ChoirMutation, AdminChoir>;
  updateChoir?: ServerMutation<ChoirMutation & { id: string }, AdminChoir>;
  setChoirActive?: ServerMutation<{ id: string; isActive: boolean }, AdminChoir>;
  getSession?: () => Promise<{ data: { session: unknown | null }; error: unknown }>;
  signOut?: () => Promise<{ error: unknown }>;
  navigateTo?: (to: AdminNavigationPath) => void;
};

type Gate = "checking" | "authorized" | "forbidden" | "error" | "leaving";
type SettingsDraft = {
  standard: string;
  promotional: string;
  promotionalRemaining: string;
};

type ChoirDraft = Omit<ChoirMutation, "diocese"> & { diocese: "" | Diocese };

const emptyChoirDraft: ChoirDraft = {
  name: "",
  diocese: "",
  usesPromotionalPrice: false,
  isFree: false,
  isActive: true,
};

const defaultGetSession = () => supabase.auth.getSession();
const defaultSignOut = () => supabase.auth.signOut();

function settingsDraft(settings: PricingSettings): SettingsDraft {
  return {
    standard: formatCentsForInput(settings.standardPriceCents),
    promotional: formatCentsForInput(settings.promotionalPriceCents),
    promotionalRemaining: formatCentsForInput(settings.promotionalRemainingPriceCents ?? null),
  };
}

function choirAvailability(choir: AdminChoir, settings: PricingSettings) {
  if (!choir.isActive) return "Inativo";
  if (choir.isFree) return "Inscrição gratuita com aprovação do administrador";
  if (choir.usesPromotionalPrice) {
    if (settings.standardPriceCents === null || settings.promotionalPriceCents === null) {
      return "Oculto: configure os valores normal e promocional.";
    }
    return "Disponível com valor promocional";
  }
  return settings.standardPriceCents === null
    ? "Oculto: configure o valor normal."
    : "Disponível com valor normal";
}

export function AdminChoirsPage({
  section = "choirs",
  onSignedOut,
  onMissingSession,
  checkAdmin = getAdminAccess,
  loadInitialData,
  loadData = getAdminChoirPricing,
  saveSettings = saveAdminPricingSettings,
  createChoir = createAdminChoir,
  updateChoir = updateAdminChoir,
  setChoirActive = setAdminChoirActive,
  getSession = defaultGetSession,
  signOut = defaultSignOut,
  navigateTo,
}: AdminChoirsPageProps) {
  const [gate, setGate] = useState<Gate>("checking");
  const [data, setData] = useState<AdminChoirPricing | null>(null);
  const [settings, setSettings] = useState<SettingsDraft>({
    standard: "",
    promotional: "",
    promotionalRemaining: "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminChoir | null>(null);
  const [pendingInactivation, setPendingInactivation] = useState<AdminChoir | null>(null);
  const [regentChoir, setRegentChoir] = useState<AdminChoir | null>(null);
  const [choirDraft, setChoirDraft] = useState<ChoirDraft>(emptyChoirDraft);
  const [bootstrapDataReady, setBootstrapDataReady] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await loadData();
      setData(next);
      setSettings(settingsDraft(next.settings));
    } catch {
      setError("Não foi possível carregar os coros e valores.");
    } finally {
      setLoading(false);
    }
  }, [loadData]);

  useEffect(() => {
    if (loadInitialData) {
      let active = true;
      setGate("checking");
      setLoading(true);
      setError("");
      void loadInitialData()
        .then((bootstrap) => {
          if (!active) return;
          if (bootstrap.access.status !== "authorized" || !bootstrap.data) {
            setGate(bootstrap.access.status);
            return;
          }
          setData(bootstrap.data);
          setSettings(settingsDraft(bootstrap.data.settings));
          setBootstrapDataReady(true);
          setGate("authorized");
        })
        .catch(async () => {
          if (!active) return;
          try {
            const session = await getSession();
            if (!active) return;
            if (!session.error && !session.data.session) {
              onMissingSession();
              return;
            }
          } catch {
            /* An unavailable local session cannot authorize or prove expiry. */
          }
          setGate("error");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }
    let active = true;
    void (async () => {
      try {
        const session = await getSession();
        if (!session.data.session) {
          if (active) onMissingSession();
          return;
        }
        const access = await checkAdmin();
        if (!active) return;
        setGate(access.status === "authorized" ? "authorized" : "forbidden");
      } catch {
        if (active) setGate("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [checkAdmin, getSession, loadInitialData, onMissingSession]);

  useEffect(() => {
    if (gate === "authorized" && !(loadInitialData && bootstrapDataReady)) void load();
  }, [bootstrapDataReady, gate, load, loadInitialData]);

  const submitSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const parsed = pricingSettingsSchema.parse({
        standardPriceCents: parseCurrencyToCents(settings.standard),
        promotionalPriceCents: parseCurrencyToCents(settings.promotional),
        promotionalRemainingPriceCents: parseCurrencyToCents(settings.promotionalRemaining),
      });
      const saved = await saveSettings({ data: parsed });
      setData((previous) => (previous ? { ...previous, settings: saved } : previous));
      setSettings(settingsDraft(saved));
      setMessage("Valores do evento salvos.");
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message.includes("promocional")
          ? caught.message
          : "Não foi possível salvar os valores do evento.",
      );
    } finally {
      setSaving(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setChoirDraft(emptyChoirDraft);
    setError("");
    setDialogOpen(true);
  };

  const openEdit = (choir: AdminChoir) => {
    setEditing(choir);
    setChoirDraft({
      name: choir.name,
      diocese: choir.diocese ?? "",
      usesPromotionalPrice: choir.usesPromotionalPrice,
      isFree: choir.isFree ?? false,
      isActive: choir.isActive,
    });
    setError("");
    setDialogOpen(true);
  };

  const submitChoir = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const parsedDraft = choirMutationSchema.parse(choirDraft);
      const saved = editing
        ? await updateChoir({ data: { id: editing.id, ...parsedDraft } })
        : await createChoir({ data: parsedDraft });
      setData((previous) => {
        if (!previous) return previous;
        const withoutSaved = previous.choirs.filter((choir) => choir.id !== saved.id);
        return {
          ...previous,
          choirs: [...withoutSaved, saved].sort((left, right) =>
            left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" }),
          ),
        };
      });
      setDialogOpen(false);
      setMessage(editing ? "Coro atualizado." : "Coro cadastrado.");
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message === "Já existe um coro com esse nome."
          ? caught.message
          : "Não foi possível salvar o coro.",
      );
    } finally {
      setSaving(false);
    }
  };

  const changeActive = async (choir: AdminChoir, isActive: boolean) => {
    setSaving(true);
    setError("");
    try {
      const saved = await setChoirActive({ data: { id: choir.id, isActive } });
      setData((previous) =>
        previous
          ? {
              ...previous,
              choirs: previous.choirs.map((item) => (item.id === saved.id ? saved : item)),
            }
          : previous,
      );
      setMessage(isActive ? "Coro reativado." : "Coro inativado.");
    } catch {
      setError("Não foi possível alterar a situação do coro.");
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    setGate("leaving");
    const result = await signOut();
    if (result.error) {
      setGate("authorized");
      setError("Não foi possível sair.");
      return;
    }
    onSignedOut();
  };

  return (
    <main className="internal-app min-h-svh bg-[#f7f7f5] px-4 pb-24 pt-20 sm:px-6 md:pl-[calc(15rem+1.5rem)] md:pr-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Encontro de Coros · Administração
            </p>
            <h1 className="mt-2 font-display text-2xl">
              {section === "settings" ? "Configurações" : "Coros"}
            </h1>
          </div>
          {gate === "authorized" && (
            <Button size="sm" variant="outline" onClick={logout}>
              Sair
            </Button>
          )}
        </header>
        {gate === "authorized" && <AdminNavigation current={section} navigateTo={navigateTo} />}
        <div aria-live="polite" className="text-sm text-muted-foreground">
          {message}
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {gate === "authorized" && !loading && !data && error && (
          <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
            Tentar novamente
          </Button>
        )}
        {gate === "checking" && <Skeleton className="h-40 w-full" />}
        {gate === "forbidden" && <p role="alert">Acesso não autorizado.</p>}
        {gate === "error" && <p role="alert">Não foi possível verificar seu acesso.</p>}
        {gate === "authorized" && loading && <Skeleton className="h-64 w-full" />}
        {gate === "authorized" && !loading && data && section === "choirs" && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl">Coros/Dioceses</h2>
                <p className="text-sm text-muted-foreground">
                  A promoção é aplicada automaticamente no formulário público.
                </p>
              </div>
              <Button onClick={openCreate}>Cadastrar coro</Button>
            </div>
            {data.choirs.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-sm">
                  Nenhum coro cadastrado.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {data.choirs.map((choir) => (
                  <Card key={choir.id}>
                    <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{choir.name}</h3>
                          <Badge variant={choir.isActive ? "default" : "secondary"}>
                            {choir.isActive ? "Ativo" : "Inativo"}
                          </Badge>
                          {choir.usesPromotionalPrice && (
                            <Badge variant="outline">Promocional</Badge>
                          )}
                          {choir.isFree && <Badge variant="outline">Gratuito</Badge>}
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {choir.diocese ?? "Diocese não informada"}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {choirAvailability(choir, data.settings)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => setRegentChoir(choir)}>
                          Gerenciar regente
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEdit(choir)}>
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={saving}
                          onClick={() => {
                            if (choir.isActive) setPendingInactivation(choir);
                            else void changeActive(choir, true);
                          }}
                        >
                          {choir.isActive ? "Inativar" : "Reativar"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        )}
        {gate === "authorized" && !loading && data && section === "settings" && (
          <div className="space-y-5">
            <Card>
              <CardContent className="p-5 sm:p-6">
                <div className="mb-5">
                  <h2 className="font-display text-xl">Valores do evento</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Deixe vazio para manter uma opção indisponível ao público.
                  </p>
                </div>
                <form onSubmit={submitSettings} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    {(
                      [
                        ["standard", "Valor normal"],
                        ["promotional", "Valor promocional"],
                        ["promotionalRemaining", "Valor restante promocional"],
                      ] as const
                    ).map(([field, label]) => (
                      <div className="space-y-2" key={field}>
                        <Label htmlFor={`price-${field}`}>{label}</Label>
                        <Input
                          id={`price-${field}`}
                          inputMode="decimal"
                          placeholder="Não configurado"
                          value={settings[field]}
                          onChange={(event) =>
                            setSettings((previous) => ({
                              ...previous,
                              [field]: event.target.value,
                            }))
                          }
                          disabled={saving}
                        />
                      </div>
                    ))}
                  </div>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Salvando…" : "Salvar valores"}
                  </Button>
                </form>
              </CardContent>
            </Card>
            <AdminCoroAppIntegrationPage
              embedded
              checkAdmin={checkAdmin}
              getSession={getSession}
              navigateTo={navigateTo}
              onMissingSession={onMissingSession}
            />
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar coro" : "Cadastrar coro"}</DialogTitle>
            <DialogDescription>
              Defina o nome e a modalidade da inscrição do coro.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitChoir} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="choir-name">Nome do coro</Label>
              <Input
                id="choir-name"
                required
                maxLength={120}
                value={choirDraft.name}
                onChange={(event) =>
                  setChoirDraft((previous) => ({ ...previous, name: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="choir-diocese">Diocese</Label>
              <select
                id="choir-diocese"
                required
                value={choirDraft.diocese}
                onChange={(event) =>
                  setChoirDraft((previous) => ({
                    ...previous,
                    diocese: event.target.value as "" | Diocese,
                  }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                disabled={saving}
              >
                <option value="">Selecione a diocese</option>
                {dioceseOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
              <Label htmlFor="choir-promotional">Aplicar valor promocional</Label>
              <input
                id="choir-promotional"
                type="checkbox"
                className="size-5 accent-primary"
                checked={choirDraft.usesPromotionalPrice}
                onChange={(event) =>
                  setChoirDraft((previous) => ({
                    ...previous,
                    usesPromotionalPrice: event.target.checked,
                    isFree: event.target.checked ? false : previous.isFree,
                  }))
                }
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
              <Label htmlFor="choir-free">Inscrição gratuita com aprovação do administrador</Label>
              <input
                id="choir-free"
                type="checkbox"
                className="size-5 accent-primary"
                checked={choirDraft.isFree ?? false}
                onChange={(event) =>
                  setChoirDraft((previous) => ({
                    ...previous,
                    isFree: event.target.checked,
                    usesPromotionalPrice: event.target.checked ? false : previous.usesPromotionalPrice,
                  }))
                }
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando…" : "Salvar coro"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={regentChoir !== null}
        onOpenChange={(open) => {
          if (!open) setRegentChoir(null);
        }}
      >
        <DialogContent className="max-h-[90svh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Regente de {regentChoir?.name}</DialogTitle>
            <DialogDescription>
              Cadastre e gerencie o acesso do regente vinculado a este coro.
            </DialogDescription>
          </DialogHeader>
          {regentChoir && data && (
            <AdminRegentsPanel key={regentChoir.id} choirId={regentChoir.id} choirs={data.choirs} />
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={pendingInactivation !== null}
        onOpenChange={(open) => {
          if (!open) setPendingInactivation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Inativar este coro?</AlertDialogTitle>
            <AlertDialogDescription>
              Ele deixará de aparecer no formulário público, mas as inscrições anteriores serão
              preservadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingInactivation) void changeActive(pendingInactivation, false);
                setPendingInactivation(null);
              }}
            >
              Confirmar inativação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
