/**
 * Forces a real download of a file, regardless of which origin it's hosted
 * on. A plain `<a href={url} download>` only reliably triggers a download
 * for same-origin URLs — browsers silently ignore the `download` attribute
 * for cross-origin URLs (which Supabase Storage always is relative to the
 * app: different host/port, so a different origin even on localhost) and
 * just navigate to/display the resource instead, indistinguishable from
 * clicking a plain "view" link.
 *
 * Fetching the file as a blob and downloading from a local blob: URL
 * sidesteps the cross-origin restriction entirely, since the blob URL is
 * same-origin by construction.
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download file (${res.status}).`);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
}
