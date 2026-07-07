import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

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

  const supabase = await createClient();
  const { data } = await supabase.rpc("add_portal_message_attachment", {
    p_token:      token,
    p_message_id: messageId,
    p_file_url:   fileUrl,
    p_file_name:  fileName,
    p_file_size:  fileSize ?? null,
    p_mime_type:  mimeType ?? null,
  });

  return NextResponse.json(data ?? { ok: false });
}
