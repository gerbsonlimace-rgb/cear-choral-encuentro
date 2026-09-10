import { render, within } from "@testing-library/react";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();

  return {
    ...actual,
    Link: ({
      children,
      to,
      ...props
    }: AnchorHTMLAttributes<HTMLAnchorElement> & {
      children: ReactNode;
      to: string;
    }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});

vi.mock("@/components/ui/carousel", () => ({
  Carousel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CarouselContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CarouselItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CarouselNext: () => null,
  CarouselPrevious: () => null,
}));

import { Route } from "./index";

const heroAssetPath = resolve("src/assets/hero-encontro-coros-original-2026.png");

describe("landing page hero", () => {
  it("uses one unmanipulated choir photo behind the current hero content", () => {
    const IndexPage = Route.options.component!;
    render(<IndexPage />);

    const main = within(document.querySelector<HTMLElement>("main")!);
    const photos = main.getAllByRole("img", {
      name: "Participantes do Encontro de Coros reunidos diante da igreja",
    });
    const eventInformation = document.querySelector<HTMLElement>(
      '[aria-label="Informações principais do evento"]',
    );

    expect(photos).toHaveLength(1);
    expect(photos[0]).toHaveClass(
      "object-cover",
      "object-[65%_bottom]",
      "sm:object-[right_bottom]",
    );
    expect(eventInformation).not.toBeNull();

    const information = within(eventInformation!);
    expect(information.getByText("20 a 22 de novembro de 2026")).toBeInTheDocument();
    expect(information.getByText("Quixadá, CE")).toBeInTheDocument();
    expect(
      main.getByRole("heading", {
        level: 1,
        name: "II Encontro de Coros Diocesanos e Litúrgicos do Regional Nordeste 1 - CNBB",
      }),
    ).toBeInTheDocument();
    expect(main.getByText("Coralistas, Instrumentistas e Regentes")).toBeInTheDocument();
  });

  it("keeps the copied hero asset byte-identical to the supplied original", () => {
    const exists = existsSync(heroAssetPath);
    expect(exists).toBe(true);
    if (!exists) return;

    const sha256 = createHash("sha256").update(readFileSync(heroAssetPath)).digest("hex");
    expect(sha256).toBe("1a154eb087651f1fc80d424c35a61ba7af8a9a5a2871cc41a7ca7d0605f728d0");
  });
});
