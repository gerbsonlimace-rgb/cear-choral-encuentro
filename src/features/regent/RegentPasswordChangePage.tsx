import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { completeRegentPasswordChange } from "@/lib/regent.functions";

type Props = {
  onCompleted: () => void;
  updatePassword?: (attributes: { password: string }) => Promise<{ error: unknown }>;
  completeChange?: () => Promise<unknown>;
};

const defaultUpdatePassword: NonNullable<Props["updatePassword"]> = (attributes) =>
  supabase.auth.updateUser(attributes);

export function RegentPasswordChangePage({
  onCompleted,
  updatePassword = defaultUpdatePassword,
  completeChange = completeRegentPasswordChange,
}: Props) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [completionRetry, setCompletionRetry] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const changedPassword = useRef("");

  useEffect(
    () => () => {
      changedPassword.current = "";
    },
    [],
  );

  async function finishCompletion() {
    try {
      await completeChange();
      changedPassword.current = "";
      onCompleted();
      return true;
    } catch {
      setCompletionRetry(true);
      setError("Sua senha foi alterada, mas não foi possível liberar o acesso.");
      return false;
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    setError("");
    if (password.length < 8) {
      setError("Use pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setError("As senhas precisam ser iguais.");
      return;
    }

    busy.current = true;
    setPending(true);
    try {
      const result = await updatePassword({ password });
      if (result.error) throw result.error;
    } catch {
      setError("Não foi possível alterar a senha. Tente novamente.");
      busy.current = false;
      setPending(false);
      return;
    }

    changedPassword.current = password;
    setPassword("");
    setConfirmation("");
    await finishCompletion();
    busy.current = false;
    setPending(false);
  }

  async function retryCompletion() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    await finishCompletion();
    busy.current = false;
    setPending(false);
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-sm border-t-4 border-t-primary shadow-sm">
        <CardHeader className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Encontro de Coros Diocesanos
          </p>
          <CardTitle>
            <h1 className="font-display text-2xl">Crie uma nova senha</h1>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Para continuar, substitua a senha temporária por uma senha pessoal.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {completionRetry ? (
            <Button className="w-full" disabled={pending} onClick={retryCompletion}>
              {pending ? "Concluindo…" : "Tentar concluir novamente"}
            </Button>
          ) : (
            <form className="space-y-4" onSubmit={submit}>
              <div className="space-y-2">
                <Label htmlFor="regent-new-password">Nova senha</Label>
                <Input
                  id="regent-new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={pending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="regent-password-confirmation">Confirmar nova senha</Label>
                <Input
                  id="regent-password-confirmation"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  disabled={pending}
                />
              </div>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Alterando…" : "Alterar senha"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
