import { describe, expect, it, vi } from "vitest";
import { createPublicAttendanceService } from "./publicAttendance.server";
import { extractParticipantCardToken, buildAttendanceCardsCsv } from "./publicAttendance.domain";

const token = "a".repeat(64);
const activityId = "044cd7de-e6cf-4746-9a08-8a074980044d";
const card = { name: "Ana", choirName: "Coro São José", eligible: true, token, email: "private@example.test", cpf: "private" };

describe("public participant attendance", () => {
  it("accepts only individual card URLs or opaque tokens, never the old activity QR", () => {
    expect(extractParticipantCardToken(`https://evento.test/cartao?token=${token}`)).toBe(token);
    expect(extractParticipantCardToken(token)).toBe(token);
    for (const value of ["123", "https://evento.test/participante/presenca?token=" + token, "https://evento.test/cartao?token=" + "x".repeat(64)]) {
      expect(() => extractParticipantCardToken(value)).toThrow();
    }
  });

  it("reveals only card fields and never marks attendance on card opening", async () => {
    const repository = { findCard: vi.fn().mockResolvedValue(card), record: vi.fn(), list: vi.fn(), prepareCards: vi.fn() };
    const service = createPublicAttendanceService(repository, vi.fn().mockResolvedValue("data:image/png;base64,AA=="));
    expect(await service.card(token, "https://evento.test")).toEqual({
      name: "Ana", choirName: "Coro São José", eligible: true,
      cardUrl: `https://evento.test/cartao?token=${token}`, qrDataUrl: "data:image/png;base64,AA==",
    });
    expect(repository.record).not.toHaveBeenCalled();
  });

  it("rejects invalid tokens before the database and invalid activity identifiers", async () => {
    const repository = { findCard: vi.fn(), record: vi.fn(), list: vi.fn(), prepareCards: vi.fn() };
    const service = createPublicAttendanceService(repository, vi.fn());
    await expect(service.card("invalid", "https://evento.test")).rejects.toThrow();
    await expect(service.record({ token, activityId: "invalid" })).rejects.toThrow();
    expect(repository.findCard).not.toHaveBeenCalled();
    expect(repository.record).not.toHaveBeenCalled();
  });

  it("includes the approved portrait and lodging details without leaking contact or document data", async () => {
    const details = { fullName: "Ana Maria", photoUrl: "https://storage.test/signed-photo", lodging: { room: "CP37", location: "Centro de Pastoral", roommates: ["Bia"] } };
    const repository = { findCard: vi.fn().mockResolvedValue({...card,...details}), record: vi.fn(), list: vi.fn(), prepareCards: vi.fn() };
    const output = await createPublicAttendanceService(repository, vi.fn().mockResolvedValue("qr")).card(token,"https://evento.test");
    expect(output).toMatchObject(details);
    expect(output).not.toHaveProperty("cpf");
    expect(output).not.toHaveProperty("email");
  });

  it("passes the opaque token directly to the atomic recording operation", async () => {
    const repository = { findCard: vi.fn(), record: vi.fn().mockResolvedValue({ status: "recorded" }), list: vi.fn(), prepareCards: vi.fn() };
    const service = createPublicAttendanceService(repository, vi.fn());
    await service.record({ token, activityId });
    expect(repository.record).toHaveBeenCalledWith({ token, activityId });
    expect(repository.findCard).not.toHaveBeenCalled();
  });

  it("exports every prepared link and neutralizes CSV formulas", () => {
    const csv = buildAttendanceCardsCsv([{ name: '=HYPERLINK("bad")', choirName: "São José; Centro", token }], "https://evento.test");
    expect(csv).toContain("'" + '=HYPERLINK(""bad"")');
    expect(csv).toContain(`https://evento.test/cartao?token=${token}`);
    expect(csv).toContain('"São José; Centro"');
  });
});
