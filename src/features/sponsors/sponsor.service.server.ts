import {
  createSupabaseSponsorLogoStorage,
  createSupabaseSponsorRepository,
} from "./sponsor.repository.server";
import { createSponsorService } from "./sponsor.server";

let sponsorService: ReturnType<typeof createSponsorService> | undefined;

export function getSponsorService() {
  if (!sponsorService) {
    sponsorService = createSponsorService(
      createSupabaseSponsorRepository(),
      createSupabaseSponsorLogoStorage(),
    );
  }
  return sponsorService;
}
