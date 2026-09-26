/**
 * Couple-portal HTC how-to articles — canonical product knowledge for
 * couple Ask Luv. Same FinalHelpArticle model as staff Help; audience is
 * `couple` so they never publish into venue staff Guidance.
 *
 * Derived from live portal product truth (Documents, contract signing,
 * Payments, questionnaires, Your Choices, Next Steps, Tasks, vendors).
 * Do not invent capabilities. Do not embed this prose in the Luv prompt
 * as a separate parallel knowledge base — retrieve via couple-htc-knowledge.
 */

import type { FinalHelpArticle } from "@/lib/help-guides/final-articles";

export const COUPLE_PORTAL_HELP_ARTICLES: readonly FinalHelpArticle[] = [
  {
    slug: "couple-finding-documents",
    title: "Where Do I Find Documents?",
    category: "Working With Clients",
    audience: "couple",
    coupleKeywords: [
      "documents",
      "docs",
      "find documents",
      "where are documents",
      "contract file",
      "invoice file",
      "upload",
      "insurance",
    ],
    body: `Documents is where your venue shares contracts, invoices, and other files with you — and where you can upload files when needed.

Open **Documents** in your portal navigation.

There you can:

* Open a contract your venue sent for review or signature
* View invoices and related payment documents
* Open questionnaires your venue has sent (when one is available)
* Upload a file (including event insurance when your venue asks for it)

If Documents looks empty, your venue may not have shared anything yet. That does not mean something is missing on your side — ask your coordinator if you expected a specific file.`,
  },
  {
    slug: "couple-review-sign-contract",
    title: "How Do I Review and Sign My Contract?",
    category: "Contracts & Payments",
    audience: "couple",
    coupleKeywords: [
      "sign",
      "signing",
      "sign contract",
      "review contract",
      "how do i sign",
      "contract signature",
      "e-sign",
      "execute",
    ],
    body: `Hello to Cheers uses a client-first signing process.

1. Open **Documents** in your portal.
2. Open the contract your venue sent.
3. Read it carefully. You can ask your coordinator questions or request changes before you sign.
4. When you are comfortable, complete your signature in the contract experience.

You sign first. After you sign, the contract goes back to your venue for their signature.

The sequence is:

Send to Client → You Review → You Sign → Venue Signs → Fully Executed

Signing a contract does not automatically create an invoice or start a payment. Contracts and payments are related but separate in Hello to Cheers.`,
  },
  {
    slug: "couple-understanding-contract-status",
    title: "What Do Contract Statuses Mean?",
    category: "Contracts & Payments",
    audience: "couple",
    coupleKeywords: [
      "contract status",
      "awaiting your signature",
      "signed",
      "fully executed",
      "draft contract",
      "contract waiting",
    ],
    body: `In your portal, contract status tells you where the agreement stands.

**Awaiting your signature** means your venue has sent the contract and needs you to review and sign.

**Signed** means you have completed your signature. Your venue may still need to sign before the contract is fully executed.

**Fully Executed** means both you and the venue have signed. The completed contract is locked and appears in Documents for both of you.

A contract that is still being prepared by your venue may not appear in your Documents yet.

If more than one person must sign on the client side, Hello to Cheers tracks each required signer separately. Each person completes their own signature.`,
  },
  {
    slug: "couple-understanding-payments",
    title: "How Do Payments and Invoices Work in My Portal?",
    category: "Contracts & Payments",
    audience: "couple",
    coupleKeywords: [
      "payment",
      "payments",
      "pay",
      "invoice",
      "invoices",
      "payment schedule",
      "deposit",
      "balance",
      "pay online",
      "pay now",
      "due",
    ],
    body: `**Payments** in your portal is where you see amounts your venue has made visible to you — including payment schedules and invoices when they apply.

Open **Payments** to review what is due and any **Pay now** options your venue has enabled.

Online payment is available only when your venue has connected online payment collection (Stripe). If you do not see a way to pay online, that usually means online collection is not set up for this venue, or that particular amount is not payable online yet — ask your coordinator.

Important distinctions:

* A **payment schedule** describes when payments are expected.
* An **invoice** is a specific amount your venue has issued to you.
* A **payment** is money that was requested or collected.

**Issued** on an invoice means it has been released to you. Issued does not mean paid.

**Paid** means the amount due has been collected.

**Void** means the invoice is no longer an active amount due.

Signing a contract does not automatically create invoices or payment plans.`,
  },
  {
    slug: "couple-submitting-questionnaire",
    title: "How Do I Submit a Questionnaire?",
    category: "Planning the Event",
    audience: "couple",
    coupleKeywords: [
      "questionnaire",
      "questionnaires",
      "final details",
      "submit questionnaire",
      "planning form",
      "fill out form",
    ],
    body: `When your venue sends a questionnaire (including Final Details or feedback requests), it appears in your portal.

You can reach it from **Documents** when a questionnaire card is shown, or from **Tasks** / **Your Next Steps** when there is an open questionnaire step.

Open the questionnaire, answer the questions, and submit when you are ready. You can often save progress before submitting, depending on what your venue sent.

After you submit, your venue can review your answers. The questionnaire for your event keeps the working answers for this booking — it is not the same thing as a reusable template your venue uses for other events.`,
  },
  {
    slug: "couple-questionnaire-status",
    title: "What Do Questionnaire Statuses Mean?",
    category: "Planning the Event",
    audience: "couple",
    coupleKeywords: [
      "questionnaire status",
      "not started",
      "in progress",
      "submitted",
      "resubmitted",
      "questionnaire complete",
    ],
    body: `Questionnaire status in your portal describes your progress on the form your venue sent.

**Not started** — you have not begun yet.

**In progress** — you have started but have not submitted.

**Submitted** — you have sent your answers to your venue.

**Resubmitted** — you submitted again after an earlier submission.

**Complete** — the questionnaire work for this request is finished.

Statuses describe the questionnaire workflow. They are not payment statuses and they are not contract statuses.`,
  },
  {
    slug: "couple-completing-your-choices",
    title: "How Do I Complete Your Choices?",
    category: "Planning the Event",
    audience: "couple",
    coupleKeywords: [
      "choices",
      "your choices",
      "client choices",
      "menu choices",
      "select options",
      "add-ons",
      "dinner choices",
    ],
    body: `**Your Choices** is where you select options your venue asked for — for example menus, add-ons, or other event selections.

Open **Your Choices** in your portal navigation (or follow the step from **Your Next Steps** / **Tasks** when one is waiting).

Select the options, save if you need to come back later, and submit when you are ready.

Submitting sends your selections to your venue for review. **Submitting Your Choices is not a payment.**`,
  },
  {
    slug: "couple-after-submitting-choices",
    title: "What Happens After I Submit Your Choices?",
    category: "Planning the Event",
    audience: "couple",
    coupleKeywords: [
      "after submit choices",
      "choices submitted",
      "choices finalized",
      "changes requested",
      "event order",
    ],
    body: `After you submit **Your Choices**, your venue reviews them.

Your venue may:

* Accept and finalize your selections
* Ask you to make changes (you can update and submit again)
* Apply finalized choices into the event order your venue manages

You may see statuses such as awaiting your response, submitted / waiting on the venue, changes requested, or finalized.

Finalized choices become part of how your venue builds the event. If something looks wrong after you submit, message your coordinator rather than assuming the portal will invent a correction.`,
  },
  {
    slug: "couple-working-with-vendors",
    title: "How Do Vendors Work in My Portal?",
    category: "Vendors",
    audience: "couple",
    coupleKeywords: [
      "vendor",
      "vendors",
      "preferred vendors",
      "photographer",
      "caterer",
      "florist",
      "vendor list",
    ],
    body: `Your portal can include **Preferred Vendors** — vendors your venue has made available for you to browse.

Open **Preferred Vendors** (or follow the Venue Guide link when your venue surfaces it there).

When a vendor is connected to your event, you may be able to see the vendor information your venue has shared, communicate with the vendor, and make vendor-related choices when your venue has enabled that.

Your venue stays connected to the relationship. You do not need a separate staff Task Center to work with vendors in the couple portal.`,
  },
  {
    slug: "couple-understanding-next-steps",
    title: "What Are Your Next Steps?",
    category: "Working With Clients",
    audience: "couple",
    coupleKeywords: [
      "next steps",
      "your next steps",
      "what should i do next",
      "priority",
      "what's next",
    ],
    body: `**Your Next Steps** on Home highlights the most important open items for your event right now — things like reviewing a contract, completing a questionnaire, finishing Your Choices, or other tasks your venue has shared with you.

Each next step takes you to the right place in the portal to finish that item.

Your Next Steps is a focused list for Home. The full list of open work lives under **Tasks**.`,
  },
  {
    slug: "couple-understanding-tasks",
    title: "What Are Tasks in My Portal?",
    category: "Working With Clients",
    audience: "couple",
    coupleKeywords: [
      "tasks",
      "task",
      "reminders",
      "to-do",
      "todo",
      "checklist",
      "due date",
    ],
    body: `**Tasks** is your fuller list of planning work and reminders for this event.

Open **Tasks** to see what still needs attention, including items with due dates when your venue has set them.

Some tasks open another section (Documents, questionnaire, Your Choices, Payments, and so on) so you can complete the real work there.

Tasks in your couple portal are not the same as your venue team's internal Task Center. You only see the customer-facing work shared with you.`,
  },
  {
    slug: "couple-portal-planning-overview",
    title: "How Does Planning Work in My Portal?",
    category: "Planning the Event",
    audience: "couple",
    coupleKeywords: [
      "portal",
      "how does this work",
      "planning",
      "workflow",
      "where do i start",
      "couple portal",
      "home",
    ],
    body: `Your Hello to Cheers couple portal is where you plan with your venue.

Common places:

* **Home** — overview, Your Next Steps, and helpful updates
* **Tasks** — open planning work and reminders
* **Documents** — contracts, invoices, uploads, questionnaires
* **Your Choices** — selections your venue asked you to make
* **Payments** — schedules and invoices your venue has shared
* **Timeline** — event day schedule work when your venue uses it
* **Messages** — conversation with your venue
* **Venue Guide** — what this venue has written about policies, parking, and day-of details
* **Preferred Vendors** — vendors your venue has shared
* **Ask Luv** — questions about how Hello to Cheers works and what your Venue Guide says

Ask Luv can explain how these areas work. Specific dates, amounts, and statuses for your event come from the portal itself (and from your coordinator) — not from generic wedding advice.`,
  },
];
