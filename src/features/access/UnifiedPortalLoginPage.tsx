import { Eye, EyeOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getUnifiedPortalAccess } from "@/lib/portal-access.functions";

import type { PortalDestination, UnifiedPortalAccess } from "./portal-access.domain";

type Props = {
  onAuthorized: (destination: PortalDestination) => void;
  signIn?: (credentials: { email: string; password: string }) => Promise<{ error: unknown }>;
  checkAccess?: () => Promise<UnifiedPortalAccess>;
  signOut?: () => Promise<{ error: unknown }>;
  getSession?: () => Promise<{ data: { session: unknown | null }; error: unknown }>;
};

type CurrentOperation = {
  cancelled: boolean;
};

type StartupGate = {
  promise: Promise<boolean>;
  resolve: (authorized: boolean) => void;
};

const defaultSignIn: NonNullable<Props["signIn"]> = (credentials) =>
  supabase.auth.signInWithPassword(credentials);
const defaultCheckAccess = getUnifiedPortalAccess;
const defaultSignOut: NonNullable<Props["signOut"]> = () => supabase.auth.signOut();
const defaultGetSession: NonNullable<Props["getSession"]> = () => supabase.auth.getSession();

export function UnifiedPortalLoginPage({
  onAuthorized,
  signIn = defaultSignIn,
  checkAccess = defaultCheckAccess,
  signOut = defaultSignOut,
  getSession = defaultGetSession,
}: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const currentSubmit = useRef<CurrentOperation | null>(null);
  const onAuthorizedRef = useRef(onAuthorized);
  const signOutRef = useRef(signOut);
  const startupGetSession = useRef(getSession);
  const startupCheckAccess = useRef(checkAccess);
  const startupSession = useRef<ReturnType<NonNullable<Props["getSession"]>> | null>(null);
  const startupGate = useRef<StartupGate | null>(null);

  onAuthorizedRef.current = onAuthorized;
  signOutRef.current = signOut;

  if (!startupGate.current) {
    let resolve!: (authorized: boolean) => void;
    const promise = new Promise<boolean>((accept) => {
      resolve = accept;
    });
    startupGate.current = { promise, resolve };
  }

  const closeRejectedSession = useCallback(async () => {
    try {
      await signOutRef.current();
    } catch {
      // The public response remains generic even if cleanup fails.
    }
  }, []);

  const routeAuthorizedAccess = useCallback(
    async (access: UnifiedPortalAccess, isCurrent: () => boolean) => {
      if (!isCurrent()) return false;
      if (access.status === "authorized") {
        onAuthorizedRef.current(access.destination);
        return true;
      }
      await closeRejectedSession();
      if (isCurrent()) setError("Não foi possível acessar o portal.");
      return false;
    },
    [closeRejectedSession],
  );

  useEffect(() => {
    let cancelled = false;
    const isCurrent = () => !cancelled;
    const gate = startupGate.current;
    if (!gate) return;

    async function resolveExistingSession(activeGate: StartupGate) {
      let sessionResult: Awaited<ReturnType<NonNullable<Props["getSession"]>>>;
      try {
        startupSession.current ??= Promise.resolve().then(() => startupGetSession.current());
        sessionResult = await startupSession.current;
      } catch {
        if (isCurrent()) activeGate.resolve(false);
        return;
      }
      if (!isCurrent()) return;
      if (sessionResult.error || !sessionResult.data.session) {
        activeGate.resolve(false);
        return;
      }

      try {
        const access = await startupCheckAccess.current();
        if (!isCurrent()) return;
        activeGate.resolve(await routeAuthorizedAccess(access, isCurrent));
      } catch {
        if (!isCurrent()) return;
        await closeRejectedSession();
        if (isCurrent()) {
          setError("Não foi possível verificar seu acesso. Tente novamente.");
          activeGate.resolve(false);
        }
      }
    }

    void resolveExistingSession(gate);
    return () => {
      cancelled = true;
      if (currentSubmit.current) currentSubmit.current.cancelled = true;
    };
  }, [closeRejectedSession, routeAuthorizedAccess]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current) return;

    busy.current = true;
    setPending(true);
    setError("");
    const operation = { cancelled: false };
    currentSubmit.current = operation;
    const isCurrent = () => currentSubmit.current === operation && !operation.cancelled;
    let signedIn = false;

    try {
      const existingSessionAuthorized = await startupGate.current?.promise;
      if (!isCurrent() || existingSessionAuthorized) return;
      setError("");

      const result = await signIn({ email: email.trim(), password });
      if (!isCurrent()) return;
      setPassword("");
      if (result.error) throw result.error;

      signedIn = true;
      const access = await checkAccess();
      if (!isCurrent()) return;
      await routeAuthorizedAccess(access, isCurrent);
    } catch {
      if (!isCurrent()) return;
      setPassword("");
      if (signedIn) {
        await closeRejectedSession();
        if (!isCurrent()) return;
        setError("Não foi possível verificar seu acesso. Tente novamente.");
      } else {
        setError("Não foi possível entrar. Verifique seu e-mail e senha.");
      }
    } finally {
      busy.current = false;
      if (isCurrent()) {
        currentSubmit.current = null;
        setPending(false);
      }
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md border-t-4 border-t-primary shadow-sm">
        <CardHeader className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            II Encontro de Coros Diocesanos e Litúrgicos do Regional Nordeste 1 - CNBB
          </p>
          <CardTitle>
            <h1 className="font-display text-2xl">Acessar portal</h1>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="portal-email">E-mail</Label>
              <Input
                id="portal-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={pending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="portal-password">Senha</Label>
              <div className="relative">
                <Input
                  id="portal-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={pending}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                  disabled={pending}
                >
                  {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </Button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Entrando…" : "Entrar"}
            </Button>
          </form>
          <a
            href="/"
            className="inline-block text-sm text-muted-foreground underline underline-offset-4"
          >
            Voltar ao evento
          </a>
        </CardContent>
      </Card>
    </main>
  );
}
