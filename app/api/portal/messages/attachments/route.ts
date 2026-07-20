import { NextResponse } from "next/server";
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

  const result = await addPortalConversationMessageAttachment(token, messageId, {
    url: fileUrl, name: fileName, size: fileSize ?? null, mimeType: mimeType ?? null,
  });

  return NextResponse.json(result);
}
