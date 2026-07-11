"use client";

import * as React from "react";

import { Loader2, Plus, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { saveDocumentAction } from "@/app/(app)/documents/actions";
import { DocumentCard } from "@/components/documents/document-card";
import { DocumentCategoryBadge } from "@/components/documents/document-category-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/integrations/supabase/client";
import { categoryHasExpiry, DOCUMENT_CATEGORIES } from "@/lib/documents/constants";
import type {
  Document,
  DocumentCategory,
  DocumentEntityType,
} from "@/lib/documents/types";

const MAX_FILE_SIZE_MB = 25;
const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.svg,.txt,.csv";

function CategoryFilter({
  active,
  counts,
  onChange,
}: {
  active: DocumentCategory | "";
  counts: Partial<Record<DocumentCategory, number>>;
  onChange: (cat: DocumentCategory | "") => void;
}) {
  const total = Object.values(counts).reduce((s, c) => s + (c ?? 0), 0);
  return (
    <div className="flex flex-wrap gap-1.5">
      <button type="button" onClick={() => onChange("")}
        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${!active ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary/40"}`}>
        All {total > 0 && `(${total})`}
      </button>
      {DOCUMENT_CATEGORIES.filter((c) => counts[c.value]).map((c) => (
        <button key={c.value} type="button" onClick={() => onChange(c.value)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${active === c.value ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary/40"}`}>
          {c.label} ({counts[c.value]})
        </button>
      ))}
    </div>
  );
}

export function DocumentsSection({
  entityType,
  entityId,
  venueId,
  initialDocuments,
}: {
  entityType: DocumentEntityType;
  entityId: string;
  venueId: string;
  initialDocuments: Document[];
}) {
  const [docs, setDocs] = React.useState(initialDocuments);
  const [showUpload, setShowUpload] = React.useState(false);
  const [categoryFilter, setCategoryFilter] = React.useState<DocumentCategory | "">("");

  // Upload form state
  const [file, setFile] = React.useState<File | null>(null);
  const [uploadName, setUploadName] = React.useState("");
  const [uploadCategory, setUploadCategory] = React.useState<DocumentCategory>("other");
  const [uploadNotes, setUploadNotes] = React.useState("");
  const [uploadTags, setUploadTags] = React.useState("");
  const [uploadExpiry, setUploadExpiry] = React.useState("");
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
    if (!uploadName) setUploadName(f.name.replace(/\.[^.]+$/, ""));
  }

  function resetForm() {
    setFile(null); setUploadName(""); setUploadCategory("other");
    setUploadNotes(""); setUploadTags(""); setUploadExpiry("");
    if (fileRef.current) fileRef.current.value = "";
    setShowUpload(false);
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
        name: uploadName.trim() || file.name,
        category: uploadCategory,
        notes: uploadNotes,
        tags: uploadTags,
        expiresAt: uploadExpiry,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        storagePath,
        storageUrl: urlData.publicUrl,
      });

      if (result.ok) {
        // Optimistic: add a placeholder, real data comes after refresh
        const newDoc: Document = {
          id: result.documentId, venueId, entityType, entityId,
          leadId: entityType === "lead" ? entityId : null,
          clientId: entityType === "client" ? entityId : null,
          eventId: entityType === "event" ? entityId : null,
          vendorId: entityType === "vendor" ? entityId : null,
          name: uploadName.trim() || file.name,
          fileName: file.name, fileSize: file.size, mimeType: file.type,
          storagePath, storageUrl: urlData.publicUrl,
          category: uploadCategory, notes: uploadNotes.trim() || null,
          tags: uploadTags.split(",").map((t) => t.trim()).filter(Boolean),
          expiresAt: uploadExpiry || null,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        } as unknown as Document;
        setDocs((p) => [newDoc, ...p]);
        toast.success("Document uploaded.");
        resetForm();
      } else {
        toast.error(result.message ?? "Could not save document.");
        // Clean up orphaned file
        await supabase.storage.from("documents").remove([storagePath]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function handleDelete(id: string) {
    setDocs((p) => p.filter((d) => d.id !== id));
  }

  function handleUpdate(id: string, patch: Partial<Document>) {
    setDocs((p) => p.map((d) => d.id === id ? { ...d, ...patch } : d));
  }

  // Category counts for filter pills
  const counts: Partial<Record<DocumentCategory, number>> = {};
  for (const doc of docs) counts[doc.category] = (counts[doc.category] ?? 0) + 1;

  const visible = categoryFilter ? docs.filter((d) => d.category === categoryFilter) : docs;

  return (
    <div className="space-y-4">
      {/* Category filter */}
      {docs.length > 1 && (
        <CategoryFilter active={categoryFilter} counts={counts} onChange={setCategoryFilter} />
      )}

      {/* Document list */}
      {visible.length === 0 && !showUpload && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {categoryFilter ? `No ${categoryFilter} documents.` : "No documents uploaded yet."}
        </p>
      )}
      <div className="space-y-2">
        {visible.map((doc) => (
          <DocumentCard
            key={doc.id}
            doc={doc}
            entityType={entityType}
            entityId={entityId}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
          />
        ))}
      </div>

      {/* Upload form */}
      {showUpload && (
        <div className="rounded-xl border border-ring bg-card p-4 space-y-4">
          <p className="text-sm font-medium text-heading">Upload Document</p>

          {/* File picker */}
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
                <Input value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder={file.name} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Select value={uploadCategory} onValueChange={(v) => setUploadCategory(v as DocumentCategory)} items={DOCUMENT_CATEGORIES}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DOCUMENT_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {categoryHasExpiry(uploadCategory) && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Expiration date</Label>
                  <Input type="date" value={uploadExpiry} onChange={(e) => setUploadExpiry(e.target.value)} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">Tags <span className="font-normal text-muted-foreground">(comma-separated)</span></Label>
                <Input value={uploadTags} onChange={(e) => setUploadTags(e.target.value)} placeholder="2027 season, vendor…" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Notes</Label>
                <Input value={uploadNotes} onChange={(e) => setUploadNotes(e.target.value)} placeholder="Any notes about this document…" />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={resetForm} disabled={uploading}>Cancel</Button>
            <Button type="button" size="sm" disabled={!file || uploading} onClick={handleUpload}>
              {uploading
                ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Uploading…</>
                : <><Upload className="mr-1 h-3.5 w-3.5" />Upload</>}
            </Button>
          </div>
        </div>
      )}

      {!showUpload && (
        <Button type="button" variant="outline" size="sm" onClick={() => setShowUpload(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Upload Document
        </Button>
      )}
    </div>
  );
}
