import { NextResponse } from "next/server";

import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { provisionWorkspaceFromEnrollment } from "@/lib/provisioning/workspace";

export const runtime = "nodejs";

/**
 * Internal: provision venue workspace from an enrollment (White Glove
 * post-purchase, or Self-Setup when called explicitly).
 *
 * Auth: Bearer PRODUCT_SYNC_API_KEY
 *
 * Idempotent — safe on Stripe webhook retries.
 *
 * Body: { enrollmentId: string }
 */
type Body = { enrollmentId?: string };

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

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const enrollmentId = body.enrollmentId?.trim();
  if (!enrollmentId) {
    return NextResponse.json({ error: "enrollmentId is required" }, { status: 400 });
  }

  try {
    const result = await provisionWorkspaceFromEnrollment({ enrollmentId });
    if (!result.ok) {
      const status = result.error === "enrollment_not_found" ? 404 : 500;
      return NextResponse.json({ ok: false, error: result.error }, { status });
    }

    // Bind CRM Relationship ↔ product venue (idempotent). Needed so HTC staff
    // can Configure Workspace from CRM without a second identity system.
    try {
      const admin = createAdminClient();
      const { data: enrollMeta } = await admin
        .from("venue_enrollments")
        .select("owner_email, stripe_customer_id, stripe_subscription_id")
        .eq("id", enrollmentId)
        .maybeSingle<{
          owner_email: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
        }>();
      const { bindCrmProductVenueId } = await import("@shared/relationships");
      const bound = await bindCrmProductVenueId({
        productVenueId: result.venueId,
        ownerEmail: enrollMeta?.owner_email,
        stripeCustomerId: enrollMeta?.stripe_customer_id,
        stripeSubscriptionId: enrollMeta?.stripe_subscription_id,
      });
      if (!bound.ok) {
        console.warn("[enrollment/provision] CRM venue bind skipped", bound.reason);
      }
    } catch (bindErr) {
      console.error("[enrollment/provision] CRM venue bind failed", bindErr);
      // Provision succeeded — bind is retryable on next provision/webhook.
    }

    // Surface starter failures for staff alerting without failing the
    // overall provision (venue exists; starters are retryable).
    if (!result.starters.ok) {
      console.error("[enrollment/provision] starter seed partial failure", {
        enrollmentId,
        venueId: result.venueId,
        failed: result.starters.failed,
      });
      try {
        const admin = createAdminClient();
        await admin.from("venue_hq_tasks").insert({
          venue_id: result.venueId,
          title: `Provisioning: starter content incomplete (${result.starters.failed.map((f) => f.key).join(", ")})`,
          kind: "blocker",
        });
      } catch (alertErr) {
        console.error("[enrollment/provision] could not create HQ alert", alertErr);
      }
    }

    return NextResponse.json({
      ok: true,
      venueId: result.venueId,
      alreadyProvisioned: result.alreadyProvisioned,
      intakeToken: result.intakeToken,
      startersOk: result.starters.ok,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[enrollment/provision]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
