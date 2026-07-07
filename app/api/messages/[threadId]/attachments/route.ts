import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

type Params = { params: Promise<{ threadId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { threadId } = await params;
  const { messageId, fileUrl, fileName, fileSize, mimeType } =
    await request.json() as {
      messageId: string;
      fileUrl:   string;
      fileName:  string;
      fileSize?: number;
      mimeType?: string;
    };

  if (!messageId || !fileUrl || !fileName) {
    return NextResponse.json({ ok: false, error: "Missing fields." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc("add_message_attachment", {
    p_message_id: messageId,
    p_file_url:   fileUrl,
    p_file_name:  fileName,
    p_file_size:  fileSize ?? null,
    p_mime_type:  mimeType ?? null,
  });

  void threadId; // threadId is used for path clarity; auth enforced in RPC
  return NextResponse.json(data ?? { ok: false });
}
