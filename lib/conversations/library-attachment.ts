/**
 * Attaching an existing Library Document to a conversation message.
 *
 * The Library and the Inbox do not agree on what a file may be, and that
 * disagreement is the whole reason this module exists:
 *
 *   Library Documents — 25 MB, a broad type set. They are venue reference
 *   material, not delivery payloads.
 *   Conversation storage — 20 MB, a narrower type set.
 *   Text/MMS           — 5 MB total, narrower still.
 *
 * So a perfectly valid Library Document can be undeliverable on the channel
 * the venue happens to have selected. The picker says so, per document, in
 * plain language. It does not quietly filter the list: a coordinator hunting
 * for the rain plan they know they uploaded must find it and be told why it
 * cannot go out as a text, rather than conclude the product lost their file.
 *
 * WHY THE OBJECT IS COPIED RATHER THAN REFERENCED
 *
 * Everywhere else in Documents, a message attachment and its Documents row
 * share one physical object (see attachment-document.ts). That is not
 * available in this direction, because the two buckets have deliberately
 * opposite visibility:
 *
 *   documents        — private. Reached only through the venue-authorized
 *                      signed-URL route added for the Library.
 *   couple-messages  — public. An attachment URL is fetched by people who
 *                      have no venue session at all: a couple in their
 *                      portal, a vendor, an email client rendering an
 *                      attachment, and (when texting resumes) Twilio
 *                      fetching MMS media.
 *
 * Pointing an attachment at the private object would therefore break the
 * recipient's ability to open what they were sent, and no signed URL fixes it
 * — signed URLs expire, and an expiring link inside an already-sent message
 * is a data-loss path with a delay on it.
 *
 * Copying server-side into the delivery bucket costs one stored object and
 * buys two things worth more than it: the recipient keeps working forever,
 * and deleting the Library Document afterwards cannot break the sent message,
 * because the message never depended on the Library's object. That makes the
 * "never break a sent attachment" invariant true by construction rather than
 * by policy.
 *
 * What is NOT duplicated is the Documents *row*. The Library Document remains
 * the single record for this file; a Library-sourced attachment deliberately
 * skips the entity-scoped Documents registration that a fresh upload performs,
 * so attaching the venue's insurance certificate to nine leads does not litter
 * the workspace with nine lead-scoped copies of it.
 */
import {
  isMimeAllowedForChannel,
  maxBytesForChannel,
  SMS_MMS_MAX_BYTES,
  type AttachmentChannel,
} from "@/lib/conversations/attachment-constraints";

/** The subset of a Document the picker and the attach route both need. */
export type LibraryAttachmentCandidate = {
  id: string;
  name: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
};

export type LibraryAttachmentCompatibility =
  | { attachable: true }
  | { attachable: false; reason: string };

function megabytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 10 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`;
}

function channelNoun(channel: AttachmentChannel): string {
  switch (channel) {
    case "sms": return "a text";
    case "email": return "an email";
    case "portal": return "a portal message";
    case "internal_note": return "an internal note";
  }
}

/**
 * Can this one document go out on this channel, ignoring what else is already
 * attached? Size-vs-channel and type-vs-channel only — the running total is a
 * separate question because it depends on the rest of the selection.
 *
 * A document with no recorded type is refused rather than assumed: the send
 * path would have to guess a MIME for the provider, and guessing wrong on an
 * outbound message is worse than declining here.
 */
export function evaluateLibraryAttachment(
  channel: AttachmentChannel,
  doc: LibraryAttachmentCandidate,
): LibraryAttachmentCompatibility {
  const size = doc.fileSize ?? 0;
  const mime = (doc.mimeType ?? "").trim();

  if (!mime) {
    return {
      attachable: false,
      reason: "This file has no recorded file type, so it can’t be sent as an attachment. Re-upload it to the Library to fix that.",
    };
  }

  if (!isMimeAllowedForChannel(channel, mime)) {
    return {
      attachable: false,
      reason: channel === "sms"
        ? "This file type can’t be sent as a text. Texts take photos, PDFs, and short audio or video."
        : `This file type can’t be sent as ${channelNoun(channel)}.`,
    };
  }

  const maxBytes = maxBytesForChannel(channel);
  if (size > maxBytes) {
    return {
      attachable: false,
      reason: channel === "sms"
        ? `At ${megabytes(size)} this is over the ${megabytes(maxBytes)} limit for everything attached to one text.`
        : `At ${megabytes(size)} this is over the ${megabytes(maxBytes)} attachment limit.`,
    };
  }

  return { attachable: true };
}

/**
 * Would adding this document push the message past the channel's running
 * total? Only text/MMS has a combined cap, so every other channel answers
 * with its per-file rule alone.
 */
export function evaluateLibraryAttachmentWithSelection(
  channel: AttachmentChannel,
  doc: LibraryAttachmentCandidate,
  alreadyAttachedBytes: number,
): LibraryAttachmentCompatibility {
  const single = evaluateLibraryAttachment(channel, doc);
  if (!single.attachable) return single;
  if (channel !== "sms") return { attachable: true };

  const total = alreadyAttachedBytes + (doc.fileSize ?? 0);
  if (total > SMS_MMS_MAX_BYTES) {
    return {
      attachable: false,
      reason: `Adding this would put the text over ${megabytes(SMS_MMS_MAX_BYTES)} of media. Remove something else first.`,
    };
  }
  return { attachable: true };
}

/** "PDF · 1.4 MB" — enough to tell two similarly-named files apart. */
export function describeLibraryDocument(doc: LibraryAttachmentCandidate): string {
  const ext = doc.fileName.includes(".")
    ? doc.fileName.split(".").pop()!.toUpperCase()
    : (doc.mimeType?.split("/")[1]?.toUpperCase() ?? "File");
  const size = doc.fileSize ? megabytes(doc.fileSize) : "size unknown";
  return `${ext} · ${size}`;
}
