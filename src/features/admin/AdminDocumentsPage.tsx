import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { ExternalLink, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { PdfCoverPreview } from "@/components/PdfCoverPreview";

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
import {
  MAX_EVENT_DOCUMENT_BYTES,
  type EventDocument,
  type EventDocumentCreate,
  type EventDocumentUpdate,
} from "@/features/event-documents/eventDocument.domain";
import { supabase } from "@/integrations/supabase/client";
import {
  createAdminEventDocument,
  deleteAdminEventDocument,
  getAdminEventDocumentBootstrap,
  getAdminEventDocumentUrl,
  updateAdminEventDocument,
  type AdminEventDocumentBootstrap,
} from "@/lib/event-document.functions";

import { AdminNavigation, type AdminNavigationPath } from "./AdminNavigation";

type Mutation<TInput, TResult> = (input: { data: TInput }) => Promise<TResult>;

export type AdminDocumentsPageProps = {
  loadBootstrap?: () => Promise<AdminEventDocumentBootstrap>;
  createDocument?: Mutation<EventDocumentCreate, EventDocument>;
  updateDocument?: Mutation<EventDocumentUpdate, EventDocument>;
  deleteDocument?: Mutation<{ id: string }, { cleanupPending: boolean }>;
  getDocumentUrl?: Mutation<{ id: string }, { signedUrl: string; expiresIn: number }>;
  getSession?: () => Promise<{ data: { session: unknown | null }; error: unknown }>;
  openUrl?: (url: string) => void;
  onMissingSession: () => void;
  navigateTo?: (to: AdminNavigationPath) => void;
};

type Gate = "checking" | "authorized" | "error";
type FileDraft = EventDocumentCreate["file"];

const defaultGetSession = () => supabase.auth.getSession();

function defaultOpenUrl(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

function readPdf(file: File): Promise<FileDraft> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo PDF."));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const separator = result.indexOf(",");
      if (separator < 0) {
        reject(new Error("Não foi possível ler o arquivo PDF."));
        return;
      }
      resolve({
        base64: result.slice(separator + 1),
        mimeType: "application/pdf",
        fileName: file.name,
      });
    };
    reader.readAsDataURL(file);
  });
}

