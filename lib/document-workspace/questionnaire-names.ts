/**
 * Documents workspace questionnaire titles — reuse questionnaire-family kindLabel.
 * Do not invent a second naming dictionary here.
 */
import {
  kindLabel,
  type QuestionnaireKind,
} from "@/lib/questionnaire-family/definitions";

const KINDS = new Set<QuestionnaireKind>([
  "client_planning",
  "final_details",
  "post_event_feedback",
]);

export function isQuestionnaireKind(value: string | null | undefined): value is QuestionnaireKind {
  return Boolean(value && KINDS.has(value as QuestionnaireKind));
}

/** Canonical customer-facing Documents name for a questionnaire kind. */
export function questionnaireWorkspaceDocumentName(kind: QuestionnaireKind): string {
  return kindLabel(kind);
}

/**
 * Overlay kind-derived titles onto raw get_venue_documents questionnaire rows
 * before normalize. Leaves non-questionnaire rows untouched.
 */
export function applyQuestionnaireWorkspaceNames<T extends {
  docType: string;
  id: string;
  name: string;
  kind?: string | null;
}>(
  rows: readonly T[],
  kindById: ReadonlyMap<string, string>,
): T[] {
  return rows.map((row) => {
    if (row.docType !== "questionnaire") return row;
    const kind = row.kind ?? kindById.get(row.id) ?? null;
    if (!isQuestionnaireKind(kind)) return row;
    return {
      ...row,
      kind,
      name: questionnaireWorkspaceDocumentName(kind),
    };
  });
}
