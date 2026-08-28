/**
 * Shared auth predicate for the venue-app's cron/manual-trigger routes.
 * Mirrors workspace/lib/cron-auth.ts's contract exactly: when the relevant
 * secret is set, require an exact match; when it's unset, allow only
 * outside production. This is the one place that decides "missing secret"
 * behavior for every route below, replacing what used to be six near-
 * identical inline copies (five of which defaulted to always-open).
 */
import { NextResponse } from "next/server";

export function isCronAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export function cronUnauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * Same contract as isCronAuthorized, parameterized for the manual-trigger
 * routes' per-route header/env var pairs (x-notifications-secret /
 * NOTIFICATIONS_SECRET, x-automation-secret / AUTOMATION_SECRET, etc.).
 */
export function isManualSecretAuthorized(request: Request, headerName: string, envVarName: string): boolean {
  const secret = process.env[envVarName]?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get(headerName) === secret;
}
