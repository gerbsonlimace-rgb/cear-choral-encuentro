import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAdminAuthorizer } from "@/features/admin/admin-auth.server";
import { evaluateEventManagementAccess, EVENT_REPORT_ROLE_KEY, type EventManagementAccess } from "./eventManagement.domain";

// Server-owned Auth app_metadata; participant-editable user_metadata is never trusted.
export async function getEventManagementAccess(userId: string): Promise<EventManagementAccess> {
  const admin = await getAdminAuthorizer().findActive(userId);
  const [user, account] = await Promise.all([
    supabaseAdmin.auth.admin.getUserById(userId),
    supabaseAdmin.from("participant_accounts").select("registration_id,access_status,registrations(cancelled_at)").eq("user_id", userId).maybeSingle(),
  ]);
  if (user.error || account.error) throw new Error("Não foi possível verificar seu acesso.");
  return evaluateEventManagementAccess(
    user.data.user,
    account.data as { registration_id: string; access_status: string | null; registrations?: { cancelled_at: string | null } | null } | null,
    Boolean(admin),
  );
}

export async function setEventReportAccess(registrationId: string, enabled: boolean) {
  const { data, error } = await supabaseAdmin.from("participant_accounts")
    .select("user_id,access_status,registrations(cancelled_at)").eq("registration_id", registrationId).maybeSingle();
  if (error) throw new Error("Não foi possível consultar a conta do participante.");
  if (!data?.user_id || data.access_status !== "active") throw new Error("Libere o acesso do participante primeiro.");
  if (enabled && data.registrations?.cancelled_at) throw new Error("A inscrição está cancelada.");
  const user = await supabaseAdmin.auth.admin.getUserById(data.user_id);
  if (user.error || !user.data.user) throw new Error("Não foi possível consultar o acesso.");
  const update = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
    app_metadata: { ...user.data.user.app_metadata, [EVENT_REPORT_ROLE_KEY]: enabled ? registrationId : null },
  });
  if (update.error) throw new Error("Não foi possível salvar a permissão.");
  return { enabled };
}

export async function hasEventReportAccessForAccount(userId: string, registrationId: string) {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error) throw new Error("Não foi possível consultar a permissão de relatórios.");
  return data.user?.app_metadata?.[EVENT_REPORT_ROLE_KEY] === registrationId;
}
