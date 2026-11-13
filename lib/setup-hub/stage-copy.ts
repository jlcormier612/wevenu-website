/**
 * Setup Hub stage copy — decision-focused, not tutorials.
 * Destinations and Help links come from help-crosswalk.ts (final Help only).
 */
import { crosswalkRow, type SetupStageKey } from "@/lib/setup-hub/help-crosswalk";

export type StageCopy = {
  what: string;
  why: string;
  whatToDo: string;
  required: boolean;
  destinationHref: string;
  destinationLabel: string;
  helpHref?: string;
  helpTitle?: string;
};

function fromCrosswalk(
  stage: SetupStageKey,
  copy: Pick<StageCopy, "what" | "why" | "whatToDo">,
): StageCopy {
  const row = crosswalkRow(stage);
  return {
    ...copy,
    required: row.required,
    destinationHref: row.destinationHref,
    destinationLabel: row.destinationLabel,
    helpHref: row.helpSlug ? `/help/${row.helpSlug}` : undefined,
    helpTitle: row.helpTitle ?? undefined,
  };
}

export const STAGE_COPY: Record<SetupStageKey, StageCopy> = {
  "your-venue": fromCrosswalk("your-venue", {
    what: "Start with your venue name and contact details. Add business hours, logo, hero image, and brand colors when you're ready.",
    why: "Spaces and contact info help Hello to Cheers know where events happen. Branding shows on emails, contracts, and client pages — polish it anytime.",
    whatToDo: "Open Business & Brand. Name and contact are enough to keep going; logo and hero can wait until before you invite clients.",
  }),
  "calendar-availability": fromCrosswalk("calendar-availability", {
    what: "Set event spaces, how many events you can host at once, and whether you offer tours.",
    why: "Configuring spaces tells Hello to Cheers where events can happen and how availability should work — so you don't double-book.",
    whatToDo: "Open Availability & Capacity. If you don't offer tours, choose Not offered — that's a complete answer.",
  }),
  "bring-your-business": fromCrosswalk("bring-your-business", {
    what: "Optionally bring existing clients and calendar commitments into Hello to Cheers.",
    why: "Useful when you're migrating — not required for a brand-new venue exploring the product.",
    whatToDo: "Follow Bring Your Business for a recommended order, add things yourself, or skip for now. None of these is the “correct” answer.",
  }),
  "your-offerings": fromCrosswalk("your-offerings", {
    what: "Review the packages Hello to Cheers prepared for you — adjust, replace, or keep them.",
    why: "Packages are what you sell on the way from inquiry to booking. Starters are ready to customize; you don't need to rebuild from scratch.",
    whatToDo: "Open Packages in Library. Preview a contract starter when you're ready. If starters are enough for now, say so explicitly.",
  }),
  "client-experience": fromCrosswalk("client-experience", {
    what: "Review Setup Profiles, planning playbooks, Event Orders, and client-facing materials — then preview before anything is shared.",
    why: "You configure a preferred experience once, customize individual events, review what is prepared, and choose when to release or invite.",
    whatToDo: "Open Library and Setup Profiles. Use Preview — never Invite or Release — until you mean to involve a real client.",
  }),
  "lead-capture": fromCrosswalk("lead-capture", {
    what: "Choose how new inquiries reach Hello to Cheers — or practice with a manual lead first.",
    why: "Understanding the sales journey starts with where a lead lands. Practice leads never email or text anyone.",
    whatToDo: "Set up an intake path, or add a practice lead yourself. Public forms and automations stay off until you turn them on.",
  }),
  "your-team": fromCrosswalk("your-team", {
    what: "Invite coordinators if anyone else should have their own access.",
    why: "So the right people can help — without sharing your login.",
    whatToDo: "Invite teammates when you're ready. Running solo is completely fine.",
  }),
  financials: fromCrosswalk("financials", {
    what: "Decide whether couples can pay you online.",
    why: "Useful once you're taking deposits — not required to explore Hello to Cheers.",
    whatToDo: "Open Financials & Integrations when you're ready to connect Stripe, or skip for now.",
  }),
};
