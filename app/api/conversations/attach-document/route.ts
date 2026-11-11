/**
 * POST /api/conversations/attach-document
 *
 * Stages an existing Library Document for sending on a conversation message.
 * Body: { conversationId, documentId }
 *
 * Returns the same shape as /api/conversations/upload, so the composer can
 * treat a Library pick and a fresh upload identically from here on — plus
 * library_document_id, which tells the send path this file already has a
 * Documents row and must not get a second, entity-scoped one.
 *
 * The object is copied out of the private `documents` bucket into the public
 * `couple-messages` delivery prefix. See lib/conversations/library-attachment.ts
 * for why a copy rather than a reference: recipients fetch attachment URLs with
 * no venue session, and an expiring signed URL inside an already-sent message
 * is a delayed data-loss path.
 *
 * Both the conversation and the document are re-resolved through the caller's
 * RLS-scoped client, so a document id from another venue reads as not found
 * here even though the copy itself runs with the service role.
 */
import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

import { createClient as createAuthClient } from "@/integrations/supabase/server";
import {
  CONVERSATION_ATTACH_MIME_TYPES,
  CONVERSATION_STORAGE_MAX_BYTES,
} from "@/lib/conversations/attachment-constraints";
import { getCurrentVenue } from "@/lib/venue/service";

const DOCUMENTS_BUCKET = "documents";
const DELIVERY_BUCKET = "couple-messages";

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createServiceClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * GET /api/conversations/attach-document — the Library Documents the picker
 * lists. Fetched when the picker opens rather than pushed through the Inbox
 * page, so a venue with a large Library pays nothing on every thread open.
 *
 * Returns every Library Document with its size and type. Deciding what is
 * attachable is the caller's job (lib/conversations/library-attachment.ts):
 * the picker has to show incompatible files and explain them, so filtering
 * here would defeat the point.
 */
export async function GET() {
  const venue = await getCurrentVenue();
  if (!venue) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const auth = await createAuthClient();
  const { data, error } = await auth
    .from("documents")
    .select("id, name, file_name, file_size, mime_type")
    .eq("venue_id", venue.id)
    .is("lead_id", null)
    .is("client_id", null)
    .is("event_id", null)
    .is("vendor_id", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[conversations/attach-document] list", error.message);
    return NextResponse.json({ ok: false, error: "Could not load Library documents." }, { status: 500 });
  }

  const documents = (data ?? []).map((d) => ({
    id: d.id as string,
    name: d.name as string,
    fileName: d.file_name as string,
    fileSize: d.file_size as number | null,
    mimeType: d.mime_type as string | null,
  }));

  return NextResponse.json({ ok: true, documents });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as
      | { conversationId?: string; documentId?: string }
      | null;
    const conversationId = body?.conversationId?.trim();
    const documentId = body?.documentId?.trim();
    if (!conversationId || !documentId) {
      return NextResponse.json({ ok: false, error: "Missing conversation or document." }, { status: 400 });
    }

    const venue = await getCurrentVenue();
    if (!venue) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const auth = await createAuthClient();

    const { data: conversation } = await auth
      .from("conversations")
      .select("id, venue_id")
      .eq("id", conversationId)
      .maybeSingle<{ id: string; venue_id: string }>();
    if (!conversation || conversation.venue_id !== venue.id) {
      return NextResponse.json({ ok: false, error: "Invalid conversation." }, { status: 400 });
    }

    // Library Documents are venue-scoped and entity-unscoped: all four entity
    // keys null. Requiring that here keeps this route from becoming a way to
    // pull a couple's or vendor's private file into an outbound message.
    const { data: doc } = await auth
      .from("documents")
      .select("id, venue_id, name, file_name, file_size, mime_type, storage_path, lead_id, client_id, event_id, vendor_id")
      .eq("id", documentId)
      .maybeSingle<{
        id: string;
        venue_id: string;
        name: string;
        file_name: string;
        file_size: number | null;
        mime_type: string | null;
        storage_path: string;
        lead_id: string | null;
        client_id: string | null;
        event_id: string | null;
        vendor_id: string | null;
      }>();

    if (!doc || doc.venue_id !== venue.id) {
      return NextResponse.json({ ok: false, error: "Document not found." }, { status: 404 });
    }
    if (doc.lead_id || doc.client_id || doc.event_id || doc.vendor_id) {
      return NextResponse.json(
        { ok: false, error: "Only Library documents can be attached this way." },
        { status: 400 },
      );
    }

    const mime = (doc.mime_type ?? "").trim().toLowerCase();
    if (!mime || !(CONVERSATION_ATTACH_MIME_TYPES as readonly string[]).includes(mime)) {
      return NextResponse.json(
        { ok: false, error: "That file type can’t be sent as a message attachment." },
        { status: 400 },
      );
    }
    // Channel-specific limits (text/MMS 5 MB) are enforced in the composer and
    // again at send; this is the storage-bucket ceiling that applies to all.
    if ((doc.file_size ?? 0) > CONVERSATION_STORAGE_MAX_BYTES) {
      return NextResponse.json(
        { ok: false, error: "That file is too large to send as a message attachment." },
        { status: 400 },
      );
    }

    const service = serviceClient();

    const { data: blob, error: downloadErr } = await service.storage
      .from(DOCUMENTS_BUCKET)
      .download(doc.storage_path);
    if (downloadErr || !blob) {
      console.error("[conversations/attach-document] download", downloadErr?.message);
      return NextResponse.json({ ok: false, error: "Could not read that document." }, { status: 500 });
    }

    const safe = (doc.file_name || doc.name || "document").replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `conversations/${conversation.venue_id}/${conversation.id}/${Date.now()}-${safe}`;

    const { error: uploadErr } = await service.storage
      .from(DELIVERY_BUCKET)
      .upload(path, blob, { upsert: false, contentType: mime });
    if (uploadErr) {
      console.error("[conversations/attach-document] upload", uploadErr.message);
      return NextResponse.json({ ok: false, error: "Could not attach that document." }, { status: 500 });
    }

    const { data: urlData } = service.storage.from(DELIVERY_BUCKET).getPublicUrl(path);

    return NextResponse.json({
      ok: true,
      url: urlData.publicUrl,
      file_name: doc.file_name || doc.name,
      file_size: doc.file_size ?? blob.size,
      mime_type: mime,
      library_document_id: doc.id,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
