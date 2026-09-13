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
    what: "Confirm your venue name, contact details, business hours, logo, hero image, and brand colors.",
    why: "This is how couples recognize you on emails, contracts, and client-facing pages.",
    whatToDo: "Open Business & Brand and fill in what you can. You can change any of it later.",
  }),
  "calendar-availability": fromCrosswalk("calendar-availability", {
    what: "Set event spaces, how many events you can host at once, and whether you offer tours.",
    why: "This keeps you from double-booking and lets couples see real availability — without turning Calendar into a task list.",
    whatToDo: "Open Availability & Capacity. Business Hours and Tour Availability are separate. If you don't offer tours, choose Not offered — that's a complete answer.",
  }),
  "bring-your-business": fromCrosswalk("bring-your-business", {
    what: "Decide whether to bring existing clients and calendar commitments into Hello to Cheers.",
    why: "So the product opens as your working venue — or a clean start — on purpose.",
    whatToDo: "Import through Migration Center, add things yourself, or skip for now. None of these is the “correct” answer.",
  }),
  "your-offerings": fromCrosswalk("your-offerings", {
    what: "Decide what you sell — packages and the inventory that goes with them.",
    why: "A couple needs something real to book. Starter examples don't count as your configuration until you keep or replace them on purpose.",
    whatToDo: "Open Packages in Library. Adjust starters, replace them, or build your own. If starters are enough for now, say so explicitly.",
  }),
  "client-experience": fromCrosswalk("client-experience", {
    what: "Decide which contracts, questionnaires, messages, and planning materials you'll use with couples.",
    why: "This is what couples experience while working with you.",
    whatToDo: "Open Library. Make starters yours, or keep them deliberately. Seeded templates alone never mark this done.",
  }),
  "lead-capture": fromCrosswalk("lead-capture", {
    what: "Choose how new inquiries reach Hello to Cheers.",
    why: "An inquiry that doesn't land anywhere is a couple you never hear from.",
    whatToDo: "Set up at least one intake path you intend to use, or choose to add leads yourself for now. Optional channels (Facebook, QR, tours) stay optional.",
  }),
  "your-team": fromCrosswalk("your-team", {
    what: "Invite coordinators if anyone else should have their own access.",
    why: "So the right people can help — without sharing your login.",
    whatToDo: "Invite teammates when you're ready. Running solo is completely fine and does not leave setup incomplete.",
  }),
  financials: fromCrosswalk("financials", {
    what: "Decide whether couples can pay you online.",
    why: "Online payment collection is useful once you're taking deposits — it is not required to start.",
    whatToDo: "Open Financials & Integrations when you're ready to connect Stripe, or skip for now.",
  }),
};
