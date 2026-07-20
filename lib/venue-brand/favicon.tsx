/**
 * Venue Brand Experience Phase 1 — shared favicon logic for every
 * customer-facing route segment (couple portal, contract page, public
 * wedding site, RSVP, tour-booking, inquiry form, questionnaire). Each
 * segment's own `icon.tsx` calls this instead of duplicating the fetch/
 * fallback logic 7 times.
 *
 * Renders the venue's own logo when set; falls back to a small, neutral,
 * deliberately non-Hello to Cheers-branded mark otherwise — the coordinator's own
 * authenticated app keeps Hello to Cheers' real favicon (app/favicon.ico),
 * untouched by this.
 */
import { ImageResponse } from "next/og";

export const faviconSize = { width: 32, height: 32 };
export const faviconContentType = "image/png";

const FALLBACK_BACKGROUND = "#8C8075"; // a neutral taupe, not Hello to Cheers' own brand color

function fallbackIcon(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex",
          alignItems: "center", justifyContent: "center",
          background: FALLBACK_BACKGROUND, borderRadius: "50%",
        }}
      >
        <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#FFFFFF" }} />
      </div>
    ),
    faviconSize,
  );
}

export async function venueFaviconResponse(logoUrl: string | null | undefined): Promise<Response> {
  if (!logoUrl) return fallbackIcon();
  try {
    const res = await fetch(logoUrl, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return fallbackIcon();
    const buffer = await res.arrayBuffer();
    return new Response(buffer, {
      headers: { "content-type": res.headers.get("content-type") ?? "image/png" },
    });
  } catch {
    return fallbackIcon();
  }
}
