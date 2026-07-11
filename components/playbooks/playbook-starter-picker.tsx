"use client";

/**
 * PlaybookStarterPicker — reuses the Day-of Timeline's Template Picker sheet
 * pattern (card-based selection, live preview, "fully editable after")
 * instead of inventing a new starting-point interaction.
 *
 * Two-step flow (Product Decisions, 2026-07-08): a venue first chooses which
 * of the two independent planning checklists they're building — Client
 * Planning or Venue Planning — then picks a starting point scoped to that
 * type. Duplicating an existing template only ever offers templates of the
 * same type; a Client Planning template can't accidentally become the basis
 * for a Venue Planning one.
 *
 * Creating a template is a secondary action (Planning Templates UX Rebuild,
 * 2026-07-09) — this whole flow is reached through a plain button, not a
 * prominent call to action, once the library already has content.
 */

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";

import {
  createStandardClientPlanningTemplateAction, createStandardVenueWorkflowTemplateAction,
  createTemplateAction, createTemplateFromImportAction, duplicateTemplateAction,
} from "@/app/(app)/playbooks/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { EVENT_TYPES } from "@/lib/leads/constants";
import { PLAYBOOK_KINDS } from "@/lib/playbooks/constants";
import {
  STANDARD_CLIENT_PLANNING_MILESTONES, STANDARD_CLIENT_PLANNING_TASKS,
  STANDARD_VENUE_WORKFLOW_MILESTONES, STANDARD_VENUE_WORKFLOW_TASKS,
} from "@/lib/playbooks/constants";
import type { PlaybookKind, PlaybookTemplate } from "@/lib/playbooks/types";

function referenceFor(kind: PlaybookKind) {
  return kind === "client"
    ? { name: "Standard Wedding", milestones: STANDARD_CLIENT_PLANNING_MILESTONES, tasks: STANDARD_CLIENT_PLANNING_TASKS }
    : { name: "Standard Wedding", milestones: STANDARD_VENUE_WORKFLOW_MILESTONES, tasks: STANDARD_VENUE_WORKFLOW_TASKS };
}

type StarterChoice = "standard" | "existing" | "scratch" | "import";

