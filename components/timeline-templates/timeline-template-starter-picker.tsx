"use client";

/**
 * The "New Template" menu (Timeline Templates, 2026-07-10) — four ways to
 * start a Timeline Template: Blank, Duplicate an existing one, Upload a
 * file, or Paste text. Upload and Paste both land in the same Luv proposal
 * pipeline (lib/luv/timeline-import.ts) — Upload just reads the file into
 * text client-side first (readAsText; .txt/.md/.csv only — no PDF/DOCX
 * parsing exists in this codebase yet, and Google Docs is explicitly out of
 * scope for this task).
 */

import * as React from "react";

import { useRouter } from "next/navigation";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  createTemplateAction, createTemplateFromImportAction, duplicateTemplateAction,
} from "@/app/(app)/timeline-templates/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { VenueSpace } from "@/lib/availability/types";
import { EVENT_TYPES } from "@/lib/leads/constants";
import type { TimelineTemplate } from "@/lib/timeline-templates/types";

const ANY_EVENT_TYPE = "__any__";
const NO_SPACE = "__none__";

type Flow = "blank" | "duplicate" | "upload" | "paste";

function EventTypeSpaceFields({
  eventType, setEventType, spaceId, setSpaceId, spaces,
}: { eventType: string; setEventType: (v: string) => void; spaceId: string; setSpaceId: (v: string) => void; spaces: VenueSpace[] }) {
  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs">Event type</Label>
        <Select value={eventType} onValueChange={setEventType} items={[{ value: ANY_EVENT_TYPE, label: "Any event type" }, ...EVENT_TYPES]}>
          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_EVENT_TYPE}>Any event type</SelectItem>
            {EVENT_TYPES.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {spaces.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs">Venue space (optional)</Label>
          <Select value={spaceId} onValueChange={setSpaceId} items={[{ value: NO_SPACE, label: "No specific space" }, ...spaces.map((s) => ({ value: s.id, label: s.name }))]}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_SPACE}>No specific space</SelectItem>
              {spaces.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  );
}

