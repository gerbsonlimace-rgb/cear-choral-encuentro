import {
  ArrowLeft,
  CalendarDays,
  Eye,
  EyeOff,
  LockKeyhole,
  LogIn,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import eventLogo from "@/assets/logo-coros-branco.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getUnifiedPortalAccess } from "@/lib/portal-access.functions";

import type { PortalDestination, UnifiedPortalAccess } from "./portal-access.domain";
import { MobileEventSplash } from "./MobileEventSplash";

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
    <main className="chorister-app relative isolate min-h-svh bg-white text-zinc-950">
      <MobileEventSplash />
      <div className="relative mx-auto grid min-h-svh w-full max-w-[88rem] items-center gap-10 px-4 py-5 sm:px-8 sm:py-8 lg:grid-cols-[minmax(0,1.12fr)_minmax(24rem,0.72fr)] lg:px-12 lg:py-12 xl:gap-20">
        <section
          aria-label="Informações do evento"
          className="hidden min-w-0 flex-col justify-center lg:flex"
        >
          <span className="mb-7 inline-flex w-fit items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.2em] text-zinc-600">
            <span className="size-1.5 rounded-full bg-amber-500" />
            Acesso oficial do evento
          </span>
          <p className="max-w-[42rem] text-sm font-bold uppercase tracking-[0.22em] text-amber-700">
            II Encontro de Coros Diocesanos e Litúrgicos do Regional Nordeste 1 - CNBB
          </p>
          <h2 className="mt-5 max-w-[12ch] text-5xl font-semibold leading-[1.05] tracking-[-0.025em] text-zinc-950 xl:text-6xl">
            Sua experiência do encontro começa aqui.
          </h2>
          <p className="mt-6 max-w-xl text-base leading-7 text-zinc-600 xl:text-lg">
            Um único acesso para participante, regente e administração
          </p>

          <div className="mt-9 grid max-w-xl grid-cols-2 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            <div className="flex min-w-0 items-center gap-3 px-4 py-4 xl:px-5">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-zinc-100 text-zinc-600">
                <CalendarDays aria-hidden="true" className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[0.65rem] font-bold uppercase tracking-[0.16em] text-amber-700">
                  Data
                </span>
                <span className="mt-1 block text-sm font-bold leading-tight text-zinc-950">
                  20 a 22 de novembro de 2026
                </span>
              </span>
            </div>
            <div className="flex min-w-0 items-center gap-3 border-l border-zinc-200 px-4 py-4 xl:px-5">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-zinc-100 text-zinc-600">
                <MapPin aria-hidden="true" className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[0.65rem] font-bold uppercase tracking-[0.16em] text-amber-700">
                  Cidade
                </span>
                <span className="mt-1 block text-sm font-bold leading-tight text-zinc-950">
                  Quixadá, Ceará
                </span>
              </span>
            </div>
          </div>

          <blockquote className="mt-9 max-w-lg border-l-2 border-amber pl-5">
            <p className="font-display text-lg font-bold italic leading-relaxed text-zinc-700">
              “Cantai para o Senhor um canto novo, com arte sustentai a louvação!”
            </p>
            <cite className="mt-2 block text-xs font-bold not-italic uppercase tracking-[0.16em] text-amber-700">
              Salmo 32 (33), 3
            </cite>
          </blockquote>
        </section>

        <Card className="relative mx-auto w-full max-w-[27rem] overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-white text-zinc-950 shadow-[0_12px_48px_rgba(24,24,27,0.06)] sm:rounded-[2rem]">
          <div aria-hidden="true" className="h-1 bg-zinc-100" />
          <CardHeader className="space-y-0 px-5 pb-4 pt-5 text-center sm:px-8 sm:pb-5 sm:pt-7">
            <div className="mx-auto mb-4 w-full max-w-[15.5rem] overflow-hidden rounded-2xl bg-white px-3 py-2 sm:mb-5 sm:max-w-[17rem]">
              <img
                src={eventLogo}
                alt="Encontro de Coros Diocesanos e Litúrgicos"
                className="h-auto w-full"
              />
            </div>
            <p className="mb-2 text-[0.65rem] font-extrabold uppercase tracking-[0.2em] text-amber-foreground">
              Portal do Encontro
            </p>
            <CardTitle>
              <h1 className="text-[1.65rem] font-semibold tracking-[-0.02em] text-zinc-950 sm:text-3xl">
                Acessar portal
              </h1>
            </CardTitle>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-zinc-600">
              Entre com seu e-mail e senha para continuar
            </p>

            <div className="mt-4 flex items-center justify-center gap-3 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-zinc-500 lg:hidden">
              <span>20–22 nov. 2026</span>
              <span aria-hidden="true" className="size-1 rounded-full bg-amber-500" />
              <span>Quixadá, CE</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-5 pt-2 sm:px-8 sm:pb-7">
            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm leading-5 text-red-700"
              >
                {error}
              </p>
            )}
            <form className="space-y-4" onSubmit={submit}>
              <div className="space-y-2">
                <Label htmlFor="portal-email" className="font-bold text-zinc-800">
                  E-mail
                </Label>
                <Input
                  id="portal-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={pending}
                  placeholder="seuemail@exemplo.com"
                  className="min-h-12 rounded-xl border-zinc-300 bg-white px-4 text-base shadow-sm transition-shadow focus-visible:border-amber-600 focus-visible:ring-2 focus-visible:ring-amber/25 motion-reduce:transition-none"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="portal-password" className="font-bold text-zinc-800">
                  Senha
                </Label>
                <div className="relative">
                  <LockKeyhole
                    aria-hidden="true"
                    className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
                  />
                  <Input
                    id="portal-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={pending}
                    placeholder="Sua senha"
                    className="min-h-12 rounded-xl border-zinc-300 bg-white pl-11 pr-12 text-base shadow-sm transition-shadow focus-visible:border-amber-600 focus-visible:ring-2 focus-visible:ring-amber/25 motion-reduce:transition-none"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 min-h-12 min-w-12 rounded-xl text-zinc-500 hover:bg-amber/10 hover:text-zinc-950"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((visible) => !visible)}
                    disabled={pending}
                  >
                    {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </Button>
                </div>
              </div>
              <div className="flex gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-3 text-xs leading-relaxed text-zinc-600">
                <ShieldCheck
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-amber-foreground"
                />
                <p>
                  No primeiro acesso como participante, use os dígitos do CPF seguidos do ano de
                  nascimento com quatro dígitos (AAAA).
                </p>
              </div>
              <Button
                type="submit"
                className="min-h-12 w-full rounded-xl bg-zinc-950 text-base font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none"
                disabled={pending}
              >
                {pending ? (
                  "Entrando…"
                ) : (
                  <>
                    <LogIn aria-hidden="true" className="size-4" />
                    Entrar
                  </>
                )}
              </Button>
            </form>
            <a
              href="/"
              className="group flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber motion-reduce:transition-none"
            >
              <ArrowLeft
                aria-hidden="true"
                className="size-4 transition-transform group-hover:-translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none"
              />
              Voltar ao evento
            </a>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
