/**
 * Classification of internal verification / E2E / release-readiness records.
 *
 * These records remain in the venue CRM so tests can keep using them.
 * Customer-facing Reporting excludes them via `exclude_from_business_reporting`,
 * which is stamped by this classifier (SQL trigger + this module — keep the
 * two in sync).
 *
 * Dashboard Lead Flow / Leads open filter do NOT use this flag — open means
 * non-terminal pipeline reporting category (see lib/leads/open-lifecycle.ts).
 *
 * This is origin classification, not a UI string-hide. Do not use this to
 * guess at real customer names. Real dogfood (e.g. Colby Yagnesak & Nicole)
 * must not match.
 */

export type VerificationIdentity = {
  firstName?: string | null;
  lastName?: string | null;
  partnerFirstName?: string | null;
  partnerLastName?: string | null;
  email?: string | null;
  partnerEmail?: string | null;
  /** Event title or other extra display name. */
  extraName?: string | null;
};

const EMAIL_MARKERS: RegExp[] = [
  /@example\.com$/i,
  /zz-cleanup/i,
  /zz-relprobe/i,
  /zz-fin-probe/i,
  /^patha\./i,
  /^pathb\./i,
  /phase7\./i,
  /commercial-spine/i,
  /e2etest/i,
  /e2eclient/i,
  /e2efullclient/i,
  /e2enoemail/i,
  /closeout\.e2e/i,
  /live\.offer/i,
  /live\.contract/i,
  /htc\.invoice\.smoke/i,
  /portal-e2e/i,
];

const NAME_MARKERS: RegExp[] = [
  /zzcleanup/i,
  /patha\s+live/i,
  /pathb\s+live/i,
  /pathb\s+closeout/i,
  /patha\s+closeout/i,
  /phase\s*7/i,
  /spinee2e/i,
  /spinespace/i,
  /\be2etest/i,
  /\be2eclient/i,
  /\be2efull/i,
  /\be2enoemail/i,
  /\be2e\b/i,
  /sandbox\s+watch\s+fixture/i,
  /liveoffer/i,
  /livecontract/i,
  /closeoute2e/i,
  /block_a_verify/i,
  /release_readiness/i,
];

function emailsOf(identity: VerificationIdentity): string[] {
  return [identity.email, identity.partnerEmail]
    .map((v) => v?.trim() ?? "")
    .filter((v) => v.length > 0);
}

function nameBlob(identity: VerificationIdentity): string {
  return [
    identity.firstName,
    identity.lastName,
    identity.partnerFirstName,
    identity.partnerLastName,
    identity.extraName,
  ]
    .map((v) => v?.trim() ?? "")
    .filter((v) => v.length > 0)
    .join(" ");
}

export function isInternalVerificationIdentity(identity: VerificationIdentity): boolean {
  for (const email of emailsOf(identity)) {
    if (EMAIL_MARKERS.some((re) => re.test(email))) return true;
  }
  const blob = nameBlob(identity);
  if (!blob) return false;
  const compact = blob.replace(/[\s_-]+/g, "");
  return NAME_MARKERS.some((re) => re.test(blob) || re.test(compact));
}
