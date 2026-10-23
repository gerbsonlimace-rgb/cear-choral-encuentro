import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  linkExistingAdminRegent,
  listAdminRegents,
  replaceAdminRegentWithExistingUser,
  resetAdminRegentPassword,
  revokeAdminRegent,
  searchAdminRegentCandidates,
} from "@/lib/regent.functions";
import { regentMutationSchema, type RegentMutation } from "@/features/regent/regent.domain";
import type {
  AdminRegentRow,
  RegentAdminResult,
  RegentCandidateUser,
} from "@/features/regent/regent-admin.server";

type Mutation<T> = (input: { data: T }) => Promise<RegentAdminResult>;
export type AdminRegentsPanelProps = {
  choirs: { id: string; name: string }[];
  choirId?: string;
  loadRegents?: () => Promise<AdminRegentRow[]>;
  searchCandidates?: (input: { data: { query: string } }) => Promise<RegentCandidateUser[]>;
  linkExistingRegent?: Mutation<RegentMutation>;
  replaceExistingRegent?: Mutation<RegentMutation>;
  revokeRegent?: Mutation<{ id: string }>;
  resetPassword?: Mutation<{ id: string; password: string }>;
};
const emptyDraft: RegentMutation = { choirId: "", name: "", email: "" };
type Confirmation =
  | { kind: "revoke"; regent: AdminRegentRow }
  | { kind: "replace"; regent: AdminRegentRow; draft: RegentMutation };

