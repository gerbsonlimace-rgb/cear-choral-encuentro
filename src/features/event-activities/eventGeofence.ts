import type { AttendanceLocationInput } from "./eventActivity.domain";

export type Coordinates = { latitude: number; longitude: number };

export type AttendanceGeofence = Coordinates & { radiusMeters: number };

const EARTH_RADIUS_METERS = 6_371_000;
const MAX_LOCATION_AGE_MS = 120_000;
const MAX_FUTURE_SKEW_MS = 30_000;
const MAX_ACCURACY_METERS = 100;

export function calculateDistanceMeters(from: Coordinates, to: Coordinates): number {
  if (from.latitude === to.latitude && from.longitude === to.longitude) return 0;
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(from.latitude)) *
      Math.cos(radians(to.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return (
    EARTH_RADIUS_METERS *
    2 *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(Math.max(0, 1 - haversine)))
  );
}

export function validateAttendanceLocation({
  activity,
  position,
  now = new Date(),
}: {
  activity: AttendanceGeofence;
  position: AttendanceLocationInput;
  now?: Date;
}): { distanceMeters: number } {
  if (position.accuracyMeters > MAX_ACCURACY_METERS) {
    throw new Error("A localização está com baixa precisão. Tente novamente em uma área aberta.");
  }
  const collectedAt = new Date(position.collectedAt);
  const ageMs = now.getTime() - collectedAt.getTime();
  if (Number.isNaN(ageMs) || ageMs > MAX_LOCATION_AGE_MS || ageMs < -MAX_FUTURE_SKEW_MS) {
    throw new Error("Obtenha uma localização atual para confirmar a presença.");
  }
  const distanceMeters = calculateDistanceMeters(activity, position);
  if (distanceMeters > activity.radiusMeters) {
    throw new Error("Você está fora da área permitida para esta atividade.");
  }
  return { distanceMeters };
}
