import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import { sendFeedbackEmail } from "@/lib/feedback/notify";

/**
 * Client portal product feedback → venue_feedback (surface=client).
 * Token-authenticated via submit_product_feedback_from_portal RPC.
 */
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    token?: string;
    type?: string;
    subject?: string | null;
    body?: string;
    rating?: number | null;
    allow_public_share?: boolean;
    metadata?: {
      current_url?: string;
      user_agent?: string;
      surface?: string;
    };
  };

  const token = body.token?.trim();
  const type = body.type?.trim();
  if (!token || !type) {
    return NextResponse.json({ error: "Missing token or type" }, { status: 400 });
  }

  const allowPublicShare = type === "nps" && body.allow_public_share === true;
  const trimmedSubject = body.subject?.trim() || null;
  const trimmedBody = body.body?.trim() ?? "";

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_product_feedback_from_portal", {
    p_token: token,
    p_type: type,
    p_subject: trimmedSubject,
    p_body: trimmedBody,
    p_rating: body.rating ?? null,
    p_allow_public_share: allowPublicShare,
    p_metadata: {
      current_url: body.metadata?.current_url ?? null,
      user_agent: body.metadata?.user_agent ?? null,
      surface: "client",
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = data as {
    ok?: boolean;
    error?: string;
    id?: string;
    venue_id?: string;
    client_id?: string;
  } | null;

  if (!result?.ok) {
    const code = result?.error ?? "unknown";
    const status =
      code === "invalid_token" ? 401
        : code === "missing_body" || code === "missing_rating" || code === "invalid_type" ? 400
          : 409;
    return NextResponse.json({ error: code }, { status });
  }

  // Best-effort actor labels for internal email
  let venueName = "Client portal";
  let actorLabel = "Client";
  let userEmail = "portal@client";
  if (result.venue_id) {
    const { data: venue } = await supabase
      .from("venues")
      .select("name")
      .eq("id", result.venue_id)
      .maybeSingle<{ name: string }>();
    if (venue?.name) venueName = venue.name;
  }
  if (result.client_id) {
    const { data: client } = await supabase
      .from("clients")
      .select("first_name, partner_first_name, email")
      .eq("id", result.client_id)
      .maybeSingle<{
        first_name: string;
        partner_first_name: string | null;
        email: string | null;
      }>();
    if (client) {
      actorLabel = [client.first_name, client.partner_first_name].filter(Boolean).join(" & ")
        || "Client";
      if (client.email) userEmail = client.email;
    }
  }

  const { data: authData } = await supabase.auth.getUser();
  if (authData.user?.email) userEmail = authData.user.email;

  void sendFeedbackEmail({
    type,
    subject: trimmedSubject,
    body: trimmedBody,
    rating: body.rating ?? null,
    userEmail,
    venueName: `${actorLabel} · ${venueName}`,
    metadata: {
      surface: "client",
      allow_public_share: allowPublicShare,
      venue_id: result.venue_id ?? null,
      client_id: result.client_id ?? null,
      current_url: body.metadata?.current_url ?? null,
    },
  });

  // CRM partner ingest is wired separately — never block portal submit.
  void (async () => {
    try {
      const mod = await import("@shared/relationships") as {
        ingestProductPartnerFeedback?: (input: {
          surface: "client";
          productVenueId: string | null;
          clientId: string | null;
          email: string | null;
          actorName: string;
          feedbackType: string;
          subject: string | null;
          body: string;
          rating: number | null;
          allowPublicShare: boolean;
          productFeedbackId: string | null;
          sourceUrl: string | null;
        }) => Promise<unknown>;
      };
      if (typeof mod.ingestProductPartnerFeedback !== "function") return;
      await mod.ingestProductPartnerFeedback({
        surface: "client",
        productVenueId: result.venue_id ?? null,
        clientId: result.client_id ?? null,
        email: userEmail !== "portal@client" ? userEmail : null,
        actorName: actorLabel,
        feedbackType: type,
        subject: trimmedSubject,
        body: trimmedBody,
        rating: body.rating ?? null,
        allowPublicShare,
        productFeedbackId: result.id ?? null,
        sourceUrl: body.metadata?.current_url ?? null,
      });
    } catch (error) {
      console.error("[product→crm] client feedback sync failed:", error);
    }
  })();

  return NextResponse.json({ ok: true, id: result.id ?? null });
}
