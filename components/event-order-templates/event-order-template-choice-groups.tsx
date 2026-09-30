"use client";

/**
 * Choice groups / options authoring for Event Order Templates
 * (commercial build sheet — absorbs Choices Template authoring).
 */
import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addEventOrderTemplateGroupAction,
  addEventOrderTemplateOptionAction,
  removeEventOrderTemplateGroupAction,
  removeEventOrderTemplateOptionAction,
} from "@/app/(app)/library/event-order-templates/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  choicesOptionDraftFromOffering,
  isCatalogBackedChoicesOption,
} from "@/lib/client-choices-templates/option-catalog";
import { optionsForGroup } from "@/lib/event-order-templates/offerings";
import type {
  EventOrderTemplateGroup,
  EventOrderTemplateWithDetails,
} from "@/lib/event-order-templates/types";
import type { Offering } from "@/lib/offerings/types";

type OptionMode = "idle" | "catalog" | "custom";

function formatOptionPrice(o: { isIncluded: boolean; unitPrice: number | null }): string {
  if (o.isIncluded) return "Included";
  if (o.unitPrice != null) return `$${o.unitPrice.toFixed(2)}`;
  return "Unpriced";
}

function groupRulesLabel(g: EventOrderTemplateGroup): string {
  const mode = g.selectionMode === "single" ? "Pick one" : "Pick many";
  const req = g.minSelect > 0 ? "required" : "optional";
  const qty = g.allowQuantity ? " · quantities" : "";
  return `${mode} · ${req}${qty}`;
}

