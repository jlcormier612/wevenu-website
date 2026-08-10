"use client";

import * as React from "react";
import {
  ArrowLeft, CheckSquare, FileUp, Loader2, Paperclip, Plus, Trash2, X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  addVendorTaskTemplateItemAttachmentAction,
  createVendorTaskTemplateAction,
  createVendorTaskTemplateItemAction,
  deleteVendorTaskTemplateAction,
  deleteVendorTaskTemplateItemAction,
  removeVendorTaskTemplateItemAttachmentAction,
  toggleVendorTaskTemplateAction,
  updateVendorTaskTemplateAction,
  updateVendorTaskTemplateItemAction,
} from "@/app/vendor/task-templates/actions";
import { EVENT_TYPES, eventTypeLabel } from "@/lib/leads/constants";
import { uploadVendorFile } from "@/lib/vendor-documents/upload-client";
import { VendorRelativeDuePicker } from "@/components/vendor-app/vendor-relative-due-picker";
import { parseDaysOffsetInput } from "@/lib/vendor-task-templates/presets";
import type {
  VendorTaskTemplate,
  VendorTaskTemplateItem,
  VendorTaskTemplateItemInput,
  VendorTaskTemplatePackInput,
} from "@/lib/vendor-task-templates/types";
import type { VendorPackage } from "@/lib/vendors/types";

const NONE = "__none__";

const EMPTY_PACK: VendorTaskTemplatePackInput = {
  name: "",
  notes: "",
  packageId: "",
  eventType: "",
  isActive: true,
};

type DraftRow = {
  localId: string;
  title: string;
  daysOffset: string;
  notes: string;
  actionType: "" | "share_timeline";
};

type ItemDraft = {
  title: string;
  daysOffset: string;
  notes: string;
  actionType: "" | "share_timeline";
};

function newDraftRow(): DraftRow {
  return { localId: crypto.randomUUID(), title: "", daysOffset: "", notes: "", actionType: "" };
}

function itemToDraft(item: VendorTaskTemplateItem): ItemDraft {
  return {
    title: item.title,
    daysOffset: item.daysOffset != null ? String(item.daysOffset) : "",
    notes: item.notes ?? "",
    actionType: item.actionType === "share_timeline" ? "share_timeline" : "",
  };
}

function draftsEqual(a: ItemDraft, b: ItemDraft): boolean {
  return (
    a.title === b.title
    && a.daysOffset === b.daysOffset
    && a.notes === b.notes
    && a.actionType === b.actionType
  );
}

function packTagParts(pack: VendorTaskTemplate): string[] {
  const parts: string[] = [];
  if (pack.eventType) parts.push(eventTypeLabel(pack.eventType));
  if (pack.packageName) parts.push(pack.packageName);
  return parts;
}

function PackHeaderFields({
  form,
  packages,
  onChange,
  idPrefix,
}: {
  form: VendorTaskTemplatePackInput;
  packages: VendorPackage[];
  onChange: <K extends keyof VendorTaskTemplatePackInput>(
    key: K,
    value: VendorTaskTemplatePackInput[K],
  ) => void;
  idPrefix: string;
}) {
  const eventTypeItems = [{ value: NONE, label: "Any event type" }, ...EVENT_TYPES];
  const packageItems = [
    { value: NONE, label: "No package tag" },
    ...packages.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`${idPrefix}-name`}>
            Template name <span className="text-destructive">*</span>
          </Label>
          <Input
            id={`${idPrefix}-name`}
            value={form.name}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder='e.g. Gold package, Full wedding day'
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-event-type`}>Event type</Label>
          <Select
            value={form.eventType || NONE}
            onValueChange={(v) => onChange("eventType", v === NONE ? "" : v)}
            items={eventTypeItems}
          >
            <SelectTrigger id={`${idPrefix}-event-type`}><SelectValue /></SelectTrigger>
            <SelectContent>
              {eventTypeItems.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-package`}>Package tag</Label>
          <Select
            value={form.packageId || NONE}
            onValueChange={(v) => onChange("packageId", v === NONE ? "" : v)}
            items={packageItems}
          >
            <SelectTrigger id={`${idPrefix}-package`}><SelectValue /></SelectTrigger>
            <SelectContent>
              {packageItems.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">Soft filter only — not linked to bookings.</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-notes`}>Template notes (optional)</Label>
        <Textarea
          id={`${idPrefix}-notes`}
          rows={2}
          value={form.notes}
          onChange={(e) => onChange("notes", e.target.value)}
          placeholder="Internal notes about this template…"
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id={`${idPrefix}-active`}
          checked={form.isActive}
          onCheckedChange={(v) => onChange("isActive", v)}
        />
        <Label htmlFor={`${idPrefix}-active`} className="cursor-pointer">
          Active (shown when applying to an event)
        </Label>
      </div>
    </div>
  );
}

