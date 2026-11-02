"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { plainSelectionRuleLabel } from "@/lib/event-order-templates/guided-setup";
import type { EventOrderTemplateGroup } from "@/lib/event-order-templates/types";

type GroupRule = Pick<
  EventOrderTemplateGroup,
  "id" | "selectionMode" | "minSelect" | "maxSelect"
>;

/**
 * Unified “Couples must choose N · Required” control for root and follow-up groups.
 * Preserves existing test ids via the `ids` prop.
 */
export function SelectionRuleControls({
  group,
  selectCount,
  required,
  pending,
  ids,
  countError,
  onSelectCountChange,
  onRequiredChange,
  onCommit,
  exampleHint,
}: {
  group: GroupRule;
  selectCount: string;
  required: boolean;
  pending: boolean;
  ids: {
    rules: string;
    count: string;
    required: string;
    hint: string;
    preset: (n: "1" | "2" | "3") => string;
  };
  countError?: string | null;
  onSelectCountChange: (raw: string) => void;
  onRequiredChange: (required: boolean) => void;
  onCommit: (count: string, required: boolean) => void;
  /** Optional example under the live rule (ceremony arch/runner/petals). */
  exampleHint?: string;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3" data-testid={ids.rules}>
      <div className="space-y-1">
        <Label htmlFor={ids.count} className="text-xs text-muted-foreground">
          Couples must choose
        </Label>
        <div className="flex items-center gap-1.5">
          {(["1", "2", "3"] as const).map((n) => (
            <button
              key={n}
              type="button"
              disabled={pending}
              data-testid={ids.preset(n)}
              className={`h-8 min-w-8 rounded-md border px-2 text-sm font-medium transition-colors ${
                selectCount === n
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-foreground hover:bg-muted"
              }`}
              onClick={() => {
                onSelectCountChange(n);
                onCommit(n, required);
              }}
            >
              {n}
            </button>
          ))}
          <Input
            id={ids.count}
            className="w-16"
            inputMode="numeric"
            value={selectCount}
            disabled={pending}
            aria-label="Custom choice count"
            data-testid={ids.count}
            onChange={(e) => onSelectCountChange(e.target.value)}
            onBlur={() => onCommit(selectCount, required)}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={required}
          disabled={pending}
          data-testid={ids.required}
          onChange={(e) => {
            onRequiredChange(e.target.checked);
            onCommit(selectCount, e.target.checked);
          }}
        />
        Required
      </label>
      <p className="w-full text-xs text-muted-foreground" data-testid={ids.hint}>
        {required
          ? `Required — exactly ${selectCount || "N"}${exampleHint ? ` (e.g. ${exampleHint})` : ""}.`
          : `Optional — up to ${selectCount || "N"}, or skip.`}{" "}
        Live rule: {plainSelectionRuleLabel(group)}.
      </p>
      {countError ? (
        <p className="w-full text-xs text-destructive" role="alert">
          {countError}
        </p>
      ) : null}
    </div>
  );
}
