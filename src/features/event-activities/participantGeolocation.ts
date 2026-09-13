import type { AttendanceLocationInput } from "./eventActivity.domain";

function geolocationMessage(code: number) {
  if (code === 1) return "Permita a localização para confirmar a presença.";
  if (code === 2) return "Não foi possível obter sua localização. Verifique o GPS e tente novamente.";
  if (code === 3) return "A localização demorou demais. Tente novamente em um local com melhor sinal.";
  return "Não foi possível obter sua localização.";
}

export function requestParticipantPosition(): Promise<AttendanceLocationInput> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("A localização não está disponível neste aparelho."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords, timestamp }) => resolve({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracyMeters: coords.accuracy,
        collectedAt: new Date(timestamp).toISOString(),
      }),
      (error) => reject(new Error(geolocationMessage(error.code))),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    );
  });
}
