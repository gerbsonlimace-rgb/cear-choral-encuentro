import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
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
  changePassword?: (
    password: string,
    operationToken: string,
  ) => Promise<RegentPasswordChangeResult>;
  completeChange?: (retryToken: string) => Promise<RegentPasswordChangeResult>;
  getEmail?: () => Promise<string>;
  signIn?: (email: string, password: string) => Promise<{ error: unknown }>;
};

type SessionRecovery = {
  email: string;
  password: string;
  operationToken: string;
  result?: RegentPasswordChangeResult;
};

const defaultChangePassword: NonNullable<Props["changePassword"]> = (password, operationToken) =>
  changeRegentPassword({ data: { password, operationToken } });
const defaultCompleteChange: NonNullable<Props["completeChange"]> = (retryToken) =>
  completeRegentPasswordChange({ data: { retryToken } });
const defaultGetEmail: NonNullable<Props["getEmail"]> = async () => {
  const { data } = await supabase.auth.getSession();
  const email = data.session?.user.email;
  if (!email) throw new Error("Session email unavailable");
  return email;
};
const defaultSignIn: NonNullable<Props["signIn"]> = async (email, password) => {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error };
};

function createOperationToken() {
  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(32)), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}

function isInvalidCredentials(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "invalid_credentials"
  );
}

export function RegentPasswordChangePage({
  onCompleted,
  onAuthorized,
  onLoginRequired,
  checkAccess = getRegentAccess,
  changePassword = defaultChangePassword,
  completeChange = defaultCompleteChange,
  getEmail = defaultGetEmail,
  signIn = defaultSignIn,
}: Props) {
  const [accessReady, setAccessReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [retryToken, setRetryToken] = useState("");
  const [sessionRecovery, setSessionRecovery] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const mounted = useRef(true);
  const recovery = useRef<SessionRecovery | null>(null);
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
      recovery.current = null;
    };
  }, [checkAccess]);

  function requireCompletion(operationToken: string) {
    recovery.current = null;
    setSessionRecovery(false);
    setRetryToken(operationToken);
    setError("Sua senha foi alterada, mas não foi possível liberar o acesso.");
  }

  async function completeRecoveredOperation(operationToken: string) {
    try {
      const result = await completeChange(operationToken);
      if (!mounted.current) return;
      if (result.status !== "success") throw new Error("Password completion remained pending");
      recovery.current = null;
      onCompleted();
    } catch {
      if (mounted.current) requireCompletion(operationToken);
    }
  }

  async function applyRestoredResult(state: SessionRecovery) {
    if (state.result?.status === "success") {
      recovery.current = null;
      onCompleted();
      return;
    }
    if (state.result?.status === "completion_required") {
      requireCompletion(state.operationToken);
      return;
    }
    await completeRecoveredOperation(state.operationToken);
  }

  async function restoreSession(state: SessionRecovery, allowReplay: boolean) {
    let restored: { error: unknown };
    try {
      restored = await signIn(state.email, state.password);
    } catch (error) {
      restored = { error };
    }
    if (!mounted.current) return;

    if (restored.error && allowReplay && !state.result && isInvalidCredentials(restored.error)) {
      try {
        state.result = await changePassword(state.password, state.operationToken);
      } catch {
        state.result = undefined;
      }
      if (!mounted.current) return;
      try {
        restored = await signIn(state.email, state.password);
      } catch (error) {
        restored = { error };
      }
      if (!mounted.current) return;
    }

    if (restored.error) {
      recovery.current = state;
      setSessionRecovery(true);
      setRetryToken("");
      setError("Não foi possível alterar a senha. Tente novamente.");
      return;
    }

    setSessionRecovery(false);
    await applyRestoredResult(state);
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
    const operationToken = createOperationToken();
    try {
      const email = await getEmail();
      if (!mounted.current) return;
      const state: SessionRecovery = { email, password, operationToken };
      try {
        state.result = await changePassword(password, operationToken);
      } catch {
        // The browser cannot distinguish a rejected request from a response lost
        // after Auth committed. Restore the session first, then use the exact
        // operation token for idempotent recovery.
      }
      if (!mounted.current) return;
      setPassword("");
      setConfirmation("");
      recovery.current = state;
      await restoreSession(state, false);
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
      const result = await completeChange(retryToken);
      if (!mounted.current) return;
      if (result.status !== "success") throw new Error("Password completion remained pending");
      setRetryToken("");
      onCompleted();
    } catch {
      if (mounted.current) {
        setError("Sua senha foi alterada, mas não foi possível liberar o acesso.");
      }
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  }

  async function retrySessionRecovery() {
    if (busy.current || !recovery.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      await restoreSession(recovery.current, true);
    } catch {
      if (mounted.current) {
        setSessionRecovery(true);
        setError("Não foi possível alterar a senha. Tente novamente.");
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
          {sessionRecovery ? (
            <Button className="w-full" disabled={pending} onClick={retrySessionRecovery}>
              {pending ? "Restaurando…" : "Tentar restaurar acesso"}
            </Button>
          ) : retryToken ? (
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
