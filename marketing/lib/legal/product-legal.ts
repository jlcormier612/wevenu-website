/**
 * Fetch active Venue ToS + Privacy document ids from the product app.
 */

function productAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_PRODUCT_APP_URL?.trim() ||
    process.env.PRODUCT_API_BASE_URL?.trim() ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export async function fetchActiveVenueLegalDocuments(): Promise<{
  venueTermsOfServiceId: string | null;
  privacyPolicyId: string | null;
} | null> {
  try {
    const res = await fetch(
      `${productAppUrl()}/api/legal/active?types=venue_terms_of_service,privacy_policy`,
      { method: "GET", cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      documents?: Array<{ id: string; documentType: string }>;
    };
    const docs = data.documents ?? [];
    return {
      venueTermsOfServiceId:
        docs.find((d) => d.documentType === "venue_terms_of_service")?.id ??
        null,
      privacyPolicyId:
        docs.find((d) => d.documentType === "privacy_policy")?.id ?? null,
    };
  } catch {
    return null;
  }
}
