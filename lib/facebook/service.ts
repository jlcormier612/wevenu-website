/**
 * Facebook application service. Server-only. Venue always resolved from
 * the authenticated session (getCurrentVenue()) — the OAuth `state` param
 * is only ever used for CSRF verification in the callback, same
 * convention as lib/quickbooks/service.ts.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";
import * as repo from "@/lib/facebook/repository";
import { facebookGraphApiBaseUrl } from "@/lib/facebook/config";
import { fetchManagedPages } from "@/lib/facebook/page-discovery";
import {
  resolveOwnedPage,
  shouldUnsubscribePage,
  shouldUnsubscribePreviousPage,
  subscribePageToLeadgen,
  unsubscribePageFromLeadgen,
} from "@/lib/facebook/page-subscription";
import type { FacebookActionResult, FacebookConnection, FacebookLeadForm, FacebookLeadLogEntry } from "@/lib/facebook/types";

export async function getFacebookConnection(): Promise<FacebookConnection | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const connection = await repo.getConnection(await createClient(), venue.id);
  if (!connection || connection.status === "disconnected") return null;
  return connection;
}

export async function getFacebookLeadForms(): Promise<FacebookLeadForm[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getLeadForms(await createClient(), venue.id);
}

export async function getRecentFacebookLog(): Promise<FacebookLeadLogEntry[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getRecentLog(await createClient(), venue.id);
}

export async function connectFacebookAccount(input: { userAccessToken: string; expiresIn: number }): Promise<FacebookActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "Session expired." };
  const supabase = await createClient();
  await repo.upsertConnection(supabase, venue.id, {
    userAccessToken: input.userAccessToken,
    userTokenExpiresAt: new Date(Date.now() + input.expiresIn * 1000).toISOString(),
  });
  return { ok: true };
}

/** Step 1 of the picker (docs/facebook-lead-ads-architecture.md §3) — fetch every Page the authorizing user manages. */
export async function listFacebookPages(): Promise<{ ok: true; pages: { id: string; name: string }[] } | { ok: false; message: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "Session expired." };
  const supabase = await createClient();
  const connection = await repo.getConnectionWithTokens(supabase, venue.id);
  if (!connection) return { ok: false, message: "Not connected to Facebook." };

  const pages = await fetchManagedPages(connection.userAccessToken);
  if (!pages.ok) return pages;
  return { ok: true, pages: pages.accounts.map((p) => ({ id: p.id, name: p.name })) };
}

/**
 * Step 1 confirm — subscribe the Page to leadgen webhooks, then persist
 * it as connected. Connection is not "active" until Meta accepts the
 * Page subscription; storing the Page token alone does not deliver leads.
 *
 * Page identity is resolved server-side from /me/accounts. The browser
 * only sends pageId — never a Page access token.
 */
export async function selectFacebookPage(input: { pageId: string }): Promise<FacebookActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "Session expired." };
  const supabase = await createClient();
  const connection = await repo.getConnectionWithTokens(supabase, venue.id);
  if (!connection) return { ok: false, message: "Not connected to Facebook." };

  const pages = await fetchManagedPages(connection.userAccessToken);
  if (!pages.ok) return pages;
  const owned = resolveOwnedPage(pages.accounts, input.pageId);
  if (!owned.ok) return owned;

  const subscribed = await subscribePageToLeadgen(owned.page.id, owned.page.accessToken);
  if (!subscribed.ok) {
    await repo.recordLastError(supabase, venue.id, subscribed.error);
    return {
      ok: false,
      message: `${subscribed.error} Lead Ads are not active until this Page is subscribed.`,
    };
  }

  const previousPageId = connection.pageId;
  const previousPageToken = connection.pageAccessToken;
  await repo.setSelectedPage(supabase, venue.id, {
    pageId: owned.page.id,
    pageName: owned.page.name,
    pageAccessToken: owned.page.accessToken,
  });

  if (shouldUnsubscribePreviousPage(previousPageId, owned.page.id) && previousPageId && previousPageToken) {
    const remaining = await repo.countConnectedVenuesForPage(createAdminClient(), previousPageId);
    if (shouldUnsubscribePage(remaining)) {
      await unsubscribePageFromLeadgen(previousPageId, previousPageToken).catch(() => undefined);
    }
  }

  return { ok: true };
}

/**
 * Step 2 of the picker — every Lead Ads form on the already-selected
 * Page. Reads the Page access token server-side (from the connection
 * record set by selectFacebookPage above) rather than accepting one as a
 * parameter — it never needs to leave the server at all.
 */
export async function listFacebookLeadForms(): Promise<{ ok: true; forms: { id: string; name: string }[] } | { ok: false; message: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "Session expired." };
  const supabase = await createClient();
  const connection = await repo.getConnectionWithTokens(supabase, venue.id);
  if (!connection?.pageId || !connection.pageAccessToken) return { ok: false, message: "Select a Page first." };

  const res = await fetch(`${facebookGraphApiBaseUrl()}/${connection.pageId}/leadgen_forms?access_token=${encodeURIComponent(connection.pageAccessToken)}`);
  const data = await res.json().catch(() => null) as { data?: { id: string; name: string }[]; error?: { message?: string } } | null;
  if (!res.ok || !data?.data) return { ok: false, message: data?.error?.message ?? "Could not fetch Lead Ads forms." };
  return { ok: true, forms: data.data.map((f) => ({ id: f.id, name: f.name })) };
}

/** Step 2 confirm — persist which forms should feed Wevenu. */
export async function selectFacebookLeadForms(forms: { formId: string; formName: string }[]): Promise<FacebookActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "Session expired." };
  const supabase = await createClient();
  const connection = await repo.getConnectionWithTokens(supabase, venue.id);
  if (!connection?.pageId) return { ok: false, message: "Select a Page first." };
  await repo.replaceLeadForms(supabase, venue.id, connection.pageId, forms);
  return { ok: true };
}

export async function setFacebookFormEnabled(formId: string, enabled: boolean): Promise<FacebookActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "Session expired." };
  const supabase = await createClient();
  await repo.setFormEnabled(supabase, venue.id, formId, enabled);
  return { ok: true };
}

/**
 * No token-revocation call the way QuickBooks/Stripe make (Meta's
 * DELETE /me/permissions revokes the *app's* access for the user across
 * every venue that authorized it through the same Facebook user account,
 * not a single venue's connection — calling it here would be too broad a
 * side effect for a single-venue "Disconnect" button). Local state is
 * still always cleared regardless.
 */
export async function disconnectFacebookAccount(): Promise<FacebookActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "Session expired." };
  const supabase = await createClient();
  const connection = await repo.getConnectionWithTokens(supabase, venue.id);
  const pageId = connection?.pageId ?? null;
  const pageAccessToken = connection?.pageAccessToken ?? null;

  // Admin client: delete must succeed even if session RLS is flaky mid-disconnect.
  await repo.disconnectConnection(createAdminClient(), venue.id);

  if (pageId && pageAccessToken) {
    const remaining = await repo.countConnectedVenuesForPage(createAdminClient(), pageId);
    if (shouldUnsubscribePage(remaining)) {
      await unsubscribePageFromLeadgen(pageId, pageAccessToken).catch(() => undefined);
    }
  }
  return { ok: true };
}
