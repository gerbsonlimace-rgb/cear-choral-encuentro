import { describe, expect, it } from "vitest";

import { getPhotoArtRedirect } from "@/features/photo-art/photoArtAccess";

describe("participant photo art route", () => {
  it("keeps authorized participants inside the logged portal", () => {
    const access = { status: "authorized" };
    expect(getPhotoArtRedirect(access)).toBeNull();
  });

  it("redirects every unauthenticated or unauthorized state to unified access", () => {
    for (const status of ["anonymous", "not_linked", "disabled"] as const) {
      expect(getPhotoArtRedirect({ status })).toBe("/acessar");
    }
  });
});
