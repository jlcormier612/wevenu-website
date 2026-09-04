/**
 * Client-side floor-plan source upload (Phase 2).
 *
 * 1. Stores the original file in the documents bucket as a business Document.
 * 2. For images, the Document URL is also the editor background.
 * 3. For PDFs, rasterizes page 1 and uploads a PNG derivative to the
 *    floor-plans bucket only — never as a second Document.
 */

import { createClient } from "@/integrations/supabase/client";
import {
  isFloorPlanSourceMime,
  isPdfMime,
} from "@/lib/floor-plans/background-document";

const MAX_BYTES = 25 * 1024 * 1024;

export type FloorPlanSourceUploadResult = {
  fileName: string;
  fileSize: number;
  mimeType: string;
  /** Original file in the documents bucket (Document SoR). */
  storagePath: string;
  storageUrl: string;
  /** Renderable image URL for the canvas (same as storageUrl for images). */
  renderableImageUrl: string;
  displayName: string;
};

export async function prepareFloorPlanSourceUpload(opts: {
  venueId: string;
  planId: string;
  file: File;
}): Promise<FloorPlanSourceUploadResult> {
  const { venueId, planId, file } = opts;
  if (file.size > MAX_BYTES) {
    throw new Error("File too large. Maximum 25 MB.");
  }
  const mimeType = file.type || guessMime(file.name);
  if (!isFloorPlanSourceMime(mimeType)) {
    throw new Error("Use a PDF or image (PNG, JPG, WebP, GIF, SVG).");
  }

  const supabase = createClient();
  const docId = crypto.randomUUID();
  const ext = file.name.split(".").pop()?.toLowerCase() || (isPdfMime(mimeType) ? "pdf" : "bin");
  const storagePath = `${venueId}/floor_plan/${planId}/${docId}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, file, { upsert: false, contentType: mimeType });
  if (uploadError) throw new Error(uploadError.message);

  const { data: urlData } = supabase.storage.from("documents").getPublicUrl(storagePath);
  const storageUrl = urlData.publicUrl;
  const displayName = file.name.replace(/\.[^.]+$/, "") || "Floor plan";

  let renderableImageUrl = storageUrl;
  if (isPdfMime(mimeType)) {
    try {
      const pngBlob = await rasterizePdfPage1(file);
      const previewPath = `${venueId}/${planId}/background-preview.png`;
      const { error: previewError } = await supabase.storage
        .from("floor-plans")
        .upload(previewPath, pngBlob, { upsert: true, contentType: "image/png" });
      if (previewError) throw new Error(previewError.message);
      const { data: previewUrl } = supabase.storage.from("floor-plans").getPublicUrl(previewPath);
      renderableImageUrl = previewUrl.publicUrl;
    } catch (err) {
      // Keep the Document; roll back only the original upload if we cannot
      // produce an editor background (PDF without a usable page-1 image).
      await supabase.storage.from("documents").remove([storagePath]);
      const message = err instanceof Error ? err.message : "Could not read this PDF.";
      throw new Error(`${message} Try a PNG or JPG of the floor plan instead.`);
    }
  }

  return {
    fileName: file.name,
    fileSize: file.size,
    mimeType,
    storagePath,
    storageUrl,
    renderableImageUrl,
    displayName,
  };
}

function guessMime(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "svg") return "image/svg+xml";
  return "";
}

/**
 * Page-1 raster for the editor. Worker is vendored at /pdf.worker.min.mjs
 * (copied from pdfjs-dist) so we do not depend on a CDN at upload time.
 */
async function rasterizePdfPage1(file: File): Promise<Blob> {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare the floor plan preview.");
  await page.render({ canvasContext: ctx, viewport }).promise;
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not prepare the floor plan preview.");
  return blob;
}
