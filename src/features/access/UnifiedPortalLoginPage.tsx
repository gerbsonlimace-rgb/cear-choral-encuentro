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
  const mounted = useRef(true);

  const closeRejectedSession = useCallback(async () => {
    try {
      await signOut();
    } catch {
      // The public response remains generic even if cleanup fails.
    }
  }, [signOut]);

  const routeAuthorizedAccess = useCallback(
    async (access: UnifiedPortalAccess) => {
      if (!mounted.current) return false;
      if (access.status === "authorized") {
        onAuthorized(access.destination);
        return true;
      }
      await closeRejectedSession();
      if (mounted.current) setError("Não foi possível acessar o portal.");
      return false;
    },
    [closeRejectedSession, onAuthorized],
  );

  useEffect(() => {
    mounted.current = true;

    async function resolveExistingSession() {
      let sessionResult: Awaited<ReturnType<NonNullable<Props["getSession"]>>>;
      try {
        sessionResult = await getSession();
      } catch {
        return;
      }
      if (!mounted.current || sessionResult.error || !sessionResult.data.session) return;

      try {
        const access = await checkAccess();
        if (!mounted.current) return;
        await routeAuthorizedAccess(access);
      } catch {
        if (!mounted.current) return;
        await closeRejectedSession();
        if (mounted.current) {
          setError("Não foi possível verificar seu acesso. Tente novamente.");
        }
      }
    }

    void resolveExistingSession();
    return () => {
      mounted.current = false;
    };
  }, [checkAccess, closeRejectedSession, getSession, routeAuthorizedAccess]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current) return;

    busy.current = true;
    setPending(true);
    setError("");
    let signedIn = false;

    try {
      const result = await signIn({ email: email.trim(), password });
      if (!mounted.current) return;
      setPassword("");
      if (result.error) throw result.error;

      signedIn = true;
      const access = await checkAccess();
      if (!mounted.current) return;
      await routeAuthorizedAccess(access);
    } catch {
      if (!mounted.current) return;
      setPassword("");
      if (signedIn) {
        await closeRejectedSession();
        if (!mounted.current) return;
        setError("Não foi possível verificar seu acesso. Tente novamente.");
      } else {
        setError("Não foi possível entrar. Verifique seu e-mail e senha.");
      }
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
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
