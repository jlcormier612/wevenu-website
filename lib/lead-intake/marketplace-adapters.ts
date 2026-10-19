/**
 * Provider adapter boundary for marketplace email-forward intake (Phase 1C).
 *
 * Shared path (do not duplicate per provider):
 *   venue routing (leads+{key}@…) → extractInquiryFromEmail → ingestLead
 *   → ingest_lead RPC → automation / assignment / notifications
 *
 * Provider-specific work plugs into classifyMarketplaceAttribution /
 * trustedMarketplaceKey once genuine message samples exist. Do not invent
 * From/subject fingerprints or APIs here.
 *
 * Status below reflects repository evidence only — not operational GREEN.
 */

import type { MarketplaceSourceKey } from "@/lib/lead-intake/marketplace-attribution";

export type MarketplaceDeliveryMechanism =
  | "email_notification_forward"
  | "listing_contact_email_forward"
  | "unknown";

export type MarketplaceAdapterStatus = {
  key: MarketplaceSourceKey;
  displayName: string;
  /** What delivery mechanism evidence supports today. */
  deliveryMechanism: MarketplaceDeliveryMechanism;
  /** Whether a venue can route inquiries into HTC through that mechanism. */
  venueCanRouteViaEmailIntake: boolean;
  /** Message format needed for reliable parsing — not yet verified with genuine samples. */
  messageFormatNeeded: string;
  extractableFieldsWhenGenericParseWorks: string[];
  fieldsOftenUnavailable: string[];
  /** Evidence still required before claiming this provider path verified. */
  evidenceStillRequired: string[];
  parsingAttributionStatus: "adapter_boundary_only" | "verified";
  verificationEvidenceStatus: "none" | "synthetic_only" | "genuine_sample";
};

export const MARKETPLACE_ADAPTER_STATUSES: MarketplaceAdapterStatus[] = [
  {
    key: "the_knot",
    displayName: "The Knot",
    deliveryMechanism: "email_notification_forward",
    venueCanRouteViaEmailIntake: true,
    messageFormatNeeded:
      "Genuine Knot inquiry-notification email (headers + body) as delivered to the venue, forwarded to leads+{key}@inbound.",
    extractableFieldsWhenGenericParseWorks: [
      "name",
      "email",
      "phone",
      "eventDate",
      "guestCount",
      "inquiryMessage",
    ],
    fieldsOftenUnavailable: ["partnerEmail", "estimatedBudget"],
    evidenceStillRequired: [
      "Authorized venue session confirming notification recipient / forward settings",
      "At least one genuine Knot-originated inquiry email captured via Sandbox intake",
    ],
    parsingAttributionStatus: "adapter_boundary_only",
    verificationEvidenceStatus: "none",
  },
  {
    key: "wedding_wire",
    displayName: "WeddingWire",
    deliveryMechanism: "email_notification_forward",
    venueCanRouteViaEmailIntake: true,
    messageFormatNeeded:
      "Genuine WeddingWire inquiry-notification email (headers + body) as delivered to the venue.",
    extractableFieldsWhenGenericParseWorks: [
      "name",
      "email",
      "phone",
      "eventDate",
      "guestCount",
      "inquiryMessage",
    ],
    fieldsOftenUnavailable: ["partnerEmail", "estimatedBudget"],
    evidenceStillRequired: [
      "Authorized venue session confirming lead-notification routing",
      "At least one genuine WeddingWire-originated inquiry email via Sandbox intake",
    ],
    parsingAttributionStatus: "adapter_boundary_only",
    verificationEvidenceStatus: "none",
  },
  {
    key: "zola",
    displayName: "Zola",
    deliveryMechanism: "unknown",
    venueCanRouteViaEmailIntake: true,
    messageFormatNeeded:
      "Confirmed Zola inquiry delivery path and genuine message sample (email or other). Vendor notification menus are not verified.",
    extractableFieldsWhenGenericParseWorks: [
      "name",
      "email",
      "phone",
      "eventDate",
      "guestCount",
      "inquiryMessage",
    ],
    fieldsOftenUnavailable: ["partnerEmail", "estimatedBudget", "confirmed_delivery_channel"],
    evidenceStillRequired: [
      "Proof of how Zola delivers venue inquiries for a US listing",
      "Genuine Zola-originated inquiry payload captured in Sandbox",
    ],
    parsingAttributionStatus: "adapter_boundary_only",
    verificationEvidenceStatus: "none",
  },
  {
    key: "here_comes_the_guide",
    displayName: "Here Comes the Guide",
    deliveryMechanism: "listing_contact_email_forward",
    venueCanRouteViaEmailIntake: true,
    messageFormatNeeded:
      "Genuine HCTG inquiry as received at the listing contact email, then forwarded to HTC intake.",
    extractableFieldsWhenGenericParseWorks: [
      "name",
      "email",
      "phone",
      "eventDate",
      "guestCount",
      "inquiryMessage",
    ],
    fieldsOftenUnavailable: ["partnerEmail", "estimatedBudget"],
    evidenceStillRequired: [
      "Listing contact-email configuration for a venue that uses HCTG",
      "Genuine HCTG-originated inquiry email via Sandbox intake",
    ],
    parsingAttributionStatus: "adapter_boundary_only",
    verificationEvidenceStatus: "none",
  },
];
