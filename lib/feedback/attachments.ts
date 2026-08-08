/**
 * Bug-report screenshot attachments for Share Feedback.
 * Stored in the `feedback-screenshots` bucket; URLs/paths persist on
 * venue_feedback.metadata.attachments.
 */

export const FEEDBACK_SCREENSHOTS_BUCKET = "feedback-screenshots";
export const MAX_FEEDBACK_SCREENSHOTS = 5;
export const MAX_FEEDBACK_SCREENSHOT_MB = 10;
export const MAX_FEEDBACK_SCREENSHOT_BYTES =
  MAX_FEEDBACK_SCREENSHOT_MB * 1024 * 1024;

/** Matches portal image accept (includes HEIC/HEIF from iPhone). */
export const FEEDBACK_SCREENSHOT_ACCEPT =
  "image/png,image/jpeg,image/webp,image/heic,image/heif,.png,.jpg,.jpeg,.webp,.heic,.heif";

export type FeedbackAttachment = {
  url: string;
  path: string;
  file_name: string;
  mime_type: string;
  size: number;
};

export function isFeedbackAttachment(value: unknown): value is FeedbackAttachment {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.url === "string"
    && typeof v.path === "string"
    && typeof v.file_name === "string"
    && typeof v.mime_type === "string"
    && typeof v.size === "number"
  );
}

/** Cap and sanitize client-supplied attachment list (bug reports only). */
export function normalizeFeedbackAttachments(
  raw: unknown,
  type: string,
): FeedbackAttachment[] {
  if (type !== "bug" || !Array.isArray(raw)) return [];
  const out: FeedbackAttachment[] = [];
  for (const item of raw) {
    if (!isFeedbackAttachment(item)) continue;
    if (!item.url.startsWith("http") || !item.path.includes("/")) continue;
    if (item.size < 0 || item.size > MAX_FEEDBACK_SCREENSHOT_BYTES) continue;
    out.push({
      url: item.url,
      path: item.path,
      file_name: item.file_name.slice(0, 255),
      mime_type: item.mime_type.slice(0, 120),
      size: item.size,
    });
    if (out.length >= MAX_FEEDBACK_SCREENSHOTS) break;
  }
  return out;
}

export function attachmentMetaFields(attachments: FeedbackAttachment[]) {
  if (attachments.length === 0) {
    return {
      attachments: [] as FeedbackAttachment[],
      attachment_count: 0,
    };
  }
  return {
    attachments,
    attachment_count: attachments.length,
  };
}
