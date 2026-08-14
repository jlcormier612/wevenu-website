"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import {
  createVendorLibraryDocumentAction,
  deleteVendorLibraryDocumentAction,
} from "@/app/vendor/documents/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DOCUMENT_CATEGORIES, categoryHasExpiry, formatBytes } from "@/lib/documents/constants";
import type { DocumentCategory } from "@/lib/documents/types";
import type { VendorLibraryDocument } from "@/lib/vendor-documents/types";
import { uploadVendorFile } from "@/lib/vendor-documents/upload-client";

const LIBRARY_CATEGORIES = DOCUMENT_CATEGORIES.filter((c) =>
  ["insurance", "contract", "invoice_copy", "menu", "other"].includes(c.value),
);

export function VendorLibrarySection({
  initialDocuments,
}: {
  initialDocuments: VendorLibraryDocument[];
}) {
  const router = useRouter();
  const [docs, setDocs] = React.useState(initialDocuments);
  const [showUpload, setShowUpload] = React.useState(false);
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState<DocumentCategory>("insurance");
  const [expiresAt, setExpiresAt] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => { setDocs(initialDocuments); }, [initialDocuments]);

  function resetForm() {
    setShowUpload(false);
    setName("");
    setCategory("insurance");
    setExpiresAt("");
    setFile(null);
  }

  function handleUpload() {
    if (!file) { toast.error("Choose a file to upload."); return; }
    startTransition(async () => {
      try {
        const uploaded = await uploadVendorFile(file, "library");
        const result = await createVendorLibraryDocumentAction({
          name: name.trim() || file.name,
          fileName: uploaded.file_name ?? file.name,
          fileSize: uploaded.file_size ?? file.size,
          mimeType: uploaded.mime_type ?? file.type,
          storagePath: uploaded.storagePath!,
          storageUrl: uploaded.storageUrl!,
          category,
          expiresAt: expiresAt || null,
        });
        if (!result.ok) { toast.error(result.message ?? "Could not save."); return; }
        toast.success("Added to Document Library.");
        resetForm();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed.");
      }
    });
  }

  function handleDelete(doc: VendorLibraryDocument) {
    if (!confirm(`Remove "${doc.name}" from Document Library?`)) return;
    startTransition(async () => {
      const result = await deleteVendorLibraryDocumentAction(doc.id);
      if (result.ok) {
        setDocs((prev) => prev.filter((d) => d.id !== doc.id));
        toast.success("Removed from Document Library.");
        router.refresh();
      } else toast.error(result.message ?? "Could not delete.");
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Reusable files (COIs, W-9s, rate cards) you store here to then share with both venues and clients when needed.
        </p>
        <Button size="sm" variant="outline" className="shrink-0" onClick={() => setShowUpload((v) => !v)}>
          <Upload className="h-3.5 w-3.5 mr-1.5" />
          Upload
        </Button>
      </div>

      {showUpload && (
        <div className="rounded-sm border border-border bg-card p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Display name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="2026 COI" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as DocumentCategory)} items={LIBRARY_CATEGORIES}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LIBRARY_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {categoryHasExpiry(category) && (
              <div className="space-y-1.5">
                <Label className="text-xs">Expiration</Label>
                <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">File</Label>
              <Input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={resetForm} disabled={pending}>Cancel</Button>
            <Button type="button" size="sm" onClick={handleUpload} disabled={pending || !file}>
              {pending ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Uploading…</> : "Save to Document Library"}
            </Button>
          </div>
        </div>
      )}

      {docs.length === 0 ? (
        <div className="rounded-sm border border-dashed border-border py-10 text-center">
          <FileText className="h-7 w-7 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No documents yet.</p>
        </div>
      ) : (
        <div className="rounded-sm border border-border bg-card divide-y divide-border">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center gap-3 px-4 py-3">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <a href={d.storageUrl} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 hover:text-primary">
                <p className="text-sm font-medium text-foreground truncate">{d.name}</p>
                <p className="text-xs text-muted-foreground">
                  {d.fileName}{d.fileSize ? ` · ${formatBytes(d.fileSize)}` : ""}
                </p>
              </a>
              <Badge variant="outline" className="text-xs shrink-0">{d.category}</Badge>
              <button
                type="button"
                onClick={() => handleDelete(d)}
                disabled={pending}
                className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

