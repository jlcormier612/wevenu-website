/**
 * Venue Readiness — Luv's read of whether this venue can actually operate.
 *
 * Pure. The loader in venue-readiness-load.ts fills VenueReadinessFacts from
 * authoritative tables. This module does not query, score a percentage, or
 * persist a second checklist. A finding exists only while the facts say the
 * gap is still true. Visiting a link is not an input, so it cannot resolve
 * anything.
 *
 * Click acknowledgements on venue_lead_capture_channels (configured_at /
 * verified_at) are intentionally not facts. The product cannot see whether a
 * form was pasted onto an external website.
 */
import type { LuvObservation } from "@/lib/luv/types";

export type ReadinessImportance = "blocker" | "recommended" | "optional";

export type FacebookReadiness =
  | "absent"
  | "incomplete"
  | "delivering";

export type VenueReadinessFacts = {
  hasName: boolean;
  hasEmail: boolean;
  hasPhone: boolean;
  hasAddress: boolean;
  hasLogo: boolean;
  hasTimezone: boolean;
  /** Public inquiry form can be opened (/form/{embed_key}). */
  inquiryFormReady: boolean;
  /**
   * A lead from the website inquiry channel exists.
   * The live public form writes source `website`. `website_form` is the older value and still counts.
   * Null when that lookup failed — never treated as "no leads."
   */
  inquiryFormReceivedLead: boolean | null;
  /**
   * venues.email_intake_connected_at is set. That is the product's own
   * "this address is on" state, written by Connect Email Intake — not by
   * opening the page.
   */
  emailIntakeEnabled: boolean;
  /** An accepted email_parsed_generic intake attempt exists. Null when the lookup failed. */
  emailIntakeAcceptedLead: boolean | null;
  facebook: FacebookReadiness;
  leadCapturePath: "automated" | "manual_external" | null;
  /** False when venue_setup_hub_state could not be read. */
  leadCapturePathKnown: boolean;
  tourSchedulingEnabled: boolean;
  tourWindowCount: number | null;
  /**
   * Active packages. A starter the venue kept and priced is still an offering —
   * source_master_key is not cleared when they edit it in place.
   */
  activePackageCount: number | null;
  /** Non-archived contract templates, including a starter they use as their agreement. */
  contractTemplateCount: number | null;
  /** Non-archived message templates, including starters they can send. */
  messageTemplateCount: number | null;
  playbookCount: number | null;
  /** Non-archived inventory items. Starter-category items are still inventory. */
  inventoryItemCount: number | null;
  stripeChargesEnabled: boolean;
  spaceOperatingMode: "single" | "multi";
  spaceCount: number | null;
};

export type VenueReadinessFinding = {
  key: string;
  importance: ReadinessImportance;
  what: string;
  why: string;
  actionLabel: string;
  href: string;
  resolvedWhen: string;
};

export type VenueReadinessAssessment = {
  findings: VenueReadinessFinding[];
  /** Proven, worth saying. Not every checkbox. */
  readyNotes: string[];
  opening: string;
  next: string | null;
};

const EMPTY: VenueReadinessFacts = {
  hasName: false,
  hasEmail: false,
  hasPhone: false,
  hasAddress: false,
  hasLogo: false,
  hasTimezone: false,
  inquiryFormReady: false,
  inquiryFormReceivedLead: false,
  emailIntakeEnabled: false,
  emailIntakeAcceptedLead: false,
  facebook: "absent",
  leadCapturePath: null,
  leadCapturePathKnown: true,
  tourSchedulingEnabled: false,
  tourWindowCount: 0,
  activePackageCount: 0,
  contractTemplateCount: 0,
  messageTemplateCount: 0,
  playbookCount: 0,
  inventoryItemCount: 0,
  stripeChargesEnabled: false,
  spaceOperatingMode: "single",
  spaceCount: 0,
};

export function emptyReadinessFacts(overrides: Partial<VenueReadinessFacts> = {}): VenueReadinessFacts {
  return { ...EMPTY, ...overrides };
}

function knownCount(value: number | null): value is number {
  return value !== null;
}

