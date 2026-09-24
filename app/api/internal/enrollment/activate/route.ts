import { NextResponse } from "next/server";

import { createAdminClient } from "@/integrations/supabase/admin";
import {
  parseExplicitPurchaserIsOwner,
  PURCHASER_OWNERSHIP_REQUIRED_ERROR,
  PURCHASER_OWNERSHIP_REQUIRED_MESSAGE,
} from "@/lib/activation/purchaser-ownership";
import { isSupabaseConfigured } from "@/lib/env";
import { resolveUserIdForEmail } from "@/lib/legal/service";

export const runtime = "nodejs";

/**
 * Internal Relationship Workspace (workspace/) → product account activation.
 *
 * Auth: Bearer PRODUCT_SYNC_API_KEY
 *
 * Body: { token, password, purchaserIsOwner (required boolean),
 *         invitedOwnerName?, invitedOwnerEmail? }
 *
 * Purchaser ≠ Owner unless purchaserIsOwner is explicitly true.
 * Missing/invalid ownership choice is rejected (fail closed).
 */
type ActivateBody = {
  token?: string;
  password?: string;
  purchaserIsOwner?: unknown;
  invitedOwnerName?: string | null;
  invitedOwnerEmail?: string | null;
  inviteOwnerNow?: unknown;
};

