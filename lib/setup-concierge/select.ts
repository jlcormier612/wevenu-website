/**
 * Deterministic one-next-action selector for Setup Hub.
 * Not Dashboard L1. Returns exactly one entry or null.
 */
import { evaluateVenueSetupDomains } from "@/lib/setup-concierge/state";
import type {
  SetupConciergeEntry,
  SetupDomainId,
  SetupDomainState,
  VenueSetupSnapshot,
} from "@/lib/setup-concierge/types";

const BLOCKED_ORDER: SetupDomainId[] = ["texting", "facebook"];
const REQUIRED_WAITING: SetupDomainId[] = ["profile", "package", "inquiry_path"];

function findState(domains: SetupDomainState[], domain: SetupDomainId, state: SetupDomainState["state"]) {
  return domains.find((d) => d.domain === domain && d.state === state) ?? null;
}

function toEntry(domain: SetupDomainState, kind: SetupConciergeEntry["kind"]): SetupConciergeEntry | null {
  if (!domain.href || !domain.ctaLabel) return null;
  const extra = [domain.why, domain.whatYouDo, domain.whatHtcDoes, `Done looks like: ${domain.doneLooksLike}`]
    .filter(Boolean)
    .join(" ");
  return {
    kind,
    domain: domain.domain,
    title: domain.what,
    body: extra,
    ctaLabel: domain.ctaLabel,
    href: domain.href,
    cannotSee: domain.cannotSee,
    helpHref: domain.helpHref,
    helpTitle: domain.helpTitle,
  };
}

export function selectSetupConciergeEntry(snapshot: VenueSetupSnapshot): SetupConciergeEntry | null {
  if (snapshot.readyToInviteCouples) return null;

  const domains = evaluateVenueSetupDomains(snapshot);

  for (const id of BLOCKED_ORDER) {
    const hit = findState(domains, id, "BLOCKED");
    if (hit) return toEntry(hit, "action");
  }

  for (const id of REQUIRED_WAITING) {
    const hit = findState(domains, id, "WAITING_ON_VENUE");
    if (hit) return toEntry(hit, "action");
  }

  const website = findState(domains, "website_delivery", "WAITING_ON_VENUE");
  if (website) return toEntry(website, "action");

  const stripeConnect = findState(domains, "stripe", "WAITING_ON_VENUE");
  if (stripeConnect) return toEntry(stripeConnect, "action");

  const facebook = findState(domains, "facebook", "WAITING_ON_VENUE");
  if (facebook) return toEntry(facebook, "action");

  const textingDetails = findState(domains, "texting", "WAITING_ON_VENUE");
  if (textingDetails) return toEntry(textingDetails, "action");

  const stripeWait = findState(domains, "stripe", "WAITING_ON_EXTERNAL");
  if (stripeWait) return toEntry(stripeWait, "waiting");

  const textingWait = findState(domains, "texting", "WAITING_ON_EXTERNAL");
  if (textingWait) return toEntry(textingWait, "waiting");

  return null;
}
