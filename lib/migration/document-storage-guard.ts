/**
 * Migration document rows require a real storage object — a documents table
 * row alone is not a migrated file.
 */
import { createDocumentsSignedUrl } from "@/lib/documents/signed-url";

export function missingDocumentStorageMessage(storagePath: string): string {
  return (
    `No file found at storage path "${storagePath}". `
    + "Upload the file into Hello to Cheers documents storage first, then put that storagePath and storageUrl in your CSV "
    + "(or use Active commitment Smart Import / Floor plan upload, which stage the file for you)."
  );
}

export async function assertMigrationDocumentStorageExists(
  storagePath: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = storagePath.trim();
  if (!trimmed) {
    return { ok: false, error: "Documents need a storagePath from an uploaded file." };
  }
  const signed = await createDocumentsSignedUrl(trimmed);
  if (!signed) {
    return { ok: false, error: missingDocumentStorageMessage(trimmed) };
  }
  return { ok: true };
}
