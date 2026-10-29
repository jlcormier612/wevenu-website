/**
 * Read-only model for "The couple will choose" on the venue Event Order tab.
 * Source, in order:
 *  1. the active selection packet's frozen definition (what the couple answers);
 *  2. otherwise the Event Order's own template, frozen exactly as
 *     Prepare selection request would freeze it;
 *  3. otherwise nothing — the couple reviews only.
 */
import { clientChoicesDisplayLabel, isClientChoicesNeedsVenueReview } from "@/lib/client-choices/constants";
import { selectionProgressLabel } from "@/lib/client-choices/selection-progress";
import type { ChoicesAnswers, ChoicesDefinition } from "@/lib/client-choices/types";
import { selectionDefinitionFromEventOrderTemplate } from "@/lib/event-order-templates/selection-definition";
import type { EventOrderTemplateWithDetails } from "@/lib/event-order-templates/types";

export function pickActiveChoices<T extends { status: string }>(choices: readonly T[]): T | null {
  if (choices.length === 0) return null;
  return (
    choices.find((c) => isClientChoicesNeedsVenueReview(c.status))
    ?? choices.find((c) => {
      const s = c.status;
      return s === "sent" || s === "in_progress" || s === "changes_requested";
    })
    ?? choices.find((c) => c.status === "draft")
    ?? choices[0]
    ?? null
  );
}

export const NO_COUPLE_CHOICES_MESSAGE = "No choices — the couple reviews only.";

export type CoupleChoiceOptionPreview = {
  id: string;
  label: string;
  isIncluded: boolean;
  unitPrice: number | null;
  priceLabel: string;
  chosen: boolean;
  chosenQuantity: number | null;
};

export type CoupleChoiceGroupPreview = {
  id: string;
  name: string;
  sectionName: string | null;
  instructions: string | null;
  ruleLabel: string;
  allowQuantity: boolean;
  /** Option labels that must be chosen before this group appears. Empty = always shown. */
  shownWhen: string[];
  options: CoupleChoiceOptionPreview[];
};

export type CoupleChoicePreview =
  | {
      kind: "packet";
      choicesId: string;
      name: string;
      statusLabel: string;
      showAnswers: boolean;
      groups: CoupleChoiceGroupPreview[];
    }
  | { kind: "template"; templateId: string; templateName: string; groups: CoupleChoiceGroupPreview[] }
  | { kind: "none" };

/** Couple-facing option price wording (same as the selection form), with included shown as $0 extra. */
export function coupleChoiceOptionPriceLabel(
  option: { isIncluded: boolean; unitPrice: number | null },
  allowQuantity: boolean,
): string {
  if (option.isIncluded) return "Included — $0 extra";
  if (option.unitPrice == null) return "Additional — price not set";
  return `+$${Number(option.unitPrice).toFixed(2)}${allowQuantity ? " each" : ""}`;
}

/** The group rule without the live count, worded exactly as the couple's form words it. */
export function coupleChoiceRuleLabel(
  group: Parameters<typeof selectionProgressLabel>[0],
): string {
  const full = selectionProgressLabel(group, 0);
  const cut = full.lastIndexOf(" — ");
  return cut === -1 ? full : full.slice(0, cut);
}

function groupsFromDefinition(
  definition: ChoicesDefinition,
  answers: ChoicesAnswers | null,
): CoupleChoiceGroupPreview[] {
  const sectionName = new Map(definition.sections.map((s) => [s.id, s.name]));
  const optionLabel = new Map(definition.options.map((o) => [o.id, o.label]));
  return [...definition.groups]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((group) => {
      const answer = answers?.[group.id];
      const chosenIds = new Set(answer?.optionIds ?? []);
      const options = definition.options
        .filter((o) => o.groupId === group.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((o) => ({
          id: o.id,
          label: o.label,
          isIncluded: o.isIncluded,
          unitPrice: o.unitPrice,
          priceLabel: coupleChoiceOptionPriceLabel(o, group.allowQuantity),
          chosen: chosenIds.has(o.id),
          chosenQuantity: chosenIds.has(o.id) ? (answer?.quantities?.[o.id] ?? null) : null,
        }));
      return {
        id: group.id,
        name: group.name,
        sectionName: group.sectionId ? (sectionName.get(group.sectionId) ?? null) : null,
        instructions: group.instructions,
        ruleLabel: coupleChoiceRuleLabel(group),
        allowQuantity: group.allowQuantity,
        shownWhen: (group.dependsOnOptionIds ?? [])
          .map((id) => optionLabel.get(id))
          .filter((label): label is string => Boolean(label)),
        options,
      };
    });
}

const ANSWERED_STATUSES = new Set(["submitted", "resubmitted", "changes_requested", "finalized"]);

type PreviewPacket = {
  id: string;
  name: string;
  status: string;
  definition: ChoicesDefinition;
  answers: ChoicesAnswers;
};

export function coupleChoicePreview(input: {
  choices: readonly PreviewPacket[];
  eventOrderTemplate: EventOrderTemplateWithDetails | null;
}): CoupleChoicePreview {
  const active = pickActiveChoices(input.choices);
  if (active) {
    const groups = groupsFromDefinition(active.definition, active.answers);
    if (groups.length === 0) return { kind: "none" };
    // Draft and sent packets carry template default answers, not the couple's.
    const showAnswers = ANSWERED_STATUSES.has(active.status);
    return {
      kind: "packet",
      choicesId: active.id,
      name: active.name,
      statusLabel: clientChoicesDisplayLabel(active.status),
      showAnswers,
      groups: showAnswers ? groups : groups.map((g) => ({
        ...g,
        options: g.options.map((o) => ({ ...o, chosen: false, chosenQuantity: null })),
      })),
    };
  }
  const template = input.eventOrderTemplate;
  if (template) {
    const groups = groupsFromDefinition(selectionDefinitionFromEventOrderTemplate(template), null);
    if (groups.length === 0) return { kind: "none" };
    return { kind: "template", templateId: template.id, templateName: template.name, groups };
  }
  return { kind: "none" };
}
