/**
 * Setup Hub stage copy — the Hello to Cheers voice, kept separate from the
 * stage logic. Setup-stage guidance now points to the canonical prescriptive
 * guide for each area so venues do not have to hunt through Help & Guides.
 */
export type StageCopy = {
  what: string;
  why: string;
  whatToDo: string;
  required: boolean;
  helpHref?: string;
  helpTitle?: string;
};

export const STAGE_COPY: Record<string, StageCopy> = {
  "your-venue": {
    what: "The basics — your venue's name, contact details, address, hours, and colors.",
    why: "This is what shows up on every email, contract, and page Hello to Cheers sends on your behalf. It's how couples and coordinators find and recognize you.",
    whatToDo: "Head to Settings and fill in what you can. Nothing here is final — you can come back and change any of it whenever you like.",
    required: true,
    helpHref: "/help/setup-your-venue",
    helpTitle: "Walk me through this setup",
  },
  "calendar-availability": {
    what: "Your event spaces, how many events you can host at once, and whether couples can book a tour online.",
    why: "This is what keeps you from double-booking and lets couples see real availability instead of guessing.",
    whatToDo: "Add your spaces in Settings, and decide whether online tour booking is right for you. If it's not, that's a completely fine answer — just let us know so we stop asking.",
    required: true,
    helpHref: "/help/setup-calendar-availability",
    helpTitle: "Walk me through this setup",
  },
  "bring-your-business": {
    what: "Your existing clients, leads, and vendors — the business you already have.",
    why: "So everything you're already tracking somewhere else follows you here, instead of starting from zero.",
    whatToDo: "Whether you're moving from another system — whether we know it by name or not — or just have a spreadsheet, it's the same place: we'll help you bring it over carefully. Or start fresh and add things as you go — that's a real choice too.",
    required: true,
    helpHref: "/help/setup-bring-your-business",
    helpTitle: "Walk me through this setup",
  },
  "your-offerings": {
    what: "The packages you sell and the items you use — tables, chairs, and everything else that comes with an event.",
    why: "This is what a couple actually books. Without at least one package, there's nothing yet for someone to say yes to.",
    whatToDo: "We've started you off with some common examples to look at. Adjust them, replace them, or build your own — whatever fits how you actually work. If the starting examples are close enough for now, just let us know you've looked them over.",
    required: true,
    helpHref: "/help/setup-your-offerings",
    helpTitle: "Walk me through this setup",
  },
  "client-experience": {
    what: "The contracts, questionnaires, message templates, and planning guides you'll use with couples.",
    why: "This is what a couple experiences while working with you — how you ask for the right details, what you send them, and how their planning stays organized.",
    whatToDo: "We've started you off with some common examples in your Library. Look them over and make them yours, or build your own from scratch. If the starting examples work for you as-is, just let us know you've looked them over. When you're ready to send real messages, open Inbox → Communication Health — Email and texting are platform-level, not something you configure in venue Settings.",
    required: true,
    helpHref: "/help/setup-client-experience",
    helpTitle: "Walk me through this setup",
  },
  "lead-capture": {
    what: "How new inquiries actually reach Hello to Cheers.",
    why: "An inquiry that doesn't land anywhere is a couple you never hear from.",
    whatToDo: "Pick at least one way inquiries reach you — your website form, forwarded emails, or others — or tell us you'll add leads yourself for now. Either way, we'll help you make sure it's actually working.",
    required: true,
    helpHref: "/help/setup-lead-capture",
    helpTitle: "Walk me through this setup",
  },
  "your-team": {
    what: "The coordinators and staff who'll work alongside you in Hello to Cheers.",
    why: "So the right people can help with tours, follow-ups, and event day — without sharing your own login.",
    whatToDo: "Invite anyone who should have their own access. Running things solo for now is completely fine too — just let us know that's the plan.",
    required: true,
    helpHref: "/help/setup-your-team",
    helpTitle: "Walk me through this setup",
  },
  financials: {
    what: "Connecting Stripe for payments and QuickBooks for accounting.",
    why: "These make collecting payments and keeping your books easier once you're up and running — but they're not something you need before you start.",
    whatToDo: "Connect these whenever it's convenient — today, next month, whenever. This is entirely optional and won't hold anything up.",
    required: false,
    helpHref: "/help/setup-financials",
    helpTitle: "Walk me through this setup",
  },
};
