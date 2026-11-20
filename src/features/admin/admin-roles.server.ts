import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type RegistrationAdminRole = { hasAccount: boolean; isAdmin: boolean; isSelf: boolean; isEventReports?: boolean };
export type AdminRoleResult = { status: "granted" | "revoked"; registrationId: string };

async function findAccountUser(registrationId: string) {
  const { data, error } = await supabaseAdmin
    .from("participant_accounts")
    .select("user_id,access_status")
    .eq("registration_id", registrationId)
    .maybeSingle();
  if (error) throw new Error("Não foi possível concluir. Tente novamente.");
  if (!data?.user_id || data.access_status !== "active")
    throw new Error("Libere o acesso do participante primeiro.");
  return data.user_id;
}

export async function listRegistrationAdminRoles(
  registrationIds: string[],
  actorId: string,
): Promise<Record<string, RegistrationAdminRole>> {
  const result: Record<string, RegistrationAdminRole> = {};
  if (!registrationIds.length) return result;
  const { data: accounts, error } = await supabaseAdmin
    .from("participant_accounts")
    .select("registration_id,user_id,access_status")
    .in("registration_id", registrationIds);
  if (error) throw new Error("Não foi possível consultar os administradores.");
  const userIds = (accounts ?? []).map((a) => a.user_id).filter((id): id is string => !!id);
  const admins = new Set<string>();
  if (userIds.length) {
    const { data: rows, error: adminError } = await supabaseAdmin
      .from("admin_users")
      .select("user_id")
      .in("user_id", userIds)
      .is("revoked_at", null);
    if (adminError) throw new Error("Não foi possível consultar os administradores.");
    for (const row of rows ?? []) admins.add(row.user_id);
  }
  const { hasEventReportAccessForAccount } = await import("@/features/public-attendance/eventManagement-access.server");
  await Promise.all((accounts ?? []).map(async (account) => {
    const userId = account.user_id;
    result[account.registration_id] = {
      hasAccount: Boolean(userId) && account.access_status === "active",
      isAdmin: Boolean(userId && admins.has(userId)),
      isSelf: userId === actorId,
      isEventReports: userId ? await hasEventReportAccessForAccount(userId,account.registration_id) : false,
    };
  }));
  return result;
}

export async function grantAdminFromRegistration(
  registrationId: string,
  actorId: string,
): Promise<AdminRoleResult> {
  const userId = await findAccountUser(registrationId);
  const { data: existing } = await supabaseAdmin
    .from("admin_users")
    .select("id")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .maybeSingle();
  if (!existing) {
    const { error } = await supabaseAdmin
      .from("admin_users")
      .insert({ user_id: userId, granted_by: actorId });
    if (error) throw new Error("Não foi possível concluir. Tente novamente.");
  }
  return { status: "granted", registrationId };
}

export async function revokeAdminFromRegistration(
  registrationId: string,
  actorId: string,
): Promise<AdminRoleResult> {
  const userId = await findAccountUser(registrationId);
  if (userId === actorId) throw new Error("Você não pode remover seu próprio acesso.");
  const { data: active, error } = await supabaseAdmin
    .from("admin_users")
    .select("id,user_id")
    .is("revoked_at", null);
  if (error) throw new Error("Não foi possível concluir. Tente novamente.");
  const target = (active ?? []).find((row) => row.user_id === userId);
  if (!target) return { status: "revoked", registrationId };
  if ((active ?? []).length <= 1) throw new Error("É preciso manter pelo menos um administrador.");
  const { error: updateError } = await supabaseAdmin
    .from("admin_users")
    .update({ revoked_at: new Date().toISOString(), revoked_by: actorId })
    .eq("id", target.id)
    .is("revoked_at", null);
  if (updateError) throw new Error("Não foi possível concluir. Tente novamente.");
  return { status: "revoked", registrationId };
}
