/**
 * Facebook application service. Server-only. Venue always resolved from
 * the authenticated session (getCurrentVenue()) — the OAuth `state` param
 * is only ever used for CSRF verification in the callback, same
 * convention as lib/quickbooks/service.ts.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";
import * as repo from "@/lib/facebook/repository";
import { facebookGraphApiBaseUrl } from "@/lib/facebook/config";
import type { FacebookActionResult, FacebookConnection, FacebookLeadForm, FacebookLeadLogEntry } from "@/lib/facebook/types";

export async function getFacebookConnection(): Promise<FacebookConnection | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getConnection(await createClient(), venue.id);
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
export async function listFacebookPages(): Promise<{ ok: true; pages: { id: string; name: string; accessToken: string }[] } | { ok: false; message: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "Session expired." };
  const supabase = await createClient();
  const connection = await repo.getConnectionWithTokens(supabase, venue.id);
  if (!connection) return { ok: false, message: "Not connected to Facebook." };

  const res = await fetch(`${facebookGraphApiBaseUrl()}/me/accounts?access_token=${encodeURIComponent(connection.userAccessToken)}`);
  const data = await res.json().catch(() => null) as { data?: { id: string; name: string; access_token: string }[]; error?: { message?: string } } | null;
  if (!res.ok || !data?.data) return { ok: false, message: data?.error?.message ?? "Could not fetch Facebook Pages." };
  return { ok: true, pages: data.data.map((p) => ({ id: p.id, name: p.name, accessToken: p.access_token })) };
}

/** Step 1 confirm — persist the selected Page (Meta returns a Page-scoped token as part of /me/accounts, no separate exchange needed). */
export async function selectFacebookPage(input: { pageId: string; pageName: string; pageAccessToken: string }): Promise<FacebookActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "Session expired." };
  const supabase = await createClient();
  await repo.setSelectedPage(supabase, venue.id, input);
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
  await repo.disconnectConnection(supabase, venue.id);
  return { ok: true };
}
