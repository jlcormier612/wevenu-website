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

/** Inline open + Print + Download for couple portal file-backed documents. */
export function CoupleDocumentViewerDialog({
  doc,
  open,
  onOpenChange,
}: {
  doc: CoupleDocumentViewTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [downloading, setDownloading] = React.useState(false);

  if (!doc) return null;
  const previewable = coupleDocumentIsPreviewable(doc.mimeType, doc.fileUrl);

  function printDocument() {
    if (!doc) return;
    // Cross-origin storage / redirect URLs usually block iframe.print();
    // open a tab the browser can print (same approach as venue file viewer).
    window.open(doc.fileUrl, "_blank", "noopener,noreferrer");
  }

  async function download() {
    if (!doc) return;
    setDownloading(true);
    try {
      await downloadFile(doc.fileUrl, coupleDocumentDownloadName(doc));
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
              data-testid="portal-document-viewer-print"
            >
              <Printer className="mr-1 h-3.5 w-3.5" />
              Print
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={download}
              disabled={downloading}
              data-testid="portal-document-viewer-download"
            >
              {downloading
                ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                : <Download className="mr-1 h-3.5 w-3.5" />}
              Download
            </Button>
            <Button
              size="sm"
              variant="ghost"
              render={<a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" />}
              data-testid="portal-document-viewer-new-tab"
            >
              <ExternalLink className="mr-1 h-3.5 w-3.5" />
              New tab
            </Button>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 bg-muted/40">
          {previewable ? (
            <iframe
              key={doc.fileUrl}
              src={doc.fileUrl}
              title={doc.name}
              className="h-full w-full border-0 bg-white"
              data-testid="portal-document-viewer-frame"
            />
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
