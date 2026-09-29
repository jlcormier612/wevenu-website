"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addChoicesTemplateGroupAction,
  addChoicesTemplateOptionAction,
  addChoicesTemplateSectionAction,
  removeChoicesTemplateGroupAction,
  removeChoicesTemplateOptionAction,
  updateChoicesTemplateAction,
} from "@/app/(app)/library/choices-templates/actions";
import { LibraryAutosaveHint, LibrarySaveStatus, useLibrarySaveStatus } from "@/components/library/library-save-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  choicesOptionDraftFromOffering,
  customChoicesOptionDraft,
  isCatalogBackedChoicesOption,
} from "@/lib/client-choices-templates/option-catalog";
import type { ChoicesTemplateWithDetails } from "@/lib/client-choices-templates/types";
import type { Offering } from "@/lib/offerings/types";

type OptionMode = "idle" | "catalog" | "custom";

export function ChoicesTemplateDetail({
  template,
  offerings,
}: {
  template: ChoicesTemplateWithDetails;
  offerings: Offering[];
}) {
  const router = useRouter();
  const [name, setName] = React.useState(template.name);
  const [description, setDescription] = React.useState(template.description ?? "");
  const [pending, startTransition] = React.useTransition();
  const saveUi = useLibrarySaveStatus();
  const metaTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const [sectionName, setSectionName] = React.useState("");
  const [groupName, setGroupName] = React.useState("");
  const [groupSectionId, setGroupSectionId] = React.useState<string>("");

  const available = offerings.filter((o) => !o.isArchived);
  const [optionMode, setOptionMode] = React.useState<OptionMode>("idle");
  const [optionGroupId, setOptionGroupId] = React.useState<string>("");
  const [optionOfferingId, setOptionOfferingId] = React.useState<string>("");
  const [optionLabel, setOptionLabel] = React.useState("");
  const [optionIncluded, setOptionIncluded] = React.useState(true);
  const [optionPrice, setOptionPrice] = React.useState("");

  function refresh() {
    router.refresh();
  }

  function onPersist(phase: "saving" | "saved" | "error", message?: string) {
    if (phase === "saving") saveUi.markSaving();
    else if (phase === "saved") saveUi.markSaved();
    else { saveUi.markError(); if (message) toast.error(message); }
  }

  function queueMetadataSave(nextName: string, nextDescription: string) {
    saveUi.markDirty();
    if (metaTimer.current) clearTimeout(metaTimer.current);
    metaTimer.current = setTimeout(() => {
      startTransition(async () => {
        onPersist("saving");
        const result = await updateChoicesTemplateAction(template.id, {
          name: nextName,
          description: nextDescription,
        });
        if (!result.ok) onPersist("error", result.message ?? "Could not save.");
        else { onPersist("saved"); refresh(); }
      });
    }, 400);
  }

  React.useEffect(() => () => {
    if (metaTimer.current) clearTimeout(metaTimer.current);
  }, []);

  function resetOptionForm() {
    setOptionMode("idle");
    setOptionOfferingId("");
    setOptionLabel("");
    setOptionPrice("");
    setOptionIncluded(true);
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
    const price = optionIncluded ? 0 : (optionPrice.trim() === "" ? null : Number(optionPrice.replace(/[$,]/g, "")));
    if (!optionIncluded && price != null && (Number.isNaN(price) || price < 0)) {
      toast.error("Enter a valid price.");
      return;
    }
    startTransition(async () => {
      onPersist("saving");
      const r = await addChoicesTemplateOptionAction(template.id, {
        groupId: optionGroupId,
        offeringId,
        label: optionLabel,
        isIncluded: optionIncluded,
        unitPrice: optionIncluded ? 0 : price,
      });
      if (!r.ok) onPersist("error", r.message ?? "Failed");
      else {
        onPersist("saved");
        resetOptionForm();
        refresh();
      }
    });
  }

  const offeringNameById = React.useMemo(() => {
    const map = new Map(offerings.map((o) => [o.id, o.name]));
    return map;
  }, [offerings]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <LibraryAutosaveHint />
        <LibrarySaveStatus status={saveUi.status} model="autosave" />
      </div>

      <div className="space-y-3 rounded-sm border border-border p-4">
        <div className="space-y-1.5">
          <Label>Template name</Label>
          <Input
            value={name}
            onChange={(e) => {
              const v = e.target.value;
              setName(v);
              queueMetadataSave(v, description);
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea
            value={description}
            onChange={(e) => {
              const v = e.target.value;
              setDescription(v);
              queueMetadataSave(name, v);
            }}
            rows={2}
          />
        </div>
      </div>

      <p className="rounded-sm border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        Select offerings as options first. You can customize the customer-facing label without losing the Offering link. Use a custom option only for one-offs.
      </p>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-heading">Sections</h2>
        <ul className="space-y-1 text-sm">
          {template.sections.map((s) => (
            <li key={s.id} className="rounded-sm border border-border px-3 py-2">{s.name}</li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input placeholder="Section name" value={sectionName} onChange={(e) => setSectionName(e.target.value)} />
          <Button
            type="button"
            size="sm"
            disabled={pending || !sectionName.trim()}
            onClick={() => startTransition(async () => {
              onPersist("saving");
              const r = await addChoicesTemplateSectionAction(template.id, sectionName);
              if (!r.ok) onPersist("error", r.message ?? "Failed");
              else { onPersist("saved"); setSectionName(""); refresh(); }
            })}
          >
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-heading">Choice groups</h2>
        <ul className="space-y-3">
          {template.groups.map((g) => {
            const opts = template.options.filter((o) => o.groupId === g.id);
            return (
              <li key={g.id} className="rounded-sm border border-border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{g.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.selectionMode === "single" ? "Pick one" : "Pick many"}
                      {g.minSelect > 0 ? " · required" : " · optional"}
                      {g.allowQuantity ? " · quantities" : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => startTransition(async () => {
                      onPersist("saving");
                      const r = await removeChoicesTemplateGroupAction(template.id, g.id);
                      if (!r.ok) onPersist("error", "message" in r ? r.message : "Failed");
                      else { onPersist("saved"); refresh(); }
                    })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <ul className="space-y-1 pl-2">
                  {opts.map((o) => {
                    const catalogName = o.offeringId ? offeringNameById.get(o.offeringId) : null;
                    return (
                      <li key={o.id} className="flex items-center justify-between text-sm gap-2">
                        <span className="min-w-0">
                          <span className="font-medium">{o.label}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {o.isIncluded ? "Included" : o.unitPrice != null ? `$${o.unitPrice.toFixed(2)}` : "Priced"}
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
                          onClick={() => startTransition(async () => {
                            onPersist("saving");
                            const r = await removeChoicesTemplateOptionAction(template.id, o.id);
                            if (!r.ok) onPersist("error", "message" in r ? r.message : "Failed");
                            else { onPersist("saved"); refresh(); }
                          })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>

        <div className="rounded-sm border border-dashed border-border p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Add group</p>
          <Input placeholder="Group name (e.g. Entrée)" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
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
          <Button
            type="button"
            size="sm"
            disabled={pending || !groupName.trim()}
            onClick={() => startTransition(async () => {
              onPersist("saving");
              const r = await addChoicesTemplateGroupAction(template.id, {
                sectionId: groupSectionId || null,
                name: groupName,
                selectionMode: "single",
                minSelect: 1,
                maxSelect: 1,
                allowQuantity: false,
              });
              if (!r.ok) onPersist("error", r.message ?? "Failed");
              else { onPersist("saved"); setGroupName(""); refresh(); }
            })}
          >
            Add group
          </Button>
        </div>

        <div className="rounded-sm border border-dashed border-border p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Add option</p>
          <select
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={optionGroupId}
            onChange={(e) => setOptionGroupId(e.target.value)}
          >
            <option value="">Select group…</option>
            {template.groups.map((g) => (
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
                <p className="w-full text-xs text-muted-foreground">No Offerings yet — add a custom option, or create Offerings first.</p>
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
              {optionOfferingId ? (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Customer-facing label</Label>
                    <Input
                      value={optionLabel}
                      onChange={(e) => setOptionLabel(e.target.value)}
                      placeholder="Shown to the client"
                    />
                    <p className="text-xs text-muted-foreground">
                      You can shorten the label; the Offering link stays.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={optionIncluded} onChange={(e) => setOptionIncluded(e.target.checked)} />
                    Included (no additional cost)
                  </label>
                  {!optionIncluded ? (
                    <Input placeholder="Unit price" value={optionPrice} onChange={(e) => setOptionPrice(e.target.value)} />
                  ) : null}
                </>
              ) : null}
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={resetOptionForm} disabled={pending}>Cancel</Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={pending || !optionOfferingId || !optionLabel.trim()}
                  onClick={() => submitOption(optionOfferingId)}
                >
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add option"}
                </Button>
              </div>
            </div>
          ) : null}

          {optionMode === "custom" ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Custom option — not linked to Offerings.</p>
              <Input
                placeholder="Label"
                value={optionLabel}
                onChange={(e) => setOptionLabel(e.target.value)}
                autoFocus
              />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={optionIncluded} onChange={(e) => setOptionIncluded(e.target.checked)} />
                Included (no additional cost)
              </label>
              {!optionIncluded ? (
                <Input placeholder="Unit price" value={optionPrice} onChange={(e) => setOptionPrice(e.target.value)} />
              ) : null}
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={resetOptionForm} disabled={pending}>Cancel</Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={pending || !optionLabel.trim()}
                  onClick={() => {
                    const draft = customChoicesOptionDraft(optionLabel);
                    setOptionLabel(draft.label);
                    submitOption(null);
                  }}
                >
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add option"}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
