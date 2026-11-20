import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { dietaryRestrictionLabels } from "./publicAttendance.domain";
import { summarizeAttendanceReport } from "./eventManagement.domain";

const rowSchema = z.object({ id: z.string().uuid(), name: z.string(), badge_name: z.string().nullable(),
  choir_name: z.string(), payment_status: z.string(), cancelled_at: z.string().nullable(),
  dietary_restriction: z.boolean().nullable(), dietary_restriction_types: z.array(z.string()).nullable().optional(),
  dietary_restriction_other: z.string().nullable().optional(), uses_event_van: z.boolean().nullable() });

export async function loadAttendanceReport(activityId: string) {
  const [activity, snapshot] = await Promise.all([
    supabaseAdmin.from("event_activities").select("id,title,activity_date").eq("id",activityId).eq("is_active",true).eq("requires_qr",true).maybeSingle(),
    supabaseAdmin.rpc("admin_registration_snapshot", { p_search: "" }),
  ]);
  if (activity.error || snapshot.error || !activity.data) throw new Error("Não foi possível carregar o relatório desta atividade.");
  const rows = z.object({ registrations: z.array(rowSchema) }).parse(snapshot.data).registrations
    .filter(row => row.payment_status === "paid" && !row.cancelled_at);
  const attendance = new Map<string,string>();
  for (let start = 0; ; start += 1000) {
    const result = await supabaseAdmin.from("event_activity_attendances").select("registration_id,checked_in_at,id")
      .eq("activity_id", activityId).order("id").range(start,start+999);
    if (result.error) throw new Error("Não foi possível conferir as presenças.");
    for (const row of result.data ?? []) {
      const previous = attendance.get(row.registration_id);
      if (!previous || row.checked_in_at < previous) attendance.set(row.registration_id,row.checked_in_at);
    }
    if ((result.data?.length ?? 0) < 1000) break;
  }
  const people = rows.map(row => ({ id: row.id, name: row.badge_name?.trim() || row.name, choirName: row.choir_name,
    checkedInAt: attendance.get(row.id) ?? null, usesEventVan: row.uses_event_van,
    dietaryRestriction: row.dietary_restriction,
    dietaryDescription: row.dietary_restriction === true ? dietaryRestrictionLabels(row.dietary_restriction_types,row.dietary_restriction_other) || "Tipo não informado" : "",
  })).sort((a,b) => a.name.localeCompare(b.name,"pt-BR"));
  return summarizeAttendanceReport({ id: activity.data.id, title: activity.data.title, activityDate: activity.data.activity_date },people,new Date().toISOString());
}
