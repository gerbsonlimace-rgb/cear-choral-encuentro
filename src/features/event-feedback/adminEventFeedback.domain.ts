import { FEEDBACK_ASPECTS, type AspectKey } from "./eventFeedback.domain";

export type AdminFeedbackRow = {
  submission_id: string;
  created_at: string;
  overall: number;
  criterion_comments: Partial<Record<AspectKey, string>>;
  suggestion: string;
} & Record<AspectKey, number | null>;

export function hasFeedbackComments(row: AdminFeedbackRow) {
  return (
    !!row.suggestion.trim() ||
    Object.values(row.criterion_comments).some((value) => !!value?.trim())
  );
}

export function summarizeFeedback(rows: AdminFeedbackRow[]) {
  return {
    total: rows.length,
    average: rows.length ? rows.reduce((sum, row) => sum + row.overall, 0) / rows.length : null,
    positive: rows.filter((row) => row.overall >= 4).length,
    withComments: rows.filter(hasFeedbackComments).length,
    distribution: [1, 2, 3, 4, 5].map(
      (rating) => rows.filter((row) => row.overall === rating).length,
    ),
    aspects: FEEDBACK_ASPECTS.map((aspect) => {
      const values = rows.flatMap((row) =>
        row[aspect.key] === null ? [] : [row[aspect.key] as number],
      );
      return {
        ...aspect,
        count: values.length,
        notUsed: rows.length - values.length,
        average: values.length
          ? values.reduce((sum, value) => sum + value, 0) / values.length
          : null,
      };
    }),
  };
}

export function formatFeedbackScore(value: number | null) {
  return value === null
    ? "—"
    : value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
