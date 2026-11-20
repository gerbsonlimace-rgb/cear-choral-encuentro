import { Archive, ClipboardList, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { setRegistrationEventManagementPermission } from "@/lib/public-attendance.functions";
import type { EventManagementPermission } from "@/features/public-attendance/eventManagement.domain";
import type { RegistrationAdminRole } from "./admin-roles.server";

const permissions: { key: EventManagementPermission; label: string; roleKey: "isEventReports" | "isEventScanner" | "isEventArchiver"; Icon: typeof ClipboardList }[] = [
  { key: "reports", label: "Relatórios", roleKey: "isEventReports", Icon: ClipboardList },
  { key: "scan", label: "Leitor QR", roleKey: "isEventScanner", Icon: ScanLine },
  { key: "archive", label: "Arquivar chamadas", roleKey: "isEventArchiver", Icon: Archive },
];

export function EventManagementRoleActions({ registrationId, role, cancelled, onChanged }: {
  registrationId: string;
  role?: RegistrationAdminRole;
  cancelled: boolean;
  onChanged?: (id: string, permission: EventManagementPermission, enabled: boolean) => void;
}) {
  async function toggle(permission: EventManagementPermission, enabled: boolean) {
    try {
      const result = await setRegistrationEventManagementPermission({ data: { registrationId, permission, enabled } });
      onChanged?.(registrationId, permission, result.enabled);
      toast.success(`${permission === "reports" ? "Relatórios" : permission === "scan" ? "Leitor QR" : "Arquivamento de chamadas"} ${result.enabled ? "habilitado" : "removido"}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível alterar a permissão.");
    }
  }

  return <>
    {permissions.map(({ key, label, roleKey, Icon }) => {
      const enabled = Boolean(role?.[roleKey]);
      return <DropdownMenuItem key={key} disabled={!role?.hasAccount || (!enabled && cancelled)} onSelect={event => {
        event.preventDefault();
        void toggle(key, !enabled);
      }}>
        <Icon aria-hidden="true" />
        <span className="flex flex-col">
          <span>{enabled ? `Remover acesso: ${label}` : `Habilitar acesso: ${label}`}</span>
          <span className="text-xs text-muted-foreground">{role?.hasAccount ? "Gerenciamento do evento · acesso com CPF" : "Libere o acesso do participante primeiro."}</span>
        </span>
      </DropdownMenuItem>;
    })}
  </>;
}
