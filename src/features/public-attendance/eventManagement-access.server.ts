import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAdminAuthorizer } from "@/features/admin/admin-auth.server";
import { evaluateEventManagementAccess, isEventCallArchiver, EVENT_ARCHIVE_ROLE_KEY, EVENT_REPORT_ROLE_KEY, EVENT_SCAN_ROLE_KEY, type EventManagementAccess, type EventManagementPermission } from "./eventManagement.domain";

// Server-owned Auth app_metadata; participant-editable user_metadata is never trusted.
export async function getEventManagementAccess(userId: string): Promise<EventManagementAccess> {
  const admin = await getAdminAuthorizer().findActive(userId);
  const [user, account] = await Promise.all([
    supabaseAdmin.auth.admin.getUserById(userId),
    supabaseAdmin.from("participant_accounts").select("registration_id,access_status,registrations(cancelled_at)").eq("user_id", userId).maybeSingle(),
  ]);
  if (user.error || account.error) throw new Error("Não foi possível verificar seu acesso.");
  const access = evaluateEventManagementAccess(
    user.data.user,
    account.data as { registration_id: string; access_status: string | null; registrations?: { cancelled_at: string | null } | null } | null,
    Boolean(admin),
  );
  return { ...access, canArchive: isEventCallArchiver(user.data.user?.email) && account.data?.access_status === "active" && !account.data.registrations?.cancelled_at };
}

export async function setEventManagementPermission(registrationId: string, permission: EventManagementPermission, enabled: boolean) {
  const { data, error } = await supabaseAdmin.from("participant_accounts")
    .select("user_id,access_status,registrations(cancelled_at)").eq("registration_id", registrationId).maybeSingle();
  if (error) throw new Error("Não foi possível consultar a conta do participante.");
  if (!data?.user_id || data.access_status !== "active") throw new Error("Libere o acesso do participante primeiro.");
  if (enabled && data.registrations?.cancelled_at) throw new Error("A inscrição está cancelada.");
  const user = await supabaseAdmin.auth.admin.getUserById(data.user_id);
  if (user.error || !user.data.user) throw new Error("Não foi possível consultar o acesso.");
  const key = permission === "reports" ? EVENT_REPORT_ROLE_KEY : permission === "scan" ? EVENT_SCAN_ROLE_KEY : EVENT_ARCHIVE_ROLE_KEY;
  const update = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
    app_metadata: { ...user.data.user.app_metadata, [key]: enabled ? registrationId : null },
  });
  if (update.error) throw new Error("Não foi possível salvar a permissão.");
  return { registrationId, permission, enabled };
}

export async function getEventManagementPermissionsForAccount(userId: string, registrationId: string) {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error) throw new Error("Não foi possível consultar as permissões do gerenciamento do evento.");
  const metadata = data.user?.app_metadata;
  return {
    isEventReports: metadata?.[EVENT_REPORT_ROLE_KEY] === registrationId,
    isEventScanner: metadata?.[EVENT_SCAN_ROLE_KEY] === registrationId,
    isEventArchiver: metadata?.[EVENT_ARCHIVE_ROLE_KEY] === registrationId,
  };
}
