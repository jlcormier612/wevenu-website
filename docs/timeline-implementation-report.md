# Timeline Implementation — Report

**Status: Implemented and live-validated, 2026-07-17.** Closes the one domain `docs/commitment-lifecycle-architecture.md` §9 named as deliberately unbuilt. Timeline now has an Owner/Lock State/Visibility model exactly per `docs/client-workspace-product-architecture.md` §12, with one approved refinement made before implementation began.

This was run as a full architecture-implementation initiative, not a direct build: Research → Assessment → Clarifying Questions → Architecture Validation → Implementation Plan (approved) → Implementation → Live Validation → this report — the same discipline as the Commitment Alignment Sprint, per your explicit instruction.

---

## What Governed This Build

- `docs/client-workspace-product-architecture.md` §12 — the target model: Owner (`venue`/`client`), Lock State (`editable`/`locked`), Visibility (`venue`/`client`/`wedding_party`/`guests`/`vendors`), a whole-timeline client Submit action, and audience publication independent of that submission.
- `docs/commitment-lifecycle-architecture.md` — the platform-wide generalization: the Universal Commitment Lifecycle (§2), Commitment Events (§3), Ownership (§4), Versioning (§5), Publication (§6), Delegation (§7), Notifications (§8). Timeline was the domain that originally forced this document into existence, and this build is the first time its own worked example got built against the generalized rules rather than informally.
- Your explicit instruction not to introduce new platform-wide architectural principles unless implementation uncovered a genuine contradiction — followed throughout; every design choice below traces to an existing principle, not a new one.

## Clarifying Questions and Answers (before any code)

Four questions were asked; all four materially shaped the schema:

