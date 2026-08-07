/**
 * Workspace → product-app legal acceptance / compliance (service-role via API key).
 */

function productAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_PRODUCT_APP_URL?.trim() ||
    process.env.PRODUCT_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export type LegalComplianceSubject = "venue" | "couple" | "vendor";

export type LegalComplianceStatus =
  | "current"
  | "outdated"
  | "not_accepted";

export type LegalComplianceRow = {
  documentType: string;
  title: string;
  activeVersion: string | null;
  acceptedVersion: string | null;
  acceptedAt: string | null;
  status: LegalComplianceStatus;
};

export type LegalComplianceSummary = {
  subject: LegalComplianceSubject;
  rows: LegalComplianceRow[];
};

export type CompleteVenueActivateLegalInput = {
  email: string;
  relationshipId?: string | null;
  legalAccepted: boolean;
};

/**
 * Read-only legal compliance for a Relationship Workspace venue account.
 * Defaults to subject=venue (Venue Terms + Privacy).
 */
export async function fetchLegalComplianceViaProduct(input: {
  subject?: LegalComplianceSubject;
  relationshipId?: string | null;
  email?: string | null;
}): Promise<LegalComplianceSummary | null> {
  const apiKey = process.env.PRODUCT_SYNC_API_KEY?.trim();
  if (!apiKey) {
    console.warn(
      "[legal] PRODUCT_SYNC_API_KEY not set — skipping compliance fetch",
    );
    return null;
  }

  const params = new URLSearchParams();
  params.set("subject", input.subject ?? "venue");
  if (input.relationshipId?.trim()) {
    params.set("relationshipId", input.relationshipId.trim());
  }
  if (input.email?.trim()) {
    params.set("email", input.email.trim().toLowerCase());
  }

  if (!params.has("relationshipId") && !params.has("email")) {
    return null;
  }

  try {
    const res = await fetch(
      `${productAppUrl()}/api/internal/legal/compliance?${params.toString()}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: "no-store",
      },
    );
    if (!res.ok) {
      console.error(
        "[legal] compliance API error",
        res.status,
        await res.text().catch(() => ""),
      );
      return null;
    }
    const data = (await res.json()) as {
      ok?: boolean;
      subject?: LegalComplianceSubject;
      rows?: LegalComplianceRow[];
      error?: string;
    };
    if (!data.ok || !Array.isArray(data.rows)) return null;
    return {
      subject: data.subject ?? input.subject ?? "venue",
      rows: data.rows,
    };
  } catch (error) {
    console.error("[legal] compliance fetch error", error);
    return null;
  }
}

/**
 * Insert legal_acceptances for Venue ToS + Privacy (service-role via product API).
 */
export async function completeVenueActivateLegalViaProduct(
  input: CompleteVenueActivateLegalInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const apiKey = process.env.PRODUCT_SYNC_API_KEY?.trim();
  if (!apiKey) {
    console.warn(
      "[legal] PRODUCT_SYNC_API_KEY not set — skipping activate legal write",
    );
    return { ok: true };
  }

  try {
    const res = await fetch(
      `${productAppUrl()}/api/internal/legal/venue-activate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          email: input.email,
          relationshipId: input.relationshipId ?? null,
          legalAccepted: input.legalAccepted,
        }),
      },
    );
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      return {
        ok: false,
        message:
          data?.error ??
          "Unable to record legal acceptance. Please try again.",
      };
    }
    return { ok: true };
  } catch (error) {
    console.error("[legal] venue activate legal API error", error);
    return {
      ok: false,
      message: "Unable to record legal acceptance. Please try again.",
    };
  }
}
