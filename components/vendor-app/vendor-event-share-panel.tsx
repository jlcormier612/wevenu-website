"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Plus, Upload } from "lucide-react";
import { toast } from "sonner";

import { shareVendorDocumentToEventAction } from "@/app/vendor/documents/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DOCUMENT_CATEGORIES, categoryHasExpiry } from "@/lib/documents/constants";
import type { DocumentCategory } from "@/lib/documents/types";
import type { VendorEventUpload, VendorLibraryDocument } from "@/lib/vendor-documents/types";
import { uploadVendorFile } from "@/lib/vendor-documents/upload-client";

const SHARE_CATEGORIES = DOCUMENT_CATEGORIES.filter((c) =>
  ["insurance", "contract", "invoice_copy", "menu", "other"].includes(c.value),
);

export function VendorEventSharePanel({
  assignmentId,
  eventId,
  library,
  uploads,
}: {
  assignmentId: string;
  eventId: string;
  library: VendorLibraryDocument[];
  uploads: VendorEventUpload[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"library" | "upload">("library");
  const [libraryId, setLibraryId] = React.useState(library[0]?.id ?? "");
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState<DocumentCategory>("insurance");
  const [expiresAt, setExpiresAt] = React.useState("");
  const [shareWithCouple, setShareWithCouple] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [pending, startTransition] = React.useTransition();

  function handleShare() {
    startTransition(async () => {
      try {
        if (mode === "library") {
          if (!libraryId) { toast.error("Pick a library document."); return; }
          const result = await shareVendorDocumentToEventAction({
            assignmentId,
            libraryDocumentId: libraryId,
            shareWithCouple,
          });
          if (!result.ok) { toast.error(result.message ?? "Could not share."); return; }
        } else {
          if (!file) { toast.error("Choose a file."); return; }
          const uploaded = await uploadVendorFile(file, "event", eventId);
          const result = await shareVendorDocumentToEventAction({
            assignmentId,
            name: name.trim() || file.name,
            fileName: uploaded.file_name ?? file.name,
            fileSize: uploaded.file_size ?? file.size,
            mimeType: uploaded.mime_type ?? file.type,
            storagePath: uploaded.storagePath!,
            storageUrl: uploaded.storageUrl!,
            category,
            expiresAt: expiresAt || null,
            shareWithCouple,
          });
          if (!result.ok) { toast.error(result.message ?? "Could not share."); return; }
        }
        toast.success("Shared with the venue.");
        setOpen(false);
        setFile(null);
        setName("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not share.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Shared with venue</h3>
          <p className="text-xs text-muted-foreground">COIs and other files you&apos;ve attached to this event.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Share
        </Button>
      </div>

      {open && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={mode === "library" ? "default" : "outline"} onClick={() => setMode("library")}>
              From library
            </Button>
            <Button type="button" size="sm" variant={mode === "upload" ? "default" : "outline"} onClick={() => setMode("upload")}>
              <Upload className="h-3.5 w-3.5 mr-1" />
              One-off upload
            </Button>
          </div>

          {mode === "library" ? (
            library.length === 0 ? (
              <p className="text-xs text-muted-foreground">Upload a library document first from Documents.</p>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs">Library document</Label>
                <Select value={libraryId} onValueChange={setLibraryId} items={library.map((d) => ({ value: d.id, label: d.name }))}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {library.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name} · {d.category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Display name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Event COI" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as DocumentCategory)} items={SHARE_CATEGORIES}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SHARE_CATEGORIES.map((c) => (
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
                <Input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={shareWithCouple}
              onChange={(e) => setShareWithCouple(e.target.checked)}
              className="rounded border-border"
            />
            Also share with the couple
          </label>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button
              type="button"
              size="sm"
              onClick={handleShare}
              disabled={pending || (mode === "library" ? !libraryId : !file)}
            >
              {pending ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Sharing…</> : "Share with venue"}
            </Button>
          </div>
        </div>
      )}

      {uploads.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing shared with the venue on this event yet.</p>
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {uploads.map((d) => (
            <a
              key={d.id}
              href={d.storageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
            >
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{d.name}</p>
                {d.notes && <p className="text-xs text-muted-foreground">{d.notes}</p>}
              </div>
              <Badge variant="outline" className="text-xs shrink-0">{d.category}</Badge>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
