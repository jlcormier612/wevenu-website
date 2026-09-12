import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { notifyVendorOfCouplePortalMessage } from "@/lib/conversations/notify";

/**
 * Start or continue a pre-selection couple ↔ vendor inquiry.
 * Does not create an event_vendor_assignment.
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const body = await request.json() as {
    token?: string;
    clientId?: string;
    vendorId?: string;
    message?: string;
  };
  const { token, clientId, vendorId, message } = body;
  if (!token || !clientId || !vendorId || typeof message !== "string") {
    return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_portal_vendor_inquiry", {
    p_access_token: token,
    p_client_id: clientId,
    p_vendor_id: vendorId,
    p_body: message,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const result = (data ?? {}) as {
    ok?: boolean;
    error?: string;
    conversationId?: string;
    messageId?: string;
    created?: boolean;
  };

  if (!result.ok) {
    const status =
      result.error === "unauthorized" || result.error === "invalid_token" ? 401
        : result.error === "vendor_unavailable" || result.error === "vendor_unclaimed" ? 400
          : 400;
    return NextResponse.json({ ok: false, error: result.error ?? "failed" }, { status });
  }

  if (result.conversationId && result.messageId) {
    notifyVendorOfCouplePortalMessage(result.conversationId, message.trim());
  }

  return NextResponse.json({
    ok: true,
    conversationId: result.conversationId,
    messageId: result.messageId,
    created: result.created === true,
  });
}