export function AdminRegentsPanel({
  choirs,
  choirId,
  loadRegents = listAdminRegents,
  searchCandidates = searchAdminRegentCandidates,
  linkExistingRegent = linkExistingAdminRegent,
  replaceExistingRegent = replaceAdminRegentWithExistingUser,
  revokeRegent = revokeAdminRegent,
  resetPassword = resetAdminRegentPassword,
}: AdminRegentsPanelProps) {
  const [regents, setRegents] = useState<AdminRegentRow[]>([]);
  const [draft, setDraft] = useState({ ...emptyDraft, choirId: choirId ?? "" });
  const [selectedCandidate, setSelectedCandidate] = useState<RegentCandidateUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [resetting, setResetting] = useState<AdminRegentRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [candidateQuery, setCandidateQuery] = useState("");
  const [candidates, setCandidates] = useState<RegentCandidateUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRegents(await loadRegents());
    } catch {
      setError("Não foi possível carregar os regentes.");
    } finally {
      setLoading(false);
    }
  }, [loadRegents]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (choirId) setDraft((current) => ({ ...current, choirId }));
  }, [choirId]);
  useEffect(() => {
    const query = candidateQuery.trim();
    if (query.length < 2) {
      setCandidates([]);
      setSearchError("");
      setSearching(false);
      return;
    }
    setSearching(true);
    let disposed = false;
    const timer = setTimeout(() => {
      setCandidates([]);
      setSearchError("");
      searchCandidates({ data: { query } })
        .then((rows) => { if (!disposed) setCandidates(rows); })
        .catch(() => { if (!disposed) setSearchError("Não foi possível buscar regentes."); })
        .finally(() => { if (!disposed) setSearching(false); });
    }, 300);
    return () => { disposed = true; clearTimeout(timer); };
  }, [candidateQuery, searchCandidates]);
  function useCandidate(found: RegentCandidateUser) {
    setDraft((current) => ({ ...current, name: found.name, email: found.email }));
    setSelectedCandidate(found);
    setCandidates([]);
    setMessage("Regente selecionado. Confirme o coro e clique em Vincular regente.");
  }
  const visibleRegents = choirId ? regents.filter((regent) => regent.choirId === choirId) : regents;

  async function mutate(
    operation: () => Promise<RegentAdminResult>,
    onSuccess: (row: AdminRegentRow) => void,
    forReset = false,
  ) {
    setBusy(true);
    setError("");
    setResetError("");
    setMessage("");
    try {
      const result = await operation();
      if (result.status !== "success") {
        if (forReset) setResetError(result.message);
        else setError(result.message);
        return;
      }
      onSuccess(result.regent);
      setMessage("Operação concluída.");
    } catch {
      const message = "Não foi possível concluir a operação. Tente novamente.";
      if (forReset) setResetError(message);
      else setError(message);
    } finally {
      setBusy(false);
    }
  }
  function validateIdentity() {
    const parsed = regentMutationSchema.safeParse(draft);
    if (!parsed.success) {
      setError(
        parsed.error.issues[0].message,
      );
      return null;
    }
    return parsed.data;
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const onSuccess = (regent: AdminRegentRow) => {
      setRegents((rows) => [...rows, regent]);
      setDraft({ ...emptyDraft, choirId: choirId ?? "" });
      setSelectedCandidate(null);
      setCandidateQuery("");
    };
    if (!selectedCandidate || selectedCandidate.email !== draft.email || selectedCandidate.name !== draft.name) {
      setError("Busque e selecione um regente já cadastrado.");
      return;
    }
    const data = validateIdentity();
    if (data) void mutate(() => linkExistingRegent({ data }), onSuccess);
  }
  function askReplacement(regent: AdminRegentRow) {
    // Replacement always keeps the selected row's choir; the entered identity is the new user.
    if (draft.choirId !== regent.choirId) {
      setDraft((value) => ({ ...value, choirId: regent.choirId }));
      setError("Confirme este coro e clique em Substituir novamente.");
      return;
    }
    if (!selectedCandidate || selectedCandidate.email !== draft.email || selectedCandidate.name !== draft.name) {
      setError("Busque e selecione um regente já cadastrado.");
      return;
    }
    const data = validateIdentity();
    if (data) setConfirmation({ kind: "replace", regent, draft: data });
  }
  function confirm() {
    if (!confirmation) return;
    const action = confirmation;
    setConfirmation(null);
    if (action.kind === "revoke") {
      void mutate(
        () => revokeRegent({ data: { id: action.regent.id } }),
        (regent) => setRegents((rows) => rows.map((row) => (row.id === regent.id ? regent : row))),
      );
    } else {
      void mutate(
        () => replaceExistingRegent({ data: action.draft }),
        (regent) => {
          setRegents((rows) => [
            ...rows.filter((row) => row.choirId !== regent.choirId || row.revokedAt !== null),
            { ...action.regent, revokedAt: new Date().toISOString() },
            regent,
          ]);
          setDraft({ ...emptyDraft, choirId: choirId ?? "" });
          setSelectedCandidate(null);
          setCandidateQuery("");
        },
      );
    }
  }
  return (
    <section
      aria-labelledby="regents-heading"
      className="space-y-4 rounded-xl border bg-card p-4 sm:p-6"
    >
      <div>
        <h2 id="regents-heading" className="font-display text-xl">
          Regentes
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Busque pelo nome ou e-mail de um regente já cadastrado. O vínculo usa a senha que ele já possui.
        </p>
      </div>
      <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="regent-user-search">Buscar regente existente</Label>
            <Input
              id="regent-user-search"
              type="search"
              placeholder="Nome ou e-mail do regente"
              maxLength={100}
              autoComplete="off"
              value={candidateQuery}
              onChange={(event) => {
                setCandidateQuery(event.target.value);
                setSelectedCandidate(null);
                setDraft((current) => ({ ...current, name: "", email: "" }));
              }}
            />
            {searching && (
              <p role="status" className="text-xs text-muted-foreground">
                Buscando…
              </p>
            )}
            {searchError && (
              <p role="alert" className="text-xs text-destructive">
                {searchError}
              </p>
            )}
            {!searching && !searchError && candidateQuery.trim().length >= 2 && candidates.length === 0 && !selectedCandidate && (
              <p className="text-xs text-muted-foreground">Nenhum regente cadastrado encontrado.</p>
            )}
            {candidates.length > 0 && (
              <ul aria-label="Regentes encontrados" className="space-y-1">
                {candidates.map((found) => (
                  <li key={found.userId}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-auto w-full justify-start py-2 text-left"
                      onClick={() => useCandidate(found)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{found.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {found.email}
                        </span>
                      </span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="regent-name">Nome</Label>
            <Input
              id="regent-name"
              required
              maxLength={120}
              value={draft.name}
              readOnly
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="regent-email">E-mail</Label>
            <Input
              id="regent-email"
              type="email"
              required
              maxLength={254}
              autoComplete="off"
              value={draft.email}
              readOnly
            />
          </div>
          {choirId ? (
            <div className="space-y-1">
              <p className="text-sm font-medium">Coro</p>
              <p className="flex h-9 items-center rounded-md bg-muted px-3 text-sm">
                {choirs.find((choir) => choir.id === choirId)?.name ?? "Coro selecionado"}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
            <Label htmlFor="regent-choir">Coro</Label>
            <select
              id="regent-choir"
              required
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={draft.choirId}
              onChange={(event) => setDraft({ ...draft, choirId: event.target.value })}
            >
              <option value="">Selecione um coro</option>
              {choirs.map((choir) => (
                <option key={choir.id} value={choir.id}>
                  {choir.name}
                </option>
              ))}
            </select>
            </div>
          )}
        </fieldset>
        <Button type="submit" disabled={busy || loading || !choirs.length || !selectedCandidate}>
          Vincular regente
        </Button>
        <p className="text-xs text-muted-foreground">
          Para substituir, selecione outro regente na busca e use Substituir no vínculo atual.
        </p>
      </form>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <p aria-live="polite" className="text-sm">
        {message}
      </p>
      <Button variant="outline" size="sm" disabled={busy || loading} onClick={() => void load()}>
        Atualizar regentes
      </Button>
      {loading ? (
        <p role="status">Carregando regentes…</p>
      ) : !visibleRegents.length ? (
        <p className="text-sm">Nenhum regente cadastrado.</p>
      ) : (
        <div className="space-y-2">
          {visibleRegents.map((regent) => (
            <article
              key={regent.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0">
                <h3 className="font-semibold">{regent.name}</h3>
                <p className="break-all text-sm text-muted-foreground">{regent.email}</p>
                <p className="text-sm">
                  {choirs.find((choir) => choir.id === regent.choirId)?.name ?? "Coro indisponível"}{" "}
                  · <span>{regent.revokedAt ? "Inativo" : "Ativo"}</span>
                </p>
                {!regent.revokedAt && regent.passwordChangeRequired && (
                  <p className="text-xs text-muted-foreground">Troca de senha obrigatória</p>
                )}
              </div>
              {!regent.revokedAt && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => askReplacement(regent)}
                  >
                    Substituir
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => setConfirmation({ kind: "revoke", regent })}
                  >
                    Inativar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setResetting(regent);
                      setNewPassword("");
                      setResetError("");
                    }}
                  >
                    Redefinir senha
                  </Button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      <AlertDialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmation?.kind === "replace"
                ? "Substituir este regente?"
                : "Inativar este regente?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation?.regent.name} perderá o acesso ao coro. As inscrições e o histórico
              serão preservados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirm}>
              {confirmation?.kind === "replace" ? "Confirmar substituição" : "Confirmar inativação"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog
        open={resetting !== null}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setResetting(null);
            setNewPassword("");
            setResetError("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir senha de {resetting?.name}</DialogTitle>
            <DialogDescription>
              Entregue a nova senha temporária ao regente. Nenhum e-mail será enviado.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (resetting)
                void mutate(
                  () => resetPassword({ data: { id: resetting.id, password: newPassword } }),
                  (regent) => {
                    setRegents((rows) => rows.map((row) => (row.id === regent.id ? regent : row)));
                    setResetting(null);
                    setNewPassword("");
                  },
                  true,
                );
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="regent-reset-password">Nova senha temporária</Label>
              <Input
                id="regent-reset-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
                disabled={busy}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>
            {resetError && (
              <p role="alert" className="text-sm text-destructive">
                {resetError}
              </p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={busy}>
                Salvar senha
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
