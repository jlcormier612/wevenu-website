/**
 * QuickBooks application service. Server-only.
 *
 * Mirrors lib/venue/service.ts's connectStripeAccount()/
 * disconnectStripeAccount() pattern: venue is always resolved from the
 * authenticated session (getCurrentVenue()), never from a client-supplied
 * ID — the OAuth `state` param is only used for CSRF verification in the
 * callback route, never trusted for the actual write.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";
import * as repo from "@/lib/quickbooks/repository";
import { quickBooksApiBaseUrl, quickBooksEnvironment, QUICKBOOKS_REVOKE_URL } from "@/lib/quickbooks/config";
import { processQuickBooksSyncQueue } from "@/lib/quickbooks/processor";
import type { QuickBooksActionResult, QuickBooksConnection, QuickBooksEntityType } from "@/lib/quickbooks/types";

function basicAuthHeader(): string {
  const id = process.env.QUICKBOOKS_CLIENT_ID ?? "";
  const secret = process.env.QUICKBOOKS_CLIENT_SECRET ?? "";
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

export async function getQuickBooksConnection(): Promise<QuickBooksConnection | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getConnection(await createClient(), venue.id);
}

export type QuickBooksSyncLogEntry = {
  id: string; entityType: string; entityId: string;
  outcome: "succeeded" | "failed" | "dead_lettered"; attemptNumber: number;
  quickbooksId: string | null; message: string | null; createdAt: string;
};

export async function getRecentQuickBooksSyncLog(): Promise<QuickBooksSyncLogEntry[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const rows = await repo.getRecentSyncLog(await createClient(), venue.id);
  return rows.map((r) => ({
    id: r.id, entityType: r.entity_type, entityId: r.entity_id,
    outcome: r.outcome, attemptNumber: r.attempt_number,
    quickbooksId: r.quickbooks_id, message: r.message, createdAt: r.created_at,
  }));
}

/**
 * Called from the OAuth callback route after a successful token exchange.
 * Persists the connection, then makes one real CompanyInfo call to confirm
 * the token actually works end-to-end and capture the company name for
 * display — a one-time connect-time verification, not a recurring poll
 * (see lib/quickbooks/health.ts for why health otherwise rides on the
 * sync processor's own real activity instead of a separate health-check
 * cron).
 */
export async function connectQuickBooksAccount(input: {
  realmId: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
}): Promise<QuickBooksActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "Session expired." };

  const now = Date.now();
  const supabase = await createClient();
  await repo.upsertConnection(supabase, venue.id, {
    realmId: input.realmId,
    accessToken: input.accessToken,
    accessTokenExpiresAt: new Date(now + input.accessTokenExpiresIn * 1000).toISOString(),
    refreshToken: input.refreshToken,
    refreshTokenExpiresAt: new Date(now + input.refreshTokenExpiresIn * 1000).toISOString(),
    environment: quickBooksEnvironment(),
  });

  // One-time verification, not a recurring poll — confirms the token works
  // and captures the company name for the Settings badge.
  try {
    const infoRes = await fetch(
      `${quickBooksApiBaseUrl()}/v3/company/${input.realmId}/companyinfo/${input.realmId}`,
      { headers: { Authorization: `Bearer ${input.accessToken}`, Accept: "application/json" } },
    );
    if (infoRes.ok) {
      const info = await infoRes.json() as { CompanyInfo?: { CompanyName?: string } };
      await supabase.from("quickbooks_connections")
        .update({ company_name: info.CompanyInfo?.CompanyName ?? null })
        .eq("venue_id", venue.id);
    }
  } catch {
    // Connection is still saved even if this one-time verification call
    // fails for an unrelated transient reason — the sync processor will
    // surface a real error on its first real push if the token is
    // genuinely bad, per lib/quickbooks/health.ts's design.
  }

  return { ok: true };
}

/**
 * Calls Intuit's own revoke endpoint before clearing local state — a
 * genuine improvement over Stripe Connect's disconnect in this codebase,
 * which never calls Stripe's revoke endpoint. On revoke failure, local
 * state is still cleared (never leave a venue stuck "connected" locally
 * to a revoke call that failed for an unrelated reason).
 */
export async function disconnectQuickBooksAccount(): Promise<QuickBooksActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "Session expired." };

  const supabase = await createClient();
  const connection = await repo.getConnectionWithTokens(supabase, venue.id);

  if (connection) {
    try {
      await fetch(QUICKBOOKS_REVOKE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: basicAuthHeader(),
        },
        body: JSON.stringify({ token: connection.refreshToken }),
      });
    } catch {
      // Revoke is best-effort — local disconnect proceeds regardless, see
      // docstring above.
    }
  }

  await repo.disconnectConnection(supabase, venue.id);
  return { ok: true };
}

/**
 * Manual "Retry now" (docs/quickbooks-online-architecture.md §7) — the one
 * piece of the fuller architecture explicitly deferred at launch, now
 * built so the Financial Validation checklist's "manual re-sync" step is
 * actually executable. Resets the entity's queue item to a fresh pending
 * state, resets the record's own status so the UI reflects "retrying"
 * immediately, then runs the processor right away rather than making the
 * coordinator wait for the next 5-minute cron tick.
 */
export async function retryQuickBooksSync(entityType: QuickBooksEntityType, entityId: string): Promise<QuickBooksActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "Session expired." };

  const supabase = await createClient();
  const reset = await repo.resetQueueItemForRetry(supabase, entityType, entityId);
  if (!reset) return { ok: false, message: "No sync attempt found to retry." };

  const table = entityType === "customer" ? "clients" : entityType === "invoice" ? "invoices" : "payment_line_items";
  await supabase.from(table).update({ quickbooks_sync_status: "pending" }).eq("id", entityId);

  await processQuickBooksSyncQueue();
  return { ok: true };
}
