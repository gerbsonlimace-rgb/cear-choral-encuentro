export type EventManagementAccess = { canScan: boolean; canReport: boolean };
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
