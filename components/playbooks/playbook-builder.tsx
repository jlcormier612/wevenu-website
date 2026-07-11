"use client";

/**
 * The Planning Template editor — milestones as reorderable, renameable
 * chapters, each holding a lightweight task punch-list. Reuses the Day-of
 * Timeline's interaction model (chronological sections, inline edit,
 * reorder-in-place) rather than a new editing paradigm.
 *
 * Kind-gated (Product Decisions, 2026-07-08): a Client Planning template's
 * form never shows Owner/Wait-until/Escalation — the client is always the
 * owner, never a per-task choice. A Venue Planning template's form shows all
 * of it. Two checklists, one editor component.
 *
 * Every task asks exactly six things by default — Task Name, Who completes
 * it, Due, Instructions, Attachments, Reminder — everything else lives under
 * Advanced, in plain venue language rather than software terms (Planning
 * Templates UX Rebuild, 2026-07-09).
 */

import * as React from "react";

import { useRouter } from "next/navigation";
import {
  ChevronDown, ChevronUp, FileText, Link2, Loader2, Pencil, Plus, Trash2, Upload, X, Check,
} from "lucide-react";
import { toast } from "sonner";

import {
  addMilestoneAction,
  addPlaybookTaskAttachmentAction,
  addTemplateTaskAction,
  deleteMilestoneAction,
  deleteTemplateTaskAction,
  removePlaybookTaskAttachmentAction,
  renameMilestoneAction,
  reorderMilestoneAction,
  updateTemplateTaskAction,
} from "@/app/(app)/playbooks/actions";
import { saveVenueDocumentAction } from "@/app/(app)/documents/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/integrations/supabase/client";
import {
  AUTO_COMPLETE_TRIGGERS, categoryColor, categoryLabel, defaultReminderForCategory,
  directionForOffset, formatDaysOffset, offsetForDirection, TASK_ACTION_TYPES, TASK_CATEGORIES, taskActionLabel,
} from "@/lib/playbooks/constants";
import type { DueDateDirection } from "@/lib/playbooks/constants";
import type {
  PlaybookKind, PlaybookMilestone, PlaybookTask, PlaybookTaskAttachment, TaskActionType, TaskCategory, TaskOwner, TaskVisibility,
} from "@/lib/playbooks/types";
import type { Document } from "@/lib/documents/types";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE_MB = 25;
const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.svg,.txt,.csv";

const VENUE_TASK_OWNERS: { value: TaskOwner; label: string }[] = [
  { value: "coordinator", label: "Coordinator" },
  { value: "team",        label: "Team" },
  { value: "vendor",      label: "Vendor" },
];

const VENUE_TASK_VISIBILITY: { value: TaskVisibility; label: string }[] = [
  { value: "coordinator_only", label: "Internal only" },
  { value: "vendor_visible",   label: "Visible to vendor" },
  { value: "vendor_owned",     label: "Vendor completes" },
];

// ---- Audience filter — Venue Planning only (Client Planning is always the client) --

type AudienceFilter = "all" | "venue" | "vendor";

const AUDIENCE_CHIPS: { value: AudienceFilter; label: string; emoji: string; color: string }[] = [
  { value: "all",    label: "All",    emoji: "📋", color: "#B8AEA1" },
  { value: "venue",  label: "Venue",  emoji: "🔒", color: "#5D6F5D" },
  { value: "vendor", label: "Vendor", emoji: "🚚", color: "#C7A66A" },
];

function matchesAudience(task: PlaybookTask, filter: AudienceFilter): boolean {
  if (filter === "all") return true;
  if (filter === "vendor") return task.ownerType === "vendor";
  return task.ownerType === "coordinator" || task.ownerType === "team";
}

// ---- Attachments — upload a file, attach an existing document, or add a link --
// Every task should support this directly (requirement 6, Planning
// Templates UX Rebuild, 2026-07-09) — never a single "button label + URL"
// field standing in for it.

