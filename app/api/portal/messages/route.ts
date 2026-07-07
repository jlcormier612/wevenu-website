import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import { sendMessageEmail } from "@/lib/messages/notify";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_portal_messages", { p_token: token });
  return NextResponse.json(data ?? { thread_id: null, messages: [] });
}

export async function POST(request: Request) {
  const { token, body } = await request.json() as { token?: string; body?: string };
  if (!token || !body?.trim()) {
    return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc("send_portal_message", { p_token: token, p_body: body });
  const result = data as { ok: boolean; message_id?: string } | null;

  if (result?.ok) {
    void notifyVenue(supabase, token, body.trim());
  }

  return NextResponse.json(result ?? { ok: false });
}

async function notifyVenue(
  supabase: Awaited<ReturnType<typeof createClient>>,
  token: string,
  preview: string,
) {
  try {
    const { data: session } = await supabase
      .from("client_portal_sessions")
      .select("venue_id, client_id")
      .eq("access_token", token)
      .maybeSingle<{ venue_id: string; client_id: string }>();

    if (!session) return;

    const [{ data: venue }, { data: client }] = await Promise.all([
      supabase
        .from("venues")
        .select("name, email")
        .eq("id", session.venue_id)
        .maybeSingle<{ name: string; email: string | null }>(),
      supabase
        .from("clients")
        .select("first_name, partner_first_name")
        .eq("id", session.client_id)
        .maybeSingle<{ first_name: string; partner_first_name: string | null }>(),
    ]);

    if (!venue?.email) return;

    const coupleName = [client?.first_name, client?.partner_first_name]
      .filter(Boolean).join(" & ") || "Your Couple";

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.wevenu.com";
    await sendMessageEmail({
      to: venue.email,
      senderName: coupleName,
      bodyPreview: preview.slice(0, 200),
      ctaUrl: `${baseUrl}/messaging`,
      ctaLabel: "Reply in Wevenu",
    });
  } catch (err) {
    console.error("[messages] notifyVenue failed:", err);
  }
}
