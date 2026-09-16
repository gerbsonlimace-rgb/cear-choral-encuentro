import type { AnchorHTMLAttributes, ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
    Link: ({
      children,
      to,
      ...props
    }: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode; to: string }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});

vi.mock("@/features/registration/RegistrationSection", () => ({
  RegistrationSection: () => <div data-testid="registration-section" />,
}));

import { Route } from "./inscricao";

describe("RegistrationPage", () => {
  it("uses a clear home link instead of a wizard back label", () => {
    const RegistrationPage = Route.options.component!;
    render(<RegistrationPage />);

    expect(screen.getByRole("link", { name: "Página inicial" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("link", { name: "Voltar ao evento" })).not.toBeInTheDocument();
  });
});
