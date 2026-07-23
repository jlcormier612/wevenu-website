# Terminology Standardization Report

**What changed, why, and what was deliberately left alone.** Companion to `docs/product-terminology-standard.md`, which defines the canonical term for each concept — this report is the change log against that standard.

**Date:** 2026-07-21
**Source:** Language Consistency Audit (this engagement), approved for implementation as "Launch Polish — Product Terminology Standardization."

## Terminology decisions

See `docs/product-terminology-standard.md` for the full canonical-term table. Summary of the calls made:

- **Hello to Cheers** is the product name everywhere a venue user can see it. **Wevenu** is the internal codebase name only — comments and internal identifiers keep it, on-screen text and any data pushed to a third party (QuickBooks) do not.
- **Client** is the event-neutral default; **Couple** is reserved for surfaces that are only ever wedding (the Couple Portal, the Wedding Website builder, the Couple Questionnaire).
- **Lead** is the canonical CRM object inside the venue's own tools; **Inquiry** survives only as the word for the public act of a stranger contacting the venue. A vendor's own `VendorInquiry` pipeline (`/vendor/inquiries`) is a genuinely different business object with its own module and was left alone — it isn't competing with the venue's Lead.
- **Convert to Lead** (not "Convert to Booking") for turning a calendar placeholder into a real Lead record; **Convert to Client** (already correct, unchanged) for turning a Lead into a paying Client.
- **Event** is the entity; **Booking** is retired from labels that implied a distinct object where none exists.
- **Conversation** is the canonical name for a message thread; "Messages" no longer competes with it as a screen/tab title on the same page.
- **Analytics** matches the nav label everywhere, including the page's own title/H1.
- **Timeline** unqualified means the event-day schedule; every other meaning already carried (or now carries) an explicit qualifier.
- Action Item is the new label for a Request whose underlying `requestType` is `task`, so it no longer reads as the same object as a real Task Center task. The database enum value (`task`) was not touched — only the display label.

## Files changed

**Brand name (Wevenu → Hello to Cheers, user-visible only):**
- `components/settings/notifications-section.tsx` — failed-delivery banner copy
- `components/settings/facebook-connect-section.tsx` — form-picker prompt, connection description
- `components/settings/quickbooks-connect-section.tsx` — "source of truth" bullet
- `lib/quickbooks/config.ts` — `QUICKBOOKS_DEFAULT_ITEM_NAME` changed from `"Wevenu Services"` to `"Hello to Cheers Services"`. This is the one launch-relevant instance: this string is pushed as a real QuickBooks line-item Item name into a customer's own connected accounting system. Not yet live (blocked on real Intuit credentials per the existing QuickBooks completion status), so the rename carries no migration risk — nothing has been pushed under the old name.
- `lib/quickbooks/items.ts`, `lib/quickbooks/sync/invoice.ts`, `lib/quickbooks/sync/refund.ts` — updated code comments that quoted the old item name, so the comments still match the actual string

**Leads module (Prospects/Inquiry → Lead, internal CRM only):**
- `lib/navigation.ts` — nav item "Prospects" → "Leads"; "Bookings" section label → "Clients" (its only child was already "Clients")
- `app/(app)/leads/page.tsx` — page description, "+ New Inquiry" → "+ New Lead"
- `app/(app)/leads/new/page.tsx` — page metadata, page title ("Convert to Booking"/"New Inquiry" → "Convert to Lead"/"New Lead"), card title ("Inquiry details" → "Lead details")
- `app/(app)/leads/[id]/edit/page.tsx` — description, card title
- `components/leads/lead-list.tsx` — empty-state heading, body copy, button
- `app/(app)/dashboard/page.tsx` — dashboard-level "+ New Inquiry" button

The public embeddable form and its own copy ("Send an Inquiry," the `/form/[embedKey]` route) were deliberately left saying "Inquiry" — that's the visiting couple's word for what they're doing, not the venue's internal record.

**Conversation vs. Messages:**
- `components/events/booking-overview-summary.tsx` — summary tile "Messages"/"Open Messages" → "Conversation"/"Open Conversation" to match the tab on the same page

**Analytics vs. Insights:**
- `app/(app)/analytics/page.tsx` — page metadata title and on-screen H1, "Insights" → "Analytics"

**Timeline:**
- `components/events/event-detail.tsx` — card title "Booking Timeline" → "Timeline"
- `components/events/timeline/timeline-view.tsx` — tooltip "the couple's latest submitted timeline" → "the client's," now matching the visible badge text right next to it ("From client's timeline")
- `app/(app)/events/[id]/timeline-print/page.tsx` — printable document's page title, "Booking Timeline" → "Timeline"
- `components/events/timeline/timeline-document.tsx` — printable document's own on-page label, same fix

**Tour Settings bug (not a terminology issue, found in the same pass):**
- `components/settings/tour-settings-section.tsx` — "Clients can't book tours less than N hours from now" was rendering the literal letter "N"; now interpolates the venue's actual configured value