export function TimelineTemplateStarterPicker({
  existingTemplates = [], spaces = [],
}: { existingTemplates?: TimelineTemplate[]; spaces?: VenueSpace[] }) {
  const router = useRouter();
  const [flow, setFlow] = React.useState<Flow | null>(null);
  // Which flow to open once the dropdown menu has fully finished closing —
  // see openFlow below for why this can't just call setFlow directly.
  const pendingFlowRef = React.useRef<Flow | null>(null);
  const [name, setName] = React.useState("");
  const [eventType, setEventType] = React.useState(ANY_EVENT_TYPE);
  const [spaceId, setSpaceId] = React.useState(NO_SPACE);
  const [sourceTemplateId, setSourceTemplateId] = React.useState("");
  const [pastedText, setPastedText] = React.useState("");
  const [fileName, setFileName] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function reset() {
    setName(""); setEventType(ANY_EVENT_TYPE); setSpaceId(NO_SPACE);
    setSourceTemplateId(""); setPastedText(""); setFileName("");
  }

  function openFlow(f: Flow) {
    reset();
    if (f === "duplicate" && existingTemplates.length > 0) setName("");
    // See the matching comment in floor-plan-template-starter-picker.tsx's
    // openFlow — opening the Sheet while the dropdown menu is still closing
    // races with Base UI's own Menu close/focus-restoration and the Sheet
    // never actually stays open.
    pendingFlowRef.current = f;
  }

  function goToEditor(templateId: string) {
    setFlow(null);
    reset();
    router.push(`/library/timeline-templates/${templateId}`);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    if (!name.trim()) setName(file.name.replace(/\.[^.]+$/, ""));
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".txt") && !lower.endsWith(".md") && !lower.endsWith(".csv")) {
      toast.error("This file type isn't supported yet — try a .txt, .md, or .csv file, or paste the text instead.");
      setFileName("");
      return;
    }
    const text = await file.text();
    setPastedText(text);
  }

  function handleBlankSubmit() {
    if (!name.trim()) return;
    startTransition(async () => {
      const result = await createTemplateAction(
        name.trim(),
        eventType === ANY_EVENT_TYPE ? null : eventType,
        spaceId === NO_SPACE ? null : spaceId,
      );
      if (result.ok) { toast.success("Template created."); goToEditor(result.templateId); }
      else toast.error(result.message ?? "Could not create template.");
    });
  }

  function handleDuplicateSubmit() {
    if (!sourceTemplateId) return;
    const source = existingTemplates.find((t) => t.id === sourceTemplateId);
    const copyName = name.trim() || `${source?.name ?? "Template"} (Copy)`;
    startTransition(async () => {
      const result = await duplicateTemplateAction(sourceTemplateId, copyName);
      if (result.ok) { toast.success("Template duplicated."); goToEditor(result.templateId); }
      else toast.error(result.message ?? "Could not duplicate template.");
    });
  }

  function handleImportSubmit() {
    if (!name.trim() || !pastedText.trim()) return;
    startTransition(async () => {
      const result = await createTemplateFromImportAction(
        pastedText, name.trim(),
        eventType === ANY_EVENT_TYPE ? null : eventType,
        spaceId === NO_SPACE ? null : spaceId,
      );
      if (result.ok) {
        toast.success(
          result.guessedCount > 0
            ? `Imported ${result.itemCount} items — Luv estimated timing for ${result.guessedCount} of them, so double-check those first.`
            : `Imported ${result.itemCount} items.`,
        );
        goToEditor(result.templateId);
      } else {
        toast.error(result.message);
      }
    });
  }

  const titles: Record<Flow, string> = {
    blank: "Blank Timeline",
    duplicate: "Duplicate Existing Timeline",
    upload: "Upload Existing Timeline",
    paste: "Paste Existing Timeline",
  };

  return (
    <>
      <DropdownMenu onOpenChangeComplete={(open) => {
        if (!open && pendingFlowRef.current) {
          setFlow(pendingFlowRef.current);
          pendingFlowRef.current = null;
        }
      }}>
        <DropdownMenuTrigger render={<Button type="button" />}>
          New Template<ChevronDown className="ml-1.5 h-3.5 w-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => openFlow("blank")}>Blank Timeline</DropdownMenuItem>
          <DropdownMenuItem disabled={existingTemplates.length === 0} onClick={() => openFlow("duplicate")}>Duplicate Existing Timeline</DropdownMenuItem>
          <DropdownMenuItem onClick={() => openFlow("upload")}>Upload Existing Timeline</DropdownMenuItem>
          <DropdownMenuItem onClick={() => openFlow("paste")}>Paste Existing Timeline</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={flow !== null} onOpenChange={(v) => { if (!v) { setFlow(null); reset(); } }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {flow && (
            <>
              <SheetHeader className="mb-6">
                <SheetTitle>{titles[flow]}</SheetTitle>
                {flow === "upload" && <p className="text-sm text-muted-foreground">Accepts .txt, .md, or .csv files. Everything is fully editable after.</p>}
                {flow === "paste" && <p className="text-sm text-muted-foreground">Paste your run-of-show — from a Word doc, a spreadsheet, notes, anything.</p>}
              </SheetHeader>

              {flow === "blank" && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Template name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Wedding — Classic" className="h-9 text-sm" />
                  </div>
                  <EventTypeSpaceFields eventType={eventType} setEventType={setEventType} spaceId={spaceId} setSpaceId={setSpaceId} spaces={spaces} />
                </div>
              )}

              {flow === "duplicate" && (
                <div className="space-y-3">
                  {existingTemplates.map((t) => (
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
                  <div className="space-y-1.5 pt-1">
                    <Label className="text-xs">New template name (optional)</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Leave blank to use “(Copy)”" className="h-9 text-sm" />
                  </div>
                </div>
              )}

              {flow === "upload" && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">File</Label>
                    <input
                      type="file"
                      accept=".txt,.md,.csv,text/plain,text/markdown,text/csv"
                      onChange={handleFileChange}
                      className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground"
                    />
                    {fileName && <p className="text-xs text-muted-foreground">Loaded {fileName}{pastedText ? ` — ${pastedText.length.toLocaleString()} characters` : ""}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Template name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Wedding — Classic" className="h-9 text-sm" />
                  </div>
                  <EventTypeSpaceFields eventType={eventType} setEventType={setEventType} spaceId={spaceId} setSpaceId={setSpaceId} spaces={spaces} />
                </div>
              )}

              {flow === "paste" && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Template name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Wedding — Classic" className="h-9 text-sm" />
                  </div>
                  <EventTypeSpaceFields eventType={eventType} setEventType={setEventType} spaceId={spaceId} setSpaceId={setSpaceId} spaces={spaces} />
                  <div className="space-y-1.5">
                    <Label className="text-xs">Paste your timeline</Label>
                    <Textarea
                      value={pastedText} onChange={(e) => setPastedText(e.target.value)}
                      placeholder="Paste your existing run-of-show here…"
                      className="min-h-32 text-sm"
                    />
                    <p className="text-[11px] text-muted-foreground">Luv will propose a first pass, ready to review and adjust here in the editor.</p>
                  </div>
                </div>
              )}

              <div className="mt-6 flex items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => { setFlow(null); reset(); }} disabled={pending}>Cancel</Button>
                <Button
                  type="button"
                  disabled={
                    pending
                    || (flow === "blank" && !name.trim())
                    || (flow === "duplicate" && !sourceTemplateId)
                    || ((flow === "upload" || flow === "paste") && (!name.trim() || !pastedText.trim()))
                  }
                  onClick={flow === "blank" ? handleBlankSubmit : flow === "duplicate" ? handleDuplicateSubmit : handleImportSubmit}
                >
                  {pending ? (
                    <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />{flow === "upload" || flow === "paste" ? "Importing…" : "Creating…"}</>
                  ) : flow === "upload" || flow === "paste" ? "Import Timeline" : flow === "duplicate" ? "Duplicate" : "Create Template"}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