function AttachmentsField({
  templateId, playbookTaskId, attachments, venueDocuments, onChanged,
}: {
  templateId: string;
  playbookTaskId: string | null;
  attachments: PlaybookTaskAttachment[];
  venueDocuments: Document[];
  onChanged: () => void;
}) {
  const [uploading, setUploading] = React.useState(false);
  const [attachingExisting, setAttachingExisting] = React.useState(false);
  const [existingDocId, setExistingDocId] = React.useState("");
  const [addingLink, setAddingLink] = React.useState(false);
  const [linkLabel, setLinkLabel] = React.useState("");
  const [linkUrl, setLinkUrl] = React.useState("");
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  if (!playbookTaskId) {
    return <p className="text-xs text-muted-foreground italic">Save this task to add attachments.</p>;
  }
  const taskId = playbookTaskId; // narrowed non-null below the guard above

  const attachedDocIds = new Set(attachments.map((a) => a.documentId).filter(Boolean));
  const availableDocs = venueDocuments.filter((d) => !attachedDocIds.has(d.id));

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) { toast.error(`File too large. Maximum ${MAX_FILE_SIZE_MB} MB.`); return; }
    setUploading(true);
    try {
      const supabase = createClient();
      const docId = crypto.randomUUID();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      // Venue-level path — this file belongs to the venue itself, not one
      // lead/client/event/vendor, so it outlives any single application of
      // this template (venue-level documents, Planning Templates UX Rebuild).
      const storagePath = `venue/${docId}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("documents").upload(storagePath, file, { upsert: false, contentType: file.type });
      if (uploadError) throw new Error(uploadError.message);
      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(storagePath);

      const saved = await saveVenueDocumentAction({
        name: file.name.replace(/\.[^.]+$/, ""), category: "other", notes: "", tags: "", expiresAt: "",
        fileName: file.name, fileSize: file.size, mimeType: file.type, storagePath, storageUrl: urlData.publicUrl,
      });
      if (!saved.ok) { toast.error(saved.message ?? "Could not save file."); await supabase.storage.from("documents").remove([storagePath]); return; }

      const linked = await addPlaybookTaskAttachmentAction(templateId, taskId, { documentId: saved.documentId }, attachments.length);
      if (linked.ok) { toast.success("File attached."); onChanged(); }
      else toast.error(linked.message ?? "Could not attach file.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleAttachExisting() {
    if (!existingDocId) return;
    const result = await addPlaybookTaskAttachmentAction(templateId, taskId, { documentId: existingDocId }, attachments.length);
    if (result.ok) { toast.success("Document attached."); setExistingDocId(""); setAttachingExisting(false); onChanged(); }
    else toast.error(result.message ?? "Could not attach document.");
  }

  async function handleAddLink() {
    if (!linkUrl.trim()) return;
    const result = await addPlaybookTaskAttachmentAction(templateId, taskId, { linkUrl: linkUrl.trim(), linkLabel: linkLabel.trim() || null }, attachments.length);
    if (result.ok) { toast.success("Link added."); setLinkLabel(""); setLinkUrl(""); setAddingLink(false); onChanged(); }
    else toast.error(result.message ?? "Could not add link.");
  }

  async function handleRemove(attachmentId: string) {
    setRemovingId(attachmentId);
    const result = await removePlaybookTaskAttachmentAction(attachmentId, templateId);
    setRemovingId(null);
    if (result.ok) onChanged();
    else toast.error(result.message ?? "Could not remove attachment.");
  }

  return (
    <div className="space-y-2">
      {attachments.map((a) => (
        <div key={a.id} className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-1.5">
          {a.documentId ? <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          <span className="flex-1 truncate text-xs text-foreground">{a.label}</span>
          <button type="button" onClick={() => handleRemove(a.id)} disabled={removingId === a.id} className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive">
            {removingId === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
          </button>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-1.5">
        <input ref={fileRef} type="file" accept={ACCEPT} onChange={handleFileSelect} className="hidden" id={`upload-${taskId}`} />
        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Upload className="mr-1 h-3 w-3" />} Upload a file
        </Button>
        {availableDocs.length > 0 && (
          <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setAttachingExisting((v) => !v)}>
            <FileText className="mr-1 h-3 w-3" /> Use an existing document
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setAddingLink((v) => !v)}>
          <Link2 className="mr-1 h-3 w-3" /> Add a link
        </Button>
      </div>

      {attachingExisting && (
        <div className="flex items-center gap-1.5">
          <Select value={existingDocId} onValueChange={setExistingDocId} items={availableDocs.map((d) => ({ value: d.id, label: d.name || d.fileName }))}>
            <SelectTrigger className="h-7 flex-1 text-xs"><SelectValue placeholder="Choose a document…" /></SelectTrigger>
            <SelectContent>{availableDocs.map((d) => <SelectItem key={d.id} value={d.id}>{d.name || d.fileName}</SelectItem>)}</SelectContent>
          </Select>
          <Button type="button" size="sm" className="h-7 px-2 text-xs" disabled={!existingDocId} onClick={handleAttachExisting}>Attach</Button>
        </div>
      )}

      {addingLink && (
        <div className="grid grid-cols-2 gap-1.5">
          <Input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Label (optional)" className="h-7 text-xs" />
          <div className="flex gap-1.5">
            <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" className="h-7 text-xs" />
            <Button type="button" size="sm" className="h-7 px-2 text-xs shrink-0" disabled={!linkUrl.trim()} onClick={handleAddLink}>Add</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Lightweight task form: six questions by default, rest behind "Advanced" --

type TaskForm = {
  title: string;
  ownerType: TaskOwner;
  direction: DueDateDirection;
  days: string;
  instructions: string;
  reminderDays: string;         // single number as a string; "" = no reminder
  category: TaskCategory;
  visibility: TaskVisibility;
  autoCompleteTrigger: string;
  dependsOnTaskId: string;
  isRequired: boolean;
  escalationAfterDays: string;  // "" = none
  actionType: string;           // "" = no action, just a checklist item
  actionLabel: string;
};

function emptyForm(kind: PlaybookKind): TaskForm {
  return {
    title: "", ownerType: kind === "client" ? "couple" : "coordinator", direction: "before", days: "30", instructions: "",
    reminderDays: "", category: "custom", visibility: kind === "client" ? "client_owned" : "coordinator_only",
    autoCompleteTrigger: "", dependsOnTaskId: "", isRequired: true, escalationAfterDays: "",
    actionType: "", actionLabel: "",
  };
}

function taskToForm(t: PlaybookTask): TaskForm {
  return {
    title: t.title, ownerType: t.ownerType, direction: directionForOffset(t.daysOffset), days: String(Math.abs(t.daysOffset)),
    instructions: t.description ?? "",
    reminderDays: t.reminderBeforeDays?.[0] != null ? String(t.reminderBeforeDays[0]) : "",
    category: t.category, visibility: t.visibility,
    autoCompleteTrigger: t.autoCompleteTrigger ?? "", dependsOnTaskId: t.dependsOnTaskId ?? "",
    isRequired: t.isRequired,
    escalationAfterDays: t.escalationAfterDays != null ? String(t.escalationAfterDays) : "",
    actionType: t.actionType ?? "", actionLabel: t.actionLabel ?? "",
  };
}

// A venue never sees or types a raw offset — this composer is the only place
// "when" is set, and it always reads as a sentence (Product Decisions, 2026-07-08).
function DueDateComposer({ direction, days, onChange }: { direction: DueDateDirection; days: string; onChange: (direction: DueDateDirection, days: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      {direction !== "on" && (
        <Input
          type="number" value={days} onChange={(e) => onChange(direction, e.target.value)}
          className="w-16 h-9 text-sm" min={0}
        />
      )}
      <Select
        value={direction}
        onValueChange={(v) => onChange(v as DueDateDirection, days)}
        items={[{ value: "before", label: "days before the event" }, { value: "on", label: "On the event day" }, { value: "after", label: "days after the event" }]}
      >
        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="before">days before the event</SelectItem>
          <SelectItem value="on">On the event day</SelectItem>
          <SelectItem value="after">days after the event</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function TaskFormPanel({
  kind, templateId, playbookTaskId, initial, allTasks, attachments, venueDocuments,
  onSave, onCancel, onAttachmentsChanged, pending, submitLabel,
}: {
  kind: PlaybookKind;
  templateId: string;
  playbookTaskId: string | null;
  initial: TaskForm;
  allTasks: PlaybookTask[];
  attachments: PlaybookTaskAttachment[];
  venueDocuments: Document[];
  onSave: (f: TaskForm) => void;
  onCancel: () => void;
  onAttachmentsChanged: () => void;
  pending: boolean;
  submitLabel: string;
}) {
  const [f, setF] = React.useState(initial);
  const [advanced, setAdvanced] = React.useState(false);
  const set = <K extends keyof TaskForm>(k: K, v: TaskForm[K]) => setF((p) => ({ ...p, [k]: v }));
  const isVenue = kind === "venue";

  // A smart reminder default the first time a venue picks a category,
  // without ever overwriting something they've already set.
  function handleCategoryChange(cat: TaskCategory) {
    const smart = defaultReminderForCategory(cat);
    setF((p) => ({ ...p, category: cat, ...(p.reminderDays || !smart ? {} : { reminderDays: String(smart[0]) }) }));
  }

  return (
    <div className="space-y-3 rounded-xl border border-ring bg-card p-4">
      {/* 1–3: Task Name, Who completes it (Venue Planning only), Due */}
      <div className={cn("grid gap-3", isVenue ? "sm:grid-cols-[1fr_auto_auto]" : "sm:grid-cols-[1fr_auto]")}>
        <div className="space-y-1.5">
          <Label className="text-xs">Task *</Label>
          <Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Final payment due" autoFocus />
        </div>
        {isVenue && (
          <div className="space-y-1.5">
            <Label className="text-xs">Who completes it</Label>
            <Select value={f.ownerType} onValueChange={(v) => set("ownerType", v as TaskOwner)} items={VENUE_TASK_OWNERS}>
              <SelectTrigger className="h-9 w-36 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{VENUE_TASK_OWNERS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label className="text-xs">Due</Label>
          <DueDateComposer direction={f.direction} days={f.days} onChange={(direction, days) => setF((p) => ({ ...p, direction, days }))} />
        </div>
      </div>

      {/* 4: Instructions */}
      <div className="space-y-1.5">
        <Label className="text-xs">Instructions <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Textarea value={f.instructions} onChange={(e) => set("instructions", e.target.value)} rows={2} placeholder="What does the person need to know to do this?" />
      </div>

      {/* 5: Attachments */}
      <div className="space-y-1.5">
        <Label className="text-xs">Attachments <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <AttachmentsField templateId={templateId} playbookTaskId={playbookTaskId} attachments={attachments} venueDocuments={venueDocuments} onChanged={onAttachmentsChanged} />
      </div>

      {/* 6: Reminder */}
      <div className="space-y-1.5 max-w-[220px]">
        <Label className="text-xs">Reminder <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <div className="flex items-center gap-1.5">
          <Input type="number" min={0} value={f.reminderDays} onChange={(e) => set("reminderDays", e.target.value)} className="h-9 w-20 text-sm" placeholder="0" />
          <span className="text-sm text-muted-foreground">days before, remind me</span>
        </div>
      </div>

      {/* 7: Opens — a task is navigation into the platform, not just a checkbox
          (Vendor Management — Next Iteration, 2026-07-10). */}
      <div className="grid gap-3 sm:grid-cols-2 max-w-md">
        <div className="space-y-1.5">
          <Label className="text-xs">Opens <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Select
            value={f.actionType || "__none__"}
            onValueChange={(v) => set("actionType", v === "__none__" ? "" : v)}
            items={[{ value: "__none__", label: "Nothing — just a checklist item" }, ...TASK_ACTION_TYPES.map((a) => ({ value: a.value, label: a.defaultLabel }))]}
          >
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Nothing — just a checklist item</SelectItem>
              {TASK_ACTION_TYPES.map((a) => <SelectItem key={a.value} value={a.value}>{a.defaultLabel}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {f.actionType && (
          <div className="space-y-1.5">
            <Label className="text-xs">Button text <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input value={f.actionLabel} onChange={(e) => set("actionLabel", e.target.value)} placeholder={taskActionLabel(f.actionType as TaskActionType, null) ?? ""} className="h-9 text-sm" />
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setAdvanced((v) => !v)}
        className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {advanced ? "Hide advanced options" : "Advanced options"}
      </button>

      {advanced && (
        <div className="space-y-3 border-t border-border/60 pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Select value={f.category} onValueChange={(v) => handleCategoryChange(v as TaskCategory)} items={TASK_CATEGORIES}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{TASK_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {isVenue && (
              <div className="space-y-1.5">
                <Label className="text-xs">Who can see this</Label>
                <Select value={f.visibility} onValueChange={(v) => set("visibility", v as TaskVisibility)} items={VENUE_TASK_VISIBILITY}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{VENUE_TASK_VISIBILITY.map((v) => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Mark this done automatically when…</Label>
              <Select
                value={f.autoCompleteTrigger || "__none__"}
                onValueChange={(v) => set("autoCompleteTrigger", v === "__none__" ? "" : v)}
                items={AUTO_COMPLETE_TRIGGERS.map((t) => ({ value: t.value || "__none__", label: t.label }))}
              >
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{AUTO_COMPLETE_TRIGGERS.map((t) => <SelectItem key={t.value || "__none__"} value={t.value || "__none__"}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {isVenue && (
              <div className="space-y-1.5">
                <Label className="text-xs">Wait until this is done first</Label>
                <Select
                  value={f.dependsOnTaskId || "__none__"}
                  onValueChange={(v) => set("dependsOnTaskId", v === "__none__" ? "" : v)}
                  items={[{ value: "__none__", label: "Nothing — can start anytime" }, ...allTasks.map((t) => ({ value: t.id, label: t.title }))]}
                >
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nothing — can start anytime</SelectItem>
                    {allTasks.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {isVenue && (
            <div className="space-y-1.5 max-w-[260px]">
              <Label className={cn("text-xs", !f.isRequired && "text-muted-foreground")}>
                Notify a manager if it&apos;s overdue by {!f.isRequired && "(required tasks only)"}
              </Label>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number" value={f.escalationAfterDays} onChange={(e) => set("escalationAfterDays", e.target.value)}
                  className="h-8 w-20 text-sm" disabled={!f.isRequired}
                />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
            </div>
          )}

          {!isVenue && (
            <div className="flex items-center gap-2">
              <Switch checked={f.visibility === "client_owned"} onCheckedChange={(v) => set("visibility", v ? "client_owned" : "client_visible")} />
              <Label className="text-xs cursor-pointer">Your client must complete this — otherwise it&apos;s just shown to them</Label>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Switch checked={f.isRequired} onCheckedChange={(v) => set("isRequired", v)} />
            <Label className="text-xs cursor-pointer">Required — affects readiness</Label>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          {playbookTaskId ? "Close" : "Cancel"}
        </Button>
        <Button type="button" size="sm" disabled={!f.title.trim() || (f.direction !== "on" && !f.days) || pending} onClick={() => onSave(f)}>
          {pending ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Saving…</> : submitLabel}
        </Button>
      </div>
    </div>
  );
}

// ---- Task row ---------------------------------------------------------------

function TaskRow({
  kind, task, allTasks, attachmentCount, onEdit, onDelete,
}: { kind: PlaybookKind; task: PlaybookTask; allTasks: PlaybookTask[]; attachmentCount: number; onEdit: () => void; onDelete: () => void }) {
  const dep = allTasks.find((t) => t.id === task.dependsOnTaskId);
  const audience = AUDIENCE_CHIPS.find((a) => a.value !== "all" && matchesAudience(task, a.value)) ?? AUDIENCE_CHIPS[1];

  return (
    <div className="group flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0">
      {kind === "venue" && (
        <span
          className="mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-white"
          style={{ background: audience.color }}
          title={audience.label}
        >
          {audience.emoji}
        </span>
      )}
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-heading">{task.title}</p>
          {!task.isRequired && <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">optional</span>}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span style={{ color: categoryColor(task.category) }}>{categoryLabel(task.category)}</span>
          <span>·</span>
          <span>{formatDaysOffset(task.daysOffset)}</span>
          {task.reminderBeforeDays && <><span>·</span><span>reminds {task.reminderBeforeDays[0]}d before</span></>}
          {task.escalationAfterDays != null && <><span>·</span><span className="text-warning-foreground">notifies manager after {task.escalationAfterDays}d</span></>}
          {task.autoCompleteTrigger && <><span>·</span><span className="italic">auto-completes</span></>}
          {dep && <><span>·</span><span>after &ldquo;{dep.title}&rdquo;</span></>}
          {attachmentCount > 0 && <><span>·</span><span>{attachmentCount} attachment{attachmentCount === 1 ? "" : "s"}</span></>}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button type="button" onClick={onEdit} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Edit">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={onDelete} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Delete">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ---- Milestone chapter -------------------------------------------------------

function MilestoneChapter({
  kind, milestone, tasks, allTasks, isFirst, isLast, templateId, audienceFilter, attachmentsByTask, venueDocuments,
  onTaskAdded, onTaskUpdated, onTaskDeleted, onAttachmentsChanged,
}: {
  kind: PlaybookKind;
  milestone: PlaybookMilestone;
  tasks: PlaybookTask[];
  allTasks: PlaybookTask[];
  isFirst: boolean;
  isLast: boolean;
  templateId: string;
  audienceFilter: AudienceFilter;
  attachmentsByTask: Record<string, PlaybookTaskAttachment[]>;
  venueDocuments: Document[];
  onTaskAdded: (newTaskId?: string) => void;
  onTaskUpdated: () => void;
  onTaskDeleted: (id: string) => void;
  onAttachmentsChanged: () => void;
}) {
  const router = useRouter();
  const [renaming, setRenaming] = React.useState(false);
  const [name, setName] = React.useState(milestone.name);
  const [showAdd, setShowAdd] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [addPending, startAdd] = React.useTransition();
  const [editPending, startEdit] = React.useTransition();
  const [renamePending, startRename] = React.useTransition();

  const visibleTasks = kind === "venue" ? tasks.filter((t) => matchesAudience(t, audienceFilter)) : tasks;

  function handleRename() {
    if (!name.trim() || name.trim() === milestone.name) { setRenaming(false); setName(milestone.name); return; }
    startRename(async () => {
      const result = await renameMilestoneAction(templateId, milestone.id, name.trim());
      if (result.ok) { toast.success("Section renamed."); setRenaming(false); router.refresh(); }
      else { toast.error(result.message ?? "Could not rename."); setName(milestone.name); }
    });
  }

  function handleReorder(direction: "up" | "down") {
    reorderMilestoneAction(templateId, milestone.id, direction).then((result) => {
      if (result.ok) router.refresh();
      else toast.error(result.message ?? "Could not reorder.");
    });
  }

  async function handleDeleteMilestone() {
    if (tasks.length > 0) {
      toast.error(`Move or remove the ${tasks.length} task${tasks.length === 1 ? "" : "s"} in this section first.`);
      return;
    }
    if (!confirm(`Remove the "${milestone.name}" section?`)) return;
    const result = await deleteMilestoneAction(templateId, milestone.id);
    if (result.ok) router.refresh();
    else toast.error(result.message ?? "Could not delete section.");
  }

  function handleAdd(f: TaskForm) {
    startAdd(async () => {
      const result = await addTemplateTaskAction(templateId, {
        title: f.title.trim(), description: f.instructions.trim() || null,
        ownerType: kind === "client" ? "couple" : f.ownerType,
        visibility: kind === "client" ? f.visibility : f.visibility,
        daysOffset: offsetForDirection(parseInt(f.days, 10) || 0, f.direction),
        dueDateRuleKind: "relative_to_event",
        category: f.category, milestoneId: milestone.id,
        autoCompleteTrigger: f.autoCompleteTrigger || null,
        dependsOnTaskId: kind === "venue" ? (f.dependsOnTaskId || null) : null,
        isRequired: f.isRequired, sortOrder: tasks.length,
        reminderBeforeDays: f.reminderDays ? [parseInt(f.reminderDays, 10)] : null,
        escalationAfterDays: kind === "venue" && f.isRequired && f.escalationAfterDays ? parseInt(f.escalationAfterDays, 10) || null : null,
        notifyOnAssign: false, notifyOnComplete: false,
        actionType: (f.actionType || null) as TaskActionType | null, actionLabel: f.actionLabel.trim() || null,
      });
      // Drop straight into edit mode for the new task so a venue can attach
      // files immediately, rather than a second click to reopen it.
      if (result.ok) { toast.success("Task added."); setShowAdd(false); setEditingId(result.taskId ?? null); onTaskAdded(result.taskId); }
      else toast.error(result.message ?? "Could not add task.");
    });
  }

  function handleEdit(taskId: string, f: TaskForm) {
    startEdit(async () => {
      const result = await updateTemplateTaskAction(taskId, {
        title: f.title.trim(), description: f.instructions.trim() || null,
        ownerType: kind === "client" ? "couple" : f.ownerType,
        visibility: f.visibility,
        daysOffset: offsetForDirection(parseInt(f.days, 10) || 0, f.direction),
        category: f.category, autoCompleteTrigger: f.autoCompleteTrigger || null,
        dependsOnTaskId: kind === "venue" ? (f.dependsOnTaskId || null) : null,
        isRequired: f.isRequired,
        reminderBeforeDays: f.reminderDays ? [parseInt(f.reminderDays, 10)] : null,
        escalationAfterDays: kind === "venue" && f.isRequired && f.escalationAfterDays ? parseInt(f.escalationAfterDays, 10) || null : null,
        actionType: (f.actionType || null) as TaskActionType | null, actionLabel: f.actionLabel.trim() || null,
      });
      if (result.ok) { toast.success("Task updated."); onTaskUpdated(); }
      else toast.error(result.message ?? "Could not update task.");
    });
  }

  async function handleDelete(taskId: string, title: string) {
    if (!confirm(`Remove "${title}" from this template?`)) return;
    const result = await deleteTemplateTaskAction(taskId);
    if (result.ok) onTaskDeleted(taskId);
    else toast.error(result.message ?? "Could not delete.");
  }

  const editingTask = tasks.find((t) => t.id === editingId);

  return (
    <div className="rounded-xl border border-border bg-card/60">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60">
        {renaming ? (
          <div className="flex items-center gap-1.5 flex-1">
            <Input
              value={name} onChange={(e) => setName(e.target.value)} autoFocus
              className="h-7 text-sm font-semibold max-w-xs"
              onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") { setRenaming(false); setName(milestone.name); } }}
            />
            <button type="button" onClick={handleRename} disabled={renamePending} className="rounded p-1 text-muted-foreground hover:text-foreground"><Check className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => { setRenaming(false); setName(milestone.name); }} className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
          </div>
        ) : (
          <button type="button" onClick={() => setRenaming(true)} className="flex items-center gap-1.5 flex-1 text-left group/name">
            <h3 className="font-heading text-sm font-semibold text-heading">{milestone.name}</h3>
            <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover/name:opacity-100 transition-opacity" />
          </button>
        )}
        <span className="text-xs text-muted-foreground shrink-0">{tasks.length} task{tasks.length !== 1 ? "s" : ""}</span>
        <div className="flex items-center gap-0.5 shrink-0">
          {!isFirst && (
            <button type="button" onClick={() => handleReorder("up")} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Move up">
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
          )}
          {!isLast && (
            <button type="button" onClick={() => handleReorder("down")} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Move down">
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          )}
          <button type="button" onClick={handleDeleteMilestone} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Delete section">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="px-4 py-1">
        {visibleTasks.length === 0 && !showAdd && (
          <p className="text-xs text-muted-foreground py-3 text-center">
            {tasks.length === 0 ? "No tasks yet." : "No tasks for this audience."}
          </p>
        )}
        {visibleTasks.map((task) =>
          editingId === task.id && editingTask ? (
            <div key={task.id} className="py-2">
              <TaskFormPanel
                kind={kind} templateId={templateId} playbookTaskId={task.id}
                initial={taskToForm(task)}
                allTasks={allTasks.filter((t) => t.id !== task.id)}
                attachments={attachmentsByTask[task.id] ?? []}
                venueDocuments={venueDocuments}
                onSave={(f) => handleEdit(task.id, f)} onCancel={() => setEditingId(null)}
                onAttachmentsChanged={onAttachmentsChanged}
                pending={editPending} submitLabel="Save task"
              />
            </div>
          ) : (
            <TaskRow key={task.id} kind={kind} task={task} allTasks={allTasks}
              attachmentCount={(attachmentsByTask[task.id] ?? []).length}
              onEdit={() => setEditingId(task.id)} onDelete={() => handleDelete(task.id, task.title)} />
          )
        )}
      </div>

      <div className="px-4 pb-3 pt-1">
        {showAdd ? (
          <TaskFormPanel
            kind={kind} templateId={templateId} playbookTaskId={null}
            initial={emptyForm(kind)} allTasks={allTasks} attachments={[]} venueDocuments={venueDocuments}
            onSave={handleAdd}
            onCancel={() => setShowAdd(false)}
            onAttachmentsChanged={onAttachmentsChanged}
            pending={addPending} submitLabel="Add task"
          />
        ) : (
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(true)} className="text-muted-foreground">
            <Plus className="mr-1 h-3.5 w-3.5" /> Add task
          </Button>
        )}
      </div>
    </div>
  );
}

// ---- Main builder -------------------------------------------------------------

export function PlaybookBuilder({
  kind, templateId, initialMilestones, initialTasks, attachmentsByTask, venueDocuments,
}: {
  kind: PlaybookKind;
  templateId: string;
  initialMilestones: PlaybookMilestone[];
  initialTasks: PlaybookTask[];
  attachmentsByTask: Record<string, PlaybookTaskAttachment[]>;
  venueDocuments: Document[];
}) {
  const router = useRouter();
  // Server-refreshed props are the source of truth (router.refresh() re-fetches
  // them after every mutation below) — no local mirror to keep in sync.
  const tasks = initialTasks;
  const milestones = initialMilestones;
  const [audienceFilter, setAudienceFilter] = React.useState<AudienceFilter>("all");
  const [addingMilestone, setAddingMilestone] = React.useState(false);
  const [newMilestoneName, setNewMilestoneName] = React.useState("");
  const [addMilestonePending, startAddMilestone] = React.useTransition();

  const sortedMilestones = [...milestones].sort((a, b) => a.sortOrder - b.sortOrder);
  const tasksByMilestone = (milestoneId: string) =>
    tasks.filter((t) => t.milestoneId === milestoneId).sort((a, b) => a.daysOffset - b.daysOffset);

  function handleAddMilestone() {
    if (!newMilestoneName.trim()) return;
    startAddMilestone(async () => {
      const result = await addMilestoneAction(templateId, newMilestoneName.trim(), milestones.length);
      if (result.ok) { toast.success("Section added."); setNewMilestoneName(""); setAddingMilestone(false); router.refresh(); }
      else toast.error(result.message ?? "Could not add section.");
    });
  }

  return (
    <div className="space-y-4">
      {/* Audience filter — Venue Planning only; Client Planning is always the client */}
      {kind === "venue" && (
        <div className="flex gap-1.5">
          {AUDIENCE_CHIPS.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => setAudienceFilter(a.value)}
              className={cn(
                "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                audienceFilter === a.value ? "text-white border-transparent" : "border-border text-muted-foreground hover:border-ring"
              )}
              style={audienceFilter === a.value ? { background: a.color } : {}}
            >
              {a.emoji} {a.label}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {sortedMilestones.map((m, i) => (
          <MilestoneChapter
            key={m.id}
            kind={kind}
            milestone={m}
            tasks={tasksByMilestone(m.id)}
            allTasks={tasks}
            isFirst={i === 0}
            isLast={i === sortedMilestones.length - 1}
            templateId={templateId}
            audienceFilter={audienceFilter}
            attachmentsByTask={attachmentsByTask}
            venueDocuments={venueDocuments}
            onTaskAdded={() => router.refresh()}
            onTaskUpdated={() => router.refresh()}
            onTaskDeleted={() => router.refresh()}
            onAttachmentsChanged={() => router.refresh()}
          />
        ))}
      </div>

      {addingMilestone ? (
        <div className="flex items-center gap-2 rounded-xl border border-ring bg-card p-3">
          <Input
            value={newMilestoneName} onChange={(e) => setNewMilestoneName(e.target.value)}
            placeholder="e.g. Vendor Selection" autoFocus className="h-8 text-sm"
            onKeyDown={(e) => e.key === "Enter" && handleAddMilestone()}
          />
          <Button type="button" size="sm" onClick={handleAddMilestone} disabled={!newMilestoneName.trim() || addMilestonePending}>
            {addMilestonePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => { setAddingMilestone(false); setNewMilestoneName(""); }}>Cancel</Button>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setAddingMilestone(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add Section
        </Button>
      )}
    </div>
  );
}
