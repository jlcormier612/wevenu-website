"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  addEventOrderTemplateSectionAction,
  removeEventOrderTemplateSectionAction,
  reorderEventOrderTemplateSectionsAction,
} from "@/app/(app)/library/event-order-templates/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  sectionEditorHref,
  sectionOverviewCards,
  sectionOverviewSummary,
} from "@/lib/event-order-templates/editor-presentation";
import {
  SUGGESTED_CATEGORIES,
  canonicalSectionNameForSuggested,
  selectedCategoryKeysFromTemplate,
} from "@/lib/event-order-templates/guided-setup";
import { linesForSection } from "@/lib/event-order-templates/offerings";
import { groupsForSection } from "@/lib/event-order-templates/section-workspace";
import type { EventOrderTemplateWithDetails } from "@/lib/event-order-templates/types";

type Persist = (phase: "saving" | "saved" | "error", message?: string) => void;

export function EventOrderTemplateOverview({
  template,
  onPersist,
}: {
  template: EventOrderTemplateWithDetails;
  onPersist: Persist;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [addingSection, setAddingSection] = React.useState(template.sections.length === 0);
  const [customDraft, setCustomDraft] = React.useState("");

  const cards = sectionOverviewCards(template);
  const sectionsOrdered = [...template.sections].sort((a, b) => a.sortOrder - b.sortOrder);
  const existing = selectedCategoryKeysFromTemplate(template.sections);
  const remainingSuggested = SUGGESTED_CATEGORIES.filter((c) => !existing.suggested.includes(c.key));

  function addSection(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (sectionsOrdered.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("That section is already on this template.");
      return;
    }
    startTransition(async () => {
      onPersist("saving");
      const r = await addEventOrderTemplateSectionAction(template.id, trimmed, null);
      if (!r.ok) {
        onPersist("error", r.message ?? "Could not add section.");
        return;
      }
      onPersist("saved");
      setCustomDraft("");
      setAddingSection(false);
      router.refresh();
    });
  }

  function removeSection(sectionId: string, name: string) {
    const hasContent =
      linesForSection(template.lines, sectionId).length > 0
      || groupsForSection(template.groups, sectionId).length > 0;
    const msg = hasContent
      ? `Remove “${name}” and its items from this template? Event Orders already created are not changed.`
      : `Remove “${name}” from this template?`;
    if (!confirm(msg)) return;
    startTransition(async () => {
      onPersist("saving");
      const r = await removeEventOrderTemplateSectionAction(template.id, sectionId);
      if (!r.ok) onPersist("error", r.message ?? "Could not remove section.");
      else {
        onPersist("saved");
        router.refresh();
      }
    });
  }

  function moveSection(sectionId: string, direction: -1 | 1) {
    const ids = sectionsOrdered.map((s) => s.id);
    const index = ids.indexOf(sectionId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= ids.length) return;
    const next = [...ids];
    const [moved] = next.splice(index, 1);
    next.splice(nextIndex, 0, moved);
    startTransition(async () => {
      onPersist("saving");
      const r = await reorderEventOrderTemplateSectionsAction(template.id, next);
      if (!r.ok) onPersist("error", r.message ?? "Could not reorder sections.");
      else {
        onPersist("saved");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3" data-testid="eo-template-overview">
      {cards.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="eo-guided-no-sections">
          No sections yet. Add the first part of the event, like Catering or Bar &amp; Beverages.
        </p>
      ) : (
        <ul className="space-y-1.5" data-testid="eo-guided-step-workspace">
          {cards.map((card, index) => (
            <li
              key={card.id}
              className="htc-working-row flex flex-wrap items-center justify-between gap-2 rounded-md border border-[color:var(--htc-border-warm)] bg-card px-3 py-2.5"
              data-testid={`eo-overview-section-${card.id}`}
              data-eo-section-card="true"
              data-section-expanded="false"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-heading">{card.name}</p>
                <p className="text-xs text-muted-foreground">{sectionOverviewSummary(card)}</p>
                {card.needsAttention && card.attentionSummary ? (
                  <p className="mt-0.5 text-xs font-medium text-heading" data-testid={`eo-overview-attention-${card.id}`}>
                    <Link
                      href={sectionEditorHref(template.id, card.id)}
                      className="underline-offset-2 hover:underline"
                    >
                      {card.attentionSummary}
                    </Link>
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-0.5">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  disabled={pending || index === 0}
                  aria-label={`Move ${card.name} up`}
                  data-testid={`eo-overview-move-up-${card.id}`}
                  onClick={() => moveSection(card.id, -1)}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  disabled={pending || index === cards.length - 1}
                  aria-label={`Move ${card.name} down`}
                  data-testid={`eo-overview-move-down-${card.id}`}
                  onClick={() => moveSection(card.id, 1)}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  data-testid={`eo-overview-edit-${card.id}`}
                  render={<Link href={sectionEditorHref(template.id, card.id)} />}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  disabled={pending}
                  aria-label={`Remove ${card.name}`}
                  data-testid={`eo-guided-remove-section-${card.id}`}
                  onClick={() => removeSection(card.id, card.name)}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {addingSection ? (
        <div
          className="rounded-md border border-[color:var(--htc-border-warm)] bg-card px-3 py-3"
          data-testid="eo-guided-step-categories"
        >
          <p className="mb-2 text-sm font-medium text-heading">Add section</p>
          <div className="space-y-2">
            {remainingSuggested.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {remainingSuggested.map((cat) => (
                  <Button
                    key={cat.key}
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    data-testid={`eo-guided-category-${cat.key}`}
                    onClick={() => addSection(canonicalSectionNameForSuggested(cat.key) || cat.name)}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    {cat.name}
                  </Button>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Input
                value={customDraft}
                onChange={(e) => setCustomDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addSection(customDraft); }}
                placeholder="Or name your own section"
                className="max-w-xs"
                data-testid="eo-guided-custom-category-input"
              />
              <Button
                type="button"
                variant="outline"
                disabled={pending || !customDraft.trim()}
                data-testid="eo-guided-custom-category-add"
                onClick={() => addSection(customDraft)}
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
              </Button>
              {sectionsOrdered.length > 0 ? (
                <Button type="button" variant="ghost" onClick={() => setAddingSection(false)}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="eo-guided-edit-package-categories"
          onClick={() => setAddingSection(true)}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add section
        </Button>
      )}
    </div>
  );
}
