export type EventManagementAccess = { canScan: boolean; canReport: boolean };
export const EVENT_REPORT_ROLE_KEY = "event_report_registration_id";

/** Server-owned Auth app_metadata decides reports; participant-editable metadata is ignored. */
export function evaluateEventManagementAccess(
  user: { app_metadata?: Record<string, unknown> } | null | undefined,
  account: { registration_id: string; access_status: string | null; registrations?: { cancelled_at: string | null } | null } | null | undefined,
  isAdmin: boolean,
): EventManagementAccess {
  const canScan = Boolean(isAdmin);
  if (!account || account.access_status !== "active" || account.registrations?.cancelled_at !== null) return { canScan, canReport: false };
  return { canScan, canReport: user?.app_metadata?.[EVENT_REPORT_ROLE_KEY] === account.registration_id };
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
