import type { PracticeJourney } from "@/lib/practice-run/journey";

export type PracticeRunStatus = "in_progress" | "resetting" | "archived";

export type PracticePerspective = "venue" | "client";

export type PracticeRun = {
  id: string;
  venueId: string;
  status: PracticeRunStatus;
  celebrationName: string;
  sampleLeadId: string | null;
  sampleClientId: string | null;
  sampleEventId: string | null;
  sampleRelationshipId: string | null;
  /** PM-02 guided journey progress and practice simulation snapshots. */
  journey: PracticeJourney;
  /** Practice-only booked marker — never events.booked_at. */
  practiceBookedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
};

export type PracticeRunStartResult =
  | { ok: true; run: PracticeRun; created: boolean }
  | { ok: false; message: string };

/** External side effects that must never leave a Practice Run. */
export type PracticeBlockedSideEffect =
  | "email"
  | "sms"
  | "stripe_charge"
  | "stripe_payment_intent"
  | "stripe_subscription"
  | "stripe_transfer"
  | "quickbooks_sync"
  | "vendor_notification"
  | "client_invitation"
  | "automation_dispatch"
  | "reminder_dispatch"
  | "public_availability_block"
  | "public_website_publish";

export const PRACTICE_CELEBRATION_NAME = "Maya & Jordan Practice Wedding";

export const PRACTICE_REASSURANCE =
  "You're in a Practice Run. Explore freely — nothing here will be sent to clients or added to your business.";

export const PRACTICE_WORKSPACE_SUPPORT =
  "See it all. Try it all. Then go live — this sample celebration uses your branding and the real tools, safely away from your live business.";

export const PRACTICE_NAV_HINT =
  "Use the Venue and Client switch above anytime — and Return to setup when you're done exploring.";
