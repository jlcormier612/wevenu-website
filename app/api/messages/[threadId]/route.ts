import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import { sendMessageEmail } from "@/lib/messages/notify";

type Params = { params: Promise<{ threadId: string }> };

export async function GET(_: Request, { params }: Params) {
  const { threadId } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_couple_thread", { p_thread_id: threadId });
  const typed = data as { error?: string } | null;
  if (typed?.error) return NextResponse.json(typed, { status: 404 });
  return NextResponse.json(data);
}

export async function POST(request: Request, { params }: Params) {
  const { threadId } = await params;
  const { body } = await request.json() as { body?: string };
  if (!body?.trim()) return NextResponse.json({ ok: false, error: "empty_body" }, { status: 400 });

  const supabase = await createClient();
  const { data } = await supabase.rpc("send_couple_message", { p_thread_id: threadId, p_body: body });
  const result = data as { ok: boolean; message_id?: string } | null;

  if (result?.ok) {
    // Fire notification to the couple (best-effort, don't block the response)
    void notifyCouple(supabase, threadId, body.trim());
  }

  return NextResponse.json(result ?? { ok: false });
}

async function notifyCouple(
  supabase: Awaited<ReturnType<typeof createClient>>,
  threadId: string,
  preview: string,
) {
  try {
    // Fetch couple email + portal token + venue name from the thread
    const { data: thread } = await supabase
      .from("couple_threads")
      .select("venue_id, client_id, clients(email, first_name, partner_first_name)")
      .eq("id", threadId)
      .maybeSingle<{
        venue_id: string;
        client_id: string;
        clients: { email: string | null; first_name: string; partner_first_name: string | null };
      }>();

    if (!thread?.clients?.email) return;

    const { data: venue } = await supabase
      .from("venues")
      .select("name")
      .eq("id", thread.venue_id)
      .maybeSingle<{ name: string }>();

    const { data: session } = await supabase
      .from("client_portal_sessions")
      .select("access_token")
      .eq("client_id", thread.client_id)
      .eq("venue_id", thread.venue_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ access_token: string }>();

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.wevenu.com";
    const portalUrl = session?.access_token
      ? `${baseUrl}/portal/${session.access_token}?section=messages`
      : baseUrl;

    const coupleName = [thread.clients.first_name, thread.clients.partner_first_name]
      .filter(Boolean).join(" & ");

    await sendMessageEmail({
      to: thread.clients.email,
      senderName: venue?.name ?? "Your Venue",
      bodyPreview: preview.slice(0, 200),
      ctaUrl: portalUrl,
      ctaLabel: `Reply as ${coupleName}`,
    });
  } catch (err) {
    console.error("[messages] notifyCouple failed:", err);
  }
}
