import { supabaseAdmin } from "@/integrations/supabase/client.server";

import {
  eventActivityCategorySchema,
  type AdminActivityAttendance,
  type AdminEventActivity,
  type AttendanceLocationInput,
  type EventActivity,
  type EventActivityCreate,
  type EventActivityUpdate,
  type ParticipantActivityAttendance,
  type ParticipantGuideActivity,
  type PublicEventActivity,
} from "./eventActivity.domain";
import type { AttendanceCheckInResult, EventActivityRepository } from "./eventActivity.server";

type DatabaseError = { message?: string; code?: string } | null;
type QueryResult = { data: unknown; error: DatabaseError };
type QueryBuilder = PromiseLike<QueryResult> & {
  select(columns?: string): QueryBuilder;
  insert(values: unknown): QueryBuilder;
  update(values: unknown): QueryBuilder;
  delete(): QueryBuilder;
  eq(column: string, value: unknown): QueryBuilder;
  order(column: string, options?: { ascending?: boolean }): QueryBuilder;
  maybeSingle(): QueryBuilder;
  single(): QueryBuilder;
};
type UntypedAdminClient = {
  from(relation: string): QueryBuilder;
  rpc(functionName: string, args: Record<string, unknown>): PromiseLike<QueryResult>;
};

export type EventActivityRow = {
  id: string;
  title: string;
  activity_date: string;
  starts_at: string | null;
  ends_at: string | null;
  location: string | null;
  description: string | null;
  category: string;
  sort_order: number;
  is_active: boolean;
  requires_qr: boolean;
  verify_location: boolean;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number | null;
  qr_version: number;
  created_at: string;
  updated_at: string;
};

const activityColumns =
  "id,title,activity_date,starts_at,ends_at,location,description,category,sort_order,is_active,requires_qr,verify_location,latitude,longitude,radius_meters,qr_version,created_at,updated_at";
const publicColumns =
  "id,title,activity_date,starts_at,ends_at,location,description,category,sort_order";

function client(): UntypedAdminClient {
  return supabaseAdmin as unknown as UntypedAdminClient;
}

function shortTime(value: string | null): string | null {
  return value ? value.slice(0, 5) : null;
}

