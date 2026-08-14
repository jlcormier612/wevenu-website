"use client";

import * as React from "react";

import { Loader2, Plus, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { saveDocumentAction } from "@/app/(app)/documents/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/integrations/supabase/client";
import { DOCUMENT_CATEGORIES } from "@/lib/documents/constants";
import type { DocumentCategory, DocumentEntityType } from "@/lib/documents/types";
import type { WorkspaceCategory, WorkspaceDocument } from "@/lib/document-workspace/types";

const MAX_FILE_SIZE_MB = 25;

// Mirrors lib/document-workspace/normalize.ts's mapCategory for the
// docType:"document" branch — kept local since the optimistic insert
// below never has a full RPC row to normalize, only the raw upload category.
const UPLOAD_CATEGORY_MAP: Record<DocumentCategory, WorkspaceCategory> = {
  contract: "Contracts", insurance: "Other", inspiration: "Planning",
  floor_plan: "Floor Plans", menu: "Planning", permit: "Other",
  questionnaire: "Questionnaires", invoice_copy: "Invoices", other: "Other",
};
const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.svg,.txt,.csv";

/**
 * The Workspace's own upload affordance — deliberately the same storage
 * mechanism the old per-entity Documents tab used (same bucket, same path
 * shape, same saveDocumentAction), not a new upload pipeline. "Upload"
 * isn't named in Steps 2–11's fixed lists, but every Relationship
 * Workspace entry point this replaces could already upload — dropping
 * that silently would be a regression, not a scope cut.
 */
export function WorkspaceUploadButton({
  entityType,
  entityId,
  venueId,
  onUploaded,
}: {
  entityType: DocumentEntityType;
  entityId: string;
  venueId: string;
  onUploaded: (doc: WorkspaceDocument) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState<DocumentCategory>("other");
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`File too large. Maximum ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }
    setFile(f);
    if (!name) setName(f.name.replace(/\.[^.]+$/, ""));
  }

  function reset() {
    setFile(null); setName(""); setCategory("other");
    if (fileRef.current) fileRef.current.value = "";
    setOpen(false);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const docId = crypto.randomUUID();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const storagePath = `${venueId}/${entityType}/${entityId}/${docId}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(storagePath, file, { upsert: false, contentType: file.type });
      if (uploadError) throw new Error(uploadError.message);

      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(storagePath);

      const result = await saveDocumentAction({
        entityType, entityId,
        name: name.trim() || file.name,
        category, notes: "", tags: "", expiresAt: "",
        fileName: file.name, fileSize: file.size, mimeType: file.type,
        storagePath, storageUrl: urlData.publicUrl,
      });

      if (result.ok) {
        const now = new Date().toISOString();
        onUploaded({
          docType: "document",
          id: result.documentId,
          name: name.trim() || file.name,
          category: UPLOAD_CATEGORY_MAP[category],
          rawStatus: null,
          status: "none",
          currentVersion: 1,
          ownerType: entityType === "lead" ? "lead" : entityType === "client" ? "client" : entityType === "event" ? "event" : "vendor",
          leadId: entityType === "lead" ? entityId : null,
          clientId: entityType === "client" ? entityId : null,
          eventId: entityType === "event" ? entityId : null,
          vendorId: entityType === "vendor" ? entityId : null,
          relationshipName: null,
          eventName: null,
          fileUrl: urlData.publicUrl,
          fileSize: file.size,
          mimeType: file.type,
          isCoupleVisible: false,
          isVendorVisible: false,
          uploadedByType: "venue",
          createdAt: now,
          updatedAt: now,
        });
        toast.success("Document uploaded.");
        reset();
      } else {
        toast.error(result.message ?? "Could not save document.");
        await supabase.storage.from("documents").remove([storagePath]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-3.5 w-3.5" /> Upload Document
      </Button>
    );
  }

  return (
    <div className="rounded-xl border border-ring bg-card p-4 space-y-4">
      <p className="text-sm font-medium text-heading">Upload Document</p>
      {!file ? (
        <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/20 cursor-pointer p-8 hover:border-primary/40 hover:bg-muted/40 transition-colors">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Click to choose a file</span>
          <span className="text-xs text-muted-foreground">PDF, Word, Excel, images — up to {MAX_FILE_SIZE_MB} MB</span>
          <input ref={fileRef} type="file" className="sr-only" accept={ACCEPT} onChange={handleFileSelect} />
        </label>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/5 px-4 py-3">
          <p className="flex-1 text-sm font-medium text-foreground truncate">{file.name}</p>
          <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }}
            className="shrink-0 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
      )}
      {file && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Display name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={file.name} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as DocumentCategory)} items={DOCUMENT_CATEGORIES}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DOCUMENT_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      )}
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={uploading}>Cancel</Button>
        <Button type="button" size="sm" disabled={!file || uploading} onClick={handleUpload}>
          {uploading ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Uploading…</> : <><Upload className="mr-1 h-3.5 w-3.5" />Upload</>}
        </Button>
      </div>
    </div>
  );
}
