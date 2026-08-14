"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addEventOrderTemplateLineAction, addEventOrderTemplateSectionAction,
  deleteEventOrderTemplateAction, removeEventOrderTemplateLineAction,
  removeEventOrderTemplateSectionAction, updateEventOrderTemplateAction,
} from "@/app/(app)/library/event-order-templates/actions";
import { BusinessAssetHeader } from "@/components/business-assets/asset-header";
import { LIBRARY_LABELS } from "@/components/library/labels";
import { LibrarySaveStatus, useLibrarySaveStatus } from "@/components/library/library-save-status";
import { librarySavedToastMessage, useLibraryUnsavedGuard } from "@/components/library/use-library-unsaved-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { EventOrderTemplateWithDetails } from "@/lib/event-order-templates/types";

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function RenameSheet({ template }: { template: EventOrderTemplateWithDetails }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(template.name);
  const [description, setDescription] = React.useState(template.description ?? "");
  const [error, setError] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const dirty = name !== template.name || description !== (template.description ?? "");
  const { confirmLeave } = useLibraryUnsavedGuard(open && dirty);

  function handleSave() {
    startTransition(async () => {
      const result = await updateEventOrderTemplateAction(template.id, { name, description });
      if (result.ok) { setOpen(false); setError(""); toast.success(librarySavedToastMessage()); }
      else setError(result.errors?.name ?? result.message ?? "Could not save.");
    });
  }

  return (
    <Sheet open={open} onOpenChange={(next) => {
      if (!next && dirty && !confirmLeave()) return;
      setOpen(next);
      if (next) {
        setName(template.name);
        setDescription(template.description ?? "");
        setError("");
      }
    }}>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="mr-1.5 h-3.5 w-3.5" />Edit
      </Button>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="mb-6"><SheetTitle>Edit Template</SheetTitle></SheetHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-heading">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-heading">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional" />
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <div className="mt-6 flex items-center justify-end gap-2">
          <LibrarySaveStatus status={pending ? "saving" : dirty ? "dirty" : "idle"} model="explicit" className="mr-auto" />
          <Button type="button" variant="outline" onClick={() => {
            if (confirmLeave()) setOpen(false);
          }} disabled={pending}>{LIBRARY_LABELS.cancel}</Button>
          <Button type="button" disabled={!name.trim() || pending || !dirty} onClick={handleSave}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : LIBRARY_LABELS.saveChanges}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AddSectionInline({
  templateId, onPersist,
}: {
  templateId: string;
  onPersist: (phase: "saving" | "saved" | "error", message?: string) => void;
}) {
  const [adding, setAdding] = React.useState(false);
  const [name, setName] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function handleAdd() {
    if (!name.trim()) return;
    startTransition(async () => {
      onPersist("saving");
      const result = await addEventOrderTemplateSectionAction(templateId, name);
      if (result.ok) { setName(""); setAdding(false); onPersist("saved"); }
      else { onPersist("error", result.message); toast.error(result.message ?? "Could not add section."); }
    });
  }

  if (!adding) return <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>+ Add Section</Button>;

  return (
    <div className="flex items-center gap-2">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Section name" autoFocus className="h-8 max-w-xs" />
      <Button type="button" size="sm" disabled={!name.trim() || pending} onClick={handleAdd}>
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => { setAdding(false); setName(""); }}>Cancel</Button>
    </div>
  );
}

function AddLineInline({
  templateId, sectionId, onPersist,
}: {
  templateId: string;
  sectionId: string | null;
  onPersist: (phase: "saving" | "saved" | "error", message?: string) => void;
}) {
  const [adding, setAdding] = React.useState(false);
  const [description, setDescription] = React.useState("");
  const [quantity, setQuantity] = React.useState("1");
  const [unitPrice, setUnitPrice] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function reset() { setDescription(""); setQuantity("1"); setUnitPrice(""); setAdding(false); }

  function handleAdd() {
    if (!description.trim()) return;
    startTransition(async () => {
      onPersist("saving");
      const result = await addEventOrderTemplateLineAction(templateId, { description, quantity, unitPrice: unitPrice || "0", sectionId });
      if (result.ok) { reset(); onPersist("saved"); }
      else { onPersist("error", result.message); toast.error(result.message ?? "Could not add line."); }
    });
  }

  if (!adding) return <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>+ Add Line</Button>;

  return (
    <div className="rounded-sm border border-border p-3 space-y-2">
      <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Line description" autoFocus />
      <div className="grid grid-cols-2 gap-2">
        <Input type="number" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Quantity" />
        <Input value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="Standard price (optional)" />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={pending}>Cancel</Button>
        <Button type="button" size="sm" disabled={!description.trim() || pending} onClick={handleAdd}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
        </Button>
      </div>
    </div>
  );
}

