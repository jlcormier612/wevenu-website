import { NextResponse } from "next/server";

import {
  verifySupportAccessToken,
  workspaceAppBaseUrl,
} from "@shared/support-access";
import { createAdminClient } from "@/integrations/supabase/admin";
import { createClient } from "@/integrations/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Exchange a short-lived CRM support token for an active htc_support_context
 * on the caller's HQ-admin auth identity, then open the real venue app.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim() || "";
  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }

  const verified = verifySupportAccessToken(token);
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: 401 });
  }
  const claims = verified.claims;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Staff must already be signed into the product app as themselves (HQ identity).
  // Do not magic-link as a customer. If unauthenticated, send to login with return.
  if (!user) {
    const login = new URL("/login", url.origin);
    login.searchParams.set("next", `/api/htc-support/enter?token=${encodeURIComponent(token)}`);
    return NextResponse.redirect(login);
  }

  if (user.id !== claims.actorUserId) {
    // Allow email match when ACL user id drifted but same staff email.
    if ((user.email || "").toLowerCase() !== claims.actorEmail) {
      return NextResponse.json(
        {
          error:
            "Support session must use the same HTC staff login that started it from CRM.",
        },
        { status: 403 },
      );
    }
  }

  const { data: isAdmin, error: adminErr } = await supabase.rpc("is_hq_admin");
  if (adminErr || !isAdmin) {
    return NextResponse.json(
      { error: "HQ admin roster required for support access" },
      { status: 403 },
    );
  }

  const { data: started, error: startErr } = await supabase.rpc(
    "htc_start_support_context",
    {
      p_portal: claims.portal,
      p_mode: claims.mode,
      p_venue_id: claims.venueId,
      p_client_id: claims.clientId,
      p_vendor_id: claims.vendorId,
      p_relationship_id: claims.relationshipId,
      p_ttl_seconds: 7200,
    },
  );

  if (startErr || !started || (started as { ok?: boolean }).ok === false) {
    // Service-role fallback if RPC missing mid-migration.
    try {
      const admin = createAdminClient();
      const { error } = await admin.from("htc_support_context").upsert({
        user_id: user.id,
        portal: claims.portal,
        venue_id: claims.venueId,
        client_id: claims.clientId,
        vendor_id: claims.vendorId,
        mode: claims.mode,
        actor_staff_email: claims.actorEmail,
        relationship_id: claims.relationshipId,
        expires_at: new Date(Date.now() + 7200_000).toISOString(),
        created_at: new Date().toISOString(),
      });
      if (error) {
        return NextResponse.json(
          { error: startErr?.message || error.message || "start_failed" },
          { status: 500 },
        );
      }
    } catch (e) {
      return NextResponse.json(
        { error: startErr?.message || String(e) },
        { status: 500 },
      );
    }
  }

  let dest = "/dashboard";
  if (claims.portal === "client" && claims.clientId) {
    // Prefer CRM return + client list; genuine portal requires a portal token.
    dest = `/clients/${claims.clientId}`;
  } else if (claims.portal === "vendor" && claims.vendorId) {
    dest = `/vendors/${claims.vendorId}`;
  }

  const res = NextResponse.redirect(new URL(dest, url.origin));
  res.cookies.set("htc_support_banner", "1", {
    httpOnly: false,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 7200,
  });
  // Soft hint for middleware mutation gate (claims also live in DB context).
  res.cookies.set(
    "htc_support_mode",
    claims.mode,
    {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 7200,
    },
  );
  void workspaceAppBaseUrl;
  return res;
}
