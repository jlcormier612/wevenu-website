# Product Terminology Standard

**The canonical word for every major business object in Hello to Cheers, and where each term is and isn't allowed to appear.**

This is a standard, not a history — it reflects the terminology decisions as of the date below and gets overwritten on the next reconciliation. Source audit: the Language Consistency Audit (2026-07-21), which found the specific inconsistencies each decision below resolves.

**Date:** 2026-07-21

## Principles

1. **Venue-facing language is event-neutral whenever possible.** A venue running corporate galas and birthday parties alongside weddings should never see wedding-only words on a generic screen.
2. **Couple-specific language appears only on genuinely wedding-specific surfaces** — the Couple Portal, the Wedding Website builder, the Couple Questionnaire, and copy that is inherently about a wedding.
3. **One business object, one name.** If two screens can show the same underlying record, they use the same word for it.
4. **Database architecture is preserved unless a rename is genuinely required.** Column names, table names, and type literals are not touched by this pass — only what a human reads on screen. Where a literal display label collides with another object's name, the label is renamed; the underlying enum value is not.

## Canonical terms

| Concept | Canonical term | Notes / where the exception lives |
|---|---|---|
| The product itself | **Hello to Cheers** | "Wevenu" is the internal engineering/codebase name only. It must never appear in venue-facing UI, and never in data pushed to a third party (e.g. QuickBooks line items) — a customer's own accounting software is an external, permanent record. |
| The person(s) a venue serves | **Client** | Event-neutral, used in nav, CRM, invoices, contracts, vendor-facing screens. **Couple** is reserved for the Couple Portal, Wedding Website builder, Couple Questionnaire, and other surfaces that only exist for weddings. |
| A prospective client record in the CRM | **Lead** | Matches the data layer (`leads` table, Lead Funnel analytics, automations, command palette). Used in nav, page headers, buttons, empty states inside the CRM. |
| The public act of a stranger contacting the venue | **Inquiry** | This is the couple's own word for what they're doing, not the venue's internal record-keeping word. The embeddable public form and its button copy keep "Inquiry." The moment that submission lands in the venue's CRM, it is a **Lead**. |
| Converting a Lead into a paying client | **Convert to Client** | "Convert to Booking" is retired — no `Booking` entity exists in the schema, and the label was misleading about what the action actually produces. |
| The thing a venue is hosting | **Event** | "Booking" is a UI synonym with no backing entity and is retired from nav/button labels where it implied a distinct object. |
| A thread of messages between venue, client, and vendor | **Conversation** | Matches the Conversations module and the `conversation_messages` data model. "Messages" survives only as a casual, non-canonical synonym in body copy (e.g. "3 unread messages") — never as a competing screen/tab label for the same object. |
| The event-day / wedding-day run-of-show schedule | **Timeline** | The dominant, unqualified meaning. Every other "timeline" concept keeps an explicit qualifier so it never collides with this one: **Timeline Templates** (the library feature), **Activity Timeline** (the audit/change log), **Message Timeline** (the popover inside Conversations). |
| The analytics/reporting area | **Analytics** | Matches the nav label, which is the one place every user sees the term regardless of which page they land on. |
| An internally assigned actionable item (coordinator/staff work) | **Task** | Lives in the Task Center. A Request whose `requestType` is `task` in the database is relabeled **Action Item** on screen so it never reads as the same object as a real Task Center task. |
| A cross-party ask/reply tied to a Conversation | **Request** | Distinct from Task by design — a Request is addressed to a client or vendor, a Task is assigned to staff. Not renamed. |
| A payment plan and its line items | **Payment Schedule** / **Installment** | Already correctly hierarchical (a Schedule is made of Installments) and used consistently. No change. |
| Guest, Vendor, Proposal, Coordinator/Staff/Team Member, Venue, Event Order | Unchanged | Audited and confirmed already consistent, or (Coordinator/Staff/Team Member) legitimately distinct concepts that are already correctly scoped. |

## Explicitly out of scope for this pass

These are real findings from the audit but are either architectural decisions bigger than a copy fix, or intentionally already-disambiguated and left alone. Full detail in `docs/terminology-standardization-report.md`.

- The couple portal's three related-but-distinct concepts — **Tasks assigned by the venue**, a personal **To-Do** list, and **Requests** — already carry explicit disambiguating captions ("separate from tasks assigned by the venue") and are not collapsed into one term; they are three different objects and conflating them would be a functionality change, not a language fix.
- A full audit of every internal prop/variable named `coupleName` etc. was not undertaken — these are code-level identifiers, not on-screen text, and renaming them touches no user-visible surface. Static on-screen labels that used "Couple" outside genuinely wedding-specific surfaces were fixed; the identifiers that already resolve to the correct display value were left as-is, per the "preserve architecture" principle.
