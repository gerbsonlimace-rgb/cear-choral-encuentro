import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { PublicAttendanceRepository } from "./publicAttendance.server";
import type { PublicAttendanceResult } from "./publicAttendance.domain";
import { resolveParticipantCardLodging, type CardLodgingPlan } from "./participantCardDetails.domain";

const progressSchema = z.object({ total_confirmed: z.number().int().nonnegative(), attended: z.number().int().nonnegative(), revision: z.string() });
const activitySchema = progressSchema.extend({ id: z.string().uuid(), title: z.string(), activity_date: z.string(), starts_at: z.string().nullable(), ends_at: z.string().nullable() });
const cardSchema = z.object({ registration_id: z.string().uuid(), token: z.string() });
const registrationSchema = z.object({ id: z.string(), name: z.string(), badge_name: z.string().nullable().optional(), choir_name: z.string(), cancelled_at: z.string().nullable().optional() });
type QueryResult = { data: unknown; error: { message: string } | null };
// New migration types stay local so the existing generated integration file is preserved.
const client = () => supabaseAdmin as unknown as {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<QueryResult>;
  from(name: string): { select(columns: string): { eq(column: string, value: string): { maybeSingle(): PromiseLike<QueryResult> } } };
};

export function createPublicAttendanceRepository(): PublicAttendanceRepository {
  return {
    async list() {
      const { data, error } = await client().rpc("public_attendance_overview");
      if (error) throw new Error("Não foi possível carregar a chamada. Tente novamente.");
      return z.array(activitySchema).parse(data).map(row => ({
        id: row.id, title: row.title, activityDate: row.activity_date, startsAt: row.starts_at?.slice(0,5) ?? null,
        endsAt: row.ends_at?.slice(0,5) ?? null, totalConfirmed: row.total_confirmed, attended: row.attended, revision: row.revision,
      }));
    },
    async findCard(token) {
      const { data, error } = await client().from("registration_attendance_cards")
        .select("registrations(id,name,badge_name,choir_name,payment_status,cancelled_at,photo_path,dietary_restriction,uses_event_van)").eq("token", token).maybeSingle();
      if (error) throw new Error("Não foi possível abrir o cartão. Tente novamente.");
      if (!data) return null;
      const parsed = z.object({ registrations: z.object({ id:z.string().uuid(), name: z.string(), badge_name: z.string().nullable(), choir_name: z.string(), payment_status: z.string(), cancelled_at: z.string().nullable(), photo_path:z.string().nullable(), dietary_restriction:z.boolean().nullable(), uses_event_van:z.boolean().nullable() }) }).parse(data);
      const row = parsed.registrations;
      if (row.cancelled_at) return null;
      const [photo, planResult] = await Promise.all([
        row.photo_path ? supabaseAdmin.storage.from("registration-photos").createSignedUrl(row.photo_path,3600) : Promise.resolve(null),
        supabaseAdmin.from("lodging_plan").select("assignments,named_rooms,no_lodging_registration_ids,extra_people").maybeSingle(),
      ]);
      if(planResult.error) throw new Error("Não foi possível carregar a hospedagem do cartão. Tente novamente.");
      const plan = planResult.data as CardLodgingPlan | null;
      const roomKey = plan?.assignments?.[row.id];
      const roomIds = Object.entries(plan?.assignments ?? {}).filter(([,key])=>key===roomKey).map(([id])=>id);
      const roommatesResult = roomKey && roomIds.length ? await supabaseAdmin.from("registrations")
        .select("id,name,badge_name,cancelled_at").in("id",roomIds).is("cancelled_at",null) : {data:[],error:null};
      if(roommatesResult.error) throw new Error("Não foi possível carregar os colegas de quarto. Tente novamente.");
      return { name: row.badge_name?.trim() || row.name, fullName:row.name, choirName: row.choir_name, eligible: row.payment_status === "paid",
        photoUrl:photo?.data?.signedUrl ?? null, lodging:resolveParticipantCardLodging(row.id,plan,roommatesResult.data??[]),
        dietaryRestriction:row.dietary_restriction, usesEventVan:row.uses_event_van };
    },
    async record(input) {
      const { data, error } = await client().rpc("record_public_attendance", { p_activity_id: input.activityId, p_token: input.token });
      if (error) throw new Error("Não foi possível confirmar a presença. Tente novamente.");
      const row = z.object({ status: z.enum(["recorded", "already_recorded", "invalid_card", "ineligible", "activity_unavailable"]), participant_name: z.string().nullable(), checked_in_at: z.string().nullable(), ...progressSchema.shape }).parse(Array.isArray(data) ? data[0] : data);
      if (row.status === "recorded" || row.status === "already_recorded") {
        if (!row.participant_name || !row.checked_in_at) throw new Error("Confirmação incompleta. Tente novamente.");
        return { status: row.status, participantName: row.participant_name, checkedInAt: row.checked_in_at,
          activity: { id: input.activityId, totalConfirmed: row.total_confirmed, attended: row.attended, revision: row.revision } };
      }
      const messages = { invalid_card: "QR Code não reconhecido. Apresente o cartão do participante.", ineligible: "Inscrição pendente ou cancelada. Procure a equipe do evento.", activity_unavailable: "Esta atividade não está disponível para chamada." };
      return { status: row.status, message: messages[row.status] } as PublicAttendanceResult;
    },
    async saveLogistics(input) {
      const { data, error } = await client().rpc("save_public_attendance_logistics", {
        p_token: input.token,
        p_dietary_restriction: input.dietaryRestriction,
        p_uses_event_van: input.usesEventVan,
      });
      if (error) throw new Error("Não foi possível salvar as respostas. Tente novamente.");
      const row = z.object({ dietary_restriction: z.boolean(), uses_event_van: z.boolean() })
        .parse(Array.isArray(data) ? data[0] : data);
      return { dietaryRestriction: row.dietary_restriction, usesEventVan: row.uses_event_van };
    },
    async prepareCards() {
      const snapshot = await client().rpc("admin_registration_snapshot", { p_search: "" });
      if (snapshot.error) throw new Error("Não foi possível consultar as inscrições.");
      const registrations = z.object({ registrations: z.array(registrationSchema) }).parse(snapshot.data).registrations.filter(row => !row.cancelled_at);
      const tokens = new Map<string,string>();
      for (let start = 0; start < registrations.length; start += 500) {
        const result = await client().rpc("prepare_attendance_cards", { p_registration_ids: registrations.slice(start,start+500).map(row => row.id) });
        if (result.error) throw new Error("Não foi possível preparar os cartões. Tente novamente.");
        for (const row of z.array(cardSchema).parse(result.data)) tokens.set(row.registration_id,row.token);
      }
      return registrations.filter(row => tokens.has(row.id)).map(row => ({ name: row.badge_name?.trim() || row.name, choirName: row.choir_name, token: tokens.get(row.id)! }));
    },
  };
}
