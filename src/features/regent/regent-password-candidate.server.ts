type RegentPasswordCandidate = {
  membershipId: string;
  userId: string;
  password: string;
};

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

async function fingerprintPasswordCandidate(
  secret: string,
  candidate: RegentPasswordCandidate,
  domain: "regent-password-candidate-v1" | "admin-password-candidate-v1",
) {
  const encoder = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const message = [domain, candidate.membershipId, candidate.userId, candidate.password].join("\0");
  const signature = await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return bytesToHex(new Uint8Array(signature));
}

export function fingerprintRegentPasswordCandidate(
  secret: string,
  candidate: RegentPasswordCandidate,
) {
  return fingerprintPasswordCandidate(secret, candidate, "regent-password-candidate-v1");
}

export function fingerprintAdminPasswordCandidate(
  secret: string,
  candidate: RegentPasswordCandidate,
) {
  return fingerprintPasswordCandidate(secret, candidate, "admin-password-candidate-v1");
}

export function createRegentPasswordCandidateFingerprint(candidate: RegentPasswordCandidate) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Regent password candidate key unavailable");
  return fingerprintRegentPasswordCandidate(secret, candidate);
}

export function createAdminPasswordCandidateFingerprint(candidate: RegentPasswordCandidate) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Administrator password candidate key unavailable");
  return fingerprintAdminPasswordCandidate(secret, candidate);
}
