"use client";

/**
 * Timeline item Attachments — upload a file or attach an existing (event)
 * document. Mirrors the established Planning Template attachments pattern
 * (components/playbooks/playbook-builder.tsx's AttachmentsField: same
 * storage bucket, same upload-then-link two-step), scoped to this event's
 * own documents rather than venue-wide ones, and document-only — Links
 * (timeline-links-field.tsx) is Timeline items' separate field for raw URLs.
 */

import * as React from "react";

import { FileText, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { addEntryAttachmentAction, removeEntryAttachmentAction } from "@/app/(app)/events/[id]/timeline-actions";
import { saveDocumentAction } from "@/app/(app)/documents/actions";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/integrations/supabase/client";
import type { Document } from "@/lib/documents/types";
import type { TimelineEntryAttachment } from "@/lib/timeline/types";

const MAX_FILE_SIZE_MB = 25;
const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.svg,.txt,.csv";

export function TimelineAttachmentsField({
  eventId, venueId, timelineEntryId, attachments, availableDocuments, onChanged,
}: {
  eventId: string;
  venueId: string;
  timelineEntryId: string;
  attachments: TimelineEntryAttachment[];
  availableDocuments: Document[];
  onChanged: (attachments: TimelineEntryAttachment[]) => void;
}) {
  const [uploading, setUploading] = React.useState(false);
  const [attachingExisting, setAttachingExisting] = React.useState(false);
  const [existingDocId, setExistingDocId] = React.useState("");
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const attachedDocIds = new Set(attachments.map((a) => a.documentId));
  const pickableDocs = availableDocuments.filter((d) => !attachedDocIds.has(d.id));

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) { toast.error(`File too large. Maximum ${MAX_FILE_SIZE_MB} MB.`); return; }
    setUploading(true);
    try {
      const supabase = createClient();
      const docId = crypto.randomUUID();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const storagePath = `${venueId}/event/${eventId}/${docId}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("documents").upload(storagePath, file, { upsert: false, contentType: file.type });
      if (uploadError) throw new Error(uploadError.message);
      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(storagePath);

      const saved = await saveDocumentAction({
        entityType: "event", entityId: eventId,
        name: file.name.replace(/\.[^.]+$/, ""), category: "other", notes: "", tags: "", expiresAt: "",
        fileName: file.name, fileSize: file.size, mimeType: file.type, storagePath, storageUrl: urlData.publicUrl,
      });
      if (!saved.ok) { toast.error(saved.message ?? "Could not save file."); await supabase.storage.from("documents").remove([storagePath]); return; }

      const linked = await addEntryAttachmentAction(timelineEntryId, eventId, saved.documentId, attachments.length);
      if (linked.ok) { toast.success("File attached."); onChanged([...attachments, linked.attachment]); }
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
    const result = await addEntryAttachmentAction(timelineEntryId, eventId, existingDocId, attachments.length);
    if (result.ok) { toast.success("Document attached."); setExistingDocId(""); setAttachingExisting(false); onChanged([...attachments, result.attachment]); }
    else toast.error(result.message ?? "Could not attach document.");
  }

  async function handleRemove(attachmentId: string) {
    setRemovingId(attachmentId);
    const result = await removeEntryAttachmentAction(attachmentId, eventId);
    setRemovingId(null);
    if (result.ok) onChanged(attachments.filter((a) => a.id !== attachmentId));
    else toast.error(result.message ?? "Could not remove attachment.");
  }

  return (
    <div className="space-y-2">
      {attachments.map((a) => (
        <div key={a.id} className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-1.5">
          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate text-xs text-foreground">{a.label}</span>
          <button type="button" onClick={() => handleRemove(a.id)} disabled={removingId === a.id} className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive">
            {removingId === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
          </button>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-1.5">
        <input ref={fileRef} type="file" accept={ACCEPT} onChange={handleFileSelect} className="hidden" id={`timeline-upload-${timelineEntryId}`} />
        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Upload className="mr-1 h-3 w-3" />} Upload a file
        </Button>
        {pickableDocs.length > 0 && (
          <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setAttachingExisting((v) => !v)}>
            <FileText className="mr-1 h-3 w-3" /> Use an existing document
          </Button>
        )}
      </div>

      {attachingExisting && (
        <div className="flex items-center gap-1.5">
          <Select value={existingDocId} onValueChange={setExistingDocId} items={pickableDocs.map((d) => ({ value: d.id, label: d.name || d.fileName }))}>
            <SelectTrigger className="h-7 flex-1 text-xs"><SelectValue placeholder="Choose a document…" /></SelectTrigger>
            <SelectContent>{pickableDocs.map((d) => <SelectItem key={d.id} value={d.id}>{d.name || d.fileName}</SelectItem>)}</SelectContent>
          </Select>
          <Button type="button" size="sm" className="h-7 px-2 text-xs" disabled={!existingDocId} onClick={handleAttachExisting}>Attach</Button>
        </div>
      )}
    </div>
  );
}
