"use client";

/**
 * Read-only Choices definition + answers — shared by couple portal patterns
 * and staff preview/review (P2-B). Not a second selection engine.
 */
import type { ChoicesAnswers, ChoicesDefinition } from "@/lib/client-choices/types";

export function ChoicesDefinitionView({
  definition,
  answers,
  mode = "review",
}: {
  definition: ChoicesDefinition;
  answers: ChoicesAnswers;
  /** preview = couple-like; review = venue review of submitted picks */
  mode?: "preview" | "review";
}) {
  const groups = definition.groups.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <div className="space-y-3" data-testid="choices-definition-view" data-mode={mode}>
      {groups.map((group) => {
        const opts = definition.options
          .filter((o) => o.groupId === group.id)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        const selected = new Set(answers[group.id]?.optionIds ?? []);
        return (
          <fieldset key={group.id} className="space-y-2 rounded-sm border border-border p-3">
            <legend className="px-1 text-sm font-medium text-heading">{group.name}</legend>
            {group.instructions ? (
              <p className="text-xs text-muted-foreground">{group.instructions}</p>
            ) : null}
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
          </fieldset>
        );
      })}
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No choice groups in this packet.</p>
      ) : null}
    </div>
  );
}
