/**
 * Registry of external side-effect entry points protected for Practice Run.
 * PM-02 wires guards at email, bookClient, and contract send/sign boundaries.
 * Practice-booked uses practice_runs.practice_booked_at — never events.booked_at.
 */

export const PRACTICE_SIDE_EFFECT_ENTRY_POINTS = [
  {
    kind: "email" as const,
    path: "lib/email/send.ts#sendEmail",
    note: "PM-02 blocks practice sample addresses (@practice.hellotocheers.invalid).",
  },
  {
    kind: "sms" as const,
    path: "lib/sms/** and conversation SMS send paths",
    note: "Practice sample has no phone; Twilio paths remain unavailable for practice.",
  },
  {
    kind: "stripe_charge" as const,
    path: "lib/stripe/** payment intent and charge helpers",
    note: "Practice payments stay preview-only — no Stripe charges or payment intents.",
  },
  {
    kind: "public_website_publish" as const,
    path: "couple_websites.is_published / wedding website publish paths",
    note: "PM-04 seeds draft couple websites only; public publish stays blocked for Practice Run.",
  },
  {
    kind: "quickbooks_sync" as const,
    path: "lib/quickbooks/** enqueue paths",
    note: "QBO customer / invoice sync stays off for practice-linked records.",
  },
  {
    kind: "vendor_notification" as const,
    path: "lib/vendors/notify-assignment.ts and notify-removal.ts",
    note: "Vendor assignment emails.",
  },
  {
    kind: "client_invitation" as const,
    path: "lib/contracts/service.ts#sendContract and client-auth invitations",
    note: "PM-02 blocks real contract send / signing invitations for practice clients.",
  },
  {
    kind: "automation_dispatch" as const,
    path: "lib/automations/** and scheduled-messages/**",
    note: "Playbook and scheduled outbound.",
  },
  {
    kind: "reminder_dispatch" as const,
    path: "lib/notifications/** and tour booked-side-effects",
    note: "Reminders and tour notification side effects.",
  },
  {
    kind: "public_availability_block" as const,
    path: "lib/booking-journey/book-client.ts and practice_runs.practice_booked_at",
    note: "PM-02 blocks bookClient for practice-linked clients. Practice-booked never sets events.booked_at.",
  },
] as const;
