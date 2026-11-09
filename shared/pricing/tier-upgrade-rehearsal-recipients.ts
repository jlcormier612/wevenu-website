/**
 * Fixture-only notice recipient allowlist for Phase 3 rehearsal.
 * Never send upgrade notices outside this allowlist while global notice is OFF.
 */

const DEFAULT_INTERNAL_INBOXES = [
  "jennifer@hellotocheers.com",
  "ops+phase3-rehearsal@hellotocheers.com",
];

export function rehearsalNoticeAllowlist(): string[] {
  const fromEnv = (process.env.TIER_UPGRADE_REHEARSAL_NOTICE_TO || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : DEFAULT_INTERNAL_INBOXES;
}

export function assertRehearsalNoticeRecipient(email: string): {
  ok: true;
  email: string;
} | { ok: false; reason: string } {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return { ok: false, reason: "Billing contact email is empty." };
  }
  const allow = rehearsalNoticeAllowlist();
  if (!allow.includes(normalized)) {
    return {
      ok: false,
      reason: `Recipient ${normalized} is not in the Phase 3 rehearsal notice allowlist.`,
    };
  }
  return { ok: true, email: normalized };
}
