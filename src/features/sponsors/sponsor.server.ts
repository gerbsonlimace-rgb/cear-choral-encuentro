import {
  validateSponsorLogoBytes,
  type AdminSponsor,
  type PublicSponsor,
  type SponsorCreate,
  type SponsorLogoMimeType,
  type SponsorUpdate,
} from "./sponsor.domain";

export type SponsorPersistence = {
  name: string;
  isActive: boolean;
  logoPath: string;
};

export type SponsorRepository = {
  list(): Promise<AdminSponsor[]>;
  find(id: string): Promise<AdminSponsor | null>;
  create(input: SponsorPersistence): Promise<AdminSponsor>;
  update(
    id: string,
    input: Omit<SponsorPersistence, "logoPath"> & { logoPath?: string },
  ): Promise<AdminSponsor>;
  setActive(id: string, isActive: boolean): Promise<AdminSponsor>;
};

export type SponsorLogoStorage = {
  upload(input: {
    path: string;
    bytes: Uint8Array;
    contentType: SponsorLogoMimeType;
  }): Promise<void>;
  remove(paths: string[]): Promise<void>;
};

function sortSponsors(sponsors: AdminSponsor[]) {
  return [...sponsors].sort((left, right) =>
    left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" }),
  );
}

function decodeLogo(base64: string) {
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function publicSponsor(sponsor: AdminSponsor): PublicSponsor {
  return { id: sponsor.id, name: sponsor.name, logoUrl: sponsor.logoUrl };
}

export function createSponsorService(
  repository: SponsorRepository,
  logoStorage: SponsorLogoStorage,
  createLogoId: () => string = () => crypto.randomUUID(),
) {
  const uploadLogo = async (logo: SponsorCreate["logo"]) => {
    const bytes = decodeLogo(logo.base64);
    const extension = validateSponsorLogoBytes(bytes, logo.mimeType);
    const path = `${createLogoId()}.${extension}`;
    await logoStorage.upload({ path, bytes, contentType: logo.mimeType });
    return path;
  };

  return {
    async listPublic(): Promise<PublicSponsor[]> {
      const sponsors = await repository.list();
      return sortSponsors(sponsors)
        .filter((sponsor) => sponsor.isActive)
        .map(publicSponsor);
    },

    async listAdmin(): Promise<AdminSponsor[]> {
      return sortSponsors(await repository.list());
    },

    async create(input: SponsorCreate): Promise<AdminSponsor> {
      const logoPath = await uploadLogo(input.logo);
      try {
        return await repository.create({
          name: input.name,
          isActive: input.isActive,
          logoPath,
        });
      } catch (error) {
        await logoStorage.remove([logoPath]);
        throw error;
      }
    },

    async update(input: SponsorUpdate): Promise<AdminSponsor> {
      if (!input.logo) {
        return repository.update(input.id, { name: input.name, isActive: input.isActive });
      }

      const current = await repository.find(input.id);
      if (!current) throw new Error("Patrocinador não encontrado.");

      const logoPath = await uploadLogo(input.logo);
      let saved: AdminSponsor;
      try {
        saved = await repository.update(input.id, {
          name: input.name,
          isActive: input.isActive,
          logoPath,
        });
      } catch (error) {
        await logoStorage.remove([logoPath]);
        throw error;
      }
      try {
        await logoStorage.remove([current.logoPath]);
      } catch {
        // The database already points to the replacement. Leaving the old object orphaned is
        // safer than deleting the new logo or reporting a failed edit that was actually saved.
      }
      return saved;
    },

    setActive(id: string, isActive: boolean) {
      return repository.setActive(id, isActive);
    },
  };
}
