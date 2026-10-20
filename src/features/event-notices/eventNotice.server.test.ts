import { describe, expect, it } from "vitest";
import { createEventNoticeService, type EventNoticeRepository } from "./eventNotice.server";
import type { EventNotice } from "./eventNotice.domain";

const eventId = "22222222-2222-4222-8222-222222222222";
const otherEventId = "33333333-3333-4333-8333-333333333333";
const id = "44444444-4444-4444-8444-444444444444";
const adminUserId = "55555555-5555-4555-8555-555555555555";
const now = "2026-09-13T12:00:00.000Z";
const draft = {
  eventId,
  title: "Ensaio geral",
  body: "Chegue às 18h.\nLeve sua partitura.",
  isPublished: true,
};

function setup() {
  const rows: EventNotice[] = [];
  const sources = [
    {
      eventId,
      eventName: "Grande Concerto",
      publicUrl: `https://example.test/e/${eventId}`,
      sortOrder: 0,
      updatedAt: now,
    },
  ];
  const repository: EventNoticeRepository = {
    async list() {
      return [...rows];
    },
    async find(noticeId) {
      return rows.find((row) => row.id === noticeId) ?? null;
    },
    async listPublishedGeneral() {
      return rows.filter((row) => row.eventId === null && row.isPublished);
    },
    async listPublished(eventIds) {
      return rows.filter((row) => row.eventId !== null && eventIds.includes(row.eventId) && row.isPublished);
    },
    async create(input) {
      const row = { ...input, id, eventName: "", createdAt: now, updatedAt: now };
      rows.push(row);
      return row;
    },
    async update(noticeId, input) {
      const index = rows.findIndex((row) => row.id === noticeId);
      if (index < 0) throw new Error("Aviso não encontrado.");
      rows[index] = { ...rows[index], ...input, updatedAt: now };
      return rows[index];
    },
  };
  let published = true;
  let sourceListUnavailable = false;
  const service = createEventNoticeService({
    repository,
    listSources: async () => {
      if (sourceListUnavailable) throw new Error("Eventos indisponíveis");
      return sources;
    },
    isEventPublished: async (sourceId) => {
      if (sourceId === otherEventId) throw new Error("Evento indisponível");
      return published;
    },
  });
  return {
    service,
    rows,
    sources,
    unpublishEvent: () => {
      published = false;
    },
    disableSourceList: () => {
      sourceListUnavailable = true;
    },
  };
}

describe("event notice publication", () => {
  it("publishes, lists, edits and withdraws a general notice without configured events", async () => {
    const { service, sources } = setup();
    sources.length = 0;
    const saved = await service.create({ ...draft, eventId: null, adminUserId });
    expect(saved).toMatchObject({ eventId: null, eventName: "Aviso geral" });
    expect(await service.listParticipant()).toMatchObject([{ id, eventName: "Aviso geral" }]);
    await service.update({ ...draft, id, eventId: null, body: "Mensagem atualizada.", adminUserId });
    expect(await service.listParticipant()).toMatchObject([{ body: "Mensagem atualizada." }]);
    await service.update({ ...draft, id, eventId: null, isPublished: false, adminUserId });
    expect(await service.listParticipant()).toEqual([]);
  });

  it("keeps general notices visible when event publication checks fail", async () => {
    const { service, rows, sources, disableSourceList } = setup();
    rows.push({ ...draft, id, eventId: null, eventName: "", createdAt: now, updatedAt: now });
    sources.splice(0, sources.length, { ...sources[0], eventId: otherEventId });
    expect(await service.listParticipant()).toMatchObject([{ eventName: "Aviso geral" }]);
    disableSourceList();
    expect(await service.listParticipant()).toMatchObject([{ eventName: "Aviso geral" }]);
    await service.update({ ...draft, id, eventId: null, body: "Atualizado", adminUserId });
  });

  it("keeps notices from healthy events when another source is unavailable", async () => {
    const { service, sources } = setup();
    await service.create({ ...draft, adminUserId });
    sources.push({ ...sources[0], eventId: otherEventId });
    expect(await service.listParticipant()).toMatchObject([{ title: "Ensaio geral" }]);
  });

  it("allows withdrawing an orphan notice but not publishing or moving it to an unknown event", async () => {
    const { service, sources } = setup();
    await service.create({ ...draft, adminUserId });
    sources.length = 0;
    await service.update({ ...draft, id, isPublished: false, adminUserId });
    expect(await service.listAdmin()).toMatchObject([{ id, isPublished: false }]);
    await expect(service.update({ ...draft, id, adminUserId })).rejects.toThrow();
    await expect(
      service.update({ ...draft, id, eventId: otherEventId, isPublished: false, adminUserId }),
    ).rejects.toThrow();
  });
  it("publishes normalized text and removes withdrawn notices from the participant feed", async () => {
    const { service } = setup();
    const saved = await service.create({ ...draft, title: " Ensaio geral ", adminUserId });
    expect(saved).toMatchObject({ title: "Ensaio geral", eventName: "Grande Concerto" });
    expect(await service.listParticipant()).toMatchObject([
      { title: "Ensaio geral", body: draft.body },
    ]);
    await service.update({ ...draft, id, isPublished: false, adminUserId });
    expect(await service.listParticipant()).toEqual([]);
    expect(await service.listAdmin()).toMatchObject([{ id, isPublished: false }]);
  });

  it("does not expose notices for unconfigured or unpublished events", async () => {
    const { service, rows, unpublishEvent } = setup();
    await service.create({ ...draft, adminUserId });
    rows.push({ ...rows[0], id: otherEventId, eventId: otherEventId });
    expect(await service.listParticipant()).toHaveLength(1);
    unpublishEvent();
    expect(await service.listParticipant()).toEqual([]);
  });

  it("rejects invalid input and unknown events before persisting", async () => {
    const { service, rows } = setup();
    for (const invalid of [
      { title: " " },
      { body: " " },
      { body: "x".repeat(5001) },
      { eventId: otherEventId },
    ]) {
      await expect(service.create({ ...draft, ...invalid, adminUserId })).rejects.toThrow();
    }
    expect(rows).toEqual([]);
  });

  it("edits content without changing the original publication order", async () => {
    const { service } = setup();
    await service.create({ ...draft, adminUserId });
    await service.update({ ...draft, id, body: "O ensaio começa às 19h.", adminUserId });
    expect(await service.listParticipant()).toMatchObject([
      { body: "O ensaio começa às 19h.", createdAt: now },
    ]);
  });
});
