import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { QuixadaRegistrationArtwork } from "./QuixadaRegistrationArtwork";

describe("QuixadaRegistrationArtwork", () => {
  it("uses the exact artwork supplied by the user as the registration landscape", () => {
    const { container } = render(<QuixadaRegistrationArtwork />);
    const artwork = container.querySelector("img");

    expect(artwork).toHaveAttribute("src", "/photo-art/quixada-story-original.png");
    expect(artwork).toHaveClass("object-cover");
  });
});
