"use client";

/**
 * DocumentPreviewModal — an in-page lightbox for viewing an image document
 * without navigating away. The plain "Open in a new tab" link was opening
 * the raw storage URL, which is a different origin from the app (Supabase
 * Storage) — showing the same image inline via an <img> tag sidesteps that
 * entirely, since the browser is just rendering it into the page, not
 * navigating to the asset's URL.
 *
 * The download action here fetches the file as a blob rather than using a
 * plain `<a download>` — that attribute is silently ignored by browsers
 * for cross-origin URLs, which is exactly what made "Download" behave
 * identically to "view" before this fix (see lib/download-file.ts).
 *
 * Images only for now — PDFs/Word/Excel keep the existing "open in a new
 * tab" behavior, since browsers don't reliably preview those inline the
 * same way.
 */
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Download, X } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { downloadFile } from "@/lib/download-file";

export function DocumentPreviewModal({
  open,
  onOpenChange,
  name,
  fileName,
  storageUrl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  fileName: string;
  storageUrl: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/70 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0",
          )}
        />
        <DialogPrimitive.Popup
          className={cn(
            "fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 p-6 transition duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0",
          )}
        >
          <div className="flex w-full max-w-3xl items-center justify-between gap-4 text-white">
            <DialogPrimitive.Title className="truncate text-sm font-medium">{name}</DialogPrimitive.Title>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => void downloadFile(storageUrl, fileName).catch(() => toast.error("Could not download this file."))}
                className="rounded p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
                aria-label="Download"
                title="Download"
              >
                <Download className="h-4 w-4" />
              </button>
              <DialogPrimitive.Close
                className="rounded p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={storageUrl}
            alt={name}
            className="max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl"
          />
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
