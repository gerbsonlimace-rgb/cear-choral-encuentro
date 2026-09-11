import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  changeRegentPassword,
  completeRegentPasswordChange,
  getRegentAccess,
  type RegentPasswordChangeResult,
} from "@/lib/regent.functions";
import type { RegentAccess } from "./regent.domain";

type Props = {
  onCompleted: () => void;
  onAuthorized: () => void;
  onLoginRequired: () => void;
  checkAccess?: () => Promise<RegentAccess>;
  changePassword?: (password: string) => Promise<RegentPasswordChangeResult>;
  completeChange?: (retryToken: string) => Promise<unknown>;
};

const defaultChangePassword: NonNullable<Props["changePassword"]> = (password) =>
  changeRegentPassword({ data: { password } });
const defaultCompleteChange: NonNullable<Props["completeChange"]> = (retryToken) =>
  completeRegentPasswordChange({ data: { retryToken } });

export function RegentPasswordChangePage({
  onCompleted,
  onAuthorized,
  onLoginRequired,
  checkAccess = getRegentAccess,
  changePassword = defaultChangePassword,
  completeChange = defaultCompleteChange,
}: Props) {
  const [accessReady, setAccessReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [retryToken, setRetryToken] = useState("");
  const [error, setError] = useState("");
  const busy = useRef(false);
  const mounted = useRef(true);
  const callbacks = useRef({ onAuthorized, onLoginRequired });
  callbacks.current = { onAuthorized, onLoginRequired };

  useEffect(() => {
    let active = true;
    mounted.current = true;
    void checkAccess()
      .then((access) => {
        if (!active) return;
        if (access.status === "password_change_required") {
          setAccessReady(true);
        } else if (access.status === "authorized") {
          callbacks.current.onAuthorized();
        } else {
          callbacks.current.onLoginRequired();
        }
      })
      .catch(() => {
        if (active) callbacks.current.onLoginRequired();
      });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [checkAccess]);

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
      const result = await changePassword(password);
      if (!mounted.current) return;
      setPassword("");
      setConfirmation("");
      if (result.status === "success") {
        onCompleted();
      } else {
        setRetryToken(result.retryToken);
        setError("Sua senha foi alterada, mas não foi possível liberar o acesso.");
      }
    } catch {
      if (mounted.current) setError("Não foi possível alterar a senha. Tente novamente.");
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  }

  async function retryCompletion() {
    if (busy.current || !retryToken) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      await completeChange(retryToken);
      if (mounted.current) onCompleted();
    } catch {
      if (mounted.current) {
        setError("Sua senha foi alterada, mas não foi possível liberar o acesso.");
      }
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  }

  if (!accessReady) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
        <p className="text-sm text-muted-foreground">Verificando acesso…</p>
      </main>
    );
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
          {retryToken ? (
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
