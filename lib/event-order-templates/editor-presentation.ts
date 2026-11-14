/**
 * Presentation helpers for the Event Order template overview and
 * three-level editor. Maps onto existing section / group / option fields.
 * Does not change persistence, snapshots, or selection engines.
 */
import { linesForSection } from "@/lib/event-order-templates/offerings";
import {
  groupsForSection,
  rootGroupsInList,
  sectionCompletenessIssues,
} from "@/lib/event-order-templates/section-workspace";
import { selectionRuleLabel } from "@/lib/event-order-templates/selection-rule-label";
import { isEventOrderTemplateUnfinished } from "@/lib/library/template-readiness";
import type {
  EventOrderTemplateGroup,
  EventOrderTemplateSection,
  EventOrderTemplateWithDetails,
} from "@/lib/event-order-templates/types";

export type SimpleSelectionKind = "choose_one" | "choose_multiple" | "choose_quantities";
export type MultipleLimit = "exactly" | "up_to" | "any";

export type SimpleSelectionState = {
  kind: SimpleSelectionKind;
  required: boolean;
  limit: MultipleLimit;
  count: number | null;
};

export type SectionOverviewCard = {
  id: string;
  name: string;
  includedCount: number;
  clientSelectionCount: number;
  needsAttention: boolean;
  attentionSummary: string | null;
};

export function sectionEditorHref(
  templateId: string,
  sectionId: string,
  focus?: {
    choice?: string | null;
    offering?: string | null;
    category?: string | null;
  },
): string {
  const params = new URLSearchParams();
  if (focus?.choice) params.set("choice", focus.choice);
  if (focus?.offering) params.set("offering", focus.offering);
  if (focus?.category) params.set("category", focus.category);
  const query = params.toString();
  return `/library/event-order-templates/${templateId}/sections/${sectionId}${query ? `?${query}` : ""}`;
}

export function templateOverviewHref(templateId: string): string {
  return `/library/event-order-templates/${templateId}`;
}

export function templatePreviewHref(templateId: string): string {
  return `/library/event-order-templates/${templateId}/preview`;
}

export function sectionOverviewCards(
  template: EventOrderTemplateWithDetails,
): SectionOverviewCard[] {
  return [...template.sections]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((section) => overviewCardForSection(template, section));
}

export function overviewCardForSection(
  template: EventOrderTemplateWithDetails,
  section: EventOrderTemplateSection,
): SectionOverviewCard {
  const lines = linesForSection(template.lines, section.id);
  const includedCount = lines.filter((line) => line.includedByDefault).length;
  const groups = groupsForSection(template.groups, section.id);
  const clientSelectionCount = rootGroupsInList(groups).length;
  const issues = sectionCompletenessIssues(groups, template.options);
  const needsAttention = issues.length > 0;
  return {
    id: section.id,
    name: section.name,
    includedCount,
    clientSelectionCount,
    needsAttention,
    attentionSummary: needsAttention
      ? (issues[0]?.kind === "empty-dependent" || issues[0]?.kind === "unpriced-option"
        ? issues[0].message
        : "Add a client option")
      : null,
  };
}

export function sectionOverviewSummary(card: SectionOverviewCard): string {
  const included =
    card.includedCount === 0
      ? "No included items"
      : `${card.includedCount} included`;
  const selections =
    card.clientSelectionCount === 0
      ? "no client selections"
      : `${card.clientSelectionCount} client ${card.clientSelectionCount === 1 ? "selection" : "selections"}`;
  return `${included} · ${selections}`;
}

export type EditorLevelCopy = {
  title: string;
  prompt: string;
  backLabel: string;
};

export function editorLevelCopy(input: {
  sectionName: string;
  choiceName?: string | null;
  offeringName?: string | null;
  categoryName?: string | null;
}): EditorLevelCopy {
  if (input.categoryName) {
    return {
      title: input.categoryName,
      prompt: "Choose the options clients can select.",
      backLabel: "Back",
    };
  }
  if (input.offeringName) {
    return {
      title: input.offeringName,
      prompt: `Configure the categories available when ${input.offeringName} is selected.`,
      backLabel: "Back",
    };
  }
  if (input.choiceName) {
    return {
      title: input.choiceName,
      prompt: "Choose which options to offer.",
      backLabel: "Back",
    };
  }
  return {
    title: input.sectionName,
    prompt: "Choose what’s included and what clients can select.",
    backLabel: "Back to template",
  };
}

export function templateReadiness(
  template: EventOrderTemplateWithDetails,
): { status: "draft" | "ready"; reason: string | null } {
  if (isEventOrderTemplateUnfinished(template.lines.length, template.groups.length)) {
    return { status: "draft", reason: "Add included items or client selections." };
  }
  const cards = sectionOverviewCards(template);
  const attention = cards.find((card) => card.needsAttention);
  if (attention) {
    return { status: "draft", reason: attention.attentionSummary };
  }
  return { status: "ready", reason: null };
}

export function simpleSelectionFromGroup(
  group: Pick<
    EventOrderTemplateGroup,
    "selectionMode" | "minSelect" | "maxSelect" | "allowQuantity"
  >,
): SimpleSelectionState {
  const required = group.minSelect > 0;
  const kind: SimpleSelectionKind = group.allowQuantity
    ? "choose_quantities"
    : group.selectionMode === "single"
      ? "choose_one"
      : "choose_multiple";
  if (kind === "choose_one") {
    return { kind, required, limit: "exactly", count: 1 };
  }
  if (group.maxSelect == null) {
    return { kind, required, limit: "any", count: null };
  }
  if (required && group.minSelect === group.maxSelect) {
    return { kind, required, limit: "exactly", count: group.maxSelect };
  }
  return { kind, required, limit: "up_to", count: group.maxSelect };
}

export function simpleSelectionToFields(state: SimpleSelectionState): {
  selectionMode: "single" | "multi";
  minSelect: number;
  maxSelect: number | null;
  allowQuantity: boolean;
} {
  const allowQuantity = state.kind === "choose_quantities";
  if (state.kind === "choose_one") {
    return {
      selectionMode: "single",
      minSelect: state.required ? 1 : 0,
      maxSelect: 1,
      allowQuantity,
    };
  }
  if (state.limit === "any") {
    return {
      selectionMode: "multi",
      minSelect: state.required ? 1 : 0,
      maxSelect: null,
      allowQuantity,
    };
  }
  const count = Math.max(1, Math.floor(state.count ?? 2));
  if (state.limit === "exactly") {
    return {
      selectionMode: "multi",
      minSelect: state.required ? count : 0,
      maxSelect: count,
      allowQuantity,
    };
  }
  return {
    selectionMode: "multi",
    minSelect: state.required ? 1 : 0,
    maxSelect: count,
    allowQuantity,
  };
}

export function simpleSelectionLabel(
  group: Pick<
    EventOrderTemplateGroup,
    "selectionMode" | "minSelect" | "maxSelect" | "allowQuantity"
  >,
): string {
  return selectionRuleLabel(group);
}

export function clientsCanSelectLabel(state: SimpleSelectionState): string {
  if (state.kind === "choose_one") return state.required ? "Exactly 1" : "1 or skip";
  if (state.limit === "any") return "Any number";
  if (state.limit === "exactly") return `Exactly ${state.count ?? 2}`;
  return `Up to ${state.count ?? 2}`;
}
