/**
 * Generic document file replacement — current file + append-only prior versions.
 * Not a collaborative editor. Does not delete the previous storage object.
 */

export type ReplaceDocumentFileInput = {
  documentId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  storageUrl: string;
};

export type ReplaceDocumentFileResult =
  | { ok: true; documentId: string; version: number; archivedVersion?: number; idempotent?: boolean }
  | { ok: false; reason: "unauthorized" | "not_found" | "invalid" | "rpc_failed"; message?: string };

export function parseReplaceDocumentResult(data: unknown): ReplaceDocumentFileResult {
  if (!data || typeof data !== "object") {
    return { ok: false, reason: "rpc_failed", message: "Empty replace result." };
  }
  const row = data as Record<string, unknown>;
  if (row.ok === true && typeof row.documentId === "string") {
    return {
      ok: true,
      documentId: row.documentId,
      version: typeof row.version === "number" ? row.version : 1,
      archivedVersion: typeof row.archivedVersion === "number" ? row.archivedVersion : undefined,
      idempotent: row.idempotent === true,
    };
  }
  const reason = row.reason;
  if (reason === "unauthorized" || reason === "not_found" || reason === "invalid") {
    return { ok: false, reason };
  }
  return { ok: false, reason: "rpc_failed", message: typeof row.reason === "string" ? row.reason : "Replace failed." };
}

/** After a failed DB replace, the newly uploaded object is an orphan and must be removed. */
export function shouldRemoveOrphanUpload(result: ReplaceDocumentFileResult): boolean {
  return result.ok === false && result.reason !== "unauthorized";
}