1. **Freeze on submit, or keep revising?** → Neither option offered was exactly right. Your answer: submitting creates a committed operational snapshot for the venue; the couple's workspace never freezes; further edits stay private until a deliberate re-submit creates a new committed version. This is Copy at Commitment, not freeze-on-submit — and it's the reason `timeline_submissions` exists as a real table rather than a boolean flag.
2. **Submission shape** → Append-only history, matching Guest List/Seating/Vendor Selection and, more specifically, mirroring the Hosted Experience Platform's `experience_versions` JSONB-snapshot shape.
3. **Wedding Day Ops scope** → Confirmed out of scope, with one real requirement: it must execute against the latest *submitted* timeline, never the client's live draft. This single sentence is why `get_event_timeline_merged` exists as one shared function rather than two independently-maintained reads.
4. **Two adjacent vendor-facing bugs found during research** (wrong column name silently emptying every vendor's timeline tab; a dead RPC with zero callers) → Folded in, scope held to exactly those two fixes.

## The One Correction Made to the Approved Plan

My original implementation plan proposed that either party could adjust Visibility on any item. You corrected this before implementation began: **Visibility follows Ownership** — an item's own owner, and only its own owner, controls its publication audiences. This closes an edge case §12 itself had left explicitly open ("whether `client` needs to be its own visibility tag distinct from Owner=client") with a cleaner answer than either of the two the document had been weighing: Visibility isn't owner-independent as originally read, but it also isn't a separate tag — it's owner-gated, full stop.

---

## What Shipped

### Schema (6 migrations, 2 corrective — see below)
- `timeline_entries`: new `owner` (`venue`/`client`) and `lock_state` (`editable`/`locked`) columns. `owner='shared'` deliberately omitted — you agreed Delegation already covers cross-party collaboration without a third ownership state.
- `audiences` vocabulary reconciled to the approved terms: `internal→venue`, `couple→client`, `guest→guests`, `vendor→vendors`, `wedding_party` added (genuinely new), `public` dropped (confirmed dead — valid in the old type/constraint, zero UI, never set by any real code path).
- `client_editable` retired — fully superseded by `owner`+`lock_state`.
- New table `timeline_submissions` (`client_id, venue_id, event_id, snapshot jsonb, entry_count, created_at`) — the Copy-at-Commitment snapshot, structurally identical in spirit to `experience_versions`.
- New RPC `submit_timeline` — snapshots every current `owner='client'` entry, fires `timeline_submitted` task auto-completion natively in the same SQL statement (avoiding the anon-RLS bug class this platform has hit three times before).
- New RPC `get_event_timeline_merged` — the single shared source for both the coordinator's planning-stage editor and Wedding Day Ops: venue's own live entries, unioned with the latest submitted snapshot of the client's entries (frozen content, live day-of status/assignment).
- Portal RPCs rebuilt on the new model: `get_portal_run_of_show` (always-live view of the couple's own draft + venue's framework, plus `lastSubmittedAt`/`hasUnpublishedChanges`), `update_portal_timeline_entry` (owner-gated), new `delete_portal_timeline_entry` (no delete path existed before — private draft work without delete was incomplete), new `set_portal_timeline_entry_visibility` (Visibility-follows-Ownership, enforced server-side).
- `get_guest_timeline` and `get_wedding_website`'s Schedule section: corrected to the `guests` vocabulary, otherwise unchanged — audience publication stays a live read, confirmed still correct under the new model since §6 treats it as independent of venue submission.
- `get_vendor_event_timeline` (confirmed dead, zero callers) retired.

### TypeScript layer
- `lib/timeline/types.ts`: `TimelineOwner`, `TimelineLockState` added; `TimelineAudience` reconciled; `TIMELINE_AUDIENCES` (the UI-facing picker list) now shows only the three genuine external-audience tags (`wedding_party`/`guests`/`vendors`) — `venue`/`client` are valid vocabulary but aren't gated toggles, since the venue's framework is always visible to the client and vice versa isn't mediated by a tag either.
- `lib/timeline/repository.ts`: `insertEntry` always creates `owner='venue'` (client items are created exclusively through the portal RPCs); `updateEntry`/`deleteEntry`/`reorderEntries` all gained explicit ownership guards — defense-in-depth against the coordinator's own save flow ever mutating a client's still-live private row, since a client-owned row does still physically exist in the table (so day-of status tracking keeps working). `getTimelineEntries` — the read every existing coordinator-facing consumer already used — now sources from the merged view instead of a raw table read, so the Timeline tab, Wedding Day Ops, the print view, and the booking overview summary all correctly stopped seeing the client's live unsubmitted drafts, with zero changes needed at any of those call sites.

### UI
- Coordinator editor: `owner` is now implicit (always venue); a Lock toggle replaces the retired "let the client edit" checkbox; client-owned rows in the merged view render read-only (no drag, no edit, no delete — a "💗 From client's timeline" badge instead) with day-of status still settable.
- Portal Timeline tab: full CRUD on the couple's own items including delete (new), a Visibility picker gated to their own items, and a **Timeline Status** widget matching your exact spec — "✓ Submitted to venue" / "Not yet submitted", "Last submitted [date] [time]", "You have unpublished changes." when the live draft has diverged from the latest submission (by count or by any post-submission edit), and a Submit action.
- Vendor App Timeline tab: the two confirmed bugs fixed (`entry_time`, not `time`; `vendors`, not `vendor`) — nothing else touched, per your explicit scope instruction.
- New stock Client Planning task, "Submit your timeline," wired to the new `timeline_submitted` trigger, positioned after Seating in the standard sequence.

### A note on `timeline_created` — corrected mid-implementation, not silently left as originally planned
My original assessment mischaracterized this. I first retired `timeline_created` entirely as a suspected §8 Notifications violation ("never fire on a raw Draft write"). On review, this was wrong: `addEntryAction` — the only place that ever fired it — creates *exclusively* `owner='venue'` rows, and the coordinator is both Workspace Owner and Operational Owner for their own entries, the same shape as Event Order's Finalize. There's no cross-party commitment being fired on early. Retiring it would have silently broken **"Build timeline,"** a required coordinator-only stock task that genuinely depends on it. Restored, unchanged in behavior; `timeline_submitted` was added alongside it as a genuinely new, separate, correctly-gated trigger for the client-facing task.

---

## Live Validation

Real venue, real client, real authenticated session (signed in as a real test user), real portal token, real running dev server — 26 checks, all passed:

- Venue milestone creation defaults to `owner=venue, lock_state=locked`.
- Client's portal view sees the venue's live milestone, read-only.
- Client adds a private item; **the coordinator's merged view does not see it** — confirmed the core Workspace Sovereignty guarantee holds.
- Defense-in-depth: `updateEntry` throws when a coordinator-side call targets a client-owned row directly, bypassing the UI.
- Client submits: snapshot created, entry count correct, **"Submit your timeline" task auto-completes with `completed_by: system`**.
- Coordinator's merged view now sees the submitted item, correctly flagged `owner=client`.
- Timeline Status: `lastSubmittedAt` set, `hasUnpublishedChanges` false immediately after submit.
- Client edits again post-submit — **succeeds** (not frozen); `hasUnpublishedChanges` flips true; the venue's merged view still shows the **old** submitted title, not the live edit — Copy at Commitment confirmed in both directions.
- Client submits again: a **second** `timeline_submissions` row exists (append-only, first one untouched); the venue's merged view now shows the **updated** title.
- Visibility follows Ownership: client's attempt to set visibility on the venue's item is rejected (`not_your_item`); setting visibility on their own item succeeds.
- Client deletes their own item; confirmed gone from their own view.
- Guest-facing read (`get_guest_timeline`) finds the venue's `guests`-tagged milestone.
- Vendor-facing query, using the corrected column and vocabulary, finds a `vendors`-tagged item.

All test data (venue, auth user, client, event, timeline entries, section, portal session, submissions, task) created and fully removed; final sweep confirmed zero leftover rows. `tsc --noEmit` clean throughout (only the two pre-existing, unrelated stale `.next` entries noted all session). Every touched or new Postgres function verified at exactly one overload.

Two bugs were found and corrected **before** this report, via corrective migrations rather than edits to already-applied ones: the merged view's two concatenated entry blocks were initially missing `ORDER BY` (chronological ordering would have been unreliable), and the venue-owned block initially omitted `notes` (the coordinator's own internal-annotation field). Both fixed, both covered by the passing validation above.