function mapEventActivityRow(row: EventActivityRow): EventActivity {
  return {
    id: row.id,
    title: row.title,
    activityDate: row.activity_date,
    startsAt: shortTime(row.starts_at),
    endsAt: shortTime(row.ends_at),
    location: row.location,
    description: row.description,
    category: eventActivityCategorySchema.parse(row.category),
    sortOrder: row.sort_order,
    isActive: row.is_active,
    requiresQr: row.requires_qr,
    verifyLocation: row.verify_location,
    latitude: row.latitude,
    longitude: row.longitude,
    radiusMeters: row.radius_meters,
    qrVersion: row.qr_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapAdminEventActivityRow(
  row: EventActivityRow,
  attendanceCount = 0,
): AdminEventActivity {
  return { ...mapEventActivityRow(row), attendanceCount };
}

export function mapPublicEventActivityRow(
  row: Pick<
    EventActivityRow,
    | "id"
    | "title"
    | "activity_date"
    | "starts_at"
    | "ends_at"
    | "location"
    | "description"
    | "category"
    | "sort_order"
  >,
): PublicEventActivity {
  return {
    id: row.id,
    title: row.title,
    activityDate: row.activity_date,
    startsAt: shortTime(row.starts_at),
    endsAt: shortTime(row.ends_at),
    location: row.location,
    description: row.description,
    category: eventActivityCategorySchema.parse(row.category),
    sortOrder: row.sort_order,
  };
}

function toWriteRow(input: EventActivityCreate) {
  return {
    title: input.title,
    activity_date: input.activityDate,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    location: input.location,
    description: input.description,
    category: input.category,
    sort_order: input.sortOrder,
    is_active: input.isActive,
    requires_qr: input.requiresQr,
    verify_location: input.verifyLocation,
    latitude: input.latitude,
    longitude: input.longitude,
    radius_meters: input.radiusMeters,
    updated_at: new Date().toISOString(),
  };
}

function requiredRow(data: unknown, error: DatabaseError, message: string): EventActivityRow {
  if (error || !data) throw new Error(message);
  return data as EventActivityRow;
}

export function createSupabaseEventActivityRepository(): EventActivityRepository {
  return {
    async listAdminActivities() {
      const [activitiesResult, attendanceResult] = await Promise.all([
        client()
          .from("event_activities")
          .select(activityColumns)
          .order("activity_date", { ascending: true })
          .order("sort_order", { ascending: true }),
        client().from("event_activity_attendances").select("activity_id"),
      ]);
      if (activitiesResult.error || attendanceResult.error) {
        throw new Error("Não foi possível carregar as atividades.");
      }
      const counts = new Map<string, number>();
      for (const row of (attendanceResult.data ?? []) as Array<{ activity_id: string }>) {
        counts.set(row.activity_id, (counts.get(row.activity_id) ?? 0) + 1);
      }
      return ((activitiesResult.data ?? []) as EventActivityRow[]).map((row) =>
        mapAdminEventActivityRow(row, counts.get(row.id) ?? 0),
      );
    },

    async listPublicActivities() {
      const { data, error } = await client()
        .from("event_activities")
        .select(publicColumns)
        .eq("is_active", true)
        .order("activity_date", { ascending: true })
        .order("sort_order", { ascending: true });
      if (error) throw new Error("Não foi possível carregar a programação do evento.");
      return ((data ?? []) as EventActivityRow[]).map(mapPublicEventActivityRow);
    },

    async listParticipantGuideActivities() {
      const { data, error } = await client()
        .from("event_activities")
        .select(`${publicColumns},requires_qr`)
        .eq("is_active", true)
        .order("activity_date", { ascending: true })
        .order("sort_order", { ascending: true });
      if (error) throw new Error("Não foi possível carregar a programação do evento.");
      return ((data ?? []) as EventActivityRow[]).map((row) => ({
        ...mapPublicEventActivityRow(row),
        requiresQr: row.requires_qr,
      }));
    },

    async createActivity(input) {
      const { data, error } = await client()
        .from("event_activities")
        .insert(toWriteRow(input))
        .select(activityColumns)
        .single();
      return mapAdminEventActivityRow(
        requiredRow(data, error, "Não foi possível criar a atividade."),
      );
    },

    async updateActivity(input) {
      const { id, ...values } = input;
      const { data, error } = await client()
        .from("event_activities")
        .update(toWriteRow(values))
        .eq("id", id)
        .select(activityColumns)
        .single();
      return mapAdminEventActivityRow(
        requiredRow(data, error, "Não foi possível atualizar a atividade."),
      );
    },

    async deleteActivity(activityId) {
      const { error } = await client().from("event_activities").delete().eq("id", activityId);
      if (error?.code === "23503") {
        throw new Error("A atividade já possui presenças e deve ser apenas inativada.");
      }
      if (error) throw new Error("Não foi possível excluir a atividade.");
    },

    async findActivity(activityId) {
      const { data, error } = await client()
        .from("event_activities")
        .select(activityColumns)
        .eq("id", activityId)
        .maybeSingle();
      if (error) throw new Error("Não foi possível carregar a atividade.");
      return data ? mapAdminEventActivityRow(data as EventActivityRow) : null;
    },

    async incrementQrVersion(activityId) {
      const { data, error } = await client().rpc("increment_event_activity_qr_version", {
        p_activity_id: activityId,
      });
      const row = Array.isArray(data) ? data[0] : data;
      return mapAdminEventActivityRow(
        requiredRow(row, error, "Não foi possível regenerar o QR Code."),
      );
    },

    async recordAttendance(input) {
      const location: AttendanceLocationInput | null = input.location;
      const { data, error } = await client().rpc("record_event_activity_attendance", {
        p_activity_id: input.activityId,
        p_qr_version: input.qrVersion,
        p_participant_account_id: input.participantAccountId,
        p_registration_id: input.registrationId,
        p_latitude: location?.latitude ?? null,
        p_longitude: location?.longitude ?? null,
        p_accuracy_meters: location?.accuracyMeters ?? null,
        p_position_collected_at: location?.collectedAt ?? null,
      });
      const code = error?.message ?? "";
      if (code.includes("EVENT_ATTENDANCE_QR_REVOKED")) throw new Error("Este QR Code foi revogado.");
      if (code.includes("EVENT_ATTENDANCE_OUTSIDE_WINDOW")) {
        throw new Error("A presença ainda não está aberta ou já foi encerrada.");
      }
      if (code.includes("EVENT_ATTENDANCE_LOCATION_REQUIRED")) {
        throw new Error("A localização é obrigatória para esta atividade.");
      }
      if (code.includes("EVENT_ATTENDANCE_LOCATION_INACCURATE")) {
        throw new Error("A localização está com baixa precisão.");
      }
      if (code.includes("EVENT_ATTENDANCE_LOCATION_STALE")) {
        throw new Error("Obtenha uma localização atual.");
      }
      if (code.includes("EVENT_ATTENDANCE_OUTSIDE_GEOFENCE")) {
        throw new Error("Você está fora da área permitida para esta atividade.");
      }
      if (error) throw new Error("Não foi possível registrar a presença.");
      const row = (Array.isArray(data) ? data[0] : data) as
        | {
            status: AttendanceCheckInResult["status"];
            activity_title: string;
            checked_in_at: string;
            distance_meters: number | null;
          }
        | undefined;
      if (!row) throw new Error("Resposta de presença inválida.");
      return {
        status: row.status,
        activityTitle: row.activity_title,
        checkedInAt: row.checked_in_at,
        distanceMeters: row.distance_meters,
      };
    },

    async listParticipantAttendance(registrationId) {
      const [activitiesResult, attendanceResult] = await Promise.all([
        client()
          .from("event_activities")
          .select(activityColumns)
          .eq("is_active", true)
          .eq("requires_qr", true)
          .order("activity_date", { ascending: true })
          .order("sort_order", { ascending: true }),
        client()
          .from("event_activity_attendances")
          .select("activity_id,checked_in_at")
          .eq("registration_id", registrationId),
      ]);
      if (activitiesResult.error || attendanceResult.error) {
        throw new Error("Não foi possível carregar suas presenças.");
      }
      const recorded = new Map(
        ((attendanceResult.data ?? []) as Array<{ activity_id: string; checked_in_at: string }>).map(
          (row) => [row.activity_id, row.checked_in_at],
        ),
      );
      return ((activitiesResult.data ?? []) as EventActivityRow[]).map((row) => {
        const activity = mapEventActivityRow(row);
        const checkedInAt = recorded.get(activity.id) ?? null;
        return {
          id: activity.id,
          title: activity.title,
          activityDate: activity.activityDate,
          startsAt: activity.startsAt,
          endsAt: activity.endsAt,
          location: activity.location,
          sortOrder: activity.sortOrder,
          attended: checkedInAt !== null,
          checkedInAt,
        } satisfies ParticipantActivityAttendance;
      });
    },

    async listActivityAttendances(activityId) {
      const { data, error } = await client()
        .from("event_activity_attendances")
        .select("id,checked_in_at,latitude,longitude,accuracy_meters,distance_meters,registrations(name)")
        .eq("activity_id", activityId)
        .order("checked_in_at", { ascending: false });
      if (error) throw new Error("Não foi possível carregar as presenças da atividade.");
      return ((data ?? []) as Array<{
        id: string;
        checked_in_at: string;
        latitude: number | null;
        longitude: number | null;
        accuracy_meters: number | null;
        distance_meters: number | null;
        registrations: { name: string } | Array<{ name: string }> | null;
      }>).map((row) => ({
        id: row.id,
        participantName: Array.isArray(row.registrations)
          ? (row.registrations[0]?.name ?? "Participante")
          : (row.registrations?.name ?? "Participante"),
        checkedInAt: row.checked_in_at,
        latitude: row.latitude,
        longitude: row.longitude,
        accuracyMeters: row.accuracy_meters,
        distanceMeters: row.distance_meters,
      } satisfies AdminActivityAttendance));
    },
  };
}
