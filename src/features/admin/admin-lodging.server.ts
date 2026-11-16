import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildLodgingRoomRelations,
  parseLodgingPlan,
  type LodgingRegistrantRow,
  type LodgingPlan,
} from "./admin-lodging.domain";

const PHOTO_BUCKET = "lodging-photos";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

function isMissingFunction(error: { code?: string } | null): boolean {
  return error?.code === "42883" || error?.code === "PGRST202";
}

/**
 * Reads the stored plan. A missing table (migration not applied yet) is not an
 * error: the screen simply starts without a saved allocation. A missing row
 * means the plan was never configured, which the screen tells apart from a
 * plan the administrator deliberately reset.
 */
export async function getAdminLodgingPlan(): Promise<LodgingPlan | null> {
  const { data, error } = await supabaseAdmin
    .from("lodging_plan")
    .select(
      "rooms_available,room_capacity,no_lodging_registration_ids,assignments,extra_rooms,hidden_rooms,extra_people,extra_room_counter",
    )
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) return null;
    throw new Error("Não foi possível carregar a alocação de quartos.");
  }
  if (!data) return null;
  return parseLodgingPlan(data);
}

/** Replaces the whole plan in one statement. */
export async function saveAdminLodgingPlan(plan: LodgingPlan): Promise<void> {
  const registrations: LodgingRegistrantRow[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await supabaseAdmin
      .from("registrations")
      .select("id,choir_name,voice_part,registration_price_cents")
      .is("cancelled_at", null)
      .order("id", { ascending: true })
      .range(start, start + 999);
    if (error) throw new Error("Não foi possível consultar as inscrições para salvar os quartos.");
    registrations.push(
      ...(data ?? []).map((row) => ({
        id: row.id,
        choirName: row.choir_name || "Sem coro",
        voicePart: row.voice_part,
        registrationPriceCents: row.registration_price_cents,
      })),
    );
    if ((data ?? []).length < 1000) break;
  }

  const noLodgingIds = new Set([
    ...plan.noLodgingIds,
    ...registrations.filter((row) => row.registrationPriceCents === 8000).map((row) => row.id),
  ]);
  const lodgingPlan: LodgingPlan = {
    ...plan,
    noLodgingIds: [...noLodgingIds],
    assignments: Object.fromEntries(
      Object.entries(plan.assignments).filter(
        ([registrationId]) => !noLodgingIds.has(registrationId),
      ),
    ),
  };
  const relations = buildLodgingRoomRelations(registrations, lodgingPlan);
  const { error } = await supabaseAdmin.rpc("replace_lodging_plan_with_rooms", {
    p_rooms_available: lodgingPlan.roomsAvailable,
    p_room_capacity: lodgingPlan.roomCapacity,
    p_no_lodging_registration_ids: lodgingPlan.noLodgingIds,
    p_assignments: lodgingPlan.assignments,
    p_extra_rooms: lodgingPlan.extraRooms,
    p_hidden_rooms: lodgingPlan.hiddenRoomKeys,
    p_extra_people: lodgingPlan.extraPeople,
    p_extra_room_counter: lodgingPlan.extraRoomCounter,
    p_rooms: relations.rooms,
    p_placements: relations.placements,
  });
  if (error) {
    if (isMissingTable(error) || isMissingFunction(error)) {
      throw new Error(
        "A migração dos quartos ainda não foi aplicada no Supabase. Aplique a migration de hospedagem para habilitar a gravação.",
      );
    }
    throw new Error("Não foi possível salvar a alocação de quartos.");
  }
}

/** Stores the photo of a person added by hand in the private bucket. */
export async function uploadAdminLodgingPhoto(input: {
  base64: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
}): Promise<{ path: string }> {
  const bytes = Buffer.from(input.base64, "base64");
  if (bytes.length === 0 || bytes.length > MAX_PHOTO_BYTES) {
    throw new Error("A foto deve ter até 5 MB.");
  }
  const extension =
    input.mimeType === "image/png" ? "png" : input.mimeType === "image/webp" ? "webp" : "jpg";
  const path = `extra/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabaseAdmin.storage.from(PHOTO_BUCKET).upload(path, bytes, {
    contentType: input.mimeType,
    upsert: false,
  });
  if (error) throw new Error("Não foi possível enviar a foto.");
  return { path };
}

/** Signs the photos of the people added by hand so the screen can show them. */
export async function signAdminLodgingPhotos(paths: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter((path) => path.length > 0))];
  if (unique.length === 0) return {};
  const signed: Record<string, string> = {};
  for (const path of unique) {
    const result = await supabaseAdmin.storage.from(PHOTO_BUCKET).createSignedUrl(path, 60 * 60);
    if (!result.error && result.data?.signedUrl) signed[path] = result.data.signedUrl;
  }
  return signed;
}
