/**
 * Provider adapter boundary for marketplace intake (Phase 2 readiness).
 *
 * Shared path (do not duplicate per provider):
 *   venue routing (leads+{key}@…) → extractInquiryFromEmail → ingestLead
 *   → ingest_lead RPC → automation / assignment / notifications
 *
 * Provider-specific parsing plugs into classifyMarketplaceAttribution only
 * after a genuine provider-originated message is available. This module does
 * not invent From/subject fingerprints or parsers.
 *
 * Evidence checked 2026-10-19. Third-party CRM writeups are not provider
 * message samples. WeddingWire.in extra-recipient docs are a different
 * product and are not treated as US WeddingPro behavior.
 */

import type { MarketplaceSourceKey } from "@/lib/lead-intake/marketplace-attribution";

export type MarketplaceReadiness =
  | "READY TO IMPLEMENT"
  | "PARTIALLY READY — EVIDENCE GAP"
  | "BLOCKED — DELIVERY MECHANISM UNKNOWN";

export type MarketplaceAdapterStatus = {
  key: MarketplaceSourceKey;
  displayName: string;
  readiness: MarketplaceReadiness;
  /** False until a genuine provider message supports attribution and field mapping. */
  parserSafeNow: false;
  deliverySummary: string;
  evidence: { checkedOn: "2026-10-19"; sources: string[] };
  venueCanRouteWithoutMarketplaceApi: boolean;
  confirmedPayloadDetails: string[];
  unknownPayloadDetails: string[];
  evidenceStillRequired: string[];
};