export function AdminDocumentsPage({
  loadBootstrap = getAdminEventDocumentBootstrap,
  createDocument = createAdminEventDocument,
  updateDocument = updateAdminEventDocument,
  deleteDocument = deleteAdminEventDocument,
  getDocumentUrl = getAdminEventDocumentUrl,
  getSession = defaultGetSession,
  openUrl = defaultOpenUrl,
  onMissingSession,
  navigateTo,
}: AdminDocumentsPageProps) {
  const [gate, setGate] = useState<Gate>("checking");
  const [data, setData] = useState<AdminEventDocumentBootstrap | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EventDocument | null>(null);
  const [pendingDelete, setPendingDelete] = useState<EventDocument | null>(null);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<FileDraft | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const session = await getSession();
        if (!active) return;
        if (session.error || !session.data.session) {
          onMissingSession();
          return;
        }
        const loaded = await loadBootstrap();
        if (!active) return;
        setData(loaded);
        setGate("authorized");
      } catch {
        if (active) {
          setError("Não foi possível carregar os documentos.");
          setGate("error");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [getSession, loadBootstrap, onMissingSession]);

  const openCreate = () => {
    setEditing(null);
    setTitle("");
    setFile(null);
    setDialogError("");
    setDialogOpen(true);
  };

  const openEdit = (document: EventDocument) => {
    setEditing(document);
    setTitle(document.title);
    setFile(null);
    setDialogError("");
    setDialogOpen(true);
  };

  const selectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setDialogError("");
    setFile(null);
    if (selected.type !== "application/pdf" || !selected.name.toLowerCase().endsWith(".pdf")) {
      setDialogError("Envie um arquivo no formato PDF.");
      return;
    }
    if (selected.size > MAX_EVENT_DOCUMENT_BYTES) {
      setDialogError("O documento deve ter no máximo 10 MB.");
      return;
    }
    try {
      setFile(await readPdf(selected));
    } catch (caught) {
      setDialogError(caught instanceof Error ? caught.message : "Não foi possível ler o PDF.");
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing && !file) {
      setDialogError("Selecione o arquivo PDF.");
      return;
    }
    setSaving(true);
    setDialogError("");
    setMessage("");
    try {
      const saved = editing
        ? await updateDocument({
            data: {
              id: editing.id,
              title,
              ...(file ? { file } : {}),
            },
          })
        : await createDocument({ data: { title, file: file! } });
      setData((previous) =>
        previous
          ? {
              ...previous,
              documents: [
                saved,
                ...previous.documents.filter((document) => document.id !== saved.id),
              ],
            }
          : previous,
      );
      setDialogOpen(false);
      setMessage(editing ? "Documento atualizado." : "Documento cadastrado.");
    } catch (caught) {
      setDialogError(
        caught instanceof Error && caught.message
          ? caught.message
          : "Não foi possível salvar o documento.",
      );
    } finally {
      setSaving(false);
    }
  };

  const openDocument = async (document: EventDocument) => {
    setBusyId(document.id);
    setError("");
    try {
      const { signedUrl } = await getDocumentUrl({ data: { id: document.id } });
      openUrl(signedUrl);
    } catch {
      setError("Não foi possível abrir o documento.");
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const document = pendingDelete;
    setPendingDelete(null);
    setBusyId(document.id);
    setError("");
    setMessage("");
    try {
      const result = await deleteDocument({ data: { id: document.id } });
      setData((previous) =>
        previous
          ? {
              ...previous,
              documents: previous.documents.filter((item) => item.id !== document.id),
            }
          : previous,
      );
      setMessage(
        result.cleanupPending
          ? "Documento excluído. A limpeza do arquivo privado ficou pendente."
          : "Documento excluído.",
      );
    } catch {
      setError("Não foi possível excluir o documento.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="internal-app min-h-svh bg-[#f7f7f5] px-4 pb-24 pt-20 sm:px-6 md:pl-[calc(15rem+1.5rem)] md:pr-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Encontro de Coros · Administração
          </p>
          <h1 className="mt-2 font-display text-2xl">Documentos</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Publique documentos em PDF para os participantes.
          </p>
        </header>

        {gate === "authorized" && <AdminNavigation current="documents" navigateTo={navigateTo} />}
        <div aria-live="polite" className="text-sm font-medium text-emerald-700">
          {message}
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {gate === "checking" && <Skeleton className="h-64 w-full" />}
        {gate === "error" && <p role="alert">Não foi possível verificar seu acesso.</p>}

        {gate === "authorized" && data && (
          <section className="space-y-4" aria-labelledby="document-list-title">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="document-list-title" className="font-display text-xl">
                  Materiais publicados
                </h2>
                <p className="text-sm text-muted-foreground">
                  Envie um PDF e informe o nome do documento.
                </p>
              </div>
              <Button onClick={openCreate}>
                <Plus aria-hidden="true" />
                Cadastrar documento
              </Button>
            </div>

            {data.documents.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  Nenhum documento cadastrado.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {data.documents.map((document) => (
                  <Card key={document.id}>
                    <CardContent className="flex h-full flex-col gap-4 p-4">
                      <PdfCoverPreview
                        sourceKey={`${document.id}:${document.storagePath}:${document.updatedAt}`}
                        title={document.title}
                        getUrl={async () =>
                          (await getDocumentUrl({ data: { id: document.id } })).signedUrl
                        }
                      />
                      <div className="flex gap-3">
                        <div className="min-w-0">
                          <h3 className="font-semibold leading-tight">{document.title}</h3>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatBytes(document.sizeBytes)}</span>
                        <span className="truncate">{document.originalFileName}</span>
                      </div>
                      <div className="mt-auto flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          aria-label={`Abrir ${document.title}`}
                          disabled={busyId === document.id}
                          onClick={() => void openDocument(document)}
                        >
                          {busyId === document.id ? (
                            <LoaderCircle className="animate-spin" aria-hidden="true" />
                          ) : (
                            <ExternalLink aria-hidden="true" />
                          )}
                          Abrir
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          aria-label={`Editar ${document.title}`}
                          onClick={() => openEdit(document)}
                        >
                          <Pencil aria-hidden="true" />
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          aria-label={`Excluir ${document.title}`}
                          disabled={busyId === document.id}
                          onClick={() => setPendingDelete(document)}
                        >
                          <Trash2 aria-hidden="true" />
                          Excluir
                        </Button>
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
            <DialogTitle>{editing ? "Editar documento" : "Cadastrar documento"}</DialogTitle>
            <DialogDescription>
              PDFs de até 10 MB. Para substituir o arquivo, selecione uma nova versão.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="document-title">Nome</Label>
              <Input
                id="document-title"
                required
                maxLength={160}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="document-file">Arquivo PDF</Label>
              <Input
                id="document-file"
                type="file"
                accept="application/pdf,.pdf"
                aria-required={!editing}
                disabled={saving}
                onChange={(event) => void selectFile(event)}
              />
              {editing && !file && (
                <p className="text-xs text-muted-foreground">
                  O arquivo atual será mantido se nenhum novo PDF for selecionado.
                </p>
              )}
            </div>
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
                {saving ? "Salvando…" : "Salvar documento"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este documento?</AlertDialogTitle>
            <AlertDialogDescription>
              O PDF deixará de aparecer para os participantes e será removido do armazenamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()}>
              Excluir documento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
