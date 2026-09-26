/**
 * Map finalized Client Choices answers onto Event Order lines.
 * Does NOT touch invoices — callers surface existing EO → invoice paths.
 */
import type {
  ChoicesAnswers,
  ChoicesDefinition,
  ChoicesDefinitionOption,
} from "@/lib/client-choices/types";

export type AppliedChoiceLine = {
  optionId: string;
  groupId: string;
  offeringId: string | null;
  description: string;
  quantity: number;
  unitPrice: number | null;
  isIncluded: boolean;
  amount: number;
};

export function resolveSelectedOptions(
  definition: ChoicesDefinition,
  answers: ChoicesAnswers,
): AppliedChoiceLine[] {
  const byId = new Map(definition.options.map((o) => [o.id, o]));
  const lines: AppliedChoiceLine[] = [];

  for (const group of definition.groups) {
    const answer = answers[group.id];
    if (!answer?.optionIds?.length) continue;
    for (const optionId of answer.optionIds) {
      const opt = byId.get(optionId);
      if (!opt) continue;
      const qty = group.allowQuantity
        ? Math.max(1, Number(answer.quantities?.[optionId] ?? 1) || 1)
        : 1;
      const unitPrice = effectiveUnitPrice(opt);
      const amount = unitPrice == null ? 0 : Number((qty * unitPrice).toFixed(2));
      lines.push({
        optionId: opt.id,
        groupId: group.id,
        offeringId: opt.offeringId,
        description: opt.label,
        quantity: qty,
        unitPrice,
        isIncluded: opt.isIncluded,
        amount,
      });
    }
  }
  return lines;
}

export function effectiveUnitPrice(opt: ChoicesDefinitionOption): number | null {
  if (opt.isIncluded) return 0;
  return opt.unitPrice;
}

/** Net financial delta for selected lines (additional-cost only). */
export function financialDeltaFromLines(lines: AppliedChoiceLine[]): number {
  return Number(lines.reduce((sum, l) => sum + (l.isIncluded ? 0 : l.amount), 0).toFixed(2));
}

/**
 * Price-neutral: no additional-cost amount change vs previous applied selection.
 * Used to avoid financial noise when only labels/options swap at $0.
 */
export function isPriceNeutralChange(
  previousDelta: number,
  nextDelta: number,
): boolean {
  return Math.abs(previousDelta - nextDelta) < 0.02;
}

export function choicesLineNotes(clientChoicesId: string, optionId: string): string {
  return `choices:${clientChoicesId}:${optionId}`;
}

export function parseChoicesLineNotes(
  notes: string | null | undefined,
): { clientChoicesId: string; optionId: string } | null {
  if (!notes) return null;
  const m = /^choices:([0-9a-f-]{36}):([0-9a-f-]{36})$/i.exec(notes.trim());
  if (!m) return null;
  return { clientChoicesId: m[1], optionId: m[2] };
}
