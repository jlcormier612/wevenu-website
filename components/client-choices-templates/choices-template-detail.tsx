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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ChoicesTemplateWithDetails } from "@/lib/client-choices-templates/types";
import type { Offering } from "@/lib/offerings/types";

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

  const [sectionName, setSectionName] = React.useState("");
  const [groupName, setGroupName] = React.useState("");
  const [groupSectionId, setGroupSectionId] = React.useState<string>("");
  const [optionLabel, setOptionLabel] = React.useState("");
  const [optionGroupId, setOptionGroupId] = React.useState<string>("");
  const [optionOfferingId, setOptionOfferingId] = React.useState<string>("");
  const [optionIncluded, setOptionIncluded] = React.useState(true);
  const [optionPrice, setOptionPrice] = React.useState("");

  function refresh() {
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3 rounded-sm border border-border p-4">
        <div className="space-y-1.5">
          <Label>Template name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </div>
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => startTransition(async () => {
            const result = await updateChoicesTemplateAction(template.id, { name, description });
            if (!result.ok) toast.error(result.message ?? "Could not save.");
            else { toast.success("Saved."); refresh(); }
          })}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </Button>
      </div>

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
              const r = await addChoicesTemplateSectionAction(template.id, sectionName);
              if (!r.ok) toast.error(r.message ?? "Failed");
              else { setSectionName(""); refresh(); }
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
                      await removeChoicesTemplateGroupAction(template.id, g.id);
                      refresh();
                    })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <ul className="space-y-1 pl-2">
                  {opts.map((o) => (
                    <li key={o.id} className="flex items-center justify-between text-sm">
                      <span>
                        {o.label}
                        <span className="text-xs text-muted-foreground ml-2">
                          {o.isIncluded ? "Included" : o.unitPrice != null ? `$${o.unitPrice.toFixed(2)}` : "Priced"}
                        </span>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => startTransition(async () => {
                          await removeChoicesTemplateOptionAction(template.id, o.id);
                          refresh();
                        })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
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
              const r = await addChoicesTemplateGroupAction(template.id, {
                sectionId: groupSectionId || null,
                name: groupName,
                selectionMode: "single",
                minSelect: 1,
                maxSelect: 1,
                allowQuantity: false,
              });
              if (!r.ok) toast.error(r.message ?? "Failed");
              else { setGroupName(""); refresh(); }
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
          <Input placeholder="Label" value={optionLabel} onChange={(e) => setOptionLabel(e.target.value)} />
          <select
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={optionOfferingId}
            onChange={(e) => {
              setOptionOfferingId(e.target.value);
              const off = offerings.find((o) => o.id === e.target.value);
              if (off) {
                setOptionLabel(off.name);
                if (off.defaultUnitPrice != null) {
                  setOptionIncluded(false);
                  setOptionPrice(String(off.defaultUnitPrice));
                }
              }
            }}
          >
            <option value="">Optional: link Offering…</option>
            {offerings.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={optionIncluded} onChange={(e) => setOptionIncluded(e.target.checked)} />
            Included (no additional cost)
          </label>
          {!optionIncluded ? (
            <Input placeholder="Unit price" value={optionPrice} onChange={(e) => setOptionPrice(e.target.value)} />
          ) : null}
          <Button
            type="button"
            size="sm"
            disabled={pending || !optionGroupId || !optionLabel.trim()}
            onClick={() => startTransition(async () => {
              const price = optionIncluded ? 0 : (optionPrice.trim() === "" ? null : Number(optionPrice.replace(/[$,]/g, "")));
              if (!optionIncluded && price != null && (Number.isNaN(price) || price < 0)) {
                toast.error("Enter a valid price.");
                return;
              }
              const r = await addChoicesTemplateOptionAction(template.id, {
                groupId: optionGroupId,
                offeringId: optionOfferingId || null,
                label: optionLabel,
                isIncluded: optionIncluded,
                unitPrice: optionIncluded ? 0 : price,
              });
              if (!r.ok) toast.error(r.message ?? "Failed");
              else {
                setOptionLabel("");
                setOptionOfferingId("");
                setOptionPrice("");
                setOptionIncluded(true);
                refresh();
              }
            })}
          >
            Add option
          </Button>
        </div>
      </section>
    </div>
  );
}
