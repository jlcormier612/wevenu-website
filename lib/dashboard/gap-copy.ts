/**
 * Guided Setup §1.1 (2026-07-22) — the journey-voiced copy attached to each
 * Activation Engine checklist item, keyed by the same stable `key` string
 * compute_venue_activation_score() emits. Shared between the Getting
 * Started card (lib/dashboard/service.ts) and Luv's setup-gap observations
 * (lib/luv/setup-observations.ts) — one copy table, not two independently
 * written ones drifting apart. Companion voice, not documentation: every
 * description names the actual consequence of the gap, not just the
 * feature that's missing.
 */
export type GapCopy = {
  title: string;
  description: string;
  timeEstimate?: string;
  ctaLabel: string;
};

export const GAP_COPY: Record<string, GapCopy> = {
  profile_complete: {
    title: "Finish your venue profile",
    description: "Without your address, phone, and email on file, couples and coordinators have no way to actually reach you. Two minutes closes that gap.",
    timeEstimate: "2 min",
    ctaLabel: "Complete profile",
  },
  first_package: {
    title: "Create your first package",
    description: "Right now there's nothing for a couple to actually book — a package is the thing you're selling. This is the one every venue needs before anything else.",
    timeEstimate: "5 min",
    ctaLabel: "Create a package",
  },
  first_portal_invite: {
    title: "Invite your first couple to their portal",
    description: "Until you send an invite, your couples have no home for their planning — no timeline, no guest list, nowhere to see what's next.",
    timeEstimate: "2 min",
    ctaLabel: "Invite a couple",
  },
  first_portal_open: {
    title: "Your first couple hasn't opened their portal yet",
    description: "You've sent the invite — once they open it, you'll know your couples are actually using their workspace, not just receiving an email.",
    ctaLabel: "View clients",
  },
  three_couples_active: {
    title: "Get three couples active in their portals",
    description: "This is the point where Hello to Cheers starts running your day-to-day — couples managing their own guest lists and timelines instead of emailing you for updates.",
    ctaLabel: "View clients",
  },
  first_contract_signed: {
    title: "Sign your first contract",
    description: "A booking isn't real until the contract is signed — this is the moment a lead actually becomes a client.",
    ctaLabel: "View clients",
  },
  first_payment_received: {
    title: "Receive your first payment",
    description: "Money changing hands is the real proof this works. Record your first payment here.",
    ctaLabel: "View clients",
  },
  first_vendor_assigned: {
    title: "Assign a vendor to a timeline entry",
    description: "Your vendors need to know when and where to show up — assigning them to the timeline is how they actually find out.",
    ctaLabel: "Open an event",
  },
  first_team_invite: {
    title: "Invite a team member",
    description: "You don't have to run this alone — bring your team in so they can help with tours, follow-ups, and event day.",
    timeEstimate: "2 min",
    ctaLabel: "Invite your team",
  },
  first_team_login: {
    title: "Get your team logged in",
    description: "An invited team member who hasn't logged in yet can't actually help you with anything. A quick nudge closes the loop.",
    ctaLabel: "View team",
  },
  team_active_recently: {
    title: "Keep your team active",
    description: "A team that's actually using Hello to Cheers day to day is what turns this into a real habit, not a one-time setup.",
    ctaLabel: "View team",
  },
};