export function EventOrderTemplateDetail({ template }: { template: EventOrderTemplateWithDetails }) {
  const router = useRouter();
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [deleting, startDelete] = React.useTransition();
  const saveUi = useLibrarySaveStatus();
  const unsectioned = template.lines.filter((l) => !l.sectionId);

  function onPersist(phase: "saving" | "saved" | "error", message?: string) {
    if (phase === "saving") saveUi.markSaving();
    else if (phase === "saved") saveUi.markSaved();
    else { saveUi.markError(); if (message) toast.error(message); }
  }

  async function handleRemoveLine(lineId: string) {
    setRemovingId(lineId);
    onPersist("saving");
    const result = await removeEventOrderTemplateLineAction(template.id, lineId);
    setRemovingId(null);
    if (!result.ok) onPersist("error", result.message ?? "Could not remove line.");
    else onPersist("saved");
  }

  async function handleRemoveSection(sectionId: string, name: string) {
    if (!confirm(`Remove "${name}"? Its lines will stay, unsectioned.`)) return;
    setRemovingId(sectionId);
    onPersist("saving");
    const result = await removeEventOrderTemplateSectionAction(template.id, sectionId);
    setRemovingId(null);
    if (!result.ok) onPersist("error", result.message ?? "Could not remove section.");
    else onPersist("saved");
  }

  function handleDelete() {
    if (!confirm(`Delete "${template.name}"? This can't be undone. Event Orders already created from it are unaffected.`)) return;
    startDelete(async () => {
      const result = await deleteEventOrderTemplateAction(template.id);
      if (result.ok) { toast.success("Template deleted."); router.push("/library/event-order-templates"); }
      else toast.error(result.message ?? "Could not delete.");
    });
  }

  return (
    <div className="space-y-6">
      <BusinessAssetHeader
        backHref="/library/event-order-templates"
        backLabel="Event Order Templates"
        whatIsThis="Event Order Template"
        title={template.name}
        status={
          <>
            {template.sourceMasterKey && !template.isArchived && <Badge variant="muted">Starter</Badge>}
            {template.isArchived ? <Badge variant="muted">Archived</Badge> : <Badge variant="outline">Active</Badge>}
          </>
        }
        lastUpdated={new Date(template.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        primaryAction={<RenameSheet template={template} />}
      />
      {template.description && <p className="text-sm text-muted-foreground">{template.description}</p>}

      <Card>
        <CardContent className="space-y-6 py-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Sections and lines save as you add or remove them. Applying this template to an event copies them in. Editing here never changes an Event Order already created from it.
            </p>
            <LibrarySaveStatus status={saveUi.status} model="autosave" />
          </div>
          {template.sections.map((section) => {
            const lines = template.lines.filter((l) => l.sectionId === section.id);
            return (
              <div key={section.id} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-heading">{section.name}</p>
                  <div className="flex items-center gap-2">
                    <AddLineInline templateId={template.id} sectionId={section.id} onPersist={onPersist} />
                    <button type="button" onClick={() => handleRemoveSection(section.id, section.name)} disabled={removingId === section.id}
                      className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" aria-label="Remove section">
                      {removingId === section.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                {lines.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No lines in this section yet.</p>
                ) : (
                  <div>
                    {lines.map((line) => (
                      <div key={line.id} className="group flex items-center justify-between gap-3 py-2 border-b border-border last:border-0 text-sm">
                        <span className="text-foreground flex-1 min-w-0">{line.description}</span>
                        <span className="text-muted-foreground w-14 text-right">×{line.quantity}</span>
                        <span className="w-24 text-right font-medium text-foreground">{line.unitPrice > 0 ? formatMoney(line.unitPrice) : "—"}</span>
                        <button type="button" onClick={() => handleRemoveLine(line.id)} disabled={removingId === line.id}
                          className="opacity-0 group-hover:opacity-100 rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-opacity">
                          {removingId === line.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div className="space-y-2">
            {template.sections.length > 0 && <p className="text-sm font-semibold text-heading">General</p>}
            {unsectioned.length > 0 && (
              <div>
                {unsectioned.map((line) => (
                  <div key={line.id} className="group flex items-center justify-between gap-3 py-2 border-b border-border last:border-0 text-sm">
                    <span className="text-foreground flex-1 min-w-0">{line.description}</span>
                    <span className="text-muted-foreground w-14 text-right">×{line.quantity}</span>
                    <span className="w-24 text-right font-medium text-foreground">{line.unitPrice > 0 ? formatMoney(line.unitPrice) : "—"}</span>
                    <button type="button" onClick={() => handleRemoveLine(line.id)} disabled={removingId === line.id}
                      className="opacity-0 group-hover:opacity-100 rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-opacity">
                      {removingId === line.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <AddLineInline templateId={template.id} sectionId={null} onPersist={onPersist} />
              <AddSectionInline templateId={template.id} onPersist={onPersist} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" disabled={deleting} onClick={handleDelete}>
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Delete Template"}
        </Button>
      </div>
    </div>
  );
}
