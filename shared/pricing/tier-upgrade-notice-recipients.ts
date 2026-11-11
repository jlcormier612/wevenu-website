/**
 * Phase 3 notice recipient safety.
 *
 * Sandbox population notices always redirect to an approved internal inbox.
 * Fixture-only rehearsal (global SEND_NOTICE off) uses the rehearsal allowlist.
 */

const DEFAULT_INTERNAL_INBOXES = [
  "jennifer@hellotocheers.com",
  "ops+phase3-rehearsal@hellotocheers.com",
];

export function approvedInternalNoticeInboxes(): string[] {
  const fromEnv = (
    process.env.TIER_UPGRADE_NOTICE_REDIRECT_TO ||
    process.env.TIER_UPGRADE_REHEARSAL_NOTICE_TO ||
    ""
  )
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : DEFAULT_INTERNAL_INBOXES;
}

/** @deprecated Prefer approvedInternalNoticeInboxes — kept for rehearsal callers. */
export function rehearsalNoticeAllowlist(): string[] {
  return approvedInternalNoticeInboxes();
}

export function assertRehearsalNoticeRecipient(email: string):
  | { ok: true; email: string }
  | { ok: false; reason: string } {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return { ok: false, reason: "Billing contact email is empty." };
  }
  const allow = approvedInternalNoticeInboxes();
  if (!allow.includes(normalized)) {
    return {
      ok: false,
      reason: `Recipient ${normalized} is not in the Phase 3 rehearsal notice allowlist.`,
    };
  }
  return { ok: true, email: normalized };
}

/**
 * Resolve the address that will actually receive the upgrade notice.
 *
 * When forceInternalRedirect is true (Sandbox population with SEND_NOTICE on),
 * always deliver to the first approved internal inbox — never the Stripe
 * billing contact, including @example.com test addresses.
 *
 * Opt-out (not used in Sandbox): TIER_UPGRADE_NOTICE_ALLOW_BILLING_EMAIL=true
 * sends to the billing contact only if that contact is already on the
 * approved internal allowlist.
 */
export function resolveTierUpgradeNoticeRecipient(input: {
  billingEmail: string | null | undefined;
  forceInternalRedirect: boolean;
}):
  | {
      ok: true;
      email: string;
      redirected: boolean;
      originalEmail: string | null;
    }
  | { ok: false; reason: string } {
  const original =
    (input.billingEmail || "").trim().toLowerCase() || null;
  const allowBilling =
    process.env.TIER_UPGRADE_NOTICE_ALLOW_BILLING_EMAIL === "true";

  if (input.forceInternalRedirect && !allowBilling) {
    const inbox = approvedInternalNoticeInboxes()[0];
    return {
      ok: true,
      email: inbox,
      redirected: original !== inbox,
      originalEmail: original,
    };
  }

  if (!original) {
    return { ok: false, reason: "Billing contact email is empty." };
  }

  const allow = approvedInternalNoticeInboxes();
  if (!allow.includes(original)) {
    // Fail closed: never deliver outside the approved inbox set.
    const inbox = allow[0];
    return {
      ok: true,
      email: inbox,
      redirected: true,
      originalEmail: original,
    };
  }
  return {
    ok: true,
    email: original,
    redirected: false,
    originalEmail: original,
  };
}
