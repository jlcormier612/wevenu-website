"use client";

/**
 * Attach an existing Library Document to the message being composed.
 *
 * Every Library Document is listed, including ones that cannot go out on the
 * channel currently selected — those are disabled and carry the reason. Hiding
 * them would be worse than useless: a coordinator looking for the rain plan
 * they know they uploaded would conclude the file was lost, rather than learn
 * that a 12 MB PDF cannot be a text message.
 */
import * as React from "react";
import { FileText, Loader2, Search } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  describeLibraryDocument,
  evaluateLibraryAttachmentWithSelection,
  type LibraryAttachmentCandidate,
} from "@/lib/conversations/library-attachment";
import type { AttachmentChannel } from "@/lib/conversations/attachment-constraints";
import { cn } from "@/lib/utils";

export function LibraryDocumentPicker({
  open,
  onOpenChange,
  channel,
  alreadyAttachedBytes,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The channel the message will go out on — drives every compatibility rule. */
  channel: AttachmentChannel;
  /** Bytes already staged on this message, so the text/MMS total is honest. */
  alreadyAttachedBytes: number;
  onSelect: (doc: LibraryAttachmentCandidate) => void;
}) {
  const [documents, setDocuments] = React.useState<LibraryAttachmentCandidate[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");

  // Fetched on open rather than with the thread: a venue with a large Library
  // should not pay for it every time someone reads a conversation.
  React.useEffect(() => {
    if (!open || documents !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/conversations/attach-document");
        const data = await res.json() as { ok?: boolean; documents?: LibraryAttachmentCandidate[]; error?: string };
        if (cancelled) return;
        if (!res.ok || !data.ok || !data.documents) {
          setLoadError(data.error ?? "Could not load Library documents.");
          return;
        }
        setDocuments(data.documents);
      } catch {
        if (!cancelled) setLoadError("Could not load Library documents.");
      }
    })();
    return () => { cancelled = true; };
  }, [open, documents]);

  const filtered = React.useMemo(() => {
    if (!documents) return [];
    const q = query.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter(
      (d) => d.name.toLowerCase().includes(q) || d.fileName.toLowerCase().includes(q),
    );
  }, [documents, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b px-5 pt-5 pb-4">
          <DialogTitle>Attach from Library</DialogTitle>
          <DialogDescription>
            Files your venue reuses across bookings. Attaching one sends a copy — the
            Library keeps the original.
          </DialogDescription>
        </DialogHeader>

        <div className="border-b px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Library documents by name…"
              className="pl-8"
              aria-label="Search Library documents by name"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {loadError ? (
            <p className="py-6 text-center text-sm text-destructive">{loadError}</p>
          ) : documents === null ? (
            <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading your Library…
            </p>
          ) : documents.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              You haven&rsquo;t added any Library documents yet. Add them under Library
              &rarr; Documents and they&rsquo;ll show up here.
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No Library documents match &ldquo;{query}&rdquo;.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {filtered.map((doc) => {
                const check = evaluateLibraryAttachmentWithSelection(
                  channel,
                  doc,
                  alreadyAttachedBytes,
                );
                return (
                  <li key={doc.id}>
                    <button
                      type="button"
                      disabled={!check.attachable}
                      onClick={() => {
                        onSelect(doc);
                        onOpenChange(false);
                      }}
                      aria-describedby={check.attachable ? undefined : `lib-doc-why-${doc.id}`}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-sm border p-3 text-left transition-colors",
                        check.attachable
                          ? "border-border bg-card hover:bg-muted/40"
                          : "cursor-not-allowed border-border/60 bg-muted/20",
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted",
                          check.attachable ? "text-muted-foreground" : "text-muted-foreground/60",
                        )}
                      >
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p
                          className={cn(
                            "truncate text-sm font-medium",
                            check.attachable ? "text-heading" : "text-muted-foreground",
                          )}
                        >
                          {doc.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {describeLibraryDocument(doc)}
                        </p>
                        {!check.attachable && (
                          <p
                            id={`lib-doc-why-${doc.id}`}
                            className="pt-0.5 text-xs leading-snug text-destructive"
                          >
                            {check.reason}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="border-t px-5 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
