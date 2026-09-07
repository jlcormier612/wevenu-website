import { NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { registerMessageAttachmentAsDocument } from "@/lib/conversations/attachment-document";
import { addPortalConversationMessageAttachment } from "@/lib/conversations/service";

/** RC2, Milestone 2 — attaches through Conversations instead of couple_messages. */
export async function POST(request: Request) {
  const { token, messageId, fileUrl, fileName, fileSize, mimeType } =
    await request.json() as {
      token:     string;
      messageId: string;
      fileUrl:   string;
      fileName:  string;
      fileSize?: number;
      mimeType?: string;
    };

  if (!token || !messageId || !fileUrl || !fileName) {
    return NextResponse.json({ ok: false, error: "Missing fields." }, { status: 400 });
  }

  const file = {
    url: fileUrl, name: fileName, size: fileSize ?? null, mimeType: mimeType ?? null,
  };
  const result = await addPortalConversationMessageAttachment(token, messageId, file);

  // Portal session cannot insert venue documents under RLS — register with
  // service role after the security-definer attachment RPC succeeds.
  if (result.ok) {
    try {
      const admin = createAdminClient();
      const registered = await registerMessageAttachmentAsDocument(admin, {
        messageId,
        file,
      });
      if (!registered.ok) {
        console.error("[portal/messages/attachments] documents register failed:", registered.reason);
      }
    } catch (err) {
      console.error("[portal/messages/attachments] documents register error:", err);
    }
  }

  return NextResponse.json(result);
}
