const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

// An empty or malformed selection must never become an all-participant job.
export function parseJobSelection(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Seleção inválida.");
  const keys = Object.keys(input);
  if (keys.length !== 1) throw new Error("Selecione todos, uma inscrição ou uma lista de inscrições.");
  if (input.scope === "all") return { scope: "all" };
  // Resending requires explicit IDs and never applies to scope=all.
  if (keys[0] === "resendRegistrationId" && uuid.test(input.resendRegistrationId || "")) return { registrationIds: [input.resendRegistrationId], resend: true };
  if (keys[0] === "registrationId" && uuid.test(input.registrationId || "")) return { registrationIds: [input.registrationId] };
  if (keys[0] === "registrationIds" && Array.isArray(input.registrationIds) && input.registrationIds.length > 0 &&
      input.registrationIds.length <= 1000 && input.registrationIds.every((id) => typeof id === "string" && uuid.test(id))) {
    return { registrationIds: [...new Set(input.registrationIds)] };
  }
  if (keys[0] === "resendRegistrationIds" && Array.isArray(input.resendRegistrationIds) && input.resendRegistrationIds.length > 0 && input.resendRegistrationIds.length <= 1000 && input.resendRegistrationIds.every(id => typeof id === "string" && uuid.test(id))) {
    return { registrationIds: [...new Set(input.resendRegistrationIds)], resend: true };
  }
  throw new Error("Selecione pelo menos um participante válido (máximo de 1000).");
}

export function selectJobRegistrationIds(registrations, states, selection) {
  const requested = selection.scope === "all" ? null : new Set(selection.registrationIds);
  return registrations.filter((row) => row.payment_status === "paid" && !row.cancelled_at &&
    (!requested || requested.has(row.id)) && (selection.resend === true || !["sent", "received", "review"].includes(states[row.id]))).map((row) => row.id);
}
