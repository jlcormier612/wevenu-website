"use client";

/**
 * Read-only Choices definition + answers — shared by couple portal patterns
 * and staff preview/review (P2-B). Not a second selection engine.
 * Renders the complete offering context (fixed/included lines + choice groups)
 * so venue preview and couple send preview match the Event Order Template.
 * Dependent groups appear nested under their parent when active.
 */
import {
  orderedVisibleChoiceGroups,
} from "@/lib/client-choices/conditional-groups";
import type {
  ChoicesAnswers,
  ChoicesDefinition,
  ChoicesDefinitionFixedLine,
} from "@/lib/client-choices/types";
import {
  formatTemplateOfferingPrice,
  normalizeTemplatePricingModel,
} from "@/lib/event-order-templates/offerings";

function linesForSection(
  lines: ChoicesDefinitionFixedLine[],
  sectionId: string | null,
): ChoicesDefinitionFixedLine[] {
  return lines
    .filter((l) => (sectionId == null ? l.sectionId == null : l.sectionId === sectionId))
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function FixedLineItem({ line }: { line: ChoicesDefinitionFixedLine }) {
  const priceLabel = formatTemplateOfferingPrice({
    unitPrice: line.unitPrice,
    pricingModel: normalizeTemplatePricingModel(line.pricingModel),
    unit: line.unit,
  });
  return (
    <li className="border-b border-border/70 pb-3 last:border-0" data-testid="choices-fixed-line">
      <p className="text-sm font-medium text-heading">{line.description}</p>
      {line.descriptionDetail ? (
        <p className="mt-0.5 text-sm text-muted-foreground">{line.descriptionDetail}</p>
      ) : null}
      <p className="mt-1 text-sm text-foreground">
        {line.includedByDefault ? "Included · " : ""}
        {priceLabel}
        {line.quantity !== 1 ? ` · Qty ${line.quantity}` : ""}
      </p>
    </li>
  );
}

export function ChoicesDefinitionView({
  definition,
  answers,
  mode = "review",
  /** Overlay send-preview keeps the canonical id; composer aside uses a sibling. */
  testId = "choices-definition-view",
}: {
  definition: ChoicesDefinition;
  answers: ChoicesAnswers;
  /** preview = couple-like; review = venue review of submitted picks */
  mode?: "preview" | "review";
  testId?: string;
}) {
  const sections = definition.sections.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const fixedLines = definition.fixedLines ?? [];
  const visibleGroups = orderedVisibleChoiceGroups(definition, answers);
  const unsectioned = linesForSection(fixedLines, null);
  const hasFixed = fixedLines.length > 0;

  return (
    <div className="space-y-6" data-testid={testId} data-mode={mode}>
      {hasFixed || sections.length > 0 ? (
        <div className="space-y-6">
          {sections.map((section) => {
            const offerings = linesForSection(fixedLines, section.id);
            const sectionGroups = visibleGroups.filter((g) => g.sectionId === section.id);
            if (offerings.length === 0 && sectionGroups.length === 0) return null;
            return (
              <section key={section.id} className="space-y-3">
                <h3 className="font-heading text-sm font-semibold uppercase tracking-[0.14em] text-heading">
                  {section.name}
                </h3>
                {section.guidance ? (
                  <p className="text-sm text-muted-foreground">{section.guidance}</p>
                ) : null}
                {offerings.length > 0 ? (
                  <ul className="space-y-3">
                    {offerings.map((line) => (
                      <FixedLineItem key={line.id} line={line} />
                    ))}
                  </ul>
                ) : null}
                {sectionGroups.map((group) => (
                  <ChoiceGroup
                    key={group.id}
                    group={group}
                    definition={definition}
                    answers={answers}
                    mode={mode}
                  />
                ))}
              </section>
            );
          })}
          {unsectioned.length > 0 ? (
            <section className="space-y-3">
              <h3 className="font-heading text-sm font-semibold uppercase tracking-[0.14em] text-heading">
                Included with your event
              </h3>
              <ul className="space-y-3">
                {unsectioned.map((line) => (
                  <FixedLineItem key={line.id} line={line} />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      {/* Groups without a section (or when no sections/fixed context) */}
      {visibleGroups
        .filter((g) => !g.sectionId || sections.every((s) => s.id !== g.sectionId))
        .map((group) => (
          <ChoiceGroup
            key={group.id}
            group={group}
            definition={definition}
            answers={answers}
            mode={mode}
          />
        ))}

      {visibleGroups.length === 0 && fixedLines.length === 0 ? (
        <p className="text-sm text-muted-foreground">No offerings in this selection request.</p>
      ) : null}
    </div>
  );
}

function ChoiceGroup({
  group,
  definition,
  answers,
  mode,
}: {
  group: ChoicesDefinition["groups"][number];
  definition: ChoicesDefinition;
  answers: ChoicesAnswers;
  mode: "preview" | "review";
}) {
  const opts = definition.options
    .filter((o) => o.groupId === group.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const selected = new Set(answers[group.id]?.optionIds ?? []);
  const isDependent = (group.dependsOnOptionIds?.length ?? 0) > 0;
  return (
    <fieldset
      className={`space-y-2 rounded-sm border border-border p-3 ${isDependent ? "ml-3 border-l-2 border-l-heading/40" : ""}`}
      data-testid={isDependent ? "choices-dependent-group" : "choices-group"}
      data-group-name={group.name}
    >
      <legend className="px-1 text-sm font-medium text-heading">{group.name}</legend>
      <p className="text-xs text-muted-foreground">
        {group.selectionMode === "single" ? "Pick one" : "Pick many"}
        {group.minSelect > 0 ? " · required" : " · optional"}
        {isDependent ? " · based on your selection above" : ""}
      </p>
      {group.instructions ? (
        <p className="text-xs text-muted-foreground">{group.instructions}</p>
      ) : null}
      {opts.length === 0 ? (
        <p className="text-xs text-muted-foreground" data-testid="choices-dependent-empty">
          No additional choices are configured for this selection yet.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {opts.map((opt) => {
            const checked = selected.has(opt.id);
            const priceLabel = opt.isIncluded
              ? "Included"
              : opt.unitPrice != null
                ? `+$${Number(opt.unitPrice).toFixed(2)}`
                : "Additional";
            return (
              <li
                key={opt.id}
                className={
                  checked
                    ? "rounded-sm border border-heading bg-muted/30 px-3 py-2 text-sm"
                    : "rounded-sm border border-border px-3 py-2 text-sm text-muted-foreground"
                }
                data-selected={checked ? "true" : "false"}
              >
                <span className="font-medium text-heading">{opt.label}</span>
                {mode === "review" ? (
                  <span className="ml-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {checked ? "Selected" : "Not selected"}
                  </span>
                ) : null}
                {opt.description ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">{opt.description}</span>
                ) : null}
                <span className="mt-0.5 block text-xs text-muted-foreground">{priceLabel}</span>
              </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}
