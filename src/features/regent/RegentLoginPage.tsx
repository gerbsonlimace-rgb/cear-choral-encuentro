import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getRegentAccess } from "@/lib/regent.functions";
import type { RegentAccess } from "./regent.domain";

type Props = {
  onPasswordChangeRequired: () => void;
  onAuthorized: () => void;
  signIn?: (credentials: { email: string; password: string }) => Promise<{ error: unknown }>;
  checkAccess?: () => Promise<RegentAccess>;
  signOut?: () => Promise<{ error: unknown }>;
};

const defaultSignIn: NonNullable<Props["signIn"]> = (credentials) =>
  supabase.auth.signInWithPassword(credentials);
const defaultSignOut: NonNullable<Props["signOut"]> = () => supabase.auth.signOut();

export function RegentLoginPage({
  onPasswordChangeRequired,
  onAuthorized,
  signIn = defaultSignIn,
  checkAccess = getRegentAccess,
  signOut = defaultSignOut,
}: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);

  async function closeUnauthorizedSession() {
    try {
      await signOut();
    } catch {
      // The access response remains generic even if session cleanup fails.
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    let signedIn = false;
    try {
      const result = await signIn({ email: email.trim(), password });
      if (result.error) throw result.error;
      signedIn = true;
      setPassword("");

      const access = await checkAccess();
      if (access.status === "password_change_required") {
        onPasswordChangeRequired();
        return;
      }
      if (access.status === "authorized") {
        onAuthorized();
        return;
      }

      await closeUnauthorizedSession();
      setError("Acesso não autorizado.");
    } catch {
      if (signedIn) {
        setPassword("");
        await closeUnauthorizedSession();
        setError("Não foi possível verificar seu acesso. Tente novamente.");
      } else {
        setError("Não foi possível entrar. Verifique suas credenciais.");
      }
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-sm border-t-4 border-t-primary shadow-sm">
        <CardHeader className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Encontro de Coros Diocesanos
          </p>
          <CardTitle>
            <h1 className="font-display text-2xl">Área do regente</h1>
          </CardTitle>
          <p className="text-sm text-muted-foreground">Acesse com o e-mail do seu cadastro.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="regent-email">E-mail</Label>
              <Input
                id="regent-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={pending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="regent-password">Senha</Label>
              <Input
                id="regent-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={pending}
              />
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
