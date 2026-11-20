import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AttendanceSearchPerson = { name: string; choirName: string; token: string; attended: boolean };
const normalize = (value:string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");
const registrationSchema=z.object({id:z.string().uuid(),name:z.string(),badge_name:z.string().nullable(),choir_name:z.string(),payment_status:z.string(),cancelled_at:z.string().nullable()});
export async function searchAttendanceParticipants(activityId:string,query:string):Promise<AttendanceSearchPerson[]> {
 const [activity,snapshot]=await Promise.all([
  supabaseAdmin.from("event_activities").select("id").eq("id",activityId).eq("is_active",true).eq("requires_qr",true).maybeSingle(),
  supabaseAdmin.rpc("admin_registration_snapshot",{p_search:""}),
 ]);
 if(activity.error||!activity.data||snapshot.error)throw new Error("Não foi possível buscar os participantes.");
 const words=normalize(query.trim()).split(/\s+/);
 const rows=z.object({registrations:z.array(registrationSchema)}).parse(snapshot.data).registrations
  .filter(row=>row.payment_status==="paid"&&!row.cancelled_at&&words.every(word=>normalize(`${row.name} ${row.badge_name??""}`).includes(word)))
  .sort((a,b)=>a.name.localeCompare(b.name,"pt-BR")).slice(0,30);
 if(!rows.length)return [];
 const ids=rows.map(row=>row.id);
 const [cards,presences]=await Promise.all([
  supabaseAdmin.from("registration_attendance_cards").select("registration_id,token").in("registration_id",ids),
  supabaseAdmin.from("event_activity_attendances").select("registration_id").eq("activity_id",activityId).in("registration_id",ids),
 ]);
 if(cards.error||presences.error)throw new Error("Não foi possível conferir os cartões e as presenças.");
 const tokens=new Map((cards.data??[]).map(card=>[card.registration_id,card.token]));
 const attended=new Set((presences.data??[]).map(row=>row.registration_id));
 return rows.flatMap(row=>{const token=tokens.get(row.id);return token?[{name:row.name,choirName:row.choir_name,token,attended:attended.has(row.id)}]:[];});
}
