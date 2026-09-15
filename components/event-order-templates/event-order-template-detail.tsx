"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Loader2, MoreHorizontal, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  addEventOrderTemplateLineAction,
  addEventOrderTemplateSectionAction,
  deleteEventOrderTemplateAction,
  removeEventOrderTemplateLineAction,
  removeEventOrderTemplateSectionAction,
  reorderEventOrderTemplateLinesAction,
  reorderEventOrderTemplateSectionsAction,
  updateEventOrderTemplateAction,
  updateEventOrderTemplateLineAction,
  updateEventOrderTemplateSectionAction,
} from "@/app/(app)/library/event-order-templates/actions";
import { OfferingEditorSheet } from "@/components/event-order-templates/offering-editor-sheet";
import { BusinessAssetHeader } from "@/components/business-assets/asset-header";
import { LIBRARY_LABELS } from "@/components/library/labels";
import { LibrarySaveStatus, useLibrarySaveStatus } from "@/components/library/library-save-status";
import { librarySavedToastMessage, useLibraryUnsavedGuard } from "@/components/library/use-library-unsaved-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  formatTemplateOfferingPrice,
  linesForSection,
  moveOrderedIds,
} from "@/lib/event-order-templates/offerings";
import type {
  AddTemplateLineInput, EventOrderTemplateLine, EventOrderTemplateSection,
  EventOrderTemplateWithDetails,
} from "@/lib/event-order-templates/types";
import type { Offering } from "@/lib/offerings/types";

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
        <SheetHeader className="mb-6"><SheetTitle>Event Order Template</SheetTitle></SheetHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-heading">Template name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-heading">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Optional" />
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <div className="mt-6 flex items-center justify-end gap-2">
          <LibrarySaveStatus status={pending ? "saving" : dirty ? "dirty" : "idle"} model="explicit" className="mr-auto" />
          <Button type="button" variant="outline" onClick={() => { if (confirmLeave()) setOpen(false); }} disabled={pending}>{LIBRARY_LABELS.cancel}</Button>
          <Button type="button" disabled={!name.trim() || pending || !dirty} onClick={handleSave}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : LIBRARY_LABELS.saveChanges}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function EventOrderTemplateDetail({
  template, catalogOfferings = [],
}: {
  template: EventOrderTemplateWithDetails;
  catalogOfferings?: Offering[];
}) {
  const router = useRouter();
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [deleting, startDelete] = React.useTransition();
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editorSectionId, setEditorSectionId] = React.useState<string | null>(null);
  const [editingLine, setEditingLine] = React.useState<EventOrderTemplateLine | null>(null);
  const [editorPending, startEditor] = React.useTransition();
  const [addingSection, setAddingSection] = React.useState(false);
  const [newSectionName, setNewSectionName] = React.useState("");
  const [newSectionGuidance, setNewSectionGuidance] = React.useState("");
  const [renaming, setRenaming] = React.useState<EventOrderTemplateSection | null>(null);
  const [renameName, setRenameName] = React.useState("");
  const [renameGuidance, setRenameGuidance] = React.useState("");
  const saveUi = useLibrarySaveStatus();

  const sections = [...template.sections].sort((a, b) => a.sortOrder - b.sortOrder);

  function onPersist(phase: "saving" | "saved" | "error", message?: string) {
    if (phase === "saving") saveUi.markSaving();
    else if (phase === "saved") saveUi.markSaved();
    else { saveUi.markError(); if (message) toast.error(message); }
  }

  async function persistLine(input: AddTemplateLineInput) {
    return await new Promise<boolean>((resolve) => {
      startEditor(async () => {
        onPersist("saving");
        const result = editingLine
          ? await updateEventOrderTemplateLineAction(template.id, editingLine.id, input)
          : await addEventOrderTemplateLineAction(template.id, input);
        if (result.ok) { onPersist("saved"); resolve(true); }
        else { onPersist("error", "message" in result ? result.message : "Could not save offering."); resolve(false); }
      });
    });
  }

  async function handleRemoveLine(lineId: string) {
    setRemovingId(lineId);
    onPersist("saving");
    const result = await removeEventOrderTemplateLineAction(template.id, lineId);
    setRemovingId(null);
    if (!result.ok) onPersist("error", result.message ?? "Could not remove offering.");
    else onPersist("saved");
  }

  async function handleRemoveSection(sectionId: string, name: string) {
    if (!confirm(`Remove “${name}” and its offerings from this template? Event Orders already created are not changed.`)) return;
    setRemovingId(sectionId);
    onPersist("saving");
    const result = await removeEventOrderTemplateSectionAction(template.id, sectionId);
    setRemovingId(null);
    if (!result.ok) onPersist("error", result.message ?? "Could not remove section.");
    else onPersist("saved");
  }

  async function moveSection(index: number, direction: -1 | 1) {
    const ids = sections.map((s) => s.id);
    const next = moveOrderedIds(ids, index, index + direction);
    if (next === ids || next.join() === ids.join()) return;
    onPersist("saving");
    const result = await reorderEventOrderTemplateSectionsAction(template.id, next);
    if (result.ok) onPersist("saved");
    else onPersist("error", result.message);
  }

  async function moveOffering(sectionId: string, index: number, direction: -1 | 1) {
    const offerings = linesForSection(template.lines, sectionId);
    const ids = offerings.map((l) => l.id);
    const next = moveOrderedIds(ids, index, index + direction);
    if (next.join() === ids.join()) return;
    onPersist("saving");
    const result = await reorderEventOrderTemplateLinesAction(template.id, next);
    if (result.ok) onPersist("saved");
    else onPersist("error", result.message);
  }

  function handleDelete() {
    if (!confirm(`Delete “${template.name}”? This can't be undone. Event Orders already created from it are unaffected.`)) return;
    startDelete(async () => {
      const result = await deleteEventOrderTemplateAction(template.id);
      if (result.ok) { toast.success("Template deleted."); router.push("/library/event-order-templates"); }
      else toast.error(result.message ?? "Could not delete.");
    });
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
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
        primaryAction={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" render={<Link href={`/library/event-order-templates/${template.id}/preview`} />}>
              Preview
            </Button>
            <RenameSheet template={template} />
          </div>
        }
      />

      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        You are building a reusable Event Order template. Add as much detail as you need — from simple sections to fully priced offerings. Applying this to an event creates that event’s own copy.
      </p>
      {template.description ? <p className="text-sm text-foreground">{template.description}</p> : null}

      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-sm font-semibold uppercase tracking-[0.16em] text-heading">Sections</h2>
        <LibrarySaveStatus status={saveUi.status} model="autosave" />
      </div>

      {sections.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Build the structure your team uses for this kind of event. Add as much detail as you need — from simple sections to fully priced offerings.
          </p>
        </div>
      ) : null}

      <div className="space-y-4">
        {sections.map((section, sectionIndex) => {
          const offerings = linesForSection(template.lines, section.id);
          return (
            <section key={section.id} className="rounded-lg border border-border bg-background p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-heading text-lg text-heading">{section.name}</h3>
                  {section.guidance ? (
                    <p className="mt-1 text-sm text-muted-foreground">{section.guidance}</p>
                  ) : null}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button type="button" variant="ghost" size="sm" className="shrink-0" aria-label={`${section.name} actions`} />}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => {
                      setRenaming(section);
                      setRenameName(section.name);
                      setRenameGuidance(section.guidance ?? "");
                    }}>Rename</DropdownMenuItem>
                    <DropdownMenuItem disabled={sectionIndex === 0} onClick={() => void moveSection(sectionIndex, -1)}>
                      Move up
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={sectionIndex === sections.length - 1} onClick={() => void moveSection(sectionIndex, 1)}>
                      Move down
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => void handleRemoveSection(section.id, section.name)}
                      disabled={removingId === section.id}
                    >
                      Remove section
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="mt-4 space-y-3">
                <p className="text-[0.7rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">Offerings</p>
                {offerings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No offerings yet. Add a priced item or a simple note with no price.</p>
                ) : (
                  offerings.map((line, lineIndex) => (
                    <div key={line.id} className="rounded-md border border-border/80 p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-heading">{line.description}</p>
                        {line.descriptionDetail ? (
                          <p className="mt-1 text-sm text-muted-foreground">{line.descriptionDetail}</p>
                        ) : null}
                        <p className="mt-2 text-sm text-foreground">{formatTemplateOfferingPrice(line)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {line.includedByDefault ? "Included" : "Not included by default"}
                          {line.quantity !== 1 ? ` · Default quantity ${line.quantity}` : ""}
                        </p>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1">
                        <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0" aria-label="Move earlier" disabled={lineIndex === 0} onClick={() => void moveOffering(section.id, lineIndex, -1)}>
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0" aria-label="Move later" disabled={lineIndex === offerings.length - 1} onClick={() => void moveOffering(section.id, lineIndex, 1)}>
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => { setEditingLine(line); setEditorSectionId(section.id); setEditorOpen(true); }}>
                          Edit
                        </Button>
                        <Button type="button" variant="ghost" size="sm" disabled={removingId === line.id} onClick={() => void handleRemoveLine(line.id)}>
                          {removingId === line.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Remove"}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setEditingLine(null); setEditorSectionId(section.id); setEditorOpen(true); }}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add offering
                </Button>
              </div>
            </section>
          );
        })}
      </div>

      {addingSection ? (
        <div className="space-y-2 rounded-lg border border-border p-4">
          <Input value={newSectionName} onChange={(e) => setNewSectionName(e.target.value)} placeholder="Section name" autoFocus />
          <Textarea value={newSectionGuidance} onChange={(e) => setNewSectionGuidance(e.target.value)} rows={2} placeholder="Description / guidance (optional)" />
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={!newSectionName.trim()} onClick={() => {
              startEditor(async () => {
                onPersist("saving");
                const result = await addEventOrderTemplateSectionAction(template.id, newSectionName, newSectionGuidance || null);
                if (result.ok) {
                  setAddingSection(false); setNewSectionName(""); setNewSectionGuidance(""); onPersist("saved");
                } else onPersist("error", result.message);
              });
            }}>Add section</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setAddingSection(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" onClick={() => setAddingSection(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add section
        </Button>
      )}

      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" disabled={deleting} onClick={handleDelete}>
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Delete Template"}
        </Button>
      </div>

      <OfferingEditorSheet
        open={editorOpen}
        onOpenChange={setEditorOpen}
        sectionId={editorSectionId}
        line={editingLine}
        catalogOfferings={catalogOfferings}
        pending={editorPending}
        onSave={persistLine}
      />

      <Sheet open={!!renaming} onOpenChange={(v) => { if (!v) setRenaming(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader className="mb-6"><SheetTitle>Rename section</SheetTitle></SheetHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={renameName} onChange={(e) => setRenameName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Description / guidance</Label>
              <Textarea value={renameGuidance} onChange={(e) => setRenameGuidance(e.target.value)} rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setRenaming(null)}>Cancel</Button>
              <Button type="button" disabled={!renameName.trim() || !renaming} onClick={() => {
                if (!renaming) return;
                startEditor(async () => {
                  onPersist("saving");
                  const result = await updateEventOrderTemplateSectionAction(template.id, renaming.id, {
                    name: renameName, guidance: renameGuidance || null,
                  });
                  if (result.ok) { setRenaming(null); onPersist("saved"); }
                  else onPersist("error", result.message);
                });
              }}>Save</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
