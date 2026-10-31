"use client";

import * as React from "react";

import { Download, ExternalLink, Info, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";

import { WorkspaceStatusBadge } from "@/components/document-workspace/badges";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { downloadFile } from "@/lib/download-file";
import { recordDocumentInteractionAction } from "@/lib/document-workspace/actions";
import type { WorkspaceDocument } from "@/lib/document-workspace/types";
import type { DocumentViewSource } from "@/lib/document-workspace/viewer";

/** Opens the readable document itself, with Print and Download on every type. */
export function DocumentViewerDialog({
  doc,
  source,
  open,
  onOpenChange,
  onOpenDetails,
}: {
  doc: WorkspaceDocument | null;
  source: DocumentViewSource | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenDetails: (doc: WorkspaceDocument) => void;
}) {
  const frameRef = React.useRef<HTMLIFrameElement>(null);
  const [loadedSrc, setLoadedSrc] = React.useState<string | null>(null);
  const [downloading, setDownloading] = React.useState(false);
  const loaded = !!source && loadedSrc === source.src;
  // PDFs and files may never fire load (no built-in PDF viewer, downloads), so
  // only print pages wait for it.
  const waitsForLoad = source?.kind === "page";

  if (!doc || !source) return null;
  const framed = source.kind !== "file" || source.previewable;

  function handleFrameLoad() {
    if (!source) return;
    setLoadedSrc(source.src);
    if (source.kind !== "page") return;
    try {
      const frameDoc = frameRef.current?.contentDocument;
      if (!frameDoc?.head) return;
      const style = frameDoc.createElement("style");
      style.textContent = ".no-print, .print\\:hidden { display: none !important; }";
      frameDoc.head.appendChild(style);
    } catch { /* the page keeps its own toolbar */ }
  }

  function printDocument() {
    if (!source) return;
    if (source.kind !== "file") {
      try {
        const win = frameRef.current?.contentWindow;
        if (win) {
          win.focus();
          win.print();
          return;
        }
      } catch { /* fall through to a tab the browser can print */ }
    }
    window.open(source.src, "_blank", "noopener,noreferrer");
  }

  async function download() {
    if (!doc || !source) return;
    if (source.kind === "page") {
      printDocument();
      return;
    }
    setDownloading(true);
    try {
      if (source.kind === "pdf") await downloadFile(source.downloadSrc, `${doc.name}.pdf`);
      else await downloadFile(source.src, doc.name);
      void recordDocumentInteractionAction(doc.docType, doc.id, "downloaded");
    } catch {
      toast.error("Could not download this document.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="document-viewer"
        className="h-[94vh] max-h-[94vh] w-[calc(100%-1.5rem)] gap-0 overflow-hidden p-0 sm:max-w-[min(72rem,calc(100%-3rem))]"
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3 pr-12">
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-base">{doc.name}</DialogTitle>
            <DialogDescription className="sr-only">Document preview</DialogDescription>
          </div>
          <WorkspaceStatusBadge status={doc.status} experienceStatus={doc.experienceStatus} docType={doc.docType} />
          <div className="flex flex-wrap items-center gap-1.5">
            <Button size="sm" variant="outline" onClick={printDocument} disabled={waitsForLoad && !loaded} data-testid="document-viewer-print">
              <Printer className="mr-1 h-3.5 w-3.5" />Print
            </Button>
            <Button size="sm" variant="outline" onClick={download} disabled={downloading || (waitsForLoad && !loaded)} data-testid="document-viewer-download">
              {downloading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
              {source.kind === "file" ? "Download" : source.kind === "page" ? "Save as PDF" : "Download PDF"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onOpenDetails(doc)} data-testid="document-viewer-details">
              <Info className="mr-1 h-3.5 w-3.5" />Details
            </Button>
            {doc.producerHref && (
              <Button size="sm" variant="ghost" render={<a href={doc.producerHref} />} data-testid="document-viewer-open-record">
                <ExternalLink className="mr-1 h-3.5 w-3.5" />Open record
              </Button>
            )}
          </div>
        </div>

        <div className="relative min-h-0 flex-1 bg-muted/40">
          {framed ? (
            <>
              {waitsForLoad && !loaded && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading document…
                </div>
              )}
              <iframe
                ref={frameRef}
                key={source.src}
                src={source.src}
                title={doc.name}
                onLoad={handleFrameLoad}
                className="h-full w-full border-0 bg-white"
                data-testid="document-viewer-frame"
              />
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-muted-foreground">This file type can&apos;t be shown here. Download it to open it on your computer.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
