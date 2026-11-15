/** Only expose a known local configuration issue, never arbitrary server details. */
export function localPortalConfigurationError(error: unknown): string | null {
  if (!import.meta.env.DEV || !(error instanceof Error)) return null;
  if (!error.message.includes("Missing Supabase environment variable(s):") ||
      !error.message.includes("SUPABASE_SERVICE_ROLE_KEY")) return null;
  return "O servidor local está sem a chave SUPABASE_SERVICE_ROLE_KEY. Configure a chave do projeto encontrocorosce em .env.local e reinicie o localhost. Seu login foi preservado.";
}