function NotesWithUpload({
  notes,
  onNotesChange,
  attachments,
  uploading,
  onUpload,
  onRemoveAttachment,
  removingAttachmentId,
  uploadDisabled,
  uploadHint,
}: {
  notes: string;
  onNotesChange: (value: string) => void;
  attachments: VendorTaskTemplateItem["attachments"];
  uploading: boolean;
  onUpload: () => void;
  onRemoveAttachment?: (attachmentId: string) => void;
  removingAttachmentId?: string | null;
  uploadDisabled?: boolean;
  uploadHint?: string;
}) {
  return (
    <div className="space-y-2">
      <Textarea
        rows={2}
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder="Directions / notes. Paste links as plain URLs…"
        className="min-h-[4.5rem]"
      />
      <div className="flex flex-wrap items-center gap-2">
        {attachments.map((a) => (
          <span
            key={a.id}
            className="inline-flex items-center gap-1 rounded-sm border border-border bg-muted/40 px-2 py-0.5 text-[11px]"
          >
            <Paperclip className="h-3 w-3 text-muted-foreground" />
            <a
              href={a.storageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="max-w-[10rem] truncate text-primary hover:underline"
            >
              {a.name}
            </a>
            {onRemoveAttachment && (
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => onRemoveAttachment(a.id)}
                disabled={removingAttachmentId === a.id}
                aria-label={`Remove ${a.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={onUpload}
          disabled={uploadDisabled || uploading}
        >
          {uploading
            ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Uploading…</>
            : <><FileUp className="mr-1 h-3 w-3" />Upload</>}
        </Button>
      </div>
      {uploadHint && (
        <p className="text-[11px] text-muted-foreground">{uploadHint}</p>
      )}
    </div>
  );
}

function PackListCard({
  pack,
  onOpen,
  onToggle,
  onDelete,
  saving,
}: {
  pack: VendorTaskTemplate;
  onOpen: () => void;
  onToggle: (isActive: boolean) => void;
  onDelete: () => void;
  saving: boolean;
}) {
  const taskCount = pack.items.length;
  const preview = pack.items.slice(0, 3).map((i) => i.title).filter(Boolean);
  const tags = packTagParts(pack);

  return (
    <div
      className={`rounded-sm border border-border bg-card p-4 transition-opacity ${
        pack.isActive ? "" : "opacity-60"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">{pack.name}</p>
            <Badge variant={pack.isActive ? "default" : "outline"} className="text-xs">
              {pack.isActive ? "Active" : "Inactive"}
            </Badge>
            {tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs font-normal">
                {tag}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {taskCount === 1 ? "1 task" : `${taskCount} tasks`}
            {preview.length > 0 && (
              <span>
                {" · "}
                {preview.join(" · ")}
                {taskCount > preview.length ? "…" : ""}
              </span>
            )}
          </p>
          {pack.notes && (
            <p className="line-clamp-2 text-xs text-muted-foreground">{pack.notes}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Switch
            checked={pack.isActive}
            onCheckedChange={onToggle}
            disabled={saving}
            aria-label={pack.isActive ? "Deactivate" : "Activate"}
          />
          <Button type="button" size="sm" onClick={onOpen}>
            Open
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={onDelete}
            disabled={saving}
            aria-label={`Delete ${pack.name}`}
          >
            {saving
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Trash2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function VendorTaskTemplatesManager({
  templates: initial,
  packages,
}: {
  templates: VendorTaskTemplate[];
  packages: VendorPackage[];
}) {
  const [templates, setTemplates] = React.useState(initial);
  const [activePackId, setActivePackId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [createForm, setCreateForm] = React.useState<VendorTaskTemplatePackInput>(EMPTY_PACK);
  const [packForm, setPackForm] = React.useState<VendorTaskTemplatePackInput | null>(null);
  const [itemDrafts, setItemDrafts] = React.useState<Record<string, ItemDraft>>({});
  const [draftRows, setDraftRows] = React.useState<DraftRow[]>([]);
  const [savingKey, setSavingKey] = React.useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const uploadTargetItemId = React.useRef<string | null>(null);

  const activePack = activePackId
    ? templates.find((t) => t.id === activePackId) ?? null
    : null;

  function seedEditor(pack: VendorTaskTemplate, withDraft: boolean) {
    setCreating(false);
    setActivePackId(pack.id);
    setPackForm({
      name: pack.name,
      notes: pack.notes ?? "",
      packageId: pack.packageId ?? "",
      eventType: pack.eventType ?? "",
      isActive: pack.isActive,
    });
    const next: Record<string, ItemDraft> = {};
    for (const item of pack.items) {
      next[item.id] = itemToDraft(item);
    }
    setItemDrafts(next);
    setDraftRows(withDraft ? [newDraftRow()] : []);
  }

  function openPack(packId: string, withDraft = false) {
    const pack = templates.find((t) => t.id === packId);
    if (!pack) return;
    seedEditor(pack, withDraft);
  }

  function backToList() {
    setActivePackId(null);
    setCreating(false);
    setCreateForm(EMPTY_PACK);
    setPackForm(null);
    setItemDrafts({});
    setDraftRows([]);
  }

  async function handleCreatePack() {
    if (!createForm.name.trim()) return;
    setSavingKey("pack-create");
    try {
      const result = await createVendorTaskTemplateAction(createForm);
      if (!result.ok) {
        toast.error(result.message ?? "Could not create template.");
        return;
      }
      toast.success("Template created.");
      const pkgName = packages.find((p) => p.id === createForm.packageId)?.name ?? null;
      const newPack: VendorTaskTemplate = {
        id: result.id ?? crypto.randomUUID(),
        vendorId: "",
        name: createForm.name.trim(),
        notes: createForm.notes.trim() || null,
        packageId: createForm.packageId.trim() || null,
        eventType: createForm.eventType.trim() || null,
        isActive: createForm.isActive,
        sortOrder: templates.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        packageName: pkgName,
        items: [],
      };
      setTemplates((list) => [...list, newPack]);
      setCreateForm(EMPTY_PACK);
      seedEditor(newPack, true);
    } finally {
      setSavingKey(null);
    }
  }

  async function handleSavePack() {
    if (!activePack || !packForm || !packForm.name.trim()) return;
    setSavingKey(`pack-${activePack.id}`);
    try {
      const result = await updateVendorTaskTemplateAction(activePack.id, packForm);
      if (!result.ok) {
        toast.error(result.message ?? "Could not update template.");
        return;
      }
      toast.success("Template updated.");
      const pkgName = packages.find((p) => p.id === packForm.packageId)?.name ?? null;
      setTemplates((list) => list.map((t) =>
        t.id === activePack.id
          ? {
              ...t,
              name: packForm.name.trim(),
              notes: packForm.notes.trim() || null,
              packageId: packForm.packageId.trim() || null,
              eventType: packForm.eventType.trim() || null,
              isActive: packForm.isActive,
              packageName: pkgName,
            }
          : t,
      ));
    } finally {
      setSavingKey(null);
    }
  }

  async function handleToggle(id: string, isActive: boolean) {
    setSavingKey(`pack-${id}`);
    try {
      const result = await toggleVendorTaskTemplateAction(id, isActive);
      if (!result.ok) { toast.error(result.message ?? "Could not update."); return; }
      setTemplates((list) => list.map((t) => (t.id === id ? { ...t, isActive } : t)));
      if (packForm && activePackId === id) {
        setPackForm((prev) => (prev ? { ...prev, isActive } : prev));
      }
    } finally {
      setSavingKey(null);
    }
  }

  async function handleDeletePack(id: string) {
    setSavingKey(`pack-${id}`);
    try {
      const result = await deleteVendorTaskTemplateAction(id);
      if (!result.ok) { toast.error(result.message ?? "Could not delete."); return; }
      toast.success("Template deleted.");
      setTemplates((list) => list.filter((t) => t.id !== id));
      if (activePackId === id) backToList();
    } finally {
      setSavingKey(null);
    }
  }

  async function persistItem(
    packId: string,
    input: VendorTaskTemplateItemInput,
  ): Promise<VendorTaskTemplateItem | null> {
    const result = await createVendorTaskTemplateItemAction(packId, input);
    if (!result.ok) {
      toast.error(result.message ?? "Could not add task.");
      return null;
    }
    const item: VendorTaskTemplateItem = {
      id: result.id ?? crypto.randomUUID(),
      templateId: packId,
      title: input.title.trim(),
      daysOffset: input.daysOffset.trim() ? parseDaysOffsetInput(input.daysOffset) : null,
      notes: input.notes.trim() || null,
      actionType: input.actionType === "share_timeline" ? "share_timeline" : null,
      sortOrder: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attachments: [],
    };
    setTemplates((list) => list.map((t) =>
      t.id === packId ? { ...t, items: [...t.items, item] } : t,
    ));
    setItemDrafts((prev) => ({ ...prev, [item.id]: itemToDraft(item) }));
    return item;
  }

  async function handleSaveDraftRow(localId: string): Promise<VendorTaskTemplateItem | null> {
    if (!activePack) return null;
    const draft = draftRows.find((d) => d.localId === localId);
    if (!draft || !draft.title.trim()) {
      toast.error("Add a task title first.");
      return null;
    }
    setSavingKey(`draft-${localId}`);
    try {
      const item = await persistItem(activePack.id, {
        title: draft.title,
        daysOffset: draft.daysOffset,
        notes: draft.notes,
        actionType: draft.actionType === "share_timeline" ? "share_timeline" : null,
      });
      if (!item) return null;
      toast.success("Task added.");
      setDraftRows((rows) => rows.filter((r) => r.localId !== localId));
      return item;
    } finally {
      setSavingKey(null);
    }
  }

  async function handleSaveItem(itemId: string): Promise<boolean> {
    if (!activePack) return false;
    const draft = itemDrafts[itemId];
    if (!draft || !draft.title.trim()) {
      toast.error("Task title is required.");
      return false;
    }
    setSavingKey(`item-${itemId}`);
    try {
      const result = await updateVendorTaskTemplateItemAction(itemId, {
        title: draft.title,
        daysOffset: draft.daysOffset,
        notes: draft.notes,
        actionType: draft.actionType === "share_timeline" ? "share_timeline" : null,
      });
      if (!result.ok) {
        toast.error(result.message ?? "Could not update task.");
        return false;
      }
      toast.success("Task updated.");
      setTemplates((list) => list.map((t) =>
        t.id !== activePack.id ? t : {
          ...t,
          items: t.items.map((i) =>
            i.id === itemId
              ? {
                  ...i,
                  title: draft.title.trim(),
                  daysOffset: draft.daysOffset.trim()
                    ? parseDaysOffsetInput(draft.daysOffset)
                    : null,
                  notes: draft.notes.trim() || null,
                  actionType: draft.actionType === "share_timeline" ? "share_timeline" : null,
                }
              : i,
          ),
        },
      ));
      return true;
    } finally {
      setSavingKey(null);
    }
  }

  async function handleUploadForItem(itemId: string) {
    if (!activePack) return;
    const item = activePack.items.find((i) => i.id === itemId);
    const draft = itemDrafts[itemId];
    if (item && draft && !draftsEqual(draft, itemToDraft(item))) {
      const saved = await handleSaveItem(itemId);
      if (!saved) return;
    }
    triggerUpload(itemId);
  }

  async function handleDeleteItem(itemId: string) {
    if (!activePack) return;
    setSavingKey(`item-${itemId}`);
    try {
      const result = await deleteVendorTaskTemplateItemAction(itemId);
      if (!result.ok) { toast.error(result.message ?? "Could not delete task."); return; }
      toast.success("Task removed.");
      setTemplates((list) => list.map((t) =>
        t.id === activePack.id
          ? { ...t, items: t.items.filter((i) => i.id !== itemId) }
          : t,
      ));
      setItemDrafts((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
    } finally {
      setSavingKey(null);
    }
  }

  function triggerUpload(itemId: string) {
    uploadTargetItemId.current = itemId;
    fileInputRef.current?.click();
  }

  async function handleUploadForDraft(localId: string) {
    const item = await handleSaveDraftRow(localId);
    if (!item) return;
    // Let state settle, then open the file picker for the new item.
    queueMicrotask(() => triggerUpload(item.id));
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const itemId = uploadTargetItemId.current;
    e.target.value = "";
    if (!file || !itemId) return;
    setUploadingKey(itemId);
    try {
      const uploaded = await uploadVendorFile(file, "task-template");
      const result = await addVendorTaskTemplateItemAttachmentAction({
        itemId,
        name: file.name,
        storagePath: uploaded.storagePath!,
        storageUrl: uploaded.storageUrl!,
        mimeType: uploaded.mime_type ?? (file.type || null),
        fileSize: uploaded.file_size ?? file.size,
      });
      if (!result.ok) {
        toast.error(result.message ?? "Could not attach file.");
        return;
      }
      toast.success("File attached.");
      setTemplates((list) => list.map((t) => ({
        ...t,
        items: t.items.map((i) =>
          i.id !== itemId ? i : {
            ...i,
            attachments: [
              ...i.attachments,
              {
                id: result.id ?? crypto.randomUUID(),
                itemId,
                name: file.name,
                storagePath: uploaded.storagePath!,
                storageUrl: uploaded.storageUrl!,
                mimeType: uploaded.mime_type ?? (file.type || null),
                fileSize: uploaded.file_size ?? file.size,
                sortOrder: i.attachments.length,
              },
            ],
          },
        ),
      })));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploadingKey(null);
      uploadTargetItemId.current = null;
    }
  }

  async function handleRemoveAttachment(attachmentId: string, itemId: string) {
    setSavingKey(`att-${attachmentId}`);
    try {
      const result = await removeVendorTaskTemplateItemAttachmentAction(attachmentId);
      if (!result.ok) { toast.error(result.message ?? "Could not remove file."); return; }
      setTemplates((list) => list.map((t) => ({
        ...t,
        items: t.items.map((i) =>
          i.id !== itemId ? i : {
            ...i,
            attachments: i.attachments.filter((a) => a.id !== attachmentId),
          },
        ),
      })));
    } finally {
      setSavingKey(null);
    }
  }

  function updateDraftRow(localId: string, patch: Partial<DraftRow>) {
    setDraftRows((rows) => rows.map((r) => (r.localId === localId ? { ...r, ...patch } : r)));
  }

  function updateItemDraft(itemId: string, patch: Partial<ItemDraft>) {
    setItemDrafts((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? { title: "", daysOffset: "", notes: "" }), ...patch },
    }));
  }

  const packHeaderDirty = activePack && packForm
    ? packForm.name !== activePack.name
      || packForm.notes !== (activePack.notes ?? "")
      || packForm.packageId !== (activePack.packageId ?? "")
      || packForm.eventType !== (activePack.eventType ?? "")
      || packForm.isActive !== activePack.isActive
    : false;

  // ── Create pack (short form, then open editor) ──────────────────────────
  if (creating) {
    return (
      <div className="space-y-4">
        <Button type="button" variant="ghost" size="sm" className="-ml-2" onClick={backToList}>
          <ArrowLeft className="mr-1 h-3.5 w-3.5" />
          Back to Task Templates
        </Button>
        <div className="rounded-sm border border-primary/30 bg-card p-4 space-y-4">
          <div>
            <h2 className="text-sm font-medium text-foreground">Create template</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Name the template, then add tasks in the editor.
            </p>
          </div>
          <PackHeaderFields
            form={createForm}
            packages={packages}
            idPrefix="create-pack"
            onChange={(k, v) => setCreateForm((p) => ({ ...p, [k]: v }))}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={backToList} disabled={savingKey === "pack-create"}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleCreatePack()}
              disabled={savingKey === "pack-create" || !createForm.name.trim()}
            >
              {savingKey === "pack-create"
                ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Creating…</>
                : "Create & open"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Pack editor ─────────────────────────────────────────────────────────
  if (activePack && packForm) {
    return (
      <div className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => void handleFileChange(e)}
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" className="-ml-2" onClick={backToList}>
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />
            Back to Task Templates
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => void handleDeletePack(activePack.id)}
            disabled={savingKey === `pack-${activePack.id}`}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Delete Template
          </Button>
        </div>

        <div className="rounded-sm border border-border bg-card p-4 space-y-4">
          <PackHeaderFields
            form={packForm}
            packages={packages}
            idPrefix="edit-pack"
            onChange={(k, v) => setPackForm((p) => (p ? { ...p, [k]: v } : p))}
          />
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              onClick={() => void handleSavePack()}
              disabled={
                savingKey === `pack-${activePack.id}`
                || !packForm.name.trim()
                || !packHeaderDirty
              }
            >
              {savingKey === `pack-${activePack.id}`
                ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Saving…</>
                : "Save Template"}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-medium text-foreground">Tasks</h2>
              <p className="text-xs text-muted-foreground">
                {activePack.items.length === 1
                  ? "1 task in this template"
                  : `${activePack.items.length} tasks in this template`}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDraftRows((rows) => [...rows, newDraftRow()])}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add task
            </Button>
          </div>

          {activePack.items.length === 0 && draftRows.length === 0 ? (
            <div className="rounded-sm border border-dashed border-border py-8 text-center">
              <p className="text-sm text-muted-foreground">No tasks yet.</p>
              <Button
                type="button"
                size="sm"
                className="mt-3"
                onClick={() => setDraftRows([newDraftRow()])}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add first task
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {activePack.items.map((item, index) => {
                const draft = itemDrafts[item.id] ?? itemToDraft(item);
                const saved = itemToDraft(item);
                const dirty = !draftsEqual(draft, saved);
                const saving = savingKey === `item-${item.id}`;

                return (
                  <div
                    key={item.id}
                    className="rounded-sm border border-border bg-card p-3 space-y-3"
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-2.5 w-5 shrink-0 text-center text-xs text-muted-foreground">
                        {index + 1}
                      </span>
                      <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
                        <div className="space-y-1.5">
                          <Label>
                            Title <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            value={draft.title}
                            onChange={(e) => updateItemDraft(item.id, { title: e.target.value })}
                            placeholder="e.g. Confirm final guest count"
                            className="font-medium"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Due</Label>
                          <VendorRelativeDuePicker
                            value={draft.daysOffset}
                            onChange={(daysOffset) =>
                              updateItemDraft(item.id, { daysOffset })
                            }
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mt-6 h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                        onClick={() => void handleDeleteItem(item.id)}
                        disabled={saving}
                        aria-label={`Remove ${item.title || "task"}`}
                      >
                        {saving
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </div>

                    <div className="pl-7 space-y-2">
                      <div className="space-y-1.5">
                        <Label>Couple action</Label>
                        <Select
                          value={draft.actionType || "__none__"}
                          onValueChange={(v) =>
                            updateItemDraft(item.id, {
                              actionType: v === "share_timeline" ? "share_timeline" : "",
                            })
                          }
                          items={[
                            { value: "__none__", label: "None" },
                            { value: "share_timeline", label: "Share timeline" },
                          ]}
                        >
                          <SelectTrigger className="w-full sm:w-56">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            <SelectItem value="share_timeline">Share timeline</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Label>Notes</Label>
                      <NotesWithUpload
                        notes={draft.notes}
                        onNotesChange={(v) => updateItemDraft(item.id, { notes: v })}
                        attachments={item.attachments}
                        uploading={uploadingKey === item.id}
                        onUpload={() => void handleUploadForItem(item.id)}
                        onRemoveAttachment={(id) => void handleRemoveAttachment(id, item.id)}
                        removingAttachmentId={
                          savingKey?.startsWith("att-") ? savingKey.slice(4) : null
                        }
                      />
                      {dirty && (
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void handleSaveItem(item.id)}
                            disabled={saving || !draft.title.trim()}
                          >
                            {saving
                              ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Saving…</>
                              : "Save task"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {draftRows.map((draft, draftIndex) => {
                const rowNumber = activePack.items.length + draftIndex + 1;
                const saving = savingKey === `draft-${draft.localId}`;
                return (
                  <div
                    key={draft.localId}
                    className="rounded-sm border border-dashed border-primary/40 bg-card p-3 space-y-3"
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-2.5 w-5 shrink-0 text-center text-xs text-muted-foreground">
                        {rowNumber}
                      </span>
                      <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
                        <div className="space-y-1.5">
                          <Label>
                            Title <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            value={draft.title}
                            onChange={(e) => updateDraftRow(draft.localId, { title: e.target.value })}
                            placeholder="e.g. Confirm final guest count"
                            className="font-medium"
                            autoFocus={draftIndex === draftRows.length - 1}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Due</Label>
                          <VendorRelativeDuePicker
                            value={draft.daysOffset}
                            onChange={(daysOffset) =>
                              updateDraftRow(draft.localId, { daysOffset })
                            }
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mt-6 h-8 w-8 shrink-0"
                        onClick={() =>
                          setDraftRows((rows) => rows.filter((r) => r.localId !== draft.localId))
                        }
                        aria-label="Discard draft task"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="pl-7 space-y-2">
                      <div className="space-y-1.5">
                        <Label>Couple action</Label>
                        <Select
                          value={draft.actionType || "__none__"}
                          onValueChange={(v) =>
                            updateDraftRow(draft.localId, {
                              actionType: v === "share_timeline" ? "share_timeline" : "",
                            })
                          }
                          items={[
                            { value: "__none__", label: "None" },
                            { value: "share_timeline", label: "Share timeline" },
                          ]}
                        >
                          <SelectTrigger className="w-full sm:w-56">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            <SelectItem value="share_timeline">Share timeline</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Label>Notes</Label>
                      <NotesWithUpload
                        notes={draft.notes}
                        onNotesChange={(v) => updateDraftRow(draft.localId, { notes: v })}
                        attachments={[]}
                        uploading={false}
                        onUpload={() => void handleUploadForDraft(draft.localId)}
                        uploadDisabled={saving}
                        uploadHint="Upload saves this task first, then attaches the file."
                      />
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void handleSaveDraftRow(draft.localId)}
                          disabled={saving || !draft.title.trim()}
                        >
                          {saving
                            ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Saving…</>
                            : "Save task"}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Pack list ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {templates.length === 0 ? (
        <div className="rounded-sm border border-dashed border-border py-12 text-center">
          <CheckSquare className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No task templates yet</p>
          <p className="mb-4 mt-1 text-xs text-muted-foreground">
            Create a named template (like &ldquo;Gold package&rdquo;), add tasks, then apply on an event&apos;s Tasks tab.
          </p>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Create Template
          </Button>
        </div>
      ) : (
        <>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Create Template
            </Button>
          </div>
          <div className="space-y-3">
            {templates.map((pack) => (
              <PackListCard
                key={pack.id}
                pack={pack}
                onOpen={() => openPack(pack.id)}
                onToggle={(v) => void handleToggle(pack.id, v)}
                onDelete={() => void handleDeletePack(pack.id)}
                saving={savingKey === `pack-${pack.id}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
