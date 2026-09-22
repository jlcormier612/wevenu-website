import { publicAppOrigin } from "@/lib/env";

/**
 * Public Location for a QR code that must not resolve as active.
 *
 * `resolve_qr_scan` returns `{ ok: false }` for archived campaigns and
 * unknown codes. The browser Location must use `publicAppOrigin()`
 * (`NEXT_PUBLIC_APP_URL`) — never `request.nextUrl.origin` — because
 * behind the ALB that origin is the ECS task hostname
 * (e.g. ip-10-20-1-165.ec2.internal:3000).
 */
export function qrInactiveRedirectUrl(): URL {
  return new URL("/qr/inactive", publicAppOrigin());
}

/** Archived and invalid codes share the same public inactive experience. */
export function qrInactiveRedirectUrlForUnresolvedScan(
  result: { ok: boolean } | null,
): URL | null {
  if (result?.ok) return null;
  return qrInactiveRedirectUrl();
}
