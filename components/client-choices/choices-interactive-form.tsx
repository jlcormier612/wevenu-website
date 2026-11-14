"use client";

/**
 * Couple-facing interactive Choices renderer.
 * Shared by the client portal and Preview as Client. Persistence stays in the
 * portal wrapper — this component only mutates the answers passed in.
 */
import {
  orderedVisibleChoiceGroups,
} from "@/lib/client-choices/conditional-groups";
import {
  setChoiceOptionQuantity,
  toggleChoiceOption,
} from "@/lib/client-choices/interactive-selection";
import { choiceOptionPriceLabel } from "@/lib/client-choices/price-labels";
import {
  selectionMaximumReachedMessage,
  selectionProgressForGroup,
} from "@/lib/client-choices/selection-progress";
import type { ChoicesAnswers, ChoicesDefinition } from "@/lib/client-choices/types";

function FixedLines({ definition }: { definition: ChoicesDefinition }) {
  const fixed = definition.fixedLines ?? [];
  if (fixed.length === 0) return null;
  const sections = definition.sections.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const bySection = sections
    .map((section) => ({
      section,
      lines: fixed
        .filter((l) => l.sectionId === section.id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    }))
    .filter((entry) => entry.lines.length > 0);
  const unsectioned = fixed
    .filter((l) => !l.sectionId || sections.every((s) => s.id !== l.sectionId))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const blocks =
    bySection.length > 0
      ? bySection.map(({ section, lines }) => ({
          key: section.id,
          title: section.name,
          guidance: section.guidance,
          lines,
        }))
      : [
          {
            key: "included",
            title: null as string | null,
            guidance: null as string | null,
            lines: fixed.slice().sort((a, b) => a.sortOrder - b.sortOrder),
          },
        ];
  if (unsectioned.length > 0 && bySection.length > 0) {
    blocks.push({
      key: "unsectioned",
      title: null,
      guidance: null,
      lines: unsectioned,
    });
  }

  return (
    <div
      className="space-y-4 rounded-sm border border-border bg-muted/15 p-4"
      data-testid="choices-definition-view"
      data-mode="portal-fixed"
    >
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Included with your event
      </p>
      {blocks.map((block) => (
        <section key={block.key} className="space-y-2">
          {block.title ? (
            <h2 className="text-sm font-semibold text-heading">{block.title}</h2>
          ) : null}
          {block.guidance ? (
            <p className="text-xs text-muted-foreground">{block.guidance}</p>
          ) : null}
          <ul className="space-y-2">
            {block.lines.map((line) => (
              <li key={line.id} className="text-sm" data-testid="choices-fixed-line">
                <span className="font-medium text-heading">{line.description}</span>
                {line.descriptionDetail ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {line.descriptionDetail}
                  </span>
                ) : null}
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {line.includedByDefault ? "Included" : "Part of your offering"}
                  {line.unitPrice != null
                    ? ` · $${Number(line.unitPrice).toFixed(2)}`
                    : ""}
                  {line.unit ? ` / ${line.unit}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function ChoicesInteractiveForm({
  definition,
  answers,
  onAnswersChange,
  editable = true,
  onBlocked,
  priceSurface = "client",
}: {
  definition: ChoicesDefinition;
  answers: ChoicesAnswers;
  onAnswersChange: (next: ChoicesAnswers) => void;
  editable?: boolean;
  onBlocked?: (message: string | null) => void;
  priceSurface?: "preview" | "client";
}) {
  const visibleGroups = orderedVisibleChoiceGroups(definition, answers);

  function toggle(groupId: string, optionId: string) {
    if (!editable) return;
    const result = toggleChoiceOption(definition, answers, groupId, optionId);
    onBlocked?.(result.blockedMessage);
    if (!result.blockedMessage) onAnswersChange(result.answers);
  }

  function setQty(groupId: string, optionId: string, quantity: number) {
    if (!editable) return;
    onBlocked?.(null);
    onAnswersChange(setChoiceOptionQuantity(definition, answers, groupId, optionId, quantity));
  }

  return (
    <div className="space-y-4 overflow-x-hidden" data-testid="choices-interactive-form">
      <FixedLines definition={definition} />

      {visibleGroups.map((group) => {
        const deps = group.dependsOnOptionIds ?? [];
        const isDependent = deps.length > 0;
        const opts = definition.options
          .filter((o) => o.groupId === group.id)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        const selected = answers[group.id]?.optionIds ?? [];
        const progress = selectionProgressForGroup(group, selected.length);
        const atMax = progress.atMaximum;
        return (
          <fieldset
            key={group.id}
            className={`space-y-2 rounded-sm border border-border p-4 ${isDependent ? "ml-3 border-l-2 border-l-heading/40" : ""}`}
            disabled={!editable}
            data-testid={isDependent ? "choices-dependent-group" : "choices-group"}
            data-group-id={group.id}
            data-group-name={group.name}
            data-dependent={isDependent ? "true" : "false"}
            data-selected-count={String(progress.selectedCount)}
            data-at-maximum={atMax ? "true" : "false"}
          >
            <legend className="px-1 text-sm font-medium text-heading">{group.name}</legend>
            <p className="text-xs text-muted-foreground" data-testid="choices-group-progress">
              {progress.label}
              {isDependent ? " · based on your selection above" : ""}
            </p>
            <span className="sr-only" data-testid="choices-group-rules">{progress.label}</span>
            {group.instructions ? (
              <p className="text-xs text-muted-foreground">{group.instructions}</p>
            ) : null}
            {opts.length === 0 ? (
              <p className="text-xs text-muted-foreground" data-testid="choices-dependent-empty">
                No additional choices are configured for this selection yet.
              </p>
            ) : (
              <div className="space-y-2">
                {opts.map((opt) => {
                  const checked = selected.includes(opt.id);
                  const blockedAdd = atMax && !checked && group.selectionMode === "multi";
                  return (
                    <label
                      key={opt.id}
                      className={`flex items-start gap-3 rounded-sm border px-3 py-2 text-sm ${
                        checked
                          ? "cursor-pointer border-heading bg-muted/30"
                          : blockedAdd
                            ? "cursor-not-allowed border-border opacity-60"
                            : "cursor-pointer border-border"
                      }`}
                    >
                      <input
                        type={group.selectionMode === "single" ? "radio" : "checkbox"}
                        name={group.id}
                        value={opt.id}
                        checked={checked}
                        disabled={!editable || blockedAdd}
                        aria-disabled={blockedAdd || undefined}
                        title={blockedAdd ? selectionMaximumReachedMessage(group) : undefined}
                        data-testid={`choices-option-${opt.id}`}
                        data-option-id={opt.id}
                        onChange={() => toggle(group.id, opt.id)}
                        className="mt-0.5"
                      />
                      {opt.imageUrl?.trim() ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={opt.imageUrl.trim()}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-12 w-12 shrink-0 rounded-md border border-border/60 bg-muted/30 object-contain"
                          data-testid={`choices-option-photo-${opt.id}`}
                        />
                      ) : null}
                      <span className="flex-1">
                        <span className="font-medium">{opt.label}</span>
                        {opt.description ? (
                          <span className="block text-xs text-muted-foreground">{opt.description}</span>
                        ) : null}
                        <span className="block text-xs text-muted-foreground">
                          {choiceOptionPriceLabel(opt, group.allowQuantity, priceSurface)}
                        </span>
                        {checked && group.allowQuantity ? (
                          <label className="mt-2 block text-xs text-muted-foreground">
                            Quantity
                            <input
                              className="mt-1 h-8 w-20 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                              inputMode="numeric"
                              value={String(answers[group.id]?.quantities?.[opt.id] ?? 1)}
                              disabled={!editable}
                              data-testid={`choices-qty-${opt.id}`}
                              onChange={(e) => setQty(group.id, opt.id, Number(e.target.value) || 1)}
                            />
                          </label>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>
        );
      })}
    </div>
  );
}
