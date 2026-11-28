/**
 * Map Storage / Postgres errors to actionable customer-facing copy.
 * Raw RLS / DB messages stay in server logs only.
 */

export const CUSTOMER_UPLOAD_FAILED_MESSAGE =
  "Couldn’t upload that file. Check that you’re still signed in and try again. If this keeps happening, contact support.";

export const CUSTOMER_UPLOAD_UNAUTHORIZED_MESSAGE =
  "You’re not allowed to upload files for this venue. Switch venues or ask an owner/manager for help.";

export const CUSTOMER_UPLOAD_INVALID_MESSAGE =
  "That file couldn’t be accepted. Check the file type and size, then try again.";

export function customerFacingUploadError(raw: string | null | undefined): string {
  const msg = (raw ?? "").toLowerCase();
  if (!msg) return CUSTOMER_UPLOAD_FAILED_MESSAGE;
  if (
    msg.includes("row-level security") ||
    msg.includes("violates row-level security") ||
    msg.includes("jwt") ||
    msg.includes("not authenticated") ||
    msg.includes("unauthorized")
  ) {
    return CUSTOMER_UPLOAD_FAILED_MESSAGE;
  }
  if (msg.includes("too large") || msg.includes("payload") || msg.includes("entity too large")) {
    return CUSTOMER_UPLOAD_INVALID_MESSAGE;
  }
  if (msg.includes("mime") || msg.includes("content type") || msg.includes("not allowed")) {
    return CUSTOMER_UPLOAD_INVALID_MESSAGE;
  }
  // Never surface raw provider / SQL text to customers.
  if (
    msg.includes("postgres") ||
    msg.includes("sql") ||
    msg.includes("policy") ||
    msg.includes("permission denied") ||
    msg.includes("storage")
  ) {
    return CUSTOMER_UPLOAD_FAILED_MESSAGE;
  }
  return CUSTOMER_UPLOAD_FAILED_MESSAGE;
}
