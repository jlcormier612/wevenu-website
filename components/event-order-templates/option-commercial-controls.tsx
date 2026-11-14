"use client";

/**
 * Compact Included / Additional / Not configured controls for a template option.
 * Persists through the existing option update action — no pricing wizard.
 */
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { commercialState, venueCommercialLabel } from "@/lib/event-order-templates/commercial-state";

export type OptionCommercialDraft = {
  state: "not_configured" | "included" | "additional";
  price: string;
};

export function commercialDraftFromOption(option: {
  isIncluded: boolean;
  unitPrice: number | null;
}): OptionCommercialDraft {
  const state = commercialState(option);
  return {
    state,
    price: option.unitPrice != null && state === "additional" ? String(option.unitPrice) : "",
  };
}

export function commercialDraftToWrite(draft: OptionCommercialDraft): {
  isIncluded: boolean;
  unitPrice: number | null;
} {
  if (draft.state === "included") return { isIncluded: true, unitPrice: 0 };
  if (draft.state === "not_configured") return { isIncluded: false, unitPrice: null };
  const n = Number(draft.price);
  return {
    isIncluded: false,
    unitPrice: draft.price.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : null,
  };
}

export function OptionCommercialControls({
  optionId,
  optionLabel,
  draft,
  onChange,
  onSave,
  pending = false,
  showSave = true,
}: {
  optionId: string;
  optionLabel?: string;
  draft: OptionCommercialDraft;
  onChange: (next: OptionCommercialDraft) => void;
  onSave?: () => void;
  pending?: boolean;
  showSave?: boolean;
}) {
  return (
    <fieldset
      className="space-y-2"
      data-testid={`eo-option-commercial-${optionId}`}
    >
      <legend className="text-xs font-medium text-heading">
        {optionLabel ? `Commercial configuration · ${optionLabel}` : "Commercial configuration"}
      </legend>
      <p className="text-xs text-muted-foreground">
        Not configured until you mark it Included or set an Additional price.
      </p>
      <div className="flex flex-col gap-1.5 text-sm">
        {([
          ["not_configured", "Not configured"],
          ["included", "Included"],
          ["additional", "Additional"],
        ] as const).map(([value, label]) => (
          <label key={value} className="flex items-center gap-2">
            <input
              type="radio"
              name={`eo-commercial-${optionId}`}
              checked={draft.state === value}
              onChange={() => onChange({ ...draft, state: value })}
              data-testid={`eo-option-commercial-${value}-${optionId}`}
            />
            {label}
          </label>
        ))}
      </div>
      {draft.state === "additional" ? (
        <div className="space-y-1">
          <Label htmlFor={`eo-option-price-${optionId}`} className="text-xs">
            Price
          </Label>
          <Input
            id={`eo-option-price-${optionId}`}
            value={draft.price}
            onChange={(e) => onChange({ ...draft, price: e.target.value })}
            placeholder="Amount"
            inputMode="decimal"
            data-testid={`eo-option-commercial-price-${optionId}`}
          />
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground" data-testid={`eo-option-commercial-preview-${optionId}`}>
        {venueCommercialLabel({
          isIncluded: commercialDraftToWrite(draft).isIncluded,
          unitPrice: commercialDraftToWrite(draft).unitPrice,
        })}
      </p>
      {showSave && onSave ? (
        <Button
          type="button"
          size="sm"
          disabled={pending}
          data-testid={`eo-option-commercial-save-${optionId}`}
          onClick={onSave}
        >
          Save
        </Button>
      ) : null}
    </fieldset>
  );
}

export function OptionCommercialEditor({
  option,
  pending,
  onSave,
}: {
  option: { id: string; label: string; isIncluded: boolean; unitPrice: number | null };
  pending: boolean;
  onSave: (next: { label: string; isIncluded: boolean; unitPrice: number | null }) => void;
}) {
  const [label, setLabel] = React.useState(option.label);
  const [draft, setDraft] = React.useState(commercialDraftFromOption(option));
  React.useEffect(() => {
    setLabel(option.label);
    setDraft(commercialDraftFromOption(option));
  }, [option.id, option.label, option.isIncluded, option.unitPrice]);

  function save() {
    const commercial = commercialDraftToWrite(draft);
    onSave({
      label: label.trim() || option.label,
      isIncluded: commercial.isIncluded,
      unitPrice: commercial.unitPrice,
    });
  }

  return (
    <div
      className="space-y-3 rounded-md border border-border bg-card px-3 py-3"
      data-testid={`eo-option-editor-${option.id}`}
    >
      <div className="space-y-1">
        <Label htmlFor={`eo-option-rename-${option.id}`} className="text-xs">
          Offering name
        </Label>
        <Input
          id={`eo-option-rename-${option.id}`}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          data-testid={`eo-option-rename-${option.id}`}
        />
      </div>
      <OptionCommercialControls
        optionId={option.id}
        draft={draft}
        onChange={setDraft}
        pending={pending}
        showSave={false}
      />
      <Button
        type="button"
        size="sm"
        disabled={pending || !label.trim()}
        data-testid={`eo-option-editor-save-${option.id}`}
        onClick={save}
      >
        Save
      </Button>
    </div>
  );
}