export const MARKETPLACE_ADAPTER_STATUSES: MarketplaceAdapterStatus[] = [
  {
    key: "here_comes_the_guide",
    displayName: "Here Comes the Guide",
    readiness: "PARTIALLY READY — EVIDENCE GAP",
    parserSafeNow: false,
    deliverySummary:
      "Provider privacy policy: inquiries are emailed to the selected venue partner via Postmark, and a copy goes to an internal HCTG address. Venue accounts have no self-serve login; listing contact changes go through HCTG.",
    evidence: {
      checkedOn: "2026-10-19",
      sources: [
        "https://www.herecomestheguide.com/about/privacy-policy (effective 2026-08-26; Postmark inquiry notifications; fields shared with venue partners)",
        "https://www.herecomestheguide.com/about/login (no venue login)",
        "https://www.herecomestheguide.com/help/faq (inquiry goes to the venue)",
      ],
    },
    venueCanRouteWithoutMarketplaceApi: true,
    confirmedPayloadDetails: [
      "Name, email, phone, wedding date, guest count, date flexibility, preferred contact methods, and optional message are collected on the inquiry form",
      "Those details, selected venue, and submission timing are shared with the venue partner",
      "Delivery mechanism named by HCTG is Postmark transactional email",
    ],
    unknownPayloadDetails: [
      "Exact From address, subject, headers, and body layout of the Postmark notification",
      "Whether the venue contact address can be set to the HTC intake address directly, or only forwarded from the venue inbox",
    ],
    evidenceStillRequired: [
      "One genuine HCTG Postmark notification (headers + body) received at a venue contact address",
      "Confirmation of which address on the listing receives that mail",
    ],
  },
  {
    key: "wedding_wire",
    displayName: "WeddingWire",
    readiness: "PARTIALLY READY — EVIDENCE GAP",
    parserSafeNow: false,
    deliverySummary:
      "US WeddingPro documents a vendor Leads inbox and a manual in-app action to forward one lead to another email address. No public lead API. Automatic extra-recipient settings were not found in US WeddingPro docs.",
    evidence: {
      checkedOn: "2026-10-19",
      sources: [
        "https://vendorsupport.weddingwire.com/hc/en-us/articles/7207875637652-Your-Ultimate-Guide-to-Using-the-WeddingPro-App (Leads tab includes “Forward a lead to another email address”)",
        "https://help.17hats.com/en/articles/3114074-lead-capture-email-setup (third party: monitors the venue inbox for WeddingWire notification emails; not a message template)",
      ],
    },
    venueCanRouteWithoutMarketplaceApi: true,
    confirmedPayloadDetails: [
      "Leads are available in the WeddingPro Leads inbox",
      "A person can forward an individual lead to another email address from the app",
    ],
    unknownPayloadDetails: [
      "Whether new-lead notification emails are sent automatically, and to which address",
      "Notification From domain, subject, and body fields",
      "Whether forwarded-lead mail includes couple contact details or only a link back to WeddingPro",
    ],
    evidenceStillRequired: [
      "One genuine WeddingWire new-lead notification or in-app forward, with headers and body",
      "Whether that mail can be forwarded automatically from the venue inbox to HTC intake",
    ],
  },
  {
    key: "the_knot",
    displayName: "The Knot",
    readiness: "PARTIALLY READY — EVIDENCE GAP",
    parserSafeNow: false,
    deliverySummary:
      "The Knot tells vendors to allow mail from partner/member Knot domains and to read leads in the WeddingPro Leads inbox. Storefront Contact Info is the documented contact-email control. No public lead API and no confirmed extra-recipient setting.",
    evidence: {
      checkedOn: "2026-10-19",
      sources: [
        "https://vendorsupport.theknotpro.com/hc/en-us/articles/4404574685972-Why-Am-I-Not-Receiving-The-Knot-Emails (allow postmaster@partner.theknot.com, @member.theknot.com, @partner.theknot.com)",
        "https://vendorsupport.theknotpro.com/hc/en-us/articles/4404929309076-Responding-to-a-Lead-from-Messages-on-The-Knot (Leads inbox on WeddingPro)",
        "https://pros.weddingpro.com/blog/storefront/get-support-with-weddingpro-customer-service/ (Knot contact email is Storefront → Contact Info)",
      ],
    },
    venueCanRouteWithoutMarketplaceApi: true,
    confirmedPayloadDetails: [
      "The Knot sends vendor email from partner.theknot.com and member.theknot.com",
      "Inquiries are readable in the WeddingPro Leads inbox",
    ],
    unknownPayloadDetails: [
      "Which of those emails are new-lead notifications versus other account mail",
      "Subject, body fields, and whether couple email is direct or masked",
      "A Knot control that adds the HTC intake address as a notification recipient",
    ],
    evidenceStillRequired: [
      "One genuine Knot new-inquiry email (headers + body) as received by a venue",
      "The venue inbox rule or contact-email setting that can forward only those messages to HTC",
    ],
  },
  {
    key: "zola",
    displayName: "Zola",
    readiness: "BLOCKED — DELIVERY MECHANISM UNKNOWN",
    parserSafeNow: false,
    deliverySummary:
      "Official vendor FAQ: review the inquiry in Zola and Connect or Decline. Unanswered inquiries draw reminder emails from a Vendor Experience Rep and expire after 14 days. No documented inquiry API, webhook, or additional-recipient setting.",
    evidence: {
      checkedOn: "2026-10-19",
      sources: [
        "https://www.zola.com/faq/12383678089613-what-happens-when-my-invited-couple-sends-me-an-inquiry- (review lead details; Connect or Decline)",
        "https://www.zola.com/faq/4402410692365-what-happens-if-i-do-not-respond-to-an-inquiry- (reminder emails; 14-day expiry)",
      ],
    },
    venueCanRouteWithoutMarketplaceApi: false,
    confirmedPayloadDetails: [
      "Inquiries are reviewed inside the Zola vendor experience",
      "Reminder emails exist when a vendor has not responded; those emails are not documented as the inquiry payload",
    ],
    unknownPayloadDetails: [
      "Whether a new inquiry is also emailed to the venue with couple and event fields",
      "Any setting to add a forwarding address",
      "Message or API shape",
    ],
    evidenceStillRequired: [
      "Zola documentation or a genuine vendor message showing where a new inquiry is delivered outside the dashboard",
      "If that channel is email, one genuine message with headers and body",
    ],
  },
];