export function EventOrderTemplateChoiceGroups({
  template,
  catalogOfferings,
  onPersist,
}: {
  template: EventOrderTemplateWithDetails;
  catalogOfferings: Offering[];
  onPersist: (phase: "saving" | "saved" | "error", message?: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const [groupName, setGroupName] = React.useState("");
  const [groupSectionId, setGroupSectionId] = React.useState<string>("");
  const [groupMode, setGroupMode] = React.useState<"single" | "multi">("single");
  const [groupRequired, setGroupRequired] = React.useState(true);

  const available = catalogOfferings.filter((o) => !o.isArchived);
  const [optionMode, setOptionMode] = React.useState<OptionMode>("idle");
  const [optionGroupId, setOptionGroupId] = React.useState<string>("");
  const [optionOfferingId, setOptionOfferingId] = React.useState<string>("");
  const [optionLabel, setOptionLabel] = React.useState("");
  const [optionIncluded, setOptionIncluded] = React.useState(true);
  const [optionPrice, setOptionPrice] = React.useState("");
  const [optionDefault, setOptionDefault] = React.useState(false);

  const offeringNameById = React.useMemo(
    () => new Map(catalogOfferings.map((o) => [o.id, o.name])),
    [catalogOfferings],
  );

  const groups = [...template.groups].sort((a, b) => a.sortOrder - b.sortOrder);

  function refresh() {
    router.refresh();
  }

  function resetOptionForm() {
    setOptionMode("idle");
    setOptionOfferingId("");
    setOptionLabel("");
    setOptionPrice("");
    setOptionIncluded(true);
    setOptionDefault(false);
  }

  function pickOffering(id: string) {
    const off = available.find((o) => o.id === id);
    setOptionOfferingId(id);
    if (!off) return;
    const draft = choicesOptionDraftFromOffering(off);
    setOptionLabel(draft.label);
    setOptionIncluded(draft.isIncluded);
    setOptionPrice(draft.unitPrice != null ? String(draft.unitPrice) : "");
  }

  function submitOption(offeringId: string | null) {
    if (!optionGroupId || !optionLabel.trim()) return;
    startTransition(async () => {
      onPersist("saving");
      const r = await addEventOrderTemplateOptionAction(template.id, {
        groupId: optionGroupId,
        offeringId,
        label: optionLabel,
        isIncluded: optionIncluded,
        unitPrice: optionIncluded ? "0" : (optionPrice.trim() || null),
        isDefault: optionDefault,
      });
      if (!r.ok) onPersist("error", r.errors?.label ?? r.message ?? "Could not add option.");
      else {
        onPersist("saved");
        resetOptionForm();
        refresh();
      }
    });
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-heading text-sm font-semibold uppercase tracking-[0.16em] text-heading">
          Choice groups
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Selectable commercial groups (Bar, Entrée, add-ons). Fixed offerings stay in sections above.
          Use and Send freeze these into the client selection runtime.
        </p>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          No choice groups yet. Add a group when clients or staff should pick among options.
        </p>
      ) : (
        <ul className="space-y-3">
          {groups.map((g) => {
            const opts = optionsForGroup(template.options, g.id);
            const sectionName = g.sectionId
              ? template.sections.find((s) => s.id === g.sectionId)?.name
              : null;
            return (
              <li key={g.id} className="rounded-lg border border-border bg-background p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-heading">{g.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {groupRulesLabel(g)}
                      {sectionName ? ` · ${sectionName}` : ""}
                    </p>
                    {g.instructions ? (
                      <p className="mt-1 text-sm text-muted-foreground">{g.instructions}</p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    aria-label={`Remove ${g.name}`}
                    onClick={() => startTransition(async () => {
                      if (!confirm(`Remove “${g.name}” and its options from this template?`)) return;
                      onPersist("saving");
                      const r = await removeEventOrderTemplateGroupAction(template.id, g.id);
                      if (!r.ok) onPersist("error", r.message ?? "Could not remove group.");
                      else { onPersist("saved"); refresh(); }
                    })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <ul className="space-y-1 pl-1">
                  {opts.length === 0 ? (
                    <li className="text-sm text-muted-foreground">No options yet.</li>
                  ) : (
                    opts.map((o) => {
                      const catalogName = o.offeringId ? offeringNameById.get(o.offeringId) : null;
                      return (
                        <li key={o.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="min-w-0">
                            <span className="font-medium text-heading">{o.label}</span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {formatOptionPrice(o)}
                              {o.isDefault ? " · Default" : ""}
                            </span>
                            <span className="block text-[0.7rem] text-muted-foreground">
                              {isCatalogBackedChoicesOption(o)
                                ? (catalogName ? `From catalog · ${catalogName}` : "From catalog")
                                : "Custom"}
                            </span>
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={pending}
                            aria-label={`Remove ${o.label}`}
                            onClick={() => startTransition(async () => {
                              onPersist("saving");
                              const r = await removeEventOrderTemplateOptionAction(template.id, o.id);
                              if (!r.ok) onPersist("error", r.message ?? "Could not remove option.");
                              else { onPersist("saved"); refresh(); }
                            })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </li>
                      );
                    })
                  )}
                </ul>
              </li>
            );
          })}
        </ul>
      )}

      <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Add choice group</p>
        <Input
          placeholder="Group name (e.g. Bar package)"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
        />
        <select
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={groupSectionId}
          onChange={(e) => setGroupSectionId(e.target.value)}
        >
          <option value="">No section</option>
          {template.sections.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="eo-group-mode"
              checked={groupMode === "single"}
              onChange={() => setGroupMode("single")}
            />
            Pick one
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="eo-group-mode"
              checked={groupMode === "multi"}
              onChange={() => setGroupMode("multi")}
            />
            Pick many
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={groupRequired}
              onChange={(e) => setGroupRequired(e.target.checked)}
            />
            Required
          </label>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={pending || !groupName.trim()}
          onClick={() => startTransition(async () => {
            onPersist("saving");
            const r = await addEventOrderTemplateGroupAction(template.id, {
              sectionId: groupSectionId || null,
              name: groupName,
              selectionMode: groupMode,
              minSelect: groupRequired ? 1 : 0,
              maxSelect: groupMode === "single" ? 1 : null,
              allowQuantity: false,
            });
            if (!r.ok) onPersist("error", r.errors?.name ?? r.message ?? "Could not add group.");
            else {
              onPersist("saved");
              setGroupName("");
              refresh();
            }
          })}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add group
        </Button>
      </div>

      <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Add option</p>
        <select
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={optionGroupId}
          onChange={(e) => setOptionGroupId(e.target.value)}
        >
          <option value="">Select group…</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>

        {optionMode === "idle" ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!optionGroupId || available.length === 0}
              onClick={() => setOptionMode("catalog")}
            >
              + Select Offering
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!optionGroupId}
              onClick={() => setOptionMode("custom")}
            >
              + Add custom option
            </Button>
            {available.length === 0 ? (
              <p className="w-full text-xs text-muted-foreground">
                No Offerings yet — add a custom option, or create Offerings first.
              </p>
            ) : null}
          </div>
        ) : null}

        {optionMode === "catalog" ? (
          <div className="space-y-2">
            <Label className="text-sm">Select Offering</Label>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={optionOfferingId}
              onChange={(e) => pickOffering(e.target.value)}
              autoFocus
            >
              <option value="">Choose an offering…</option>
              {available.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            <Input
              placeholder="Customer-facing label"
              value={optionLabel}
              onChange={(e) => setOptionLabel(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={optionIncluded}
                onChange={(e) => setOptionIncluded(e.target.checked)}
              />
              Included ($0)
            </label>
            {!optionIncluded ? (
              <Input
                placeholder="Unit price"
                value={optionPrice}
                onChange={(e) => setOptionPrice(e.target.value)}
              />
            ) : null}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={optionDefault}
                onChange={(e) => setOptionDefault(e.target.checked)}
              />
              Pre-selected (default)
            </label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={pending || !optionOfferingId || !optionLabel.trim()}
                onClick={() => submitOption(optionOfferingId || null)}
              >
                Add option
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={resetOptionForm}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {optionMode === "custom" ? (
          <div className="space-y-2">
            <Input
              placeholder="Option label"
              value={optionLabel}
              onChange={(e) => setOptionLabel(e.target.value)}
              autoFocus
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={optionIncluded}
                onChange={(e) => setOptionIncluded(e.target.checked)}
              />
              Included ($0)
            </label>
            {!optionIncluded ? (
              <Input
                placeholder="Unit price"
                value={optionPrice}
                onChange={(e) => setOptionPrice(e.target.value)}
              />
            ) : null}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={optionDefault}
                onChange={(e) => setOptionDefault(e.target.checked)}
              />
              Pre-selected (default)
            </label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={pending || !optionLabel.trim()}
                onClick={() => submitOption(null)}
              >
                Add custom option
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={resetOptionForm}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
