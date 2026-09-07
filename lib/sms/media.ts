/**
 * Twilio MMS media helpers — inbound fetch + outbound MediaUrl validation.
 *
 * Inbound Twilio MediaUrl* require HTTP Basic auth (Account SID + Auth Token).
 * We never expose those URLs to the browser; media is downloaded into
 * couple-messages and referenced via conversation_message_attachments.
 */
import { createClient } from "@supabase/supabase-js";
import { isMimeAllowedForChannel, SMS_MMS_MAX_BYTES } from "@/lib/conversations/attachment-constraints";

const BUCKET = "couple-messages";

export type InboundTwilioMedia = {
  url: string;
  contentType: string | null;
  index: number;
};

export function parseInboundTwilioMedia(params: URLSearchParams): InboundTwilioMedia[] {
  const num = Number.parseInt(params.get("NumMedia") ?? "0", 10);
  if (!Number.isFinite(num) || num <= 0) return [];
  const out: InboundTwilioMedia[] = [];
  for (let i = 0; i < num; i++) {
    const url = params.get(`MediaUrl${i}`)?.trim();
    if (!url) continue;
    out.push({
      url,
      contentType: params.get(`MediaContentType${i}`)?.trim() || null,
      index: i,
    });
  }
  return out;
}

function extensionForMime(mime: string | null): string {
  const m = (mime ?? "").toLowerCase();
  if (m.includes("jpeg") || m === "image/jpg") return "jpg";
  if (m.includes("png")) return "png";
  if (m.includes("gif")) return "gif";
  if (m.includes("webp")) return "webp";
  if (m.includes("heic")) return "heic";
  if (m.includes("heif")) return "heif";
  if (m.includes("pdf")) return "pdf";
  if (m.includes("mp4")) return "mp4";
  if (m.includes("quicktime")) return "mov";
  if (m.includes("webm")) return "webm";
  if (m.includes("mpeg") && m.startsWith("audio")) return "mp3";
  if (m.includes("amr")) return "amr";
  if (m.includes("ogg")) return "ogg";
  return "bin";
}

function serviceStorage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/**
 * Download one Twilio media URL with Basic auth and store under conversations/.
 * Rejects oversize / disallowed types with a clear reason (no silent drop).
 * Auth must be the venue subaccount credentials (API key preferred).
 */
export async function persistTwilioMediaToConversationStorage(input: {
  venueId: string;
  conversationId: string;
  media: InboundTwilioMedia;
  messageSid: string;
  /** Base64 Basic auth value for the venue subaccount (API key:secret). */
  mediaBasicAuth: string;
}): Promise<
  | { ok: true; url: string; fileName: string; fileSize: number; mimeType: string }
  | { ok: false; message: string }
> {
  if (!input.mediaBasicAuth?.trim()) {
    return { ok: false, message: "Texting isn’t configured — can’t save inbound media." };
  }

  const res = await fetch(input.media.url, {
    headers: {
      Authorization: `Basic ${input.mediaBasicAuth}`,
    },
    redirect: "follow",
  });
  if (!res.ok) {
    return { ok: false, message: `Couldn’t download inbound media (${res.status}).` };
  }

  const mimeType = (res.headers.get("content-type")?.split(";")[0]?.trim()
    || input.media.contentType
    || "application/octet-stream").toLowerCase();

  if (!isMimeAllowedForChannel("sms", mimeType)) {
    return {
      ok: false,
      message: `Inbound media type ${mimeType} isn’t supported for text/MMS storage.`,
    };
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > SMS_MMS_MAX_BYTES) {
    return {
      ok: false,
      message: `Inbound media exceeds the ${Math.floor(SMS_MMS_MAX_BYTES / (1024 * 1024))} MB MMS limit.`,
    };
  }

  const ext = extensionForMime(mimeType);
  // Short ASCII filename (Twilio outbound MediaUrl naming guidance ≤20 chars for Content-Disposition;
  // inbound storage uses a stable short leaf name under the conversation path).
  const leaf = `in${input.media.index}-${input.messageSid.slice(-8)}.${ext}`.replace(/[^a-zA-Z0-9._-]/g, "");
  const path = `conversations/${input.venueId}/${input.conversationId}/${leaf}`;

  const supabase = serviceStorage();
  const { error } = await supabase.storage.from(BUCKET).upload(path, buf, {
    upsert: false,
    contentType: mimeType,
  });
  if (error) {
    // Idempotent retry: object may already exist from a prior webhook attempt.
    if (!/already exists|Duplicate|409/i.test(error.message)) {
      return { ok: false, message: `Couldn’t store inbound media: ${error.message}` };
    }
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return {
    ok: true,
    url: urlData.publicUrl,
    fileName: leaf,
    fileSize: buf.byteLength,
    mimeType,
  };
}
