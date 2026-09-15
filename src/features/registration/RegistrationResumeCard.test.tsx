import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RegistrationResumeCard } from "./RegistrationResumeCard";

describe("RegistrationResumeCard", () => {
  async function submitIdentity(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText("CPF da inscrição"), "52998224725");
    await user.type(screen.getByLabelText("Data de nascimento da inscrição"), "1990-05-12");
    await user.click(screen.getByRole("button", { name: "Retomar pagamento" }));
  }

  it("navigates to the existing checkout after submitting CPF and birth date", async () => {
    const user = userEvent.setup();
    const resume = vi.fn(async () => ({
      status: "pending" as const,
      checkoutUrl: "https://checkout.infinitepay.com.br/existing",
    }));
    const navigateToCheckout = vi.fn();
    render(<RegistrationResumeCard resume={resume} navigateToCheckout={navigateToCheckout} />);

    await submitIdentity(user);

    await waitFor(() =>
      expect(navigateToCheckout).toHaveBeenCalledWith(
        "https://checkout.infinitepay.com.br/existing",
      ),
    );
    expect(resume).toHaveBeenCalledWith({ cpf: "52998224725", birthDate: "1990-05-12" });
  });

  it("confirms an already-paid registration without navigating", async () => {
    const user = userEvent.setup();
    const navigateToCheckout = vi.fn();
    render(
      <RegistrationResumeCard
        resume={async () => ({ status: "paid" })}
        navigateToCheckout={navigateToCheckout}
      />,
    );

    await submitIdentity(user);

    expect(await screen.findByText("Sua inscrição já está confirmada.")).toBeInTheDocument();
    expect(navigateToCheckout).not.toHaveBeenCalled();
  });

  it("shows the stable identity error returned by the server", async () => {
    const user = userEvent.setup();
    render(
      <RegistrationResumeCard
        resume={async () => {
          throw new Error("Não foi possível localizar uma inscrição com os dados informados.");
        }}
      />,
    );

    await submitIdentity(user);

    expect(
      await screen.findByText("Não foi possível localizar uma inscrição com os dados informados."),
    ).toBeInTheDocument();
  });

  it("disables repeated submission while the lookup is pending", async () => {
    const user = userEvent.setup();
    let finishLookup: (() => void) | undefined;
    const resume = vi.fn(
      () =>
        new Promise<{ status: "paid" }>((resolve) => {
          finishLookup = () => resolve({ status: "paid" });
        }),
    );
    render(<RegistrationResumeCard resume={resume} />);

    await submitIdentity(user);

    expect(screen.getByRole("button", { name: "Consultando…" })).toBeDisabled();
    finishLookup?.();
    expect(await screen.findByText("Sua inscrição já está confirmada.")).toBeInTheDocument();
  });
});