---

## Deferred / Not Done, Named Explicitly

- **Phase 5's Hosted Experience change-notification nudge** still watches raw `timeline_entries.updated_at`, not the new Submit signal — explicitly out of this build's scope, flagged in `docs/hosted-experience-platform-architecture-spec.md` rather than silently left stale.
- **`wedding_party` has no consuming audience-facing surface yet.** The Visibility tag is real, stored, and settable — no Wedding Party portal or view exists anywhere in the product to read it. The projection mechanism is ready; building that surface is separate, future scope.
- **`reorderEntry`/`shiftEntriesAfter`** (two lower-traffic legacy functions, distinct from the actively-used `reorderEntries` bulk drag-drop path, which does have the guard) were not given the same explicit ownership guard as `updateEntry`/`deleteEntry`/`reorderEntries`. The coordinator UI never offers these controls on a client-owned row, so the practical exposure is low, but it's not defense-in-depth the way the other three are. Named here rather than left unmentioned.
- **Owner=`shared`** remains unimplemented, per your explicit agreement that Delegation already covers the case it would have addressed.

## Recommendation

Timeline is compliant with the approved architecture, live-validated end to end, and the last domain the Commitment Lifecycle's own Domain Mapping Matrix named as unbuilt. Per your framing, this was "the final major Product Completion initiative before Engineering Cleanup and Launch Readiness" — ready for whatever review or pause you'd like before that next phase begins.
