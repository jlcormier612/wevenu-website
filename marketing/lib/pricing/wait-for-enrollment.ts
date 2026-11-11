import type { EnrollmentLookupResult } from "@shared/product-account";

export type WaitForEnrollmentOptions = {
  /** Max lookup attempts including the first immediate call. Default 8. */
  attempts?: number;
  /** Delay between attempts in ms. Default 500. */
  delayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  lookup: (sessionId: string) => Promise<EnrollmentLookupResult>;
};

export type WaitForEnrollmentOutcome =
  | {
      status: "found";
      enrollment: Extract<EnrollmentLookupResult, { ok: true; found: true }>;
      attemptsUsed: number;
    }
  | {
      status: "pending";
      attemptsUsed: number;
    }
  | {
      status: "invalid_session";
      attemptsUsed: number;
    }
  | {
      status: "error";
      error: string;
      attemptsUsed: number;
    };

/**
 * Bounded wait for webhook-driven enrollment after Checkout redirect.
 * Read-only lookups only — never creates enrollments or subscriptions.
 */
export async function waitForEnrollmentBySession(
  sessionId: string | null | undefined,
  options: WaitForEnrollmentOptions,
): Promise<WaitForEnrollmentOutcome> {
  const trimmed = sessionId?.trim() || "";
  if (!trimmed) {
    return { status: "invalid_session", attemptsUsed: 0 };
  }

  const attempts = Math.max(1, options.attempts ?? 8);
  const delayMs = Math.max(0, options.delayMs ?? 500);
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  for (let i = 0; i < attempts; i += 1) {
    if (i > 0 && delayMs > 0) {
      await sleep(delayMs);
    }

    const result = await options.lookup(trimmed);
    if (result.ok && result.found) {
      return {
        status: "found",
        enrollment: result,
        attemptsUsed: i + 1,
      };
    }
    // not found or transient API error — keep retrying within the bound.
  }

  return { status: "pending", attemptsUsed: attempts };
}

export type SuccessPageView =
  | "self_setup_ready"
  | "white_glove_ready"
  | "already_activated"
  | "processing"
  | "missing_session";

export function classifySuccessEnrollment(
  outcome: WaitForEnrollmentOutcome,
): SuccessPageView {
  if (outcome.status === "invalid_session") return "missing_session";
  if (outcome.status !== "found") return "processing";

  const enrollment = outcome.enrollment;
  if (enrollment.status === "activated") return "already_activated";
  if (enrollment.onboardingType === "white_glove") return "white_glove_ready";
  if (enrollment.activationToken) return "self_setup_ready";
  // Enrollment exists but activation token not yet available — keep processing.
  return "processing";
}
