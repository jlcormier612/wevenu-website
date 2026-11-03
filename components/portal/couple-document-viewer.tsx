"use client";

import * as React from "react";
import { Download, ExternalLink, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { downloadFile } from "@/lib/download-file";
import {
  coupleDocumentDownloadName,
  coupleDocumentIsPreviewable,
  type CoupleDocumentViewTarget,
} from "@/lib/portal/couple-document-viewer";

/** Inline open + Print + Download for couple portal documents (files, contracts, invoices). */
export function CoupleDocumentViewerDialog({
  doc,
  open,
  onOpenChange,
}: {
  doc: CoupleDocumentViewTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const frameRef = React.useRef<HTMLIFrameElement>(null);
  const [loadedSrc, setLoadedSrc] = React.useState<string | null>(null);
  const [downloading, setDownloading] = React.useState(false);

  if (!doc) return null;

  const frameSrc = doc.kind === "file" ? doc.fileUrl : doc.src;
  const previewable =
    doc.kind === "page"
    || doc.kind === "pdf"
    || (doc.kind === "file" && coupleDocumentIsPreviewable(doc.mimeType, doc.fileUrl));
  const waitsForLoad = doc.kind === "page";
  const loaded = loadedSrc === frameSrc;
  const downloadLabel =
    doc.kind === "page" ? "Save as PDF"
    : doc.kind === "pdf" ? "Download PDF"
    : "Download";

  function handleFrameLoad() {
    if (!doc) return;
    setLoadedSrc(frameSrc);
    if (doc.kind !== "page") return;
    try {
      const frameDoc = frameRef.current?.contentDocument;
      if (!frameDoc?.head) return;
      const style = frameDoc.createElement("style");
      style.textContent = ".no-print, .print\\:hidden { display: none !important; }";
      frameDoc.head.appendChild(style);
    } catch { /* print page keeps its own toolbar */ }
  }

  function printDocument() {
    if (!doc) return;
    if (doc.kind === "page") {
      try {
        const win = frameRef.current?.contentWindow;
        if (win) {
          win.focus();
          win.print();
          return;
        }
      } catch { /* fall through */ }
    }
    window.open(frameSrc, "_blank", "noopener,noreferrer");
  }

  async function download() {
    if (!doc) return;
    if (doc.kind === "page") {
      printDocument();
      return;
    }
    setDownloading(true);
    try {
      if (doc.kind === "pdf") {
        await downloadFile(doc.downloadSrc, coupleDocumentDownloadName({
          name: doc.name,
          mimeType: "application/pdf",
        }));
      } else {
        await downloadFile(doc.fileUrl, coupleDocumentDownloadName({
          name: doc.name,
          mimeType: doc.mimeType,
          fileUrl: doc.fileUrl,
        }));
      }
    } catch {
      toast.error("Could not download this document.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="portal-document-viewer"
        className="flex h-[94vh] max-h-[94vh] w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(72rem,calc(100%-3rem))]"
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3 pr-12">
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-base">{doc.name}</DialogTitle>
            <DialogDescription className="sr-only">Document preview</DialogDescription>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={printDocument}
              disabled={waitsForLoad && !loaded}
              data-testid="portal-document-viewer-print"
            >
              <Printer className="mr-1 h-3.5 w-3.5" />
              Print
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={download}
              disabled={downloading || (waitsForLoad && !loaded)}
              data-testid="portal-document-viewer-download"
            >
              {downloading
                ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                : <Download className="mr-1 h-3.5 w-3.5" />}
              {downloadLabel}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              render={<a href={frameSrc} target="_blank" rel="noopener noreferrer" />}
              data-testid="portal-document-viewer-new-tab"
            >
              <ExternalLink className="mr-1 h-3.5 w-3.5" />
              New tab
            </Button>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 bg-muted/40">
          {previewable ? (
            <>
              {waitsForLoad && !loaded && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading document…
                </div>
              )}
              <iframe
                ref={frameRef}
                key={frameSrc}
                src={frameSrc}
                title={doc.name}
                onLoad={handleFrameLoad}
                className="h-full w-full border-0 bg-white"
                data-testid="portal-document-viewer-frame"
              />
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                This file type can&apos;t be shown here. Download it to open it on your computer.
              </p>
              <Button size="sm" variant="outline" onClick={download} disabled={downloading}>
                {downloading
                  ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  : <Download className="mr-1 h-3.5 w-3.5" />}
                Download
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
