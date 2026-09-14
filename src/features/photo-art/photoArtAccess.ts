export function getPhotoArtRedirect(access: { status: string }) {
  return access.status === "authorized" ? null : ("/acessar" as const);
}