function authorize(request: Request): boolean {
  const expected = process.env.PRODUCT_SYNC_API_KEY?.trim();
  if (!expected) return false;
  const header = request.headers.get("authorization") || "";
  const key = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return Boolean(key && key === expected);
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Supabase is not configured in this environment." },
      { status: 503 },
    );
  }

  let body: ActivateBody;
  try {
    body = (await request.json()) as ActivateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token = body.token?.trim();
  const password = body.password ?? "";
  const ownership = parseExplicitPurchaserIsOwner(body.purchaserIsOwner);
  if (!ownership.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: ownership.error,
        message: PURCHASER_OWNERSHIP_REQUIRED_MESSAGE,
      },
      { status: 400 },
    );
  }
  const purchaserIsOwner = ownership.purchaserIsOwner;
  const invitedOwnerName = body.invitedOwnerName?.trim() || null;
  const invitedOwnerEmail = body.invitedOwnerEmail?.trim().toLowerCase() || null;
  const inviteOwnerNow = body.inviteOwnerNow === true;
  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "password must be at least 8 characters" }, { status: 400 });
  }
  if (!purchaserIsOwner && ((invitedOwnerName && !invitedOwnerEmail) || (!invitedOwnerName && invitedOwnerEmail))) {
    return NextResponse.json(
      { error: "Owner name and email must both be provided, or both left blank to add later." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  try {
    const { data: enrollment, error: lookupErr } = await admin
      .from("venue_enrollments")
      .select("id, owner_email, owner_first_name, owner_last_name, venue_name, status, venue_id, onboarding_type")
      .eq("activation_token", token)
      .maybeSingle();
    if (lookupErr) throw lookupErr;

    if (!enrollment) {
      return NextResponse.json(
        { ok: false, error: "invalid_or_expired_token" },
        { status: 404 },
      );
    }

    const userId = await resolveUserIdForEmail(enrollment.owner_email);

    // Password updates stay retry-safe: an already-activated owner who
    // re-submits the form gets a working credential again. Venue creation
    // itself stays idempotent inside activate_venue_enrollment().
    const { error: pwErr } = await admin.auth.admin.updateUserById(userId, { password });
    if (pwErr) throw pwErr;

    // Always call the RPC — including on already-activated retries — so
    // the owner venue_staff row is upserted/repaired. Older activations
    // created the venues row without that staff row; Setup Hub and
    // current_user_role() expect it.
    const { data: result, error: activateErr } = await admin
      .rpc("activate_venue_enrollment", {
        p_activation_token: token,
        p_owner_user_id: userId,
        p_purchaser_is_owner: purchaserIsOwner,
        p_invited_owner_name: inviteOwnerNow ? invitedOwnerName : null,
        p_invited_owner_email: inviteOwnerNow ? invitedOwnerEmail : null,
      })
      .single();
    if (activateErr) {
      const activateMsg = activateErr.message.toLowerCase();
      if (activateMsg.includes("invalid_or_expired_token")) {
        return NextResponse.json({ ok: false, error: "invalid_or_expired_token" }, { status: 404 });
      }
      if (activateMsg.includes("token_expired")) {
        return NextResponse.json({ ok: false, error: "token_expired" }, { status: 410 });
      }
      if (activateMsg.includes("purchaser_ownership_choice_required")) {
        return NextResponse.json(
          {
            ok: false,
            error: PURCHASER_OWNERSHIP_REQUIRED_ERROR,
            message: PURCHASER_OWNERSHIP_REQUIRED_MESSAGE,
          },
          { status: 400 },
        );
      }
      throw activateErr;
    }

    const row = result as { venue_id: string; already_activated: boolean };

    // Shared provisioning: starters + Setup Hub state (idempotent).
    // Must run after the venue exists so Self-Setup and White Glove share
    // the same prepared workspace without depending on the legacy wizard.
    if (row.venue_id) {
      try {
        const { ensureProvisionedWorkspace } = await import("@/lib/provisioning/workspace");
        await ensureProvisionedWorkspace({
          venueId: row.venue_id,
          onboardingType:
            (enrollment.onboarding_type as "self_setup" | "white_glove") ?? "self_setup",
          enrollmentId: enrollment.id,
        });
      } catch (provisionError) {
        console.error("[enrollment/activate] starter provisioning failed", provisionError);
        // Venue + credentials already exist — do not fail activation; retries
        // of this endpoint (or a later ensure call) re-seed safely.
      }

      try {
        const { bindCrmProductVenueId, recordCrmProductAccountActivated } =
          await import("@shared/relationships");
        await bindCrmProductVenueId({
          productVenueId: row.venue_id,
          ownerEmail: enrollment.owner_email,
        });
        await recordCrmProductAccountActivated({
          productVenueId: row.venue_id,
          ownerEmail: enrollment.owner_email,
        });
      } catch (crmErr) {
        console.error("[enrollment/activate] CRM milestone sync failed", crmErr);
      }

      // Record or invite the first Owner after purchaser said they are not one.
      if (!purchaserIsOwner && invitedOwnerName && invitedOwnerEmail && !row.already_activated) {
        if (!inviteOwnerNow) {
          try {
            const { data: existingOwner } = await admin
              .from("venue_staff")
              .select("id")
              .eq("venue_id", row.venue_id)
              .eq("email", invitedOwnerEmail)
              .eq("is_active", true)
              .maybeSingle<{ id: string }>();
            if (!existingOwner) {
              await admin.from("venue_staff").insert({
                venue_id: row.venue_id,
                user_id: null,
                full_name: invitedOwnerName,
                email: invitedOwnerEmail,
                role: "staff",
                is_owner: true,
                is_active: true,
                accepted_at: null,
                invited_at: null,
                invite_token: null,
                access_title: "administrator",
                title_basis: "administrator",
                capability_overrides: {},
                owner_invite_pending: false,
              });
            }
          } catch (recordErr) {
            console.error("[enrollment/activate] record Owner later failed", recordErr);
          }
        }
      }
      if (!purchaserIsOwner && inviteOwnerNow && invitedOwnerEmail && !row.already_activated) {
        try {
          const { data: pendingOwner } = await admin
            .from("venue_staff")
            .select("full_name, email, invite_token")
            .eq("venue_id", row.venue_id)
            .eq("owner_invite_pending", true)
            .eq("is_active", true)
            .maybeSingle<{
              full_name: string;
              email: string | null;
              invite_token: string | null;
            }>();
          if (pendingOwner?.invite_token && pendingOwner.email) {
            const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
            const acceptUrl = `${appUrl}/join?token=${pendingOwner.invite_token}`;
            const venueName = enrollment.venue_name || "your venue";
            const administratorName =
              [enrollment.owner_first_name, enrollment.owner_last_name]
                .filter(Boolean)
                .join(" ")
                .trim() || enrollment.owner_email || "Your Administrator";
            const { sendEmail } = await import("@/lib/email/send");
            const { buildOwnerInviteHtml, buildOwnerInviteText } =
              await import("@/lib/email/team-invite");
            await sendEmail({
              to: pendingOwner.email,
              subject: `You're invited as an Owner of ${venueName} on Hello to Cheers`,
              text: buildOwnerInviteText({
                memberName: pendingOwner.full_name,
                venueName,
                acceptUrl,
                administratorName,
              }),
              html: buildOwnerInviteHtml({
                memberName: pendingOwner.full_name,
                venueName,
                acceptUrl,
                administratorName,
              }),
            });
          }
        } catch (inviteErr) {
          console.error("[enrollment/activate] Owner invite email failed", inviteErr);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      venueId: row.venue_id,
      alreadyActivated: row.already_activated,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error && "message" in error
          ? String((error as { message: unknown }).message)
          : JSON.stringify(error);
    console.error("[enrollment/activate]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
