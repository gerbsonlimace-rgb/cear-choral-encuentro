import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";

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
import { Badge } from "@/components/ui/badge";
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
import {
  MAX_SPONSOR_LOGO_BYTES,
  sponsorLogoMimeTypeSchema,
  type AdminSponsor,
  type SponsorCreate,
  type SponsorLogoUpload,
  type SponsorUpdate,
} from "@/features/sponsors/sponsor.domain";
import { supabase } from "@/integrations/supabase/client";
import type { AdminAccessState } from "@/lib/admin.functions";
import { getAdminAccess } from "@/lib/admin.functions";
import {
  createAdminSponsor,
  getAdminSponsors,
  type AdminSponsorsBootstrap,
  setAdminSponsorActive,
  updateAdminSponsor,
} from "@/lib/sponsor.functions";
import { AdminNavigation } from "./AdminNavigation";

type ServerMutation<TInput> = (input: { data: TInput }) => Promise<AdminSponsor>;

export type AdminSponsorsPageProps = {
  onSignedOut: () => void;
  onMissingSession: () => void;
  checkAdmin?: () => Promise<AdminAccessState>;
  loadInitialData?: () => Promise<AdminSponsorsBootstrap>;
  loadSponsors?: () => Promise<AdminSponsor[]>;
  createSponsor?: ServerMutation<SponsorCreate>;
  updateSponsor?: ServerMutation<SponsorUpdate>;
  setSponsorActive?: ServerMutation<{ id: string; isActive: boolean }>;
  getSession?: () => Promise<{ data: { session: unknown | null }; error: unknown }>;
  signOut?: () => Promise<{ error: unknown }>;
  navigateTo?: (
    to: "/admin/inscricoes" | "/admin/coros" | "/admin/patrocinadores" | "/regente",
  ) => void;
};

type Gate = "checking" | "authorized" | "forbidden" | "error" | "leaving";
type LogoDraft = { upload: SponsorLogoUpload; previewUrl: string };

const defaultGetSession = () => supabase.auth.getSession();
const defaultSignOut = () => supabase.auth.signOut();

function readLogo(file: File): Promise<LogoDraft> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a logo selecionada."));
    reader.onload = () => {
      const previewUrl = typeof reader.result === "string" ? reader.result : "";
      const separator = previewUrl.indexOf(",");
      if (separator < 0) {
        reject(new Error("Não foi possível ler a logo selecionada."));
        return;
      }
      resolve({
        previewUrl,
        upload: {
          base64: previewUrl.slice(separator + 1),
          mimeType: sponsorLogoMimeTypeSchema.parse(file.type),
        },
      });
    };
    reader.readAsDataURL(file);
  });
}