export function profileContactReady(facts: VenueReadinessFacts): boolean {
  return facts.hasName && (facts.hasEmail || facts.hasPhone) && facts.hasAddress;
}

export type IntakeStatus = "ready" | "missing" | "unknown";

export function intakeStatus(facts: VenueReadinessFacts): IntakeStatus {
  if (facts.leadCapturePath === "manual_external") return "ready";
  if (facts.inquiryFormReceivedLead === true) return "ready";
  if (facts.emailIntakeAcceptedLead === true) return "ready";
  if (facts.facebook === "delivering") return "ready";
  if (facts.tourSchedulingEnabled && knownCount(facts.tourWindowCount) && facts.tourWindowCount > 0) return "ready";
  if (
    !facts.leadCapturePathKnown
    || facts.inquiryFormReceivedLead === null
    || facts.emailIntakeAcceptedLead === null
    || (facts.tourSchedulingEnabled && facts.tourWindowCount === null)
  ) {
    return "unknown";
  }
  return "missing";
}

export function intakeReady(facts: VenueReadinessFacts): boolean {
  return intakeStatus(facts) === "ready";
}

function finding(
  key: string,
  importance: ReadinessImportance,
  what: string,
  why: string,
  actionLabel: string,
  href: string,
  resolvedWhen: string,
): VenueReadinessFinding {
  return { key, importance, what, why, actionLabel, href, resolvedWhen };
}

