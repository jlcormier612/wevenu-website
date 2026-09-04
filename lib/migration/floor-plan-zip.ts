/**
 * Client-side ZIP expansion for Migration Center floor-plan batch upload.
 * Uses fflate — no server-side unzip pipeline.
 */
import { unzipSync } from "fflate";

import { isFloorPlanImportFileName } from "@/lib/migration/floor-plan-import";

export type ExpandedFloorPlanFile = {
  fileName: string;
  /** Path inside the ZIP (for display / sourceRowRef). */
  zipPath: string;
  blob: Blob;
};

function guessMime(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "svg") return "image/svg+xml";
  return "application/octet-stream";
}

export async function expandFloorPlanZip(file: File): Promise<{
  files: ExpandedFloorPlanFile[];
  skippedNonFloorPlan: number;
}> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(buf);
  } catch {
    throw new Error("Could not read that ZIP. Try uploading the floor plan files directly.");
  }

  const out: ExpandedFloorPlanFile[] = [];
  let skippedNonFloorPlan = 0;
  for (const [path, data] of Object.entries(entries)) {
    if (path.endsWith("/") || path.split("/").some((p) => p.startsWith("."))) continue;
    const fileName = path.split("/").pop() ?? path;
    if (!isFloorPlanImportFileName(fileName)) {
      skippedNonFloorPlan++;
      continue;
    }
    out.push({
      fileName,
      zipPath: path,
      blob: new Blob([data as BlobPart], { type: guessMime(fileName) }),
    });
  }
  if (out.length === 0) {
    throw new Error("No PDF or image floor plans found in that ZIP.");
  }
  return { files: out, skippedNonFloorPlan };
}

export async function collectFloorPlanUploadFiles(files: FileList | File[]): Promise<{
  files: { fileName: string; sourceRef: string; file: File }[];
  skippedNonFloorPlan: number;
}> {
  const list = Array.from(files);
  const out: { fileName: string; sourceRef: string; file: File }[] = [];
  let skippedNonFloorPlan = 0;

  for (const file of list) {
    const isZip =
      file.type === "application/zip"
      || file.type === "application/x-zip-compressed"
      || file.name.toLowerCase().endsWith(".zip");
    if (isZip) {
      const expanded = await expandFloorPlanZip(file);
      skippedNonFloorPlan += expanded.skippedNonFloorPlan;
      for (const entry of expanded.files) {
        out.push({
          fileName: entry.fileName,
          sourceRef: `${file.name}:${entry.zipPath}`,
          file: new File([entry.blob], entry.fileName, { type: entry.blob.type }),
        });
      }
      continue;
    }
    if (!isFloorPlanImportFileName(file.name)) {
      skippedNonFloorPlan++;
      continue;
    }
    out.push({ fileName: file.name, sourceRef: file.name, file });
  }

  return { files: out, skippedNonFloorPlan };
}
