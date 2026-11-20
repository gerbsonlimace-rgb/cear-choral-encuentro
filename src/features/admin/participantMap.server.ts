import { getAdminRegistrationService } from "./admin-registration.server";
import {
  buildParticipantMapData,
  type ParticipantMapData,
} from "./participantMap.domain";

const PHOTO_CHUNK_SIZE = 200;

/**
 * Loads the complete administrative snapshot once and signs only the photos
 * needed by the regent cards in a separate follow-up call.
 */
export async function loadParticipantMapData(now: Date = new Date()): Promise<ParticipantMapData> {
  const service = getAdminRegistrationService();
  const rows = await service.lodgingRows();
  const signed: Record<string, string> = {};
  for (let offset = 0; offset < rows.length; offset += PHOTO_CHUNK_SIZE) {
    const chunk = rows.slice(offset, offset + PHOTO_CHUNK_SIZE).map((row) => row.id);
    Object.assign(signed, await service.photoUrls(chunk));
  }
  const withPhotos = rows.map((row) => ({ ...row, photoUrl: signed[row.id] ?? row.photoUrl ?? null }));
  return buildParticipantMapData(withPhotos, now);
}
