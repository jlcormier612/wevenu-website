"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  clientsCanSelectLabel,
  simpleSelectionFromGroup,
  type MultipleLimit,
  type SimpleSelectionKind,
  type SimpleSelectionState,
} from "@/lib/event-order-templates/editor-presentation";
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

const KIND_OPTIONS: { id: SimpleSelectionKind; label: string }[] = [
  { id: "choose_one", label: "Choose one" },
  { id: "choose_multiple", label: "Choose multiple" },
  { id: "choose_quantities", label: "Choose items and quantities" },
];

const LIMIT_OPTIONS: { id: MultipleLimit; label: (count: number | null) => string }[] = [
  { id: "exactly", label: (count) => `Exactly ${count ?? 2}` },
  { id: "up_to", label: (count) => `Up to ${count ?? 2}` },
  { id: "any", label: () => "Any number" },
];

/**
 * Primary venue-facing selection rules. Maps to selection_mode, min_select,
 * max_select, and allow_quantity. Specialized count controls stay available
 * through the existing SelectionRuleControls when needed.
 */
export function SimpleSelectionRuleControls({
  group,
  pending,
  testId,
  onCommit,
}: {
  group: Pick<EventOrderTemplateGroup, "selectionMode" | "minSelect" | "maxSelect" | "allowQuantity">;
  pending: boolean;
  testId: string;
  onCommit: (next: SimpleSelectionState) => void;
}) {
  const state = simpleSelectionFromGroup(group);
  const [countDraft, setCountDraft] = React.useState(String(state.count ?? 2));
  const [showSpecialized, setShowSpecialized] = React.useState(false);

  React.useEffect(() => {
    setCountDraft(String(simpleSelectionFromGroup(group).count ?? 2));
  }, [group.selectionMode, group.minSelect, group.maxSelect, group.allowQuantity]);

  function commit(next: SimpleSelectionState) {
    onCommit(next);
  }

  return (
    <div className="space-y-3" data-testid={testId}>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Clients can choose</Label>
        <div className="flex flex-wrap gap-1.5">
          {KIND_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={pending}
              data-testid={`${testId}-${option.id}`}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                state.kind === option.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-foreground hover:bg-muted"
              }`}
              onClick={() =>
                commit({
                  ...state,
                  kind: option.id,
                  limit: option.id === "choose_one" ? "exactly" : state.limit,
                  count: option.id === "choose_one" ? 1 : state.count ?? 2,
                })
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={state.required}
          disabled={pending}
          data-testid={`${testId}-required`}
          onChange={(e) => commit({ ...state, required: e.target.checked })}
        />
        Required
      </label>
      {state.kind !== "choose_one" ? (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Clients can select</Label>
          <div className="flex flex-wrap gap-1.5">
            {LIMIT_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                disabled={pending}
                data-testid={`${testId}-limit-${option.id}`}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                  state.limit === option.id
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-foreground hover:bg-muted"
                }`}
                onClick={() =>
                  commit({
                    ...state,
                    limit: option.id,
                    count: option.id === "any" ? null : Number(countDraft) || 2,
                  })
                }
              >
                {option.label(state.count)}
              </button>
            ))}
          </div>
          {state.limit !== "any" ? (
            <div className="flex items-center gap-2">
              <Label htmlFor={`${testId}-count`} className="text-xs text-muted-foreground">
                Number
              </Label>
              <Input
                id={`${testId}-count`}
                className="w-16"
                inputMode="numeric"
                value={countDraft}
                disabled={pending}
                aria-label="How many clients can select"
                data-testid={`${testId}-count`}
                onChange={(e) => setCountDraft(e.target.value)}
                onBlur={() => {
                  const parsed = Number(countDraft);
                  if (!Number.isFinite(parsed) || parsed < 1) return;
                  commit({ ...state, count: Math.floor(parsed) });
                }}
              />
            </div>
          ) : null}
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">
        {clientsCanSelectLabel(state)} · {state.required ? "Required" : "Optional"}
      </p>
      <button
        type="button"
        className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        onClick={() => setShowSpecialized((open) => !open)}
      >
        {showSpecialized ? "Hide specialized limits" : "More specialized limits"}
      </button>
      {showSpecialized ? (
        <p className="text-xs text-muted-foreground">
          Live stored rule: {plainSelectionRuleLabel(group)}.
        </p>
      ) : null}
    </div>
  );
}
