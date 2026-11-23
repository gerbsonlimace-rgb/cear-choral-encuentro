import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventFeedbackPage } from "./EventFeedbackPage";

async function complete(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("radio", { name: "Excelente" }));
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  for (const group of screen.getAllByRole("group")) {
    const unused = within(group).queryByRole("radio", { name: "Não utilizei" });
    await user.click(unused ?? within(group).getByRole("radio", { name: "Bom" }));
  }
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.click(screen.getByRole("radio", { name: "Sim, quero participar" }));
  await user.click(screen.getByRole("button", { name: "Continuar" }));
}

describe("public mobile event feedback", () => {
  beforeEach(() => sessionStorage.clear());
  it("shows clickable numbered emoji squares with one selected score and unused only for food and lodging", async () => {
    const user = userEvent.setup();
    render(<EventFeedbackPage onSubmit={vi.fn()} />);
    const overall = screen.getByRole("group", { name: "Avaliação geral" });
    await user.click(within(overall).getByRole("radio", { name: "Bom" }));
    expect(overall.querySelectorAll(".feedback-score-face")).toHaveLength(5);
    expect(overall.querySelectorAll('[data-selected="true"]')).toHaveLength(1);
    expect(overall.querySelector('[data-selected="true"]')).toHaveTextContent("4");
    await user.click(within(overall).getByRole("radio", { name: "Ruim" }));
    expect(overall.querySelector('[data-selected="true"]')).toHaveTextContent("2");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getAllByRole("radio", { name: "Não utilizei" })).toHaveLength(2);
    for (const name of ["Alimentação", "Hospedagem"])
      expect(
        within(screen.getByRole("group", { name })).getByRole("radio", { name: "Não utilizei" }),
      ).toBeVisible();
    expect(
      within(screen.getByRole("group", { name: "Formação" })).queryByRole("radio", {
        name: "Não utilizei",
      }),
    ).not.toBeInTheDocument();
  });
  it("shows real totals without a WhatsApp sharing invitation", async () => {
    const loadStats = vi.fn().mockResolvedValue({ registrations: 245, responses: 18 });
    render(<EventFeedbackPage onSubmit={vi.fn()} loadStats={loadStats} />);
    expect(await screen.findByText("245")).toBeVisible();
    expect(screen.getByText("18")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Enviar pelo WhatsApp" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Envie para um colega/)).not.toBeInTheDocument();
  });

  it("shows the event logo and validates a required answer without authentication", async () => {
    const user = userEvent.setup();
    render(<EventFeedbackPage onSubmit={vi.fn()} />);
    expect(screen.getByAltText("II Encontro de Coros Diocesanos e Litúrgicos")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Escolha uma opção");
    expect(screen.getByRole("heading", { name: "Como foi o encontro para você?" })).toBeVisible();
  });
  it("keeps selected answers when returning to the previous step", async () => {
    const user = userEvent.setup();
    render(<EventFeedbackPage onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("radio", { name: "Bom" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByRole("radio", { name: "Bom" })).toBeChecked();
  });
  it("shows six criteria without fellowship or contribution and describes the venue organization", async () => {
    const user = userEvent.setup();
    render(<EventFeedbackPage onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("radio", { name: "Bom" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Etapa 2 de 4")).toBeVisible();
    expect(screen.queryByText("Transporte")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Convivência" })).not.toBeInTheDocument();
    expect(
      screen.queryByText("Quanto o encontro contribuiu para sua atuação no coro?"),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("group")).toHaveLength(6);
    expect(
      within(screen.getByRole("group", { name: "Estrutura" })).getByText(
        "Organização do espaço e dos materiais do encontro",
      ),
    ).toBeVisible();
    for (const group of screen.getAllByRole("group")) {
      const unused = within(group).queryByRole("radio", { name: "Não utilizei" });
      await user.click(unused ?? within(group).getByRole("radio", { name: "Bom" }));
    }
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("heading", { name: "Nos encontramos na próxima?" })).toBeVisible();
  });
  it("submits anonymous answers, preserves them on failure and retries with the same UUID", async () => {
    const user = userEvent.setup();
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new Error("Falha de conexão. Tente novamente."))
      .mockResolvedValue({ saved: true });
    render(<EventFeedbackPage onSubmit={onSubmit} />);
    await complete(user);
    await user.type(
      screen.getByRole("textbox", { name: /Sua sugestão/ }),
      "Mais momentos de troca.",
    );
    await user.click(screen.getByRole("button", { name: "Enviar avaliação" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha de conexão");
    expect(screen.getByRole("textbox")).toHaveValue("Mais momentos de troca.");
    await user.click(screen.getByRole("button", { name: "Enviar avaliação" }));
    expect(
      await screen.findByRole("heading", { name: "Sua voz faz parte deste encontro." }),
    ).toBeVisible();
    expect(onSubmit.mock.calls[0][0].submissionId).toBe(onSubmit.mock.calls[1][0].submissionId);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      overall: 5,
      returnIntent: "yes",
      suggestion: "Mais momentos de troca.",
    });
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("email");
  });
  it("restores an uncertain submission after a mobile reload and sends edited answers with the same UUID", async () => {
    const user = userEvent.setup();
    const firstSubmit = vi.fn().mockRejectedValue(new Error("Conexão interrompida"));
    const first = render(<EventFeedbackPage onSubmit={firstSubmit} />);
    await complete(user);
    await user.click(screen.getByRole("button", { name: "Enviar avaliação" }));
    await screen.findByRole("alert");
    const previousId = firstSubmit.mock.calls[0][0].submissionId;
    first.unmount();
    const retry = vi.fn().mockResolvedValue({ saved: true });
    render(<EventFeedbackPage onSubmit={retry} />);
    await user.type(await screen.findByRole("textbox"), "Sugestão atualizada");
    await user.click(screen.getByRole("button", { name: "Enviar avaliação" }));
    expect(retry).toHaveBeenCalledWith(
      expect.objectContaining({ submissionId: previousId, suggestion: "Sugestão atualizada" }),
    );
  });
});
