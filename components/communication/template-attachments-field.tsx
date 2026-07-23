"use client";

/**
 * Message Template attachments — bug-report follow-up, 2026-07-22: "they'll
 * also need to be able to attach things in these templates, like brochures,
 * etc." Mirrors components/playbooks/playbook-builder.tsx's AttachmentsField
 * exactly (upload a file / attach an existing venue document / add a link),
 * reusing the same venue-level Documents system rather than a new one.
 */
import * as React from "react";

import { FileText, Link2, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import {
  addTemplateAttachmentAction, removeTemplateAttachmentAction,
} from "@/app/(app)/communication/templates/actions";
import { saveVenueDocumentAction } from "@/app/(app)/documents/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/integrations/supabase/client";
import type { Document } from "@/lib/documents/types";
import type { MessageTemplateAttachment } from "@/lib/message-templates/types";

const MAX_FILE_SIZE_MB = 25;
const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.svg,.txt,.csv";

export function TemplateAttachmentsField({
  templateId, attachments, venueDocuments, onChanged,
}: {
  templateId: string;
  attachments: MessageTemplateAttachment[];
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
      const storagePath = `venue/${docId}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("documents").upload(storagePath, file, { upsert: false, contentType: file.type });
      if (uploadError) throw new Error(uploadError.message);
      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(storagePath);

      const saved = await saveVenueDocumentAction({
        name: file.name.replace(/\.[^.]+$/, ""), category: "other", notes: "", tags: "", expiresAt: "",
        fileName: file.name, fileSize: file.size, mimeType: file.type, storagePath, storageUrl: urlData.publicUrl,
      });
      if (!saved.ok) { toast.error(saved.message ?? "Could not save file."); await supabase.storage.from("documents").remove([storagePath]); return; }

      const linked = await addTemplateAttachmentAction(templateId, { documentId: saved.documentId }, attachments.length);
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
    const result = await addTemplateAttachmentAction(templateId, { documentId: existingDocId }, attachments.length);
    if (result.ok) { toast.success("Document attached."); setExistingDocId(""); setAttachingExisting(false); onChanged(); }
    else toast.error(result.message ?? "Could not attach document.");
  }

  async function handleAddLink() {
    if (!linkUrl.trim()) return;
    const result = await addTemplateAttachmentAction(templateId, { linkUrl: linkUrl.trim(), linkLabel: linkLabel.trim() || null }, attachments.length);
    if (result.ok) { toast.success("Link added."); setLinkLabel(""); setLinkUrl(""); setAddingLink(false); onChanged(); }
    else toast.error(result.message ?? "Could not add link.");
  }

  async function handleRemove(attachmentId: string) {
    setRemovingId(attachmentId);
    const result = await removeTemplateAttachmentAction(attachmentId, templateId);
    setRemovingId(null);
    if (result.ok) onChanged();
    else toast.error(result.message ?? "Could not remove attachment.");
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-heading">Attachments</p>
        <p className="text-xs text-muted-foreground">Brochures, pricing sheets, or any file worth including</p>
      </div>

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
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <input ref={fileRef} type="file" accept={ACCEPT} onChange={handleFileSelect} className="hidden" id={`template-upload-${templateId}`} />
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
