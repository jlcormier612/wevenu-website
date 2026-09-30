"use client";

/**
 * Venue-side picker for EO Template choice groups during Use / Send.
 */
import * as React from "react";

import { Input } from "@/components/ui/input";
import { optionsForGroup } from "@/lib/event-order-templates/offerings";
import type { EventOrderTemplateWithDetails } from "@/lib/event-order-templates/types";
import type { ChoicesAnswers } from "@/lib/client-choices/types";
import { defaultAnswersFromEventOrderTemplate } from "@/lib/event-order-templates/selection-definition";

export function TemplateGroupAnswerChooser({
  template,
  answers,
  onChange,
}: {
  template: EventOrderTemplateWithDetails;
  answers: ChoicesAnswers;
  onChange: (next: ChoicesAnswers) => void;
}) {
  const groups = [...(template.groups ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  if (groups.length === 0) return null;

  function toggle(groupId: string, optionId: string, mode: "single" | "multi") {
    const current = answers[groupId]?.optionIds ?? [];
    let nextIds: string[];
    if (mode === "single") {
      nextIds = current.includes(optionId) && current.length === 1 ? [] : [optionId];
    } else {
      nextIds = current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId];
    }
    onChange({
      ...answers,
      [groupId]: { ...answers[groupId], optionIds: nextIds },
    });
  }

  function setQty(groupId: string, optionId: string, quantity: number) {
    const current = answers[groupId] ?? { optionIds: [] };
    onChange({
      ...answers,
      [groupId]: {
        ...current,
        quantities: { ...current.quantities, [optionId]: Math.max(1, quantity) },
      },
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-heading">
        Choice groups
      </p>
      {groups.map((g) => {
        const opts = optionsForGroup(template.options ?? [], g.id);
        const selected = answers[g.id]?.optionIds ?? [];
        return (
          <div key={g.id} className="space-y-2">
            <p className="text-sm font-medium text-heading">{g.name}</p>
            <p className="text-xs text-muted-foreground">
              {g.selectionMode === "single" ? "Pick one" : "Pick many"}
              {g.minSelect > 0 ? " · required" : " · optional"}
            </p>
            {g.instructions ? (
              <p className="text-xs text-muted-foreground">{g.instructions}</p>
            ) : null}
            <ul className="space-y-2">
              {opts.map((o) => {
                const checked = selected.includes(o.id);
                return (
                  <li key={o.id} className="rounded-md border border-border p-3">
                    <label className="flex items-start gap-3">
                      <input
                        type={g.selectionMode === "single" ? "radio" : "checkbox"}
                        name={`eo-group-${g.id}`}
                        className="mt-1 size-4 shrink-0"
                        checked={checked}
                        onChange={() => toggle(g.id, o.id, g.selectionMode)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-heading">{o.label}</span>
                        <span className="block text-xs text-muted-foreground">
                          {o.isIncluded
                            ? "Included"
                            : o.unitPrice != null
                              ? `$${o.unitPrice.toFixed(2)}`
                              : "Unpriced"}
                        </span>
                      </span>
                    </label>
                    {checked && g.allowQuantity ? (
                      <div className="mt-2 pl-7">
                        <label className="text-xs text-muted-foreground">
                          Quantity
                          <Input
                            className="mt-1 h-8"
                            inputMode="numeric"
                            value={String(answers[g.id]?.quantities?.[o.id] ?? 1)}
                            onChange={(e) => setQty(g.id, o.id, Number(e.target.value) || 1)}
                          />
                        </label>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export function initialAnswersForTemplate(
  template: EventOrderTemplateWithDetails,
): ChoicesAnswers {
  return defaultAnswersFromEventOrderTemplate(template);
}