export function PlaybookStarterPicker({
  existingTemplates = [], compact,
}: { existingTemplates?: PlaybookTemplate[]; compact?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [kind, setKind] = React.useState<PlaybookKind | null>(null);
  const [selected, setSelected] = React.useState<StarterChoice | null>(null);
  const [sourceTemplateId, setSourceTemplateId] = React.useState("");
  const [scratchName, setScratchName] = React.useState("");
  const [scratchEventType, setScratchEventType] = React.useState(EVENT_TYPES[0].value);
  const [importName, setImportName] = React.useState("");
  const [importText, setImportText] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function reset() {
    setKind(null); setSelected(null); setSourceTemplateId(""); setScratchName(""); setScratchEventType(EVENT_TYPES[0].value);
    setImportName(""); setImportText("");
  }

  function goToBuilder(templateId: string) {
    setOpen(false);
    reset();
    router.push(`/library/playbooks/${templateId}`);
  }

  const sameKindTemplates = existingTemplates.filter((t) => t.kind === kind);

  function handleApply() {
    if (!kind) return;
    if (selected === "standard") {
      startTransition(async () => {
        const result = kind === "client" ? await createStandardClientPlanningTemplateAction() : await createStandardVenueWorkflowTemplateAction();
        if (result.ok) { toast.success(`${referenceFor(kind).name} template created.`); goToBuilder(result.templateId); }
        else toast.error(result.message ?? "Could not create template.");
      });
    } else if (selected === "existing" && sourceTemplateId) {
      const source = sameKindTemplates.find((t) => t.id === sourceTemplateId);
      startTransition(async () => {
        const result = await duplicateTemplateAction(sourceTemplateId, `${source?.name ?? "Template"} (Copy)`);
        if (result.ok) { toast.success("Template duplicated."); goToBuilder(result.templateId); }
        else toast.error(result.message ?? "Could not duplicate template.");
      });
    } else if (selected === "scratch" && scratchName.trim()) {
      startTransition(async () => {
        const result = await createTemplateAction(scratchName.trim(), kind, scratchEventType, null);
        if (result.ok) { toast.success("Template created."); goToBuilder(result.templateId); }
        else toast.error(result.message ?? "Could not create template.");
      });
    } else if (selected === "import" && importName.trim() && importText.trim()) {
      startTransition(async () => {
        const result = await createTemplateFromImportAction(importText, kind, importName.trim());
        if (result.ok) {
          toast.success(
            result.guessedCount > 0
              ? `Imported ${result.taskCount} tasks — Luv estimated timing for ${result.guessedCount} of them, so double-check those first.`
              : `Imported ${result.taskCount} tasks.`,
          );
          goToBuilder(result.templateId);
        } else {
          toast.error(result.message);
        }
      });
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <SheetTrigger render={<Button type="button" variant={compact ? "outline" : "default"} size={compact ? "sm" : "default"} />}>
        <Wand2 className="mr-1.5 h-4 w-4" />New template
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        {!kind ? (
          <>
            <SheetHeader className="mb-6">
              <SheetTitle>What kind of checklist is this?</SheetTitle>
              <p className="text-sm text-muted-foreground">
                Client Planning and Venue Planning are separate checklists — choosing one determines what this template can do.
              </p>
            </SheetHeader>
            <div className="space-y-3">
              {PLAYBOOK_KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => setKind(k.value)}
                  className="w-full rounded-xl border border-border p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
                >
                  <p className="font-medium text-foreground">{k.emoji} {k.label}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{k.description}</p>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <SheetHeader className="mb-6">
              <button type="button" onClick={() => setKind(null)} className="mb-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                ← Change kind
              </button>
              <SheetTitle>Start a {PLAYBOOK_KINDS.find((k) => k.value === kind)?.label} checklist</SheetTitle>
              <p className="text-sm text-muted-foreground">
                Start with a proven checklist. Every task is yours to rename, reorder, add, or remove after.
              </p>
            </SheetHeader>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setSelected("standard")}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${
                  selected === "standard" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/40"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-foreground">{referenceFor(kind).name}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {referenceFor(kind).milestones.length} sections · {referenceFor(kind).tasks.length} tasks
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {kind === "client"
                    ? "Booking through post-event, for your client to work through themselves."
                    : "Booking through post-event, for your team to run internally."}
                </p>
                {selected === "standard" && (
                  <div className="mt-3 space-y-1 border-t border-border pt-3">
                    {referenceFor(kind).milestones.map((m) => (
                      <p key={m.name} className="text-xs text-muted-foreground">
                        · {m.name} — {referenceFor(kind).tasks.filter((t) => referenceFor(kind).milestones[t.milestoneIndex].name === m.name).length} tasks
                      </p>
                    ))}
                  </div>
                )}
              </button>

              {sameKindTemplates.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelected("existing")}
                  className={`w-full rounded-xl border p-4 text-left transition-colors ${
                    selected === "existing" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/40"
                  }`}
                >
                  <p className="font-medium text-foreground">Duplicate one of your own</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">Start from an existing template and adjust it from there.</p>
                  {selected === "existing" && (
                    <div className="mt-3 space-y-1.5 border-t border-border pt-3" onClick={(e) => e.stopPropagation()}>
                      {sameKindTemplates.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSourceTemplateId(t.id)}
                          className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                            sourceTemplateId === t.id ? "border-primary bg-primary/10 font-medium" : "border-border hover:border-primary/40"
                          }`}
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelected("scratch")}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${
                  selected === "scratch" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/40"
                }`}
              >
                <p className="font-medium text-foreground">Start from scratch</p>
                <p className="mt-0.5 text-sm text-muted-foreground">Build your own checklist from a blank page.</p>
                {selected === "scratch" && (
                  <div className="mt-3 border-t border-border pt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Template name</Label>
                      <Input value={scratchName} onChange={(e) => setScratchName(e.target.value)} placeholder="Corporate Conference" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Event type</Label>
                      <Select value={scratchEventType} onValueChange={setScratchEventType} items={EVENT_TYPES}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>{EVENT_TYPES.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </button>

              {/* Bring Your Existing Checklist (2026-07-10) — eliminates
                  re-typing years of accumulated planning knowledge by hand.
                  Luv reads the pasted text once and the result opens
                  directly in the same Template Editor as every other
                  template — no separate "review the AI's work" screen. */}
              <button
                type="button"
                onClick={() => setSelected("import")}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${
                  selected === "import" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/40"
                }`}
              >
                <p className="font-medium text-foreground">Import an existing checklist</p>
                <p className="mt-0.5 text-sm text-muted-foreground">Already have one in a document? Paste it in — no re-typing.</p>
                {selected === "import" && (
                  <div className="mt-3 border-t border-border pt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Template name</Label>
                      <Input value={importName} onChange={(e) => setImportName(e.target.value)} placeholder="Our Wedding Checklist" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Paste your checklist</Label>
                      <Textarea
                        value={importText} onChange={(e) => setImportText(e.target.value)}
                        placeholder="Paste your existing checklist here — from a Word doc, a spreadsheet, notes, anything."
                        className="min-h-32 text-sm"
                      />
                      <p className="text-[11px] text-muted-foreground">Luv will propose a first pass, ready to review and adjust here in the editor.</p>
                    </div>
                  </div>
                )}
              </button>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setOpen(false); reset(); }} disabled={pending}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={
                  !selected || pending
                  || (selected === "scratch" && !scratchName.trim())
                  || (selected === "existing" && !sourceTemplateId)
                  || (selected === "import" && (!importName.trim() || !importText.trim()))
                }
                onClick={handleApply}
              >
                {pending
                  ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />{selected === "import" ? "Importing…" : "Creating…"}</>
                  : selected === "import" ? "Import Checklist" : "Create Template"}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