**Couple → Client (event-neutral coordinator/vendor/staff surfaces):**
- `components/vendor-app/vendor-event-workspace.tsx` — "Venue & Couple" → "Venue & Client" header, "Couple contact not shared" → "Client contact not shared." This screen renders for every event type a vendor is assigned to, not just weddings.
- `components/events/wedding-day-seating.tsx` — this component (and the routes that render it) has no wedding-type gating; it's the seating tool for any event with a client. Fixed: "No Wedding Workspace link exists for this couple yet" → "No Client Workspace link exists for this client yet" (also aligned to the already-established "Client Workspace" term used elsewhere); "Submitted by ... the couple" → "the client"; H1 "Wedding Day Seating" → "Event Day Seating"; "the couple seats guests" → "the client seats guests"
- `app/(app)/events/[id]/seating-print/page.tsx` — back-link text updated to match the renamed heading
- `components/events/wedding-day-dashboard.tsx` — "Wedding Day Tasks" section → "Day-of Tasks" (parallel to the existing, already event-neutral "Run of Show" section on the same dashboard); empty-state copy "No wedding day tasks. Add tasks with the 'Wedding Day' phase" → "No day-of tasks. Add tasks with the 'event day' phase," since a venue's own custom playbook template may not literally name its day-of milestone "Wedding Day"
- `components/playbooks/playbook-builder.tsx` — the milestone-chapter toggle in the venue-facing Playbook Builder (used to build templates for any event type) literally read "💍 Wedding Day." Changed to "📅 Event Day," tooltip text updated to match. This is the most consequential of the Couple/Wedding fixes: a venue building a corporate or birthday playbook template was seeing wedding-specific chrome on a completely generic tool.
- `lib/pipeline-templates/constants.ts` — `CANONICAL_STAGES` descriptions ("A couple reached out," "Waiting on the couple to decide") → "client." This list is explicitly fixed and applies to every venue regardless of event type, per its own docstring.

**Website naming collision:**
- `app/(app)/settings/page.tsx` — Settings card title "Website Forms" → "Inquiry Form," so it no longer implies any connection to the couple-facing Wedding Website builder (a completely different feature with no venue-side configuration surface at all — see Intentional Exceptions below)

**Request/Task label collision:**
- `lib/requests/constants.ts` — `REQUEST_TYPE_LABELS.task`, "Task" → "Action Item." A Request filed with this type was showing "Task" in the same UI area as the real Task Center, which manages a completely different object. The database enum value (`task`) is unchanged.

## Intentional exceptions — found, not changed

Documented here rather than silently left out of the report, per the instruction to record intentional exceptions:

- **`coupleName` and similar prop/variable names** across the codebase (event dashboards, task center, analytics) were not renamed. None of them render the literal word "Couple" to a user — they hold a display-value string that's already correctly computed by their caller. Renaming code-level identifiers with no on-screen effect would be churn without a terminology benefit, and the standard's "preserve architecture unless a rename is genuinely required" principle argues against it.
- **The couple portal's three related concepts** — Tasks assigned by the venue, a personal To-Do list, and Requests — were left as three separate terms. Each already carries an explicit disambiguating caption in the UI ("Your personal planning checklist — separate from tasks assigned by the venue"). Collapsing them into one term would be a functionality change (merging genuinely different objects), not a language fix, and the standard's "one object, one name" principle only applies when it actually is one object.
- **`VendorInquiry`** (`/vendor/inquiries`, a vendor's own pipeline of inbound interest) keeps the word "Inquiry." It's a distinct business object in its own module, not competing with the venue's Lead.
- **Pipeline stage label "Inquiry"** (the first stage a Lead can sit in, in `CANONICAL_STAGES`) was left as-is. A pipeline stage name describing where a Lead currently sits is a different kind of word than a name for the Lead record itself — this is the same pattern most CRMs use (a "Deal" that starts in a stage called "New" or "Contacted").
- **`lib/playbooks/constants.ts`'s `STANDARD_VENUE_WORKFLOW_MILESTONES`**, whose default milestone names include "Wedding Day," was left alone. Unlike `CANONICAL_STAGES`, this is seed content for the reference Playbook template — venue-editable, and a venue running only corporate events would rename their own copy of it. It's default data, not a locked system label.
- **`relationshipLabel()` in `wedding-day-dashboard.tsx`** (maps contact roles like `maid_of_honor`/`best_man`/`planner` to "Maid of Honor"/"Best Man"/"Wedding Planner") was left alone. These are genuinely bridal-party-specific roles that only render if a contact's relationship field is literally set to one of those values — not a blanket label shown regardless of event type.
- **`app/(app)/messaging/legacy-inbox.tsx`** — confirmed still present and still says "Messages" internally, but it is unreferenced dead code (documented in its own neighboring files as "no longer wired into any live route"). Out of scope for a terminology pass; flagged here as a pre-existing cleanup candidate, not touched.
- **The larger open questions from the original Language Consistency Audit** that are product decisions rather than copy fixes — whether "Booking" should exist as a real entity, the duplicate Packages/Contracts surfaces, the missing account-signup path, the vendor Invite-vs-Assign naming overlap — were not part of this pass's scope (a canonical-term standardization) and remain open for a separate decision.

## Verification results

- `tsc --noEmit`: clean, no errors, run after the full set of changes above.
- `next build`: clean production build, all routes compiled successfully, run after the full set of changes above.
- Full-repo grep sweep after the edits confirmed: no remaining user-visible "Wevenu" strings (only internal code comments, which are in scope per the standard), no remaining "Prospects" nav label, no remaining "New Inquiry" button copy inside the venue-facing CRM, no remaining "Insights" on the Analytics page, no remaining "Booking Timeline" or "Wedding Day Seating" user-visible strings outside the couple-portal-specific surfaces that are supposed to keep wedding language.
- No functional behavior was changed by any edit in this pass — every change is a label, heading, tooltip, or copy string. The one non-terminology fix bundled in (the Tour Settings "N hours" interpolation bug) was a pre-existing display bug discovered while auditing that same screen's copy, not a terminology decision, and was fixed because leaving a literal "N" on a settings screen users see the moment they enable Tour Scheduling would undercut the whole point of a copy-polish pass.
