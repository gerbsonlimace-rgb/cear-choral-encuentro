import { Eye, EyeOff } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getParticipantAccess } from "@/lib/participant.functions";

import type { ParticipantAccess } from "./participant-auth.server";

type Props = {
  onAuthorized: () => void;
  signIn?: (credentials: { email: string; password: string }) => Promise<{ error: unknown }>;
  checkAccess?: () => Promise<ParticipantAccess>;
  signOut?: () => Promise<{ error: unknown }>;
};

const defaultSignIn: NonNullable<Props["signIn"]> = (credentials) =>
  supabase.auth.signInWithPassword(credentials);
const defaultSignOut: NonNullable<Props["signOut"]> = () => supabase.auth.signOut();

export function ParticipantLoginPage({
  onAuthorized,
  signIn = defaultSignIn,
  checkAccess = getParticipantAccess,
  signOut = defaultSignOut,
}: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);

  async function closeRejectedSession() {
    try {
      await signOut();
    } catch {
      // Keep the access response generic even if session cleanup fails.
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

      if (access.status === "authorized") {
        onAuthorized();
        return;
      }

      await closeRejectedSession();
      setError("Não foi possível acessar a área do participante.");
    } catch {
      setPassword("");
      if (signedIn) {
        await closeRejectedSession();
        setError("Não foi possível verificar seu acesso. Tente novamente.");
      } else {
        setError("Não foi possível entrar. Verifique seu e-mail e senha.");
      }
    } finally {
      busy.current = false;
      setPending(false);
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
            <h1 className="font-display text-2xl">Área do participante</h1>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Acesse com o e-mail informado na inscrição.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="participant-email">E-mail</Label>
              <Input
                id="participant-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={pending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="participant-password">Senha</Label>
              <div className="relative">
                <Input
                  id="participant-password"
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
              <p className="text-xs leading-relaxed text-muted-foreground">
                Sua senha inicial é formada pelos 11 dígitos do CPF, sem pontos ou traços, seguidos
                da data de nascimento em DDMMAAAA.
              </p>
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
