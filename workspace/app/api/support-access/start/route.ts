import { NextResponse } from "next/server";

import {
  mintSupportAccessToken,
  productAppBaseUrl,
  type SupportMode,
  type SupportPortal,
} from "@shared/support-access";
import { getData } from "@/lib/data/store";
import { actorCan, requireWorkspaceStaff } from "@/lib/program4/session";
import { ensureProgram4Data } from "@/lib/program4/store";
import { isSupabaseStaffAuthEnabled } from "@/lib/supabase/workspace-auth-config";

type Body = {
  portal?: SupportPortal;
  mode?: SupportMode;
  relationshipId?: string;
  venueId?: string;
  clientId?: string;
  vendorId?: string;
};

/**
 * POST — mint a short-lived signed support token and return the product-app enter URL.
 * Does not create permanent viewing history.
 */
export async function POST(request: Request) {
  const auth = await requireWorkspaceStaff();
  if (!auth.ok) return auth.response;
  await ensureProgram4Data();

  const body = (await request.json().catch(() => ({}))) as Body;
  const portal = body.portal === "client" || body.portal === "vendor" ? body.portal : "venue";
  const requestedMode = body.mode === "assist" ? "assist" : "read";

  if (!(await actorCan("view_customer_portals"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let mode: SupportMode = "read";
  if (requestedMode === "assist") {
    const relId = body.relationshipId?.trim();
    const rel = relId
      ? getData().relationships.find((r) => r.id === relId)
      : null;
    const handedOff = Boolean(
      rel &&
        (rel.meta as { customerHandoffAt?: string } | undefined)?.customerHandoffAt,
    );
    const isWgPreHandoff =
      !handedOff &&
      (rel?.onboardingType === "white_glove" ||
        rel?.status === "white_glove_implementation" ||
        rel?.status === "onboarding");

    if (isWgPreHandoff) {
      if (!(await actorCan("configure_white_glove"))) {
        return NextResponse.json(
          { error: "White Glove configuration permission required" },
          { status: 403 },
        );
      }
    } else if (!(await actorCan("assist_customer_accounts"))) {
      return NextResponse.json(
        { error: "Customer assistance permission required" },
        { status: 403 },
      );
    }
    mode = "assist";
  }

  let venueId = body.venueId?.trim() || null;
  let clientId = body.clientId?.trim() || null;
  let vendorId = body.vendorId?.trim() || null;
  const relationshipId = body.relationshipId?.trim() || null;

  if (relationshipId && !venueId) {
    const rel = getData().relationships.find((r) => r.id === relationshipId);
    venueId = rel?.productSync?.venueId?.trim() || null;
  }

  if (portal === "vendor" && vendorId && !venueId) {
    const { resolveVenueForVendor } = await import(
      "@/lib/support-access/resolve-partner-venue"
    );
    const resolved = await resolveVenueForVendor({ vendorId, venueId });
    if (resolved.ok) {
      venueId = resolved.venueId;
    } else if (resolved.error === "ambiguous") {
      return NextResponse.json(
        {
          error:
            "Vendor is linked to multiple venues — open from a venue-linked ticket or pick a venue first.",
        },
        { status: 409 },
      );
    }
  }

  if (portal === "venue" && !venueId) {
    return NextResponse.json({ error: "venueId required" }, { status: 400 });
  }
  if (portal === "client" && (!clientId || !venueId)) {
    return NextResponse.json(
      { error: "clientId and venueId required" },
      { status: 400 },
    );
  }
  if (portal === "vendor" && (!vendorId || !venueId)) {
    // Venue app client/vendor pages are venue-scoped; require both.
    return NextResponse.json(
      { error: "vendorId and venueId required" },
      { status: 400 },
    );
  }

  // Resolve staff auth user id for product-app HQ session binding.
  let actorUserId: string | null = null;
  let actorEmail = auth.actor.email;
  if (isSupabaseStaffAuthEnabled()) {
    const { getStaffAclRepository } = await import("@/lib/program4/staff-acl");
    const staff = await getStaffAclRepository().getByTeamMemberId(auth.session.id);
    if (!staff?.active) {
      return NextResponse.json({ error: "Staff ACL required" }, { status: 403 });
    }
    actorUserId = staff.userId;
    actorEmail = staff.email;
  } else {
    actorUserId = `legacy:${auth.session.id}`;
  }

  const { token, claims } = mintSupportAccessToken({
    portal,
    mode,
    venueId,
    clientId,
    vendorId,
    relationshipId,
    actorUserId,
    actorEmail,
    ttlSeconds: 90,
  });

  const enterUrl = `${productAppBaseUrl()}/api/htc-support/enter?token=${encodeURIComponent(token)}`;

  return NextResponse.json({
    ok: true,
    enterUrl,
    mode: claims.mode,
    portal: claims.portal,
    expiresAt: new Date(claims.exp * 1000).toISOString(),
  });
}
