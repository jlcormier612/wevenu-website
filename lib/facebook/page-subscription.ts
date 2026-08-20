/**
 * Meta Page → app leadgen webhook subscription helpers.
 *
 * POST /{page-id}/subscribed_apps?subscribed_fields=leadgen is what actually
 * causes Meta to deliver leadgen webhooks for that Page. OAuth + storing a
 * Page token is not enough.
 *
 * Unsubscribe (DELETE /{page-id}/subscribed_apps) is app-wide for that Page:
 * it stops leadgen delivery to this Facebook app for every venue using the
 * Page. Never unsubscribe while another connected venue still owns it.
 */
import { facebookGraphApiBaseUrl } from "@/lib/facebook/config";

export type GraphPageAccount = {
  id: string;
  name: string;
  accessToken: string;
};

const SUBSCRIBE_FAILURE =
  "Could not subscribe this Page to lead notifications. Re-select the Page to try again, or reconnect Facebook if it keeps failing.";

export function subscribedAppsPath(pageId: string): string {
  return `/${encodeURIComponent(pageId)}/subscribed_apps`;
}

export function resolveOwnedPage(
  accounts: GraphPageAccount[],
  requestedPageId: string,
): { ok: true; page: GraphPageAccount } | { ok: false; message: string } {
  const pageId = requestedPageId.trim();
  if (!pageId) return { ok: false, message: "Select a Facebook Page." };
  const page = accounts.find((a) => a.id === pageId);
  if (!page) {
    return { ok: false, message: "That Page isn't available for this Facebook account." };
  }
  return { ok: true, page };
}

/**
 * Meta's Page/app subscription is per Page for this app — not per venue.
 * After this venue has already released the Page locally, unsubscribe only
 * when zero connected venues still reference it.
 */
export function shouldUnsubscribePage(remainingConnectedVenuesForPage: number): boolean {
  return remainingConnectedVenuesForPage <= 0;
}

export function shouldUnsubscribePreviousPage(previousPageId: string | null, newPageId: string): boolean {
  return Boolean(previousPageId && previousPageId !== newPageId);
}

export function parseSubscribedAppsResult(
  httpOk: boolean,
  body: { success?: boolean; error?: { message?: string } } | null,
): { ok: true } | { ok: false; error: string } {
  if (httpOk && body?.success !== false && !body?.error) return { ok: true };
  return {
    ok: false,
    error: body?.error?.message?.trim() || SUBSCRIBE_FAILURE,
  };
}

type GraphFetch = typeof fetch;

async function graphSubscribedApps(
  method: "POST" | "DELETE",
  pageId: string,
  pageAccessToken: string,
  fetchImpl: GraphFetch,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = new URL(`${facebookGraphApiBaseUrl()}${subscribedAppsPath(pageId)}`);
  url.searchParams.set("access_token", pageAccessToken);
  if (method === "POST") url.searchParams.set("subscribed_fields", "leadgen");

  const response = await fetchImpl(url.toString(), { method });
  const body = (await response.json().catch(() => null)) as {
    success?: boolean;
    error?: { message?: string };
  } | null;
  return parseSubscribedAppsResult(response.ok, body);
}

export async function subscribePageToLeadgen(
  pageId: string,
  pageAccessToken: string,
  fetchImpl: GraphFetch = fetch,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return graphSubscribedApps("POST", pageId, pageAccessToken, fetchImpl);
}

export async function unsubscribePageFromLeadgen(
  pageId: string,
  pageAccessToken: string,
  fetchImpl: GraphFetch = fetch,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return graphSubscribedApps("DELETE", pageId, pageAccessToken, fetchImpl);
}
