"use client";

import * as React from "react";

import { AlertTriangle, Clock, Download, ExternalLink, FileText, Loader2, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { deleteDocumentAction, updateDocumentAction } from "@/app/(app)/documents/actions";
import { DocumentCategoryBadge } from "@/components/documents/document-category-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  categoryHasExpiry,
  expiryStatus,
  formatBytes,
  isImageMimeType,
} from "@/lib/documents/constants";
import { DOCUMENT_CATEGORIES } from "@/lib/documents/constants";
import type { Document, DocumentCategory, DocumentEntityType } from "@/lib/documents/types";

function ExpiryBadge({ expiresAt }: { expiresAt: string | null }) {
  const status = expiryStatus(expiresAt);
  if (!status || !expiresAt) return null;
  const date = new Date(expiresAt + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (status === "expired") return (
    <span className="flex items-center gap-1 text-xs text-destructive font-medium">
      <AlertTriangle className="h-3 w-3" /> Expired {date}
    </span>
  );
  if (status === "soon") return (
    <span className="flex items-center gap-1 text-xs text-warning-foreground font-medium">
      <Clock className="h-3 w-3" /> Expires {date}
    </span>
  );
  return <span className="text-xs text-muted-foreground">Expires {date}</span>;
}

export function DocumentCard({
  doc,
  entityType,
  entityId,
  onDelete,
  onUpdate,
}: {
  doc: Document;
  entityType: DocumentEntityType;
  entityId: string;
  onDelete: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Document>) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(doc.name);
  const [notes, setNotes] = React.useState(doc.notes ?? "");
  const [tags, setTags] = React.useState(doc.tags.join(", "));
  const [category, setCategory] = React.useState<DocumentCategory>(doc.category);
  const [expiresAt, setExpiresAt] = React.useState(doc.expiresAt ?? "");
  const [savePending, startSave] = React.useTransition();
  const [deletePending, startDelete] = React.useTransition();

  const isImage = isImageMimeType(doc.mimeType);

  function handleSave() {
    startSave(async () => {
      const result = await updateDocumentAction(doc.id, entityType, entityId, {
        name, notes, category,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        expiresAt: expiresAt || null,
      });
      if (result.ok) {
        onUpdate(doc.id, { name, notes: notes || null, category, tags: tags.split(",").map((t) => t.trim()).filter(Boolean), expiresAt: expiresAt || null });
        setEditing(false);
      } else toast.error(result.message ?? "Could not save changes.");
    });
  }

  function handleDelete() {
    if (!confirm(`Delete "${doc.name}"? This cannot be undone.`)) return;
    startDelete(async () => {
      const result = await deleteDocumentAction(doc.id, entityType, entityId);
      if (result.ok) onDelete(doc.id);
      else toast.error(result.message ?? "Could not delete document.");
    });
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-ring bg-card p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Document name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as DocumentCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DOCUMENT_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {categoryHasExpiry(category) && (
            <div className="space-y-1.5">
              <Label className="text-xs">Expiration date</Label>
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Tags <span className="font-normal text-muted-foreground">(comma-separated)</span></Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="2027 season, primary vendor…" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Notes</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes about this document…" />
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={savePending}><X className="mr-1 h-3.5 w-3.5" />Cancel</Button>
          <Button type="button" size="sm" onClick={handleSave} disabled={savePending}>
            {savePending ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Saving…</> : "Save"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex gap-4 rounded-xl border border-border bg-card p-4 hover:bg-muted/20 transition-colors">
      {/* Thumbnail / icon */}
      <div className="shrink-0 flex h-12 w-12 items-center justify-center rounded-lg bg-muted overflow-hidden">
        {isImage ? (
          <img src={doc.storageUrl} alt={doc.name} className="h-full w-full object-cover" />
        ) : (
          <FileText className="h-5 w-5 text-muted-foreground" />
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-heading truncate">{doc.name}</p>
          <DocumentCategoryBadge category={doc.category} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span>{doc.fileName}</span>
          {doc.fileSize && <span>{formatBytes(doc.fileSize)}</span>}
          <ExpiryBadge expiresAt={doc.expiresAt} />
        </div>
        {doc.notes && <p className="text-xs text-muted-foreground">{doc.notes}</p>}
        {doc.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {doc.tags.map((tag) => (
              <span key={tag} className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <a href={doc.storageUrl} target="_blank" rel="noopener noreferrer"
          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Open">
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <a href={doc.storageUrl} download={doc.fileName}
          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Download">
          <Download className="h-3.5 w-3.5" />
        </a>
        <button type="button" onClick={() => setEditing(true)}
          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Edit">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={handleDelete} disabled={deletePending}
          className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Delete">
          {deletePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}
