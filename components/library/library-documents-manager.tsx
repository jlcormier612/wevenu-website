"use client";

/**
 * Library → Documents. Venue-level reusable files: the insurance certificate,
 * the rain plan, the parking map — things that outlive any one booking, so
 * they carry no lead/client/event/vendor scope.
 *
 * Deleting is the interesting part. A file can still be needed by a message
 * template or a floor plan (refuse and say so), or by a message the venue
 * already sent (delete the row, keep the object). That decision belongs to the
 * server; this surface only reports it.
 */

import * as React from "react";

import { Download, Eye, FileText, Loader2, Lock, Pencil, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import {
  deleteLibraryDocumentAction,
  getLibraryDocumentDeletionInfoAction,
  renameLibraryDocumentAction,
  saveLibraryDocumentAction,
} from "@/app/(app)/library/documents/actions";
import { LibraryDeleteConfirmDialog } from "@/components/library/library-delete-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/integrations/supabase/client";
import { venueFileHref } from "@/lib/documents/access";
import type { Document } from "@/lib/documents/types";

const MAX_FILE_SIZE_MB = 25;
const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.svg,.txt,.csv";

type DeleteTarget =
  | { doc: Document; state: "checking" }
  | { doc: Document; state: "confirm"; retainStorage: boolean };

/**
 * A refusal is shown against the document it concerns and stays until
 * dismissed — a modal would make the venue dismiss the explanation to go read
 * what it referred to, and a toast would take it away before they had.
 */
type BlockedNotice = { documentId: string; reason: string };

export function LibraryDocumentsManager({
  documents,
  venueId,
}: {
  documents: Document[];
  venueId: string;
}) {
  const [query, setQuery] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [renaming, setRenaming] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [pendingRename, setPendingRename] = React.useState(false);
  const [target, setTarget] = React.useState<DeleteTarget | null>(null);
  const [blocked, setBlocked] = React.useState<BlockedNotice | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);
  const fileInput = React.useRef<HTMLInputElement>(null);

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter(
      (d) => d.name.toLowerCase().includes(q) || d.fileName.toLowerCase().includes(q),
    );
  }, [documents, query]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`File too large. Maximum ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    // {venue_id}/… is required, not cosmetic: the documents bucket policies
    // compare the first path segment to current_user_venue_id(), so a literal
    // prefix here makes upload and delete both fail with an RLS violation.
    // "library" takes the entity-type slot these paths carry, since a Library
    // file belongs to the venue rather than to one lead or event.
    const storagePath = `${venueId}/library/${crypto.randomUUID()}.${ext}`;
    try {
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(storagePath, file, { upsert: false, contentType: file.type });
      if (uploadError) throw new Error(uploadError.message);
      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(storagePath);

      const saved = await saveLibraryDocumentAction({
        name: file.name.replace(/\.[^.]+$/, ""),
        category: "other",
        notes: "",
        tags: "",
        expiresAt: "",
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        storagePath,
        storageUrl: urlData.publicUrl,
      });
      if (!saved.ok) {
        // Don't leave an orphan object behind when the row didn't land.
        await supabase.storage.from("documents").remove([storagePath]);
        toast.error(saved.message ?? "Could not save that document.");
        return;
      }
      toast.success("Document added.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function submitRename(doc: Document) {
    const next = renameValue.trim();
    if (!next || next === doc.name) { setRenaming(null); return; }
    setPendingRename(true);
    const result = await renameLibraryDocumentAction(doc.id, next);
    setPendingRename(false);
    if (result.ok) {
      setRenaming(null);
      toast.success("Renamed.");
    } else {
      toast.error(result.errors?.name ?? result.message ?? "Could not rename.");
    }
  }

  async function beginDelete(doc: Document) {
    setBlocked(null);
    setTarget({ doc, state: "checking" });
    const info = await getLibraryDocumentDeletionInfoAction(doc.id);
    if (!info.ok) {
      setTarget(null);
      toast.error(info.message);
      return;
    }
    if (info.blocked) {
      setTarget(null);
      setBlocked({ documentId: doc.id, reason: `${info.reason} Detach it there first, then delete it here.` });
      return;
    }
    setTarget({ doc, state: "confirm", retainStorage: info.retainStorage });
  }

  async function confirmDelete() {
    if (!target) return;
    setDeletePending(true);
    const result = await deleteLibraryDocumentAction(target.doc.id);
    setDeletePending(false);
    setTarget(null);
    if (result.ok) {
      toast.success("Document deleted.");
    } else {
      // The server re-checks, so a reference added since the dialog opened
      // surfaces here rather than destroying the file.
      setBlocked({ documentId: target.doc.id, reason: result.message ?? "This document is still in use." });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents by name…"
            className="pl-9"
            aria-label="Search documents by name"
          />
        </div>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={handleUpload}
        />
        <Button type="button" disabled={uploading} onClick={() => fileInput.current?.click()}>
          {uploading
            ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Uploading…</>
            : <><Upload className="mr-1.5 h-4 w-4" />Add document</>}
        </Button>
      </div>

      {documents.length === 0 ? (
        <EmptyState
          title="No documents yet"
          body="Add the files you reuse across bookings — insurance certificates, parking maps, rain plans, vendor rules. They stay available to your whole venue and can be attached to templates and conversations."
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="No matches"
          body={`Nothing in your Library matches “${query.trim()}”.`}
        />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {visible.map((doc) => (
            <li key={doc.id} className="p-3 sm:p-4">
              <div className="flex flex-wrap items-center gap-3">
              <FileText className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                {renaming === doc.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      value={renameValue}
                      autoFocus
                      disabled={pendingRename}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void submitRename(doc);
                        if (e.key === "Escape") setRenaming(null);
                      }}
                      className="max-w-xs"
                      aria-label={`Rename ${doc.name}`}
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={pendingRename}
                      onClick={() => void submitRename(doc)}
                    >
                      {pendingRename ? "Saving…" : "Save"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pendingRename}
                      onClick={() => setRenaming(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="truncate font-medium text-heading">{doc.name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {doc.fileName}
                      {doc.fileSize ? ` · ${formatSize(doc.fileSize)}` : ""}
                    </p>
                  </>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {/*
                  The documents bucket is private, so the stored public URL is
                  dead. This route checks the caller's venue and redirects to a
                  short-lived signed URL.
                */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  render={<a href={venueFileHref(doc.id)} target="_blank" rel="noreferrer" />}
                >
                  <Eye className="mr-1.5 h-4 w-4" />Preview
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`More actions for ${doc.name}`}
                      />
                    }
                  >
                    ⋯
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      render={<a href={venueFileHref(doc.id)} download={doc.fileName} />}
                    >
                      <Download className="mr-2 h-4 w-4" />Download
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => { setRenaming(doc.id); setRenameValue(doc.name); }}
                    >
                      <Pencil className="mr-2 h-4 w-4" />Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => void beginDelete(doc)}>
                      <Trash2 className="mr-2 h-4 w-4" />Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              </div>

              {target?.state === "checking" && target.doc.id === doc.id && (
                <p className="mt-2 text-sm text-muted-foreground" role="status">
                  Checking what uses this document…
                </p>
              )}

              {blocked?.documentId === doc.id && (
                <div
                  role="alert"
                  className="mt-2 flex flex-wrap items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm"
                >
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <p className="min-w-0 flex-1 text-muted-foreground">
                    <span className="font-medium text-heading">Can&rsquo;t delete this yet. </span>
                    {blocked.reason}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setBlocked(null)}
                  >
                    Dismiss
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <LibraryDeleteConfirmDialog
        open={target?.state === "confirm"}
        itemName={target?.doc.name ?? ""}
        itemLabel="document"
        consequenceNote={
          target?.state === "confirm" && target.retainStorage
            ? "Messages you already sent keep their copy of this file — they will still open."
            : undefined
        }
        pending={deletePending}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setTarget(null)}
      />
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
      <FileText className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
      <p className="mt-3 font-medium text-heading">{title}</p>
      <p className="mx-auto mt-1 max-w-prose text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
