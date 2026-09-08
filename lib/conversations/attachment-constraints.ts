/**
 * Channel-aware attachment constraints for Inbox compose / provider send.
 *
 * Storage bucket (couple-messages) allows up to 20MB and a broad MIME set.
 * Text/MMS additionally requires total media ≤ 5MB and an MMS-accepted type.
 * Email attachments allow larger payloads — we keep the shared 20MB storage
 * cap as the venue-facing limit.
 *
 * Constraints are surfaced to the user — never silently degraded.
 */
export const CONVERSATION_STORAGE_MAX_BYTES = 20 * 1024 * 1024;
export const SMS_MMS_MAX_BYTES = 5 * 1024 * 1024;
export const SMS_MMS_MAX_FILES = 10;
export const EMAIL_ATTACH_MAX_BYTES = CONVERSATION_STORAGE_MAX_BYTES;
export const EMAIL_ATTACH_MAX_FILES = 10;

/** Types accepted both by couple-messages storage and text/MMS. */
export const SMS_MMS_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/tiff",
  "image/bmp",
  "application/pdf",
  "video/mp4",
  "video/mpeg",
  "video/mpeg4",
  "video/quicktime",
  "video/webm",
  "video/3gpp",
  "audio/mpeg",
  "audio/mp4",
  "audio/mp3",
  "audio/amr",
  "audio/ogg",
  "audio/3gpp",
] as const;

/** Types accepted for email / portal / internal note (storage allowlist). */
export const CONVERSATION_ATTACH_MIME_TYPES = [
  ...SMS_MMS_MIME_TYPES,
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export type AttachmentChannel = "email" | "sms" | "portal" | "internal_note";

export type PendingAttachment = {
  url: string;
  name: string;
  size: number;
  mimeType: string;
};

function normalizeMime(mime: string | null | undefined): string {
  return (mime ?? "").trim().toLowerCase();
}

export function isMimeAllowedForChannel(channel: AttachmentChannel, mime: string | null | undefined): boolean {
  const m = normalizeMime(mime);
  if (!m) return false;
  if (channel === "sms") return (SMS_MMS_MIME_TYPES as readonly string[]).includes(m);
  return (CONVERSATION_ATTACH_MIME_TYPES as readonly string[]).includes(m);
}

export function maxBytesForChannel(channel: AttachmentChannel): number {
  return channel === "sms" ? SMS_MMS_MAX_BYTES : CONVERSATION_STORAGE_MAX_BYTES;
}

export function maxFilesForChannel(channel: AttachmentChannel): number {
  return channel === "sms" ? SMS_MMS_MAX_FILES : EMAIL_ATTACH_MAX_FILES;
}

export function acceptAttributeForChannel(channel: AttachmentChannel): string {
  const list = channel === "sms" ? SMS_MMS_MIME_TYPES : CONVERSATION_ATTACH_MIME_TYPES;
  return list.join(",");
}

export function validateAttachmentsForChannel(
  channel: AttachmentChannel,
  files: ReadonlyArray<{ name: string; size: number; mimeType?: string | null }>,
): { ok: true } | { ok: false; message: string } {
  if (files.length === 0) return { ok: true };
  const maxFiles = maxFilesForChannel(channel);
  if (files.length > maxFiles) {
    return {
      ok: false,
      message: channel === "sms"
        ? `Text messages can include at most ${maxFiles} files.`
        : `You can attach at most ${maxFiles} files to one message.`,
    };
  }
  const maxBytes = maxBytesForChannel(channel);
  let total = 0;
  for (const f of files) {
    if (!isMimeAllowedForChannel(channel, f.mimeType)) {
      return {
        ok: false,
        message: channel === "sms"
          ? `"${f.name}" isn’t a file type that can be sent as a text/MMS. Try a photo (JPEG/PNG), PDF, or short video.`
          : `"${f.name}" isn’t an allowed attachment type.`,
      };
    }
    if (f.size > maxBytes) {
      return {
        ok: false,
        message: channel === "sms"
          ? `"${f.name}" is too large for text/MMS (max ${Math.floor(maxBytes / (1024 * 1024))} MB for all media in one text).`
          : `"${f.name}" exceeds the ${Math.floor(maxBytes / (1024 * 1024))} MB limit.`,
      };
    }
    total += f.size;
  }
  if (channel === "sms" && total > SMS_MMS_MAX_BYTES) {
    return {
      ok: false,
      message: `These files total more than ${Math.floor(SMS_MMS_MAX_BYTES / (1024 * 1024))} MB. Text/MMS allows at most 5 MB for all media in one text.`,
    };
  }
  return { ok: true };
}
