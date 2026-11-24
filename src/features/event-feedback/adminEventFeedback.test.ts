import { describe, expect, it, vi } from "vitest";
import { summarizeFeedback, type AdminFeedbackRow } from "./adminEventFeedback.domain";
import { loadAdminEventFeedback } from "./adminEventFeedback.server";

const row: AdminFeedbackRow = {
  submission_id: "one",
  created_at: "2026-11-24T12:00:00Z",
  overall: 5,
  organization: 5,
  formation: 4,
  celebrations: 5,
  venue: 4,
  food: null,
  lodging: null,
  criterion_comments: { formation: "Mais tempo para oficinas" },
  suggestion: "",
};

describe("administrative feedback report", () => {
  it("excludes unused services from averages and counts criterion comments", () => {
    const summary = summarizeFeedback([
      row,
      { ...row, overall: 3, food: 2, criterion_comments: {}, suggestion: "Obrigado" },
    ]);
    expect(summary.total).toBe(2);
    expect(summary.average).toBe(4);
    expect(summary.positive).toBe(1);
    expect(summary.withComments).toBe(2);
    expect(summary.distribution).toEqual([0, 0, 1, 0, 1]);
    expect(summary.aspects.find((aspect) => aspect.key === "food")).toMatchObject({
      average: 2,
      count: 1,
      notUsed: 1,
    });
    expect(summary.aspects.find((aspect) => aspect.key === "lodging")).toMatchObject({
      average: null,
      count: 0,
      notUsed: 2,
    });
  });

  it("does not fabricate scores when there are no responses", () => {
    expect(summarizeFeedback([])).toMatchObject({
      total: 0,
      average: null,
      positive: 0,
      withComments: 0,
    });
  });

  it("loads every database page instead of silently truncating the report", async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ data: [row], error: null })
      .mockResolvedValueOnce({ data: [{ ...row, submission_id: "two" }], error: null })
      .mockResolvedValueOnce({ data: [], error: null });
    expect(await loadAdminEventFeedback(read, 1)).toHaveLength(2);
    expect(read.mock.calls).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
    ]);
  });

  it("fails the whole report on a database error rather than returning partial totals", async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ data: [row], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "private error" } });
    await expect(loadAdminEventFeedback(read, 1)).rejects.toThrow(
      "Não foi possível carregar as avaliações.",
    );
  });
});
