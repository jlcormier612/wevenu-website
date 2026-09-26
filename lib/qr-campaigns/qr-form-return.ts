/**
 * Safe round-trip between QR campaign creation and the Public Form editor.
 * Keeps the selected public_form_id (and optional draft name) across navigation.
 */

export type QrCreateReturnState = {
  openCreate: boolean;
  destinationType: "public_form" | null;
  publicFormId: string | null;
  name: string | null;
};

const QR_CAMPAIGNS_PATH = "/library/qr-campaigns";

function isSafeInternalPath(raw: string): boolean {
  if (!raw.startsWith("/") || raw.startsWith("//")) return false;
  if (raw.includes("\\") || raw.includes("://")) return false;
  return true;
}

/** Only allow return into the QR campaigns page (with query). */
export function safeQrCampaignsReturnTo(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!isSafeInternalPath(trimmed)) return null;
  try {
    const url = new URL(trimmed, "http://local.test");
    if (url.pathname !== QR_CAMPAIGNS_PATH) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

/** Build a returnTo URL that reopens QR create with the chosen public form. */
export function buildQrCreateReturnPath(input: {
  publicFormId?: string | null;
  name?: string | null;
}): string {
  const params = new URLSearchParams();
  params.set("new", "1");
  params.set("destination", "public_form");
  if (input.publicFormId?.trim()) params.set("publicFormId", input.publicFormId.trim());
  if (input.name?.trim()) params.set("name", input.name.trim());
  return `${QR_CAMPAIGNS_PATH}?${params.toString()}`;
}

/** Parse QR create state from /library/qr-campaigns search params. */
export function parseQrCreateSearchParams(
  sp: Record<string, string | string[] | undefined> | URLSearchParams,
): QrCreateReturnState {
  const get = (key: string): string | null => {
    if (sp instanceof URLSearchParams) {
      const v = sp.get(key);
      return v && v.trim() ? v.trim() : null;
    }
    const raw = sp[key];
    const v = Array.isArray(raw) ? raw[0] : raw;
    return v && v.trim() ? v.trim() : null;
  };

  const openCreate = get("new") === "1" || Boolean(get("publicFormId"));
  const destination = get("destination");
  const publicFormId = get("publicFormId");
  return {
    openCreate,
    destinationType: destination === "public_form" || publicFormId ? "public_form" : null,
    publicFormId,
    name: get("name"),
  };
}

/**
 * Stamp the edited form id onto an existing QR-create returnTo while preserving
 * other intentional create state (campaign name). Used when entering or leaving
 * the Public Form editor from QR creation so the draft name survives the round trip.
 */
export function stampQrCreateReturnWithPublicFormId(
  returnTo: string | null | undefined,
  publicFormId: string,
): string | null {
  const safe = safeQrCampaignsReturnTo(returnTo);
  if (!safe) return null;
  const state = parseQrCreateSearchParams(new URL(safe, "http://local.test").searchParams);
  return buildQrCreateReturnPath({
    publicFormId,
    name: state.name,
  });
}

/** Editor/list returnTo that is either QR create or a generic public-forms path. */
export function safePublicFormEditorReturnTo(raw: string | null | undefined): string | null {
  const qr = safeQrCampaignsReturnTo(raw);
  if (qr) return qr;
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!isSafeInternalPath(trimmed)) return null;
  try {
    const url = new URL(trimmed, "http://local.test");
    if (url.pathname !== "/library/public-forms" && !url.pathname.startsWith("/library/public-forms/")) {
      return null;
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}
