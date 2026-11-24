import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventFeedbackPage } from "./EventFeedbackPage";

const accessProps = {
  onPrepareAccess: async (_identity: string) => ({
    token: "a".repeat(64),
    responded: false,
    videoUrl: null,
  }),
  onResumeAccess: async (token: string) => ({ token, responded: false, videoUrl: null }),
  onClaimVideo: async (_token: string, _claimId: string) => ({ allowed: true }),
};
async function identify(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    screen.getByRole("textbox", { name: "CPF ou e-mail da inscrição" }),
    "529.982.247-25",
  );
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await screen.findByRole("heading", { name: "Como foi o encontro para você?" });
}
async function complete(user: ReturnType<typeof userEvent.setup>) {
  await identify(user);
  await user.click(screen.getByRole("radio", { name: "Excelente" }));
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  for (const group of screen.getAllByRole("group")) {
    const unused = within(group).queryByRole("radio", { name: "Não utilizei" });
    await user.click(unused ?? within(group).getByRole("radio", { name: "Bom" }));
  }
  await user.click(screen.getByRole("button", { name: "Continuar" }));
}

describe("public mobile event feedback", () => {
  beforeEach(() => sessionStorage.clear());
  it("starts video preparation on the first question and offers the surprise only after saving", async () => {
    const user = userEvent.setup();
    const download = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", download);
    try {
      render(
        <EventFeedbackPage
          {...accessProps}
          onSubmit={vi.fn().mockResolvedValue({ saved: true })}
          onPrepareAccess={async () => ({
            token: "a".repeat(64),
            responded: false,
            videoUrl: "/final.mp4",
          })}
        />,
      );
      expect(download).not.toHaveBeenCalled();
      expect(
        screen.queryByRole("button", { name: "Finalizar e ver surpresa" }),
      ).not.toBeInTheDocument();
      await complete(user);
      await user.click(screen.getByRole("button", { name: "Enviar avaliação" }));
      expect(await screen.findByRole("button", { name: "Finalizar e ver surpresa" })).toBeVisible();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("shows clickable numbered emoji squares with one selected score and unused only for food and lodging", async () => {
    const user = userEvent.setup();
    render(<EventFeedbackPage {...accessProps} onSubmit={vi.fn()} />);
    await identify(user);

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
    render(<EventFeedbackPage {...accessProps} onSubmit={vi.fn()} loadStats={loadStats} />);
    expect(await screen.findByText("245")).toBeVisible();
    expect(screen.getByText("18")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Enviar pelo WhatsApp" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Envie para um colega/)).not.toBeInTheDocument();
  });

  it("shows the event logo and validates a required answer without authentication", async () => {
    const user = userEvent.setup();
    render(<EventFeedbackPage {...accessProps} onSubmit={vi.fn()} />);
    expect(screen.getByAltText("II Encontro de Coros Diocesanos e Litúrgicos")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Informe um CPF ou e-mail válido");
    await identify(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Escolha uma opção");
    expect(screen.getByRole("heading", { name: "Como foi o encontro para você?" })).toBeVisible();
  });
  it("asks only for CPF or email on the first page and masks a typed CPF", async () => {
    const user = userEvent.setup();
    const onPrepareAccess = vi.fn(accessProps.onPrepareAccess);
    render(
      <EventFeedbackPage {...accessProps} onPrepareAccess={onPrepareAccess} onSubmit={vi.fn()} />,
    );
    expect(screen.getByText("Etapa 1 de 4")).toBeVisible();
    expect(screen.queryByRole("group", { name: "Avaliação geral" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    const input = screen.getByRole("textbox", { name: "CPF ou e-mail da inscrição" });
    await user.type(input, "52998224725");
    expect(input).toHaveValue("529.982.247-25");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(onPrepareAccess).toHaveBeenCalledWith("52998224725");
    expect(await screen.findByRole("group", { name: "Avaliação geral" })).toBeVisible();
  });
  it("keeps selected answers when returning to the previous step", async () => {
    const user = userEvent.setup();
    render(<EventFeedbackPage {...accessProps} onSubmit={vi.fn()} />);
    await identify(user);
    await user.click(screen.getByRole("radio", { name: "Bom" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByRole("radio", { name: "Bom" })).toBeChecked();
  });
  it("shows six criteria without fellowship or contribution and describes the venue organization", async () => {
    const user = userEvent.setup();
    render(<EventFeedbackPage {...accessProps} onSubmit={vi.fn()} />);
    await identify(user);
    await user.click(screen.getByRole("radio", { name: "Bom" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Etapa 3 de 4")).toBeVisible();
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
    expect(
      screen.queryByRole("heading", { name: "Nos encontramos na próxima?" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "O que podemos fazer melhor?" })).toBeVisible();
  });
  it("submits anonymous answers, preserves them on failure and retries with the same UUID", async () => {
    const user = userEvent.setup();
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new Error("Falha de conexão. Tente novamente."))
      .mockResolvedValue({ saved: true });
    render(<EventFeedbackPage {...accessProps} onSubmit={onSubmit} />);
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
      suggestion: "Mais momentos de troca.",
    });
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("email");
    expect(sessionStorage.getItem("encontro-coros:feedback:2026")).not.toContain("529.982.247-25");
  });
  it("restores an uncertain submission after a mobile reload and sends edited answers with the same UUID", async () => {
    const user = userEvent.setup();
    const firstSubmit = vi.fn().mockRejectedValue(new Error("Conexão interrompida"));
    const first = render(<EventFeedbackPage {...accessProps} onSubmit={firstSubmit} />);
    await complete(user);
    await user.click(screen.getByRole("button", { name: "Enviar avaliação" }));
    await screen.findByRole("alert");
    const previousId = firstSubmit.mock.calls[0][0].submissionId;
    first.unmount();
    const retry = vi.fn().mockResolvedValue({ saved: true });
    render(<EventFeedbackPage {...accessProps} onSubmit={retry} />);
    await user.type(await screen.findByRole("textbox"), "Sugestão atualizada");
    await user.click(screen.getByRole("button", { name: "Enviar avaliação" }));
    expect(retry).toHaveBeenCalledWith(
      expect.objectContaining({ submissionId: previousId, suggestion: "Sugestão atualizada" }),
    );
  });
});
