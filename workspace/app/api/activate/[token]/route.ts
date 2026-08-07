import { NextResponse } from "next/server";

import { completeAccountActivation, lookupActivationToken } from "@shared/relationships";
import { recordOwnerActivationCredential } from "@shared/product-sync";

import { completeVenueActivateLegalViaProduct } from "@/lib/legal/product-legal";
import { hashPassword } from "@/lib/program4/password";

function productLoginUrl(): string {
  const base = (
    process.env.NEXT_PUBLIC_PRODUCT_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
  return `${base}/login`;
}

/**
 * Public activation API — token lookup (GET) and password submit (POST).
 * Server-side Relationship store only; no filesystem paths returned to client.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token: raw } = await context.params;
  const token = decodeURIComponent(raw || "").trim();
  const lookup = await lookupActivationToken(token);

  if (!lookup.ok) {
    return NextResponse.json(
      { ok: false, reason: lookup.reason, message: lookup.message },
      { status: lookup.reason === "not_found" ? 404 : 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    email: lookup.relationship.owner.email,
    venueName: lookup.relationship.venue.name,
    firstName: lookup.relationship.owner.firstName,
    relationshipId: lookup.relationship.id,
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token: raw } = await context.params;
  const token = decodeURIComponent(raw || "").trim();

  let body: {
    password?: string;
    confirm?: string;
    legalAccepted?: unknown;
  } = {};
  try {
    body = (await request.json()) as {
      password?: string;
      confirm?: string;
      legalAccepted?: unknown;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const password = String(body.password || "");
  const confirm = String(body.confirm || "");
  const legalAccepted =
    body.legalAccepted === true ||
    body.legalAccepted === "true" ||
    body.legalAccepted === 1 ||
    body.legalAccepted === "1";

  if (!legalAccepted) {
    return NextResponse.json(
      {
        error:
          "Please agree to the Terms of Service and Privacy Policy to continue.",
      },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }
  if (password !== confirm) {
    return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
  }

  const lookup = await lookupActivationToken(token);
  if (!lookup.ok) {
    return NextResponse.json(
      { error: lookup.message, reason: lookup.reason },
      { status: lookup.reason === "not_found" ? 404 : 400 },
    );
  }

  const email = lookup.relationship.owner.email?.trim() || "";
  if (email) {
    const legal = await completeVenueActivateLegalViaProduct({
      email,
      relationshipId: lookup.relationship.id,
      legalAccepted: true,
    });
    if (!legal.ok) {
      return NextResponse.json({ error: legal.message }, { status: 400 });
    }
  }

  const result = await completeAccountActivation({ token });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.message, reason: result.reason },
      { status: result.reason === "not_found" ? 404 : 400 },
    );
  }

  try {
    await recordOwnerActivationCredential({
      relationshipId: result.relationship.id,
      email: result.relationship.owner.email,
      passwordHash: hashPassword(password),
      ownerAccountId: result.relationship.productSync?.ownerAccountId,
    });
  } catch (error) {
    console.error("[activate:api] failed to record local owner credential", error);
  }

  return NextResponse.json({
    ok: true,
    loginUrl: `${productLoginUrl()}?activated=1`,
    venueName: result.relationship.venue.name,
  });
}
