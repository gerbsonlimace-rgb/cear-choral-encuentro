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
  createAdminRegent,
  listAdminRegents,
  replaceAdminRegent,
  resetAdminRegentPassword,
  revokeAdminRegent,
} from "@/lib/regent.functions";
import { regentMutationSchema } from "@/features/regent/regent.domain";
import type {
  AdminRegentRow,
  RegentAdminResult,
  RegentCreation,
} from "@/features/regent/regent-admin.server";

type Mutation<T> = (input: { data: T }) => Promise<RegentAdminResult>;
export type AdminRegentsPanelProps = {
  choirs: { id: string; name: string }[];
  loadRegents?: () => Promise<AdminRegentRow[]>;
  createRegent?: Mutation<RegentCreation>;
  replaceRegent?: Mutation<RegentCreation>;
  revokeRegent?: Mutation<{ id: string }>;
  resetPassword?: Mutation<{ id: string; password: string }>;
};
const emptyDraft: RegentCreation = { choirId: "", name: "", email: "", password: "" };
type Confirmation =
  | { kind: "revoke"; regent: AdminRegentRow }
  | { kind: "replace"; regent: AdminRegentRow; draft: RegentCreation };

export function AdminRegentsPanel({
  choirs,
  loadRegents = listAdminRegents,
  createRegent = createAdminRegent,
  replaceRegent = replaceAdminRegent,
  revokeRegent = revokeAdminRegent,
  resetPassword = resetAdminRegentPassword,
}: AdminRegentsPanelProps) {
  const [regents, setRegents] = useState<AdminRegentRow[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [resetting, setResetting] = useState<AdminRegentRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetError, setResetError] = useState("");
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
  function validateDraft() {
    const { password, ...identity } = draft;
    const parsed = regentMutationSchema.safeParse(identity);
    if (!parsed.success || password.length < 8 || password.length > 128) {
      setError(
        parsed.success
          ? "Use de 8 a 128 caracteres na senha temporária."
          : parsed.error.issues[0].message,
      );
      return null;
    }
    return { ...parsed.data, password };
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = validateDraft();
    if (!data) return;
    void mutate(
      () => createRegent({ data }),
      (regent) => {
        setRegents((rows) => [...rows, regent]);
        setDraft(emptyDraft);
      },
    );
  }
  function askReplacement(regent: AdminRegentRow) {
    // Replacement always keeps the selected row's choir; the entered identity is the new user.
    if (draft.choirId !== regent.choirId) {
      setDraft((value) => ({ ...value, choirId: regent.choirId }));
      setError("Preencha os dados do novo regente para este coro e clique em Substituir.");
      return;
    }
    const data = validateDraft();
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
        () => replaceRegent({ data: action.draft }),
        (regent) => {
          setRegents((rows) => [
            ...rows.filter((row) => row.choirId !== regent.choirId || row.revokedAt !== null),
            { ...action.regent, revokedAt: new Date().toISOString() },
            regent,
          ]);
          setDraft(emptyDraft);
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
          Nenhum e-mail será enviado. Entregue o acesso e a senha temporária ao regente por um canal
          seguro. A troca de senha será obrigatória no primeiro acesso.
        </p>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="regent-name">Nome</Label>
            <Input
              id="regent-name"
              required
              maxLength={120}
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
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
              onChange={(event) => setDraft({ ...draft, email: event.target.value })}
            />
          </div>
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
          <div className="space-y-1">
            <Label htmlFor="regent-password">Senha temporária</Label>
            <Input
              id="regent-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              value={draft.password}
              onChange={(event) => setDraft({ ...draft, password: event.target.value })}
            />
          </div>
        </fieldset>
        <Button type="submit" disabled={busy || loading || !choirs.length}>
          Cadastrar regente
        </Button>
        <p className="text-xs text-muted-foreground">
          Para substituir, preencha os dados do novo regente e use Substituir no vínculo atual.
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
      ) : !regents.length ? (
        <p className="text-sm">Nenhum regente cadastrado.</p>
      ) : (
        <div className="space-y-2">
          {regents.map((regent) => (
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