export function AdminSponsorsPage({
  onSignedOut,
  onMissingSession,
  checkAdmin = getAdminAccess,
  loadInitialData,
  loadSponsors = getAdminSponsors,
  createSponsor = createAdminSponsor,
  updateSponsor = updateAdminSponsor,
  setSponsorActive = setAdminSponsorActive,
  getSession = defaultGetSession,
  signOut = defaultSignOut,
  navigateTo,
}: AdminSponsorsPageProps) {
  const [gate, setGate] = useState<Gate>("checking");
  const [sponsors, setSponsors] = useState<AdminSponsor[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminSponsor | null>(null);
  const [name, setName] = useState("");
  const [logo, setLogo] = useState<LogoDraft | null>(null);
  const [pendingInactivation, setPendingInactivation] = useState<AdminSponsor | null>(null);
  const [bootstrapDataReady, setBootstrapDataReady] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setSponsors(await loadSponsors());
    } catch {
      setError("Não foi possível carregar os patrocinadores.");
    } finally {
      setLoading(false);
    }
  }, [loadSponsors]);

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
          setSponsors(bootstrap.data);
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
        if (active) setGate(access.status === "authorized" ? "authorized" : "forbidden");
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

  const openCreate = () => {
    setEditing(null);
    setName("");
    setLogo(null);
    setError("");
    setDialogError("");
    setDialogOpen(true);
  };

  const openEdit = (sponsor: AdminSponsor) => {
    setEditing(sponsor);
    setName(sponsor.name);
    setLogo(null);
    setError("");
    setDialogError("");
    setDialogOpen(true);
  };

  const selectLogo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setDialogError("");
    if (!sponsorLogoMimeTypeSchema.safeParse(file.type).success) {
      setLogo(null);
      setDialogError("Envie uma logo em PNG, JPEG ou WebP.");
      return;
    }
    if (file.size > MAX_SPONSOR_LOGO_BYTES) {
      setLogo(null);
      setDialogError("A logo deve ter no máximo 5 MB.");
      return;
    }
    try {
      setLogo(await readLogo(file));
    } catch {
      setLogo(null);
      setDialogError("Não foi possível ler a logo selecionada.");
    }
  };

  const submitSponsor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing && !logo) {
      setDialogError("Selecione a logo do patrocinador.");
      return;
    }
    setSaving(true);
    setDialogError("");
    setMessage("");
    try {
      const saved = editing
        ? await updateSponsor({
            data: {
              id: editing.id,
              name,
              isActive: editing.isActive,
              ...(logo ? { logo: logo.upload } : {}),
            },
          })
        : await createSponsor({
            data: { name, isActive: true, logo: logo!.upload },
          });
      setSponsors((previous) => {
        const withoutSaved = (previous ?? []).filter((item) => item.id !== saved.id);
        return [...withoutSaved, saved].sort((left, right) =>
          left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" }),
        );
      });
      setDialogOpen(false);
      setMessage(editing ? "Patrocinador atualizado." : "Patrocinador cadastrado.");
    } catch (caught) {
      setDialogError(
        caught instanceof Error && caught.message === "Já existe um patrocinador com esse nome."
          ? caught.message
          : "Não foi possível salvar o patrocinador.",
      );
    } finally {
      setSaving(false);
    }
  };

  const changeActive = async (sponsor: AdminSponsor, isActive: boolean) => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const saved = await setSponsorActive({ data: { id: sponsor.id, isActive } });
      setSponsors(
        (previous) => previous?.map((item) => (item.id === saved.id ? saved : item)) ?? previous,
      );
      setMessage(isActive ? "Patrocinador reativado." : "Patrocinador inativado.");
    } catch {
      setError("Não foi possível alterar a situação do patrocinador.");
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
    <main className="min-h-svh bg-background px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Encontro de Coros · Administração
            </p>
            <h1 className="mt-2 font-display text-2xl">Patrocinadores</h1>
          </div>
          {gate === "authorized" && (
            <Button size="sm" variant="outline" onClick={logout}>
              Sair
            </Button>
          )}
        </header>

        {gate === "authorized" && <AdminNavigation current="sponsors" navigateTo={navigateTo} />}
        <div aria-live="polite" className="text-sm text-muted-foreground">
          {message}
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {gate === "checking" && <Skeleton className="h-40 w-full" />}
        {gate === "forbidden" && <p role="alert">Acesso não autorizado.</p>}
        {gate === "error" && <p role="alert">Não foi possível verificar seu acesso.</p>}
        {gate === "authorized" && loading && <Skeleton className="h-64 w-full" />}
        {gate === "authorized" && !loading && sponsors && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl">Logos dos patrocinadores</h2>
                <p className="text-sm text-muted-foreground">
                  Somente os patrocinadores ativos aparecem na página inicial.
                </p>
              </div>
              <Button onClick={openCreate}>Cadastrar patrocinador</Button>
            </div>

            {sponsors.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-sm">
                  Nenhum patrocinador cadastrado.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {sponsors.map((sponsor) => (
                  <Card key={sponsor.id}>
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="flex size-24 shrink-0 items-center justify-center rounded-xl border bg-white p-3">
                        <img
                          src={sponsor.logoUrl}
                          alt={sponsor.name}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{sponsor.name}</h3>
                          <Badge variant={sponsor.isActive ? "default" : "secondary"}>
                            {sponsor.isActive ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(sponsor)}>
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={saving}
                            onClick={() => {
                              if (sponsor.isActive) setPendingInactivation(sponsor);
                              else void changeActive(sponsor, true);
                            }}
                          >
                            {sponsor.isActive ? "Inativar" : "Reativar"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar patrocinador" : "Cadastrar patrocinador"}</DialogTitle>
            <DialogDescription>
              Informe o nome e envie uma logo em PNG, JPEG ou WebP de até 5 MB.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitSponsor} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="sponsor-name">Nome do patrocinador</Label>
              <Input
                id="sponsor-name"
                required
                maxLength={120}
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sponsor-logo">Logo do patrocinador</Label>
              <Input
                id="sponsor-logo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                aria-required={!editing}
                disabled={saving}
                onChange={(event) => void selectLogo(event)}
              />
              {editing && !logo && (
                <p className="text-xs text-muted-foreground">
                  Deixe sem novo arquivo para manter a logo atual.
                </p>
              )}
            </div>
            {(logo?.previewUrl || editing?.logoUrl) && (
              <div className="flex min-h-32 items-center justify-center rounded-xl border bg-white p-4">
                <img
                  src={logo?.previewUrl ?? editing?.logoUrl}
                  alt="Pré-visualização da logo"
                  className="max-h-28 max-w-full object-contain"
                />
              </div>
            )}
            {dialogError && (
              <p role="alert" className="text-sm text-destructive">
                {dialogError}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando…" : "Salvar patrocinador"}
              </Button>
            </DialogFooter>
          </form>
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
            <AlertDialogTitle>Inativar este patrocinador?</AlertDialogTitle>
            <AlertDialogDescription>
              Ele deixará de aparecer na página inicial, mas permanecerá cadastrado.
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
