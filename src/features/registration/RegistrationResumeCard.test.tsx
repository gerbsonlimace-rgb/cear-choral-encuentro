import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RegistrationResumeCard } from "./RegistrationResumeCard";

describe("RegistrationResumeCard", () => {
  it("links pending participants to the existing authenticated participant area", () => {
    render(<RegistrationResumeCard />);

    expect(screen.getByRole("heading", { name: "Já fez sua inscrição?" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Acessar área do participante" })).toHaveAttribute(
      "href",
      "/participante",
    );
  });

  it("explains the credentials required by the participant area", () => {
    render(<RegistrationResumeCard />);

    expect(screen.getByText(/e-mail.*cpf.*ano de nascimento/i)).toBeInTheDocument();
  });
});