export function assessVenueReadiness(facts: VenueReadinessFacts): VenueReadinessAssessment {
  const findings: VenueReadinessFinding[] = [];

  if (!profileContactReady(facts)) {
    const missingReach = !facts.hasEmail && !facts.hasPhone;
    const missingAddress = !facts.hasAddress;
    const why = missingReach && missingAddress
      ? "Couples need a way to reach you, and agreements need the venue's address. Both are still blank."
      : missingReach
        ? "There's no email or phone on the venue, so people can't see how to reach you."
        : missingAddress
          ? "The venue address is blank, so agreements and directions don't have a place to point."
          : "The venue name is blank, so pages that introduce you have nothing to show.";
    findings.push(finding(
      "profile_contact",
      "blocker",
      "Your venue profile is missing how people find you.",
      why,
      "Complete your profile",
      "/settings",
      "The venue has a name, a street address, and an email or phone.",
    ));
  }

  if (knownCount(facts.activePackageCount) && facts.activePackageCount === 0) {
    findings.push(finding(
      "own_package",
      "blocker",
      "You don't have a package yet.",
      "A package is what a couple can choose. Until one is active, an inquiry has nothing to book.",
      "Create a package",
      "/library/packages",
      "At least one active package exists for this venue.",
    ));
  }

  if (intakeStatus(facts) === "missing") {
    findings.push(finding(
      "lead_intake",
      "blocker",
      "New inquiries don't have a way into Hello to Cheers yet.",
      facts.inquiryFormReady
        ? "Your inquiry form is ready to share. You can also turn on email intake, open tour booking, or decide you'll add leads yourself. Until one of those is actually in place, a couple who finds you won't become a lead here on their own."
        : "There's no working inquiry form, no received email intake, no delivering Facebook lead form, and no tour hours. New couples won't show up in Leads on their own.",
      "Set up lead intake",
      "/setup-hub/lead-capture",
      "You chose to add leads yourself, or a real inquiry, forwarded email, Facebook lead form, or bookable tour hours is in place. Opening this page does not count.",
    ));
  }

  if (
    intakeReady(facts)
    && facts.leadCapturePath !== "manual_external"
    && facts.inquiryFormReady
    && facts.inquiryFormReceivedLead === false
  ) {
    findings.push(finding(
      "share_inquiry_form",
      "recommended",
      "Your website inquiry form hasn't received an inquiry yet.",
      "The form is live in Hello to Cheers. Sharing it — or embedding it — is what lets a couple on your website become a lead here automatically. Hello to Cheers can't see your website, so this stays open until an inquiry actually arrives.",
      "Share your inquiry form",
      "/setup-hub/lead-capture",
      "A lead from the website inquiry form exists (source website, or the older website_form). Marking the channel configured does not count.",
    ));
  }

  if (intakeReady(facts) && !facts.emailIntakeEnabled && facts.emailIntakeAcceptedLead === false) {
    findings.push(finding(
      "email_intake",
      "recommended",
      "Email intake isn't on yet.",
      "Turning it on gives you an address you can forward inquiries to, and those emails become leads. It does not connect your everyday inbox.",
      "Set up email intake",
      "/settings/leads",
      "Email intake is turned on for this venue, or a forwarded email has already become a lead.",
    ));
  }

  if (facts.facebook === "incomplete") {
    findings.push(finding(
      "facebook_lead_ads",
      "recommended",
      "Facebook lead ads aren't delivering yet.",
      "The connection was started, but a lead won't arrive until a Page is selected and a lead form is turned on.",
      "Finish Facebook lead ads",
      "/settings/integrations",
      "The Facebook connection has a Page and at least one enabled lead form.",
    ));
  }

  if (knownCount(facts.contractTemplateCount) && facts.contractTemplateCount === 0) {
    findings.push(finding(
      "own_contract",
      "recommended",
      "You don't have a contract template yet.",
      "When a couple is ready to book, you'll be writing the agreement from scratch instead of sending one you've already prepared.",
      "Prepare a contract",
      "/library/contracts",
      "At least one contract template exists for this venue.",
    ));
  }

  if (!facts.stripeChargesEnabled) {
    findings.push(finding(
      "card_payments",
      "recommended",
      "Card payments aren't ready yet.",
      "A couple can't pay by card in Hello to Cheers until charges are enabled. You can still record a payment by hand. Linking an account without charges enabled is not enough.",
      "Connect payments",
      "/settings/integrations",
      "venues.stripe_charges_enabled is true.",
    ));
  }

  if (facts.tourSchedulingEnabled && knownCount(facts.tourWindowCount) && facts.tourWindowCount === 0) {
    findings.push(finding(
      "tour_hours",
      "recommended",
      "Tour scheduling is on, but there are no weekly hours.",
      "Nobody can book a tour until those hours exist.",
      "Set tour hours",
      "/settings/availability",
      "Tour scheduling is off, or at least one tour availability window exists.",
    ));
  }

  if (!facts.hasTimezone) {
    findings.push(finding(
      "venue_timezone",
      "recommended",
      "Your venue doesn't have a timezone yet.",
      "Tour times and availability use that timezone. Without it, Hello to Cheers falls back to UTC.",
      "Set your timezone",
      "/settings",
      "venues.timezone is set.",
    ));
  }

  if (facts.spaceOperatingMode === "multi" && knownCount(facts.spaceCount) && facts.spaceCount === 0) {
    findings.push(finding(
      "event_spaces",
      "recommended",
      "You don't have an event space yet.",
      "With more than one space, Hello to Cheers uses them so two events aren't booked on top of each other.",
      "Add a space",
      "/settings/availability",
      "At least one venue space exists, or the venue operates as a single space.",
    ));
  }

  if (!facts.hasLogo) {
    findings.push(finding(
      "logo",
      "optional",
      "Your logo isn't on the venue yet.",
      "It shows on proposals and your inquiry form. Those pages still work without it.",
      "Add your logo",
      "/settings",
      "venues.logo_url is set.",
    ));
  }

  if (knownCount(facts.messageTemplateCount) && facts.messageTemplateCount === 0) {
    findings.push(finding(
      "own_message_templates",
      "optional",
      "You don't have a message template yet.",
      "You can still write each note yourself. A template saves you from retyping the ones you send often.",
      "Add a message template",
      "/communication/templates",
      "At least one message template exists for this venue.",
    ));
  }

  if (knownCount(facts.playbookCount) && facts.playbookCount === 0) {
    findings.push(finding(
      "planning_template",
      "optional",
      "You don't have a planning template yet.",
      "You can still plan an event one step at a time. A template is there when you want the same plan to start every booking.",
      "Add a planning template",
      "/library/playbooks",
      "At least one planning template exists for this venue.",
    ));
  }

  if (knownCount(facts.inventoryItemCount) && facts.inventoryItemCount === 0) {
    findings.push(finding(
      "own_inventory",
      "optional",
      "You don't have inventory yet.",
      "You only need this if you track specific items — tables, chairs, rentals — with a booking.",
      "Review inventory",
      "/library/inventory",
      "At least one inventory item exists for this venue.",
    ));
  }

  const order: Record<ReadinessImportance, number> = { blocker: 0, recommended: 1, optional: 2 };
  findings.sort((a, b) => order[a.importance] - order[b.importance]);

  const readyNotes = readyNotesFor(facts);
  const blockers = findings.filter((f) => f.importance === "blocker");
  const recommended = findings.filter((f) => f.importance === "recommended");
  const hasAttention = blockers.length + recommended.length > 0;

  return {
    findings,
    readyNotes,
    opening: openingLine(readyNotes, hasAttention),
    next: nextLine(blockers.length, recommended.length),
  };
}

