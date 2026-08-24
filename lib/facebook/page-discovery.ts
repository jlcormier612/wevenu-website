/**
 * Discover Facebook Pages granted to a connected token.
 *
 * User-access tokens: GET /me/accounts.
 * Business Login for Business system-user tokens: pages are delegated as
 * granular scopes at authorization time — /me/accounts is often empty even
 * when Pages were selected in Meta's dialog.
 */
import {
  FACEBOOK_TOKEN_URL,
  facebookGraphApiBaseUrl,
  facebookUsesLoginForBusiness,
} from "@/lib/facebook/config";

export type GraphPageAccount = { id: string; name: string; accessToken: string };

type GraphList<T> = { data?: T[]; error?: { message?: string; code?: number } };

function logPageDiscovery(step: string, detail: Record<string, unknown>): void {
  console.error("[facebook page-discovery]", step, JSON.stringify(detail));
}

async function graphGet<T>(
  path: string,
  accessToken: string,
): Promise<{ ok: true; body: T } | { ok: false; message: string; status: number }> {
  const separator = path.includes("?") ? "&" : "?";
  const url = `${facebookGraphApiBaseUrl()}${path}${separator}access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url);
  const body = await res.json().catch(() => null) as (T & { error?: { message?: string } }) | null;
  if (!res.ok || body?.error) {
    return {
      ok: false,
      message: body?.error?.message ?? `Facebook API error ${res.status}`,
      status: res.status,
    };
  }
  return { ok: true, body: body as T };
}

async function fetchAppAccessToken(): Promise<string | null> {
  const appId = process.env.FACEBOOK_APP_ID?.trim();
  const appSecret = process.env.FACEBOOK_APP_SECRET?.trim();
  if (!appId || !appSecret) return null;
  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: "client_credentials",
  });
  const res = await fetch(`${FACEBOOK_TOKEN_URL}?${params}`);
  const data = await res.json().catch(() => null) as { access_token?: string } | null;
  return data?.access_token ?? null;
}

/** Extract Page IDs Meta delegated via Business Login granular scopes. */
export function pageIdsFromGranularScopes(
  granularScopes: { scope?: string; target_ids?: (string | number)[] }[] | undefined,
): string[] {
  const ids = new Set<string>();
  for (const entry of granularScopes ?? []) {
    const scope = String(entry.scope ?? "");
    if (
      !scope.startsWith("pages_") &&
      scope !== "leads_retrieval" &&
      scope !== "pages_manage_ads"
    ) {
      continue;
    }
    for (const id of entry.target_ids ?? []) ids.add(String(id));
  }
  return [...ids];
}

async function fetchPagesFromGranularScopes(accessToken: string): Promise<GraphPageAccount[]> {
  const appToken = await fetchAppAccessToken();
  if (!appToken) return [];

  const url =
    `${facebookGraphApiBaseUrl()}/debug_token` +
    `?input_token=${encodeURIComponent(accessToken)}` +
    `&access_token=${encodeURIComponent(appToken)}`;
  const res = await fetch(url);
  const body = await res.json().catch(() => null) as {
    data?: {
      type?: string;
      scopes?: string[];
      granular_scopes?: { scope?: string; target_ids?: (string | number)[] }[];
    };
    error?: { message?: string };
  } | null;

  if (!res.ok || body?.error || !body?.data) {
    logPageDiscovery("debug_token_error", {
      message: body?.error?.message ?? `HTTP ${res.status}`,
    });
    return [];
  }

  logPageDiscovery("debug_token", {
    type: body.data.type,
    scopes: body.data.scopes,
    granularScopeCount: body.data.granular_scopes?.length ?? 0,
  });

  const pageIds = pageIdsFromGranularScopes(body.data.granular_scopes);
  if (pageIds.length === 0) return [];

  const accounts: GraphPageAccount[] = [];
  for (const pageId of pageIds) {
    const page = await graphGet<{ id?: string; name?: string }>(
      `/${pageId}?fields=id,name`,
      accessToken,
    );
    if (page.ok && page.body.id && page.body.name) {
      // Business-scoped system user tokens act on delegated Page assets directly.
      accounts.push({ id: page.body.id, name: page.body.name, accessToken });
    }
  }
  return accounts;
}

export async function fetchManagedPages(
  accessToken: string,
): Promise<{ ok: true; accounts: GraphPageAccount[] } | { ok: false; message: string }> {
  const accountsResult = await graphGet<GraphList<{ id: string; name: string; access_token: string }>>(
    "/me/accounts?fields=id,name,access_token",
    accessToken,
  );

  if (accountsResult.ok) {
    const rows = accountsResult.body.data ?? [];
    logPageDiscovery("me/accounts", { count: rows.length });
    if (rows.length > 0) {
      return {
        ok: true,
        accounts: rows.map((p) => ({ id: p.id, name: p.name, accessToken: p.access_token })),
      };
    }
  } else {
    logPageDiscovery("me/accounts_error", {
      message: accountsResult.message,
      status: accountsResult.status,
    });
  }

  if (!facebookUsesLoginForBusiness()) {
    if (accountsResult.ok) return { ok: true, accounts: [] };
    return { ok: false, message: accountsResult.message };
  }

  const granularPages = await fetchPagesFromGranularScopes(accessToken);
  if (granularPages.length > 0) {
    logPageDiscovery("granular_scopes_pages", {
      count: granularPages.length,
      pageIds: granularPages.map((p) => p.id),
    });
    return { ok: true, accounts: granularPages };
  }

  const meResult = await graphGet<{ id?: string }>("/me?fields=id", accessToken);
  if (meResult.ok && meResult.body.id) {
    const assigned = await graphGet<GraphList<{ id: string; name: string; access_token?: string }>>(
      `/${meResult.body.id}/assigned_pages?fields=id,name,access_token`,
      accessToken,
    );
    if (assigned.ok) {
      const rows = assigned.body.data ?? [];
      logPageDiscovery("assigned_pages", { count: rows.length, subjectId: meResult.body.id });
      if (rows.length > 0) {
        return {
          ok: true,
          accounts: rows.map((p) => ({
            id: p.id,
            name: p.name,
            accessToken: p.access_token ?? accessToken,
          })),
        };
      }
    } else {
      logPageDiscovery("assigned_pages_error", { message: assigned.message });
    }
  }

  logPageDiscovery("no_pages", { businessLogin: true });

  return {
    ok: false,
    message:
      "No Facebook Pages were returned for this connection. Disconnect and reconnect Facebook, then select at least one Page in Meta's authorization dialog.",
  };
}
