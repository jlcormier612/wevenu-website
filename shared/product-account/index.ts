/**
 * Enrollment → real product account bridge.
 *
 * Small, single-purpose client for the two internal endpoints in the
 * product app (app/api/internal/enrollment/*) that make a Stripe SaaS
 * signup result in a real, Postgres-backed venue + owner account.
 *
 * Deliberately separate from @shared/product-sync — that module is the
 * broader, still-stubbed 7-step provisioning pipeline (workspace, website,
 * subscription, onboarding, launch); this module is only the two calls
 * needed to make the venue + owner account itself real. Not a replacement
 * for product-sync, not an expansion of it.
 *
 * Auth: Bearer PRODUCT_SYNC_API_KEY (same shared secret already documented
 * for cross-app calls into the product's internal API — see
 * shared/product-sync/adapters/http.ts).
 *
 * See docs/postgres-auth-architecture-findings.md §6.
 */

export type OnboardingType = "self_setup" | "white_glove";

export type UpsertEnrollmentInput = {
  stripeCheckoutSessionId?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  venueName: string;
  ownerEmail: string;
  /** Subscriber first/last name — never derived by splitting a combined name. */
  ownerFirstName?: string | null;
  ownerLastName?: string | null;
  plan?: string | null;
  onboardingType: OnboardingType;
  /** Absent for white_glove — matches existing behavior (no activation URL). */
  activationToken?: string | null;
};

export type UpsertEnrollmentResult =
  | { ok: true; id: string; status: "pending" | "activated" }
  | { ok: false; error: string };

export type ActivateAccountResult =
  | { ok: true; venueId: string; alreadyActivated: boolean }
  | { ok: false; error: string };

export type EnrollmentLookupResult =
  | {
      ok: true;
      found: true;
      venueName: string;
      onboardingType: OnboardingType;
      status: "pending" | "activated";
      /** Same value the welcome email links to; null for white_glove or once activated. */
      activationToken: string | null;
    }
  | { ok: true; found: false }
  | { ok: false; error: string };

export type TokenLookupResult =
  | { ok: true; found: false }
  | { ok: true; found: true; reason: "already_activated" | "expired" }
  | { ok: true; found: true; reason: "valid"; id: string; venueName: string; ownerEmail: string }
  | { ok: false; error: string };

function baseUrl(): string {
  return (process.env.PRODUCT_API_BASE_URL?.trim() || "http://localhost:3000").replace(/\/$/, "");
}

function apiKey(): string {
  return process.env.PRODUCT_SYNC_API_KEY?.trim() || "";
}

async function postInternal<T>(path: string, body: unknown): Promise<T | { ok: false; error: string }> {
  const key = apiKey();
  if (!key) {
    return { ok: false, error: "PRODUCT_SYNC_API_KEY is not configured." };
  }
  try {
    const res = await fetch(`${baseUrl()}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as T | { error?: string } | null;
    if (!res.ok) {
      const message =
        data && typeof data === "object" && "error" in data && data.error
          ? String(data.error)
          : `${path} responded ${res.status}`;
      return { ok: false, error: message };
    }
    return data as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error";
    return { ok: false, error: message };
  }
}

export async function upsertVenueEnrollment(
  input: UpsertEnrollmentInput,
): Promise<UpsertEnrollmentResult> {
  return postInternal<UpsertEnrollmentResult>("/api/internal/enrollment/upsert", input);
}

export async function activateVenueAccount(input: {
  token: string;
  password: string;
}): Promise<ActivateAccountResult> {
  return postInternal<ActivateAccountResult>("/api/internal/enrollment/activate", input);
}

/** Read-only lookup used by the Stripe Checkout success page — no side effects. */
export async function getEnrollmentBySession(
  stripeCheckoutSessionId: string,
): Promise<EnrollmentLookupResult> {
  return postInternal<EnrollmentLookupResult>("/api/internal/enrollment/by-session", {
    stripeCheckoutSessionId,
  });
}

/** Read-only lookup used by the Activate Account page — no side effects. */
export async function getEnrollmentByActivationToken(
  activationToken: string,
): Promise<TokenLookupResult> {
  return postInternal<TokenLookupResult>("/api/internal/enrollment/by-token", {
    activationToken,
  });
}
