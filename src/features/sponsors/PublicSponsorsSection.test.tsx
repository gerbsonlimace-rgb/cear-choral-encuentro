import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PublicSponsorsSection } from "./PublicSponsorsSection";

describe("PublicSponsorsSection", () => {
  it("stays hidden when no active sponsor has been configured", async () => {
    const loadSponsors = vi.fn(async () => []);
    render(<PublicSponsorsSection loadSponsors={loadSponsors} />);

    await vi.waitFor(() => expect(loadSponsors).toHaveBeenCalledOnce());
    expect(screen.queryByText("Patrocinadores")).not.toBeInTheDocument();
  });

  it("renders configured sponsors with logos and name captions", async () => {
    render(
      <PublicSponsorsSection
        loadSponsors={vi.fn(async () => [
          {
            id: "11111111-1111-4111-8111-111111111111",
            name: "Universidade Católica",
            logoUrl: "https://example.test/unicatolica.png",
          },
        ])}
      />,
    );

    const logo = await screen.findByRole("img", {
      name: "Logo de Universidade Católica",
    });
    expect(logo).toHaveAttribute("src", "https://example.test/unicatolica.png");
    expect(logo).toHaveClass("rounded-lg");
    expect(logo.closest("div")).toHaveClass("rounded-xl");
    expect(screen.getByText("Patrocinadores")).toBeInTheDocument();
    expect(screen.getByText("Universidade Católica")).toBeInTheDocument();
  });
});
