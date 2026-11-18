import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminAccessState, AdminHospedagemBootstrap } from "@/lib/admin.functions";
import { getAdminAccess, getAdminHospedagemBootstrap, getAdminRegistrationPhotos } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { AdminNavigation, type AdminNavigationPath } from "./AdminNavigation";

export type AdminOverviewPageProps = {
  onSignedOut: () => void;
  onMissingSession: () => void;
  checkAdmin?: () => Promise<AdminAccessState>;
  loadInitialData?: () => Promise<AdminHospedagemBootstrap>;
  getSession?: () => Promise<{ data: { session: unknown | null }; error: unknown }>;
  signOut?: () => Promise<{ error: unknown }>;
  navigateTo?: (to: AdminNavigationPath) => void;
};

const defaultGetSession = () => supabase.auth.getSession();
const defaultSignOut = () => supabase.auth.signOut();

export function AdminOverviewPage({
  onSignedOut,
  onMissingSession,
  checkAdmin = getAdminAccess,
  loadInitialData = getAdminHospedagemBootstrap,
  getSession = defaultGetSession,
  signOut = defaultSignOut,
  navigateTo,
}: AdminOverviewPageProps) {
  const [gate, setGate] = useState<"checking" | "authorized" | "forbidden" | "error">("checking");
  const [rows, setRows] = useState<Array<{ id: string; name: string; phone: string; birthDate: string }>>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const session = await getSession();
        if (!session.data.session) {
          if (active) onMissingSession();
          return;
        }
        const access = await checkAdmin();
        if (!active) return;
        if (access.status !== "authorized") {
          setGate("forbidden");
          return;
        }
        const bootstrap = await loadInitialData();
        if (!active) return;
        if (bootstrap.access.status === "authorized" && bootstrap.data) {
          const nextRows = bootstrap.data.registrations.map((row) => ({
            id: row.id,
            name: row.name,
            phone: row.phone,
            birthDate: row.birthDate,
          }));
          setRows(nextRows);
          const ids = [...new Set(nextRows.map((row) => row.id))];
          const chunks: string[][] = [];
          for (let index = 0; index < ids.length; index += 100) {
            chunks.push(ids.slice(index, index + 100));
          }
          void Promise.all(
            chunks.map((registrationIds) =>
              getAdminRegistrationPhotos({ data: { registrationIds } }).catch(
                () => ({}) as Record<string, string>,
              ),
            ),
          )
            .then((results) => {
              const merged: Record<string, string> = {};
              for (const urls of results) Object.assign(merged, urls);
              if (active) setPhotoUrls(merged);
            })
            .catch(() => undefined);
        }
        setGate("authorized");
      } catch {
        if (active) setGate("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [checkAdmin, getSession, loadInitialData, onMissingSession]);

  const age = (birthDate: string) => {
    if (!birthDate) return "-";
    const birth = new Date(birthDate);
    const now = new Date();
    let years = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) years -= 1;
    return years;
  };

  return (
    <main className="internal-app min-h-svh bg-[#f7f7f5] px-4 pb-24 pt-20 sm:px-6 md:pl-[calc(15rem+1.5rem)] md:pr-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Encontro de Coros · Administração</p>
            <h1 className="mt-2 font-display text-2xl">Visão geral</h1>
          </div>
          {gate === "authorized" && (
            <Button size="sm" variant="outline" onClick={() => void signOut().then(() => onSignedOut())}>
              Sair
            </Button>
          )}
        </header>
        {gate === "authorized" && <AdminNavigation current="hospedagem" navigateTo={navigateTo} />}
        {gate === "checking" && <Skeleton className="h-40 w-full" />}
        {gate === "forbidden" && <p role="alert">Acesso não autorizado.</p>}
        {gate === "error" && <p role="alert">Não foi possível verificar seu acesso.</p>}
        {gate === "authorized" && (
          <Card>
            <CardContent className="p-5 sm:p-6">
              <h2 className="font-display text-xl mb-4">Participantes</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2">Foto</th>
                      <th className="py-2">Nome</th>
                      <th className="py-2">Telefone</th>
                      <th className="py-2">Idade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-b">
                        <td className="py-2">
                          {photoUrls[row.id] ? (
                            <img src={photoUrls[row.id]} alt={row.name} className="h-9 w-9 rounded-full object-cover" />
                          ) : (
                            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-[0.6rem] font-semibold text-primary">
                              {row.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </td>
                        <td className="py-2">{row.name}</td>
                        <td className="py-2">{row.phone}</td>
                        <td className="py-2">{age(row.birthDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}