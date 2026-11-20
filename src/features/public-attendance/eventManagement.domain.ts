export type EventManagementAccess = { canScan: boolean; canReport: boolean; canArchive: boolean };
export type EventManagementPermission = "reports" | "scan" | "archive";
export const EVENT_REPORT_ROLE_KEY = "event_report_registration_id";
export const EVENT_SCAN_ROLE_KEY = "event_scan_registration_id";
export const EVENT_ARCHIVE_ROLE_KEY = "event_archive_registration_id";

/** Server-owned Auth app_metadata decides reports; participant-editable metadata is ignored. */
export function evaluateEventManagementAccess(
  user: { app_metadata?: Record<string, unknown> } | null | undefined,
  account: { registration_id: string; access_status: string | null; registrations?: { cancelled_at: string | null } | null } | null | undefined,
  isAdmin: boolean,
): EventManagementAccess {
  const canScan = Boolean(isAdmin);
  if (!account || account.access_status !== "active" || account.registrations?.cancelled_at !== null) return { canScan, canReport: false, canArchive: false };
  return {
    canScan: canScan || user?.app_metadata?.[EVENT_SCAN_ROLE_KEY] === account.registration_id,
    canReport: user?.app_metadata?.[EVENT_REPORT_ROLE_KEY] === account.registration_id,
    canArchive: user?.app_metadata?.[EVENT_ARCHIVE_ROLE_KEY] === account.registration_id,
  };
}
export type AttendanceReportPerson = {
  id: string; name: string; choirName: string; checkedInAt: string | null;
  usesEventVan: boolean | null; dietaryRestriction: boolean | null; dietaryDescription: string;
};
export type AttendanceReport = {
  activity: { id: string; title: string; activityDate: string };
  generatedAt: string; total: number; attended: number; absent: number;
  van: number; dietary: number; vanUnknown: number; dietaryUnknown: number;
  choirs: { name: string; total: number; attended: number; absent: number }[];
  people: AttendanceReportPerson[];
};
export function summarizeAttendanceReport(activity: AttendanceReport["activity"], people: AttendanceReportPerson[], generatedAt: string): AttendanceReport {
  const choirs = new Map<string, AttendanceReport["choirs"][number]>();
  for (const person of people) {
    const choir = choirs.get(person.choirName) ?? { name: person.choirName, total: 0, attended: 0, absent: 0 };
    choir.total++; if (person.checkedInAt) choir.attended++; else choir.absent++;
    choirs.set(person.choirName, choir);
  }
  const attended = people.filter(person => person.checkedInAt).length;
  return { activity, generatedAt, people, total: people.length, attended, absent: people.length - attended,
    van: people.filter(person => person.usesEventVan === true).length,
    dietary: people.filter(person => person.dietaryRestriction === true).length,
    vanUnknown: people.filter(person => person.usesEventVan === null).length,
    dietaryUnknown: people.filter(person => person.dietaryRestriction === null).length,
    choirs: [...choirs.values()].sort((a,b) => a.name.localeCompare(b.name,"pt-BR")),
  };
}

export function buildAttendanceWhatsAppMessage(report: AttendanceReport): string {
  const absentees = report.people.filter(person => !person.checkedInAt);
  const activityDate = report.activity.activityDate.slice(0, 10);
  const dateLabel = /^\d{4}-\d{2}-\d{2}$/.test(activityDate)
    ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", dateStyle: "long" }).format(new Date(`${activityDate}T12:00:00Z`))
    : report.activity.activityDate;
  const absenteeLines = absentees.map(person => {
    const van = person.usesEventVan === null ? "Não informado" : person.usesEventVan ? "Sim" : "Não";
    const dietary = person.dietaryRestriction === null
      ? "Não informado"
      : person.dietaryRestriction
        ? person.dietaryDescription || "Tipo não informado"
        : "Nenhuma";
    return `- ${person.name} | Van: ${van} | Restrição alimentar: ${dietary}`;
  });

  return [
    `Atividade: ${report.activity.title}`,
    `Data: ${dateLabel}`,
    `Total de presenças: ${report.attended} | Total de faltas: ${report.absent}`,
    "Faltantes:",
    ...(absenteeLines.length ? absenteeLines : ["Nenhum participante faltou."]),
  ].join("\n");
}
