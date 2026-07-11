"use client";

/**
 * The "+ New Floor Plan Template" menu — Blank, Duplicate an existing
 * template, Upload a background image, or Paste a text layout (Floor Plan
 * Template Library task). Upload/Paste both create the template first, then
 * populate it (a background image, or parsed objects) — no AI/Luv involved
 * for Paste, see lib/floor-plan-templates/paste-parse.ts.
 */

import * as React from "react";

import { useRouter } from "next/navigation";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  createTemplateAction, createTemplateFromPasteAction, duplicateTemplateAction, updateTemplateBackgroundAction,
} from "@/app/(app)/floor-plan-templates/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/integrations/supabase/client";
import type { VenueSpace } from "@/lib/availability/types";
import { EVENT_TYPES } from "@/lib/leads/constants";
import type { FloorPlanTemplate } from "@/lib/floor-plan-templates/types";

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

function DefaultTemplateField({
  isDefault, setIsDefault,
}: { isDefault: boolean; setIsDefault: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox checked={isDefault} onCheckedChange={(v) => setIsDefault(v === true)} />
      Default Template
    </label>
  );
}

export function FloorPlanTemplateStarterPicker({
  existingTemplates = [], spaces = [], venueId,
}: { existingTemplates?: FloorPlanTemplate[]; spaces?: VenueSpace[]; venueId: string }) {
  const router = useRouter();
  const [flow, setFlow] = React.useState<Flow | null>(null);
  const [name, setName] = React.useState("");
  const [eventType, setEventType] = React.useState(ANY_EVENT_TYPE);
  const [spaceId, setSpaceId] = React.useState(NO_SPACE);
  const [sourceTemplateId, setSourceTemplateId] = React.useState("");
  const [pastedText, setPastedText] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [isDefault, setIsDefault] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function reset() {
    setName(""); setEventType(ANY_EVENT_TYPE); setSpaceId(NO_SPACE);
    setSourceTemplateId(""); setPastedText(""); setFile(null); setIsDefault(false);
  }

  function openFlow(f: Flow) {
    reset();
    setFlow(f);
  }

  function goToEditor(templateId: string) {
    setFlow(null);
    reset();
    router.push(`/library/floor-plan-templates/${templateId}`);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    if (!name.trim()) setName(f.name.replace(/\.[^.]+$/, ""));
  }

  function handleBlankSubmit() {
    if (!name.trim()) return;
    startTransition(async () => {
      const result = await createTemplateAction(
        name.trim(), eventType === ANY_EVENT_TYPE ? null : eventType, spaceId === NO_SPACE ? null : spaceId, isDefault,
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
      const result = await duplicateTemplateAction(sourceTemplateId, copyName, isDefault);
      if (result.ok) { toast.success("Template duplicated."); goToEditor(result.templateId); }
      else toast.error(result.message ?? "Could not duplicate template.");
    });
  }

  function handleUploadSubmit() {
    if (!name.trim() || !file) return;
    startTransition(async () => {
      const created = await createTemplateAction(name.trim(), eventType === ANY_EVENT_TYPE ? null : eventType, spaceId === NO_SPACE ? null : spaceId, isDefault);
      if (!created.ok) { toast.error(created.message ?? "Could not create template."); return; }
      try {
        const supabase = createClient();
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${venueId}/${created.templateId}/background.${ext}`;
        const { error: uploadError } = await supabase.storage.from("floor-plans").upload(path, file, { upsert: true, contentType: file.type });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from("floor-plans").getPublicUrl(path);
        await updateTemplateBackgroundAction(created.templateId, publicUrl, 0.5);
        toast.success("Floor plan uploaded.");
      } catch {
        toast.error("Template created, but the image upload failed — you can set a background from inside the editor.");
      }
      goToEditor(created.templateId);
    });
  }

  function handlePasteSubmit() {
    if (!name.trim() || !pastedText.trim()) return;
    startTransition(async () => {
      const result = await createTemplateFromPasteAction(pastedText, name.trim(), eventType === ANY_EVENT_TYPE ? null : eventType, spaceId === NO_SPACE ? null : spaceId, isDefault);
      if (result.ok) { toast.success(`Created with ${result.objectCount} item${result.objectCount !== 1 ? "s" : ""} — arrange them however you like.`); goToEditor(result.templateId); }
      else toast.error(result.message);
    });
  }

  const titles: Record<Flow, string> = {
    blank: "Build from Scratch",
    upload: "Upload Existing Floor Plan",
    paste: "Paste Layout Details",
    duplicate: "Duplicate Existing Template",
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button type="button" />}>
          + New Floor Plan Template<ChevronDown className="ml-1.5 h-3.5 w-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => openFlow("blank")}>Build from Scratch</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openFlow("upload")}>Upload Existing Floor Plan</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openFlow("paste")}>Paste Layout Details</DropdownMenuItem>
          <DropdownMenuItem disabled={existingTemplates.length === 0} onSelect={() => openFlow("duplicate")}>Duplicate Existing Template</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={flow !== null} onOpenChange={(v) => { if (!v) { setFlow(null); reset(); } }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {flow && (
            <>
              <SheetHeader className="mb-6">
                <SheetTitle>{titles[flow]}</SheetTitle>
                {flow === "upload" && <p className="text-sm text-muted-foreground">Upload a floor plan image to use as the background — fully editable after.</p>}
                {flow === "paste" && <p className="text-sm text-muted-foreground">Paste your table/layout list — one item per line. Everything is fully editable after.</p>}
              </SheetHeader>

              {flow === "blank" && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Template name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ceremony Layout" className="h-9 text-sm" />
                  </div>
                  <EventTypeSpaceFields eventType={eventType} setEventType={setEventType} spaceId={spaceId} setSpaceId={setSpaceId} spaces={spaces} />
                  <DefaultTemplateField isDefault={isDefault} setIsDefault={setIsDefault} />
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
                  <DefaultTemplateField isDefault={isDefault} setIsDefault={setIsDefault} />
                </div>
              )}

              {flow === "upload" && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Image</Label>
                    <input
                      type="file" accept="image/*" onChange={handleFileChange}
                      className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground"
                    />
                    {file && <p className="text-xs text-muted-foreground">Selected {file.name}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Template name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Reception Layout" className="h-9 text-sm" />
                  </div>
                  <EventTypeSpaceFields eventType={eventType} setEventType={setEventType} spaceId={spaceId} setSpaceId={setSpaceId} spaces={spaces} />
                  <DefaultTemplateField isDefault={isDefault} setIsDefault={setIsDefault} />
                </div>
              )}

              {flow === "paste" && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Template name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Reception Layout" className="h-9 text-sm" />
                  </div>
                  <EventTypeSpaceFields eventType={eventType} setEventType={setEventType} spaceId={spaceId} setSpaceId={setSpaceId} spaces={spaces} />
                  <DefaultTemplateField isDefault={isDefault} setIsDefault={setIsDefault} />
                  <div className="space-y-1.5">
                    <Label className="text-xs">Paste your layout</Label>
                    <Textarea
                      value={pastedText} onChange={(e) => setPastedText(e.target.value)}
                      placeholder={"Table 1 - 8 guests\nTable 2 - 8 guests\nStage\nDance Floor"}
                      className="min-h-32 text-sm"
                    />
                    <p className="text-[11px] text-muted-foreground">Each line becomes one item, arranged in a simple grid — drag them into place after.</p>
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
                    || (flow === "upload" && (!name.trim() || !file))
                    || (flow === "paste" && (!name.trim() || !pastedText.trim()))
                  }
                  onClick={
                    flow === "blank" ? handleBlankSubmit
                    : flow === "duplicate" ? handleDuplicateSubmit
                    : flow === "upload" ? handleUploadSubmit
                    : handlePasteSubmit
                  }
                >
                  {pending ? (
                    <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />{flow === "upload" ? "Uploading…" : flow === "paste" ? "Creating…" : "Creating…"}</>
                  ) : flow === "duplicate" ? "Duplicate" : flow === "upload" ? "Upload" : flow === "paste" ? "Create Template" : "Create Template"}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
