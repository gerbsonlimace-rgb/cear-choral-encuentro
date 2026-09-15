import { useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { supabase } from "@/integrations/supabase/client";

type AuthResult = Promise<{ error: unknown }>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getSignedInEmail?: () => Promise<{ email: string | null; error: unknown }>;
  reauthenticate?: (credentials: { email: string; password: string }) => AuthResult;
  updatePassword?: (password: string) => AuthResult;
};

const defaultGetSignedInEmail: NonNullable<Props["getSignedInEmail"]> = async () => {
  const { data, error } = await supabase.auth.getUser();
  return { email: data.user?.email ?? null, error };
};
const defaultReauthenticate: NonNullable<Props["reauthenticate"]> = (credentials) =>
  supabase.auth.signInWithPassword(credentials);
const defaultUpdatePassword: NonNullable<Props["updatePassword"]> = async (password) =>
  supabase.auth.updateUser({ password });

function isInvalidCredentialsError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "invalid_credentials"
  );
}

export function ParticipantPasswordDialog({
  open,
  onOpenChange,
  getSignedInEmail = defaultGetSignedInEmail,
  reauthenticate = defaultReauthenticate,
  updatePassword = defaultUpdatePassword,
}: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);

  function clearSensitiveState() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmation("");
    setError("");
  }

  function changeOpen(nextOpen: boolean) {
    if (!nextOpen && busy.current) return;
    if (!nextOpen) clearSensitiveState();
    onOpenChange(nextOpen);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;

    if (!currentPassword) {
      setError("Informe sua senha atual.");
      return;
    }
    if (newPassword.length < 8) {
      setError("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmation) {
      setError("As novas senhas não coincidem.");
      return;
    }

    busy.current = true;
    setPending(true);
    setError("");

    try {
      const identity = await getSignedInEmail();
      if (identity.error || !identity.email) {
        setError("Não foi possível alterar a senha. Tente novamente.");
        return;
      }

      const reauthentication = await reauthenticate({
        email: identity.email,
        password: currentPassword,
      });
      if (reauthentication.error) {
        setError(
          isInvalidCredentialsError(reauthentication.error)
            ? "Senha atual incorreta."
            : "Não foi possível alterar a senha. Tente novamente.",
        );
        return;
      }

      const changed = await updatePassword(newPassword);
      if (changed.error) throw changed.error;
    } catch {
      setError("Não foi possível alterar a senha. Tente novamente.");
      return;
    } finally {
      busy.current = false;
      setPending(false);
    }

    clearSensitiveState();
    onOpenChange(false);
    toast.success("Senha alterada com sucesso.");
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="chorister-app rounded-2xl border-zinc-200 bg-white text-zinc-950">
        <DialogHeader>
          <DialogTitle>Alterar senha</DialogTitle>
          <DialogDescription>
            Confirme sua senha atual antes de escolher uma nova senha.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={submit}>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="participant-current-password">Senha atual</Label>
            <Input
              id="participant-current-password"
              type="password"
              className="min-h-11 bg-white text-base sm:text-sm"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="participant-new-password">Nova senha</Label>
            <Input
              id="participant-new-password"
              type="password"
              className="min-h-11 bg-white text-base sm:text-sm"
              autoComplete="new-password"
              required
              minLength={8}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="participant-password-confirmation">Confirmar nova senha</Label>
            <Input
              id="participant-password-confirmation"
              type="password"
              className="min-h-11 bg-white text-base sm:text-sm"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              disabled={pending}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => changeOpen(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Alterando…" : "Alterar senha"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
