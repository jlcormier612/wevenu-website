import { NextResponse } from "next/server";

import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { resolveUserIdForEmail } from "@/lib/legal/service";

export const runtime = "nodejs";

/**
 * Internal Relationship Workspace (workspace/) → product account activation.
 *
 * Auth: Bearer PRODUCT_SYNC_API_KEY
 *
 * Replaces the previous local-file "simulated" credential recording
 * (workspace/app/activate/actions.ts's recordOwnerActivationCredential).
 * Creates the real, loggable-into product account:
 *
 *   1. Look up the enrollment by activation token.
 *   2. Get-or-create the auth.users row for the owner's email — reuses
 *      resolveUserIdForEmail, the same helper the legal-acceptance step
 *      (which runs immediately before this call, per the existing
 *      activation flow) already uses to create a passwordless auth.users
 *      row for the FK. That row is expected to already exist by the time
 *      this runs; this call is what actually gives it a real, usable
 *      password.
 *   3. Set the real password via the Admin API (never touches product
 *      tables — auth.users remains the only place a credential lives).
 *   4. Call the atomic activate_venue_enrollment() Postgres function,
 *      which creates the venues row, upserts the owner venue_staff row,
 *      and marks the enrollment activated in one transaction. Idempotent
 *      on retry (already-activated returns the existing venueId and
 *      repairs a missing owner staff row).
 *
 * Body: { token, password }
 */
type ActivateBody = {
  token?: string;
  password?: string;
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
  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "password must be at least 8 characters" }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    const { data: enrollment, error: lookupErr } = await admin
      .from("venue_enrollments")
      .select("id, owner_email, status, venue_id")
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
      })
      .single();
    if (activateErr) {
      if (activateErr.message.toLowerCase().includes("invalid_or_expired_token")) {
        return NextResponse.json({ ok: false, error: "invalid_or_expired_token" }, { status: 404 });
      }
      if (activateErr.message.toLowerCase().includes("token_expired")) {
        return NextResponse.json({ ok: false, error: "token_expired" }, { status: 410 });
      }
      throw activateErr;
    }

    const row = result as { venue_id: string; already_activated: boolean };
    return NextResponse.json({
      ok: true,
      venueId: row.venue_id,
      alreadyActivated: row.already_activated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[enrollment/activate]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