function readyNotesFor(facts: VenueReadinessFacts): string[] {
  const notes: string[] = [];
  if (profileContactReady(facts)) notes.push("your venue profile");
  if (knownCount(facts.activePackageCount) && facts.activePackageCount > 0) notes.push("your packages");
  if (knownCount(facts.contractTemplateCount) && facts.contractTemplateCount > 0) notes.push("your contract template");
  if (facts.stripeChargesEnabled) notes.push("card payments");
  if (intakeReady(facts)) {
    notes.push(facts.leadCapturePath === "manual_external" ? "manual lead entry" : "lead intake");
  }
  if (facts.tourSchedulingEnabled && knownCount(facts.tourWindowCount) && facts.tourWindowCount > 0) {
    notes.push("tour hours");
  }
  if (facts.spaceOperatingMode === "multi" && knownCount(facts.spaceCount) && facts.spaceCount > 0) {
    notes.push("your event spaces");
  }
  return notes;
}

function joinNotes(notes: string[]): string {
  if (notes.length === 1) return notes[0];
  if (notes.length === 2) return `${notes[0]} and ${notes[1]}`;
  return `${notes.slice(0, -1).join(", ")}, and ${notes[notes.length - 1]}`;
}

function openingLine(readyNotes: string[], hasAttention: boolean): string {
  if (!hasAttention) {
    if (readyNotes.length === 0) return "You're in good shape to take a couple from an inquiry through a booking.";
    if (readyNotes.length === 1) return `You're in good shape. ${capitalize(readyNotes[0])} is ready.`;
    return `You're in good shape. ${capitalize(joinNotes(readyNotes))} are ready.`;
  }
  if (readyNotes.length >= 2) {
    return `You've got a solid foundation in place. ${capitalize(joinNotes(readyNotes))} are ready.`;
  }
  if (readyNotes.length === 1) {
    return `You've already got ${readyNotes[0]} in place.`;
  }
  return "";
}

function nextLine(blockerCount: number, recommendedCount: number): string | null {
  if (blockerCount === 1) return "The biggest thing I'd finish next is this. Want to tackle that with me?";
  if (blockerCount > 1) {
    return `I see ${countWord(blockerCount)} things that get in the way of running an inquiry here.`;
  }
  if (recommendedCount === 1) return "I'd recommend finishing this before your next inquiry.";
  if (recommendedCount > 1) {
    return `I see ${countWord(recommendedCount)} things I'd recommend finishing before your next inquiry.`;
  }
  return null;
}

const SMALL = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

function countWord(n: number): string {
  return n < SMALL.length ? SMALL[n] : String(n);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** At most one blocker may compete for the Dashboard card. Recommended and optional never do. */
export function readinessDashboardObservations(assessment: VenueReadinessAssessment): LuvObservation[] {
  const blocker = assessment.findings.find((f) => f.importance === "blocker");
  if (!blocker) return [];
  return [{
    id: `venue-readiness-${blocker.key}`,
    kind: "recommendation",
    priority: "high",
    message: blocker.what,
    detail: blocker.why,
    link: blocker.href,
    actionLabel: `${blocker.actionLabel} →`,
    recommendation: { label: blocker.actionLabel, link: blocker.href, type: "navigate" },
  }];
}
