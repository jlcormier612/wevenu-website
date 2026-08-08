/** Client-side helper for /api/vendor/documents/upload */
export async function uploadVendorFile(
  file: File,
  scope: "library" | "event" | "task-template",
  eventId?: string,
) {
  const form = new FormData();
  form.set("file", file);
  form.set("scope", scope);
  if (eventId) form.set("eventId", eventId);
  const res = await fetch("/api/vendor/documents/upload", { method: "POST", body: form });
  const json = await res.json() as {
    ok: boolean; error?: string;
    storagePath?: string; storageUrl?: string;
    file_name?: string; file_size?: number; mime_type?: string;
  };
  if (!json.ok || !json.storageUrl || !json.storagePath) {
    throw new Error(json.error ?? "Upload failed.");
  }
  return json;
}
