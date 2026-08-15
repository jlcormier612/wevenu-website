import { NextResponse } from "next/server";

import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Deployment health check — deliberately deeper than "the process is up."
 *
 * ECS's own target-group health check and the Sandbox deploy workflow's
 * ALB curl checks only prove a container is running and serving HTTP; a
 * container with completely broken Supabase credentials (wrong URL, wrong
 * service-role key, project not migrated) still returns 200 on /login,
 * since that page's own render doesn't require a successful query.
 *
 * This route runs one real, cheap, read-only query using the exact
 * runtime credentials (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 * the container was actually given, via the service-role admin client -
 * the same one every real server action depends on. No request body, no
 * auth required (this must be reachable from the deploy workflow's own
 * unauthenticated curl check), no data returned - only a boolean per
 * check and a generic error class, never the underlying error message,
 * so this endpoint can't be used to fingerprint internal failures.
 */
export async function GET() {
  const checks: Record<string, "ok" | "error" | "skipped"> = {
    env: "skipped",
    supabase: "skipped",
  };

  if (!isSupabaseConfigured) {
    checks.env = "error";
    return NextResponse.json({ ok: false, checks }, { status: 503 });
  }
  checks.env = "ok";

  try {
    const admin = createAdminClient();
    // legal_documents, not lead_sources: confirmed via this repo's own grants
    // table that service_role has full SELECT here, unlike ~115 other public
    // tables where only anon/authenticated were ever granted SELECT (a real,
    // separate, much larger finding - see the Sandbox infra report, not
    // silently fixed here).
    const { error } = await admin.from("legal_documents").select("document_type").limit(1);
    if (error) throw error;
    checks.supabase = "ok";
  } catch (error) {
    checks.supabase = "error";
    console.error("[health] supabase check failed", error);
    return NextResponse.json({ ok: false, checks }, { status: 503 });
  }

  return NextResponse.json({ ok: true, checks }, { status: 200 });
}
