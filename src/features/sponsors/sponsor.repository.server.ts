import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { AdminSponsor } from "./sponsor.domain";
import type { SponsorLogoStorage, SponsorRepository } from "./sponsor.server";

export const SPONSOR_LOGO_BUCKET = "sponsor-logos";
const sponsorColumns = "id,name,logo_path,is_active,created_at,updated_at" as const;

type SponsorRow = {
  id: string;
  name: string;
  logo_path: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function mapSponsor(row: SponsorRow): AdminSponsor {
  const { data } = supabaseAdmin.storage.from(SPONSOR_LOGO_BUCKET).getPublicUrl(row.logo_path);
  return {
    id: row.id,
    name: row.name,
    logoPath: row.logo_path,
    logoUrl: data.publicUrl,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function throwSponsorError(error: { code?: string } | null, fallback: string): never {
  if (error?.code === "23505") {
    throw new Error("Já existe um patrocinador com esse nome.");
  }
  throw new Error(fallback);
}

export function createSupabaseSponsorRepository(): SponsorRepository {
  const returningSponsor = async (
    query: PromiseLike<{ data: unknown; error: { code?: string } | null }>,
  ) => {
    const { data, error } = await query;
    if (error || !data) throwSponsorError(error, "Não foi possível salvar o patrocinador.");
    return mapSponsor(data as SponsorRow);
  };

  return {
    async list() {
      const { data, error } = await supabaseAdmin.from("sponsors").select(sponsorColumns);
      if (error) throwSponsorError(error, "Não foi possível consultar os patrocinadores.");
      return (data ?? []).map((item) => mapSponsor(item as SponsorRow));
    },

    async find(id) {
      const { data, error } = await supabaseAdmin
        .from("sponsors")
        .select(sponsorColumns)
        .eq("id", id)
        .maybeSingle();
      if (error) throwSponsorError(error, "Não foi possível consultar o patrocinador.");
      return data ? mapSponsor(data as SponsorRow) : null;
    },

    create(input) {
      return returningSponsor(
        supabaseAdmin
          .from("sponsors")
          .insert({ name: input.name, logo_path: input.logoPath, is_active: input.isActive })
          .select(sponsorColumns)
          .single(),
      );
    },

    update(id, input) {
      return returningSponsor(
        supabaseAdmin
          .from("sponsors")
          .update({
            name: input.name,
            is_active: input.isActive,
            ...(input.logoPath ? { logo_path: input.logoPath } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .select(sponsorColumns)
          .single(),
      );
    },

    setActive(id, isActive) {
      return returningSponsor(
        supabaseAdmin
          .from("sponsors")
          .update({ is_active: isActive, updated_at: new Date().toISOString() })
          .eq("id", id)
          .select(sponsorColumns)
          .single(),
      );
    },
  };
}

export function createSupabaseSponsorLogoStorage(): SponsorLogoStorage {
  return {
    async upload({ path, bytes, contentType }) {
      const { error } = await supabaseAdmin.storage.from(SPONSOR_LOGO_BUCKET).upload(path, bytes, {
        cacheControl: "31536000",
        contentType,
        upsert: false,
      });
      if (error) throw new Error("Não foi possível enviar a logo do patrocinador.");
    },

    async remove(paths) {
      const { error } = await supabaseAdmin.storage.from(SPONSOR_LOGO_BUCKET).remove(paths);
      if (error) throw new Error("Não foi possível remover a logo anterior do patrocinador.");
    },
  };
}
