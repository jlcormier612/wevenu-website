# Architecture Delta — Program 2, Phase 2 (Relationship + Conversation Foundation)

**Status:** Foundation slice of Phase 2 complete 2026-07-19. Deliberately scoped to schema + entry-point wiring only — backfill of historical messages, couple-portal RPCs, UI cutover, and legacy-table retirement are named as remaining work below, not silently folded in or silently dropped.
**Format:** Per the venue owner's request, every completed Program 2 phase (or, as here, a deliberately-bounded slice of one) gets one of these — measuring simplification, not just delivery.

---

## What became canonical

- **`venue_customer_relationships`** is now the enduring customer identity beneath Lead — the deliberate mirror of `vendors`/`venue_vendor_relationships` on the vendor side of the platform, per `docs/lead-identity-architectural-exploration.md`. Lead now represents one Opportunity belonging to a Relationship, not the identity itself.
- **`find_or_create_relationship()`** is the one shared resolver, and — for the first time — every Lead-creating path in the codebase uses it: the two automatic public entry points (`create_public_lead`, `book_tour`, already sharing `find_lead_by_email` since Phase 1a) *and* the manual-create/CSV-import path (`insertLead` in `lib/leads/repository.ts`, which `importLeadsAction` also calls per row). Phase 1a's dedup covered two of four entry points; this phase's identity resolution covers all four.
- **Conversation's schema is built exactly as designed**, anchored to `relationship_id`: `conversations`, `conversation_participants`, `conversation_messages`, `conversation_message_events`, all RLS-scoped via `current_user_venue_id()` from day one (never the `owner_user_id`-only mistake TR-C2/TR-M7 had to fix after the fact).
- **Conversation provisioning is real, not just documented intent** — an `after insert` trigger on `venue_customer_relationships` creates the matching `conversations` row automatically. "A Conversation always exists once its anchor does" is now enforced by the database, not by remembering to call a provisioning function from every future code path that might create a Relationship.

## What legacy systems were removed

None yet, deliberately. This slice is additive schema — `message_threads`/`messages` and `couple_threads`/`couple_messages` are untouched and still fully live. Retiring them requires the historical-message backfill and UI cutover, which are explicitly out of scope for this pass (see below).

## What sources of truth were eliminated

- Before this phase, "who is this customer, across every Opportunity they've ever brought the venue" had no canonical answer — only "which Lead row," and a Lead row is scoped to one Opportunity by design. There is now exactly one answer.
- Manual-create and CSV-import leads previously had *zero* identity resolution — not even Lead-level dedup, let alone anything above it. They now resolve a Relationship on every insert, same as the two automatic entry points. This doesn't fix Phase 1a's explicitly-deferred Lead-level dedup gap for these two paths (a second manual entry for the same email still creates a second Lead row) — but both of those Lead rows now correctly resolve to the *same* Relationship, which is a real improvement even though the underlying gap is unchanged.

## What Trust Risks closed

None directly — no existing register item targeted this. But this phase prevented a *shape* of bug the register exists to catch, before it could ever ship: had Conversation been built anchored to `lead_id` (the first design pass's proposal), the anniversary/repeat-customer/corporate-rebooking scenarios from `docs/lead-identity-architectural-exploration.md` §2 would have forced either duplicate conversations or a destructive reopen of closed pipeline history the first time a real customer returned. That's caught at design time here, not discovered as a production bug later — the cheapest place for this exact class of problem to be found.

## What complexity was reduced

- Every future Lead-creating entry point inherits a correctly-resolved Relationship by construction — nothing has to remember to call anything beyond the one shared function already in its path.
- Conversation never needs to be re-anchored. Re-anchoring an already-shipped Conversation (touching every reader, every RLS policy, every UI surface built on top of it) was the exact expensive rework the whole exploration existed to avoid — it's now moot, because Conversation's very first commit anchors to the right thing.
- One resolver function (`find_or_create_relationship`) instead of four independent, potentially-diverging identity checks across four entry points.

## What's explicitly deferred, not silently dropped

- **No backfill of historical messages** from `message_threads`/`couple_threads` into `conversation_messages`. The tables to receive that backfill exist; the backfill script doesn't yet.
- **No couple-portal RPCs, no coordinator UI, no couple portal UI** — `conversations` exists but nothing surfaces it to a coordinator or a couple yet. Building the UI on an unverified schema was explicitly avoided.
- **`message_threads`/`couple_threads` not retired** — still the live systems for actual messaging today; nothing about today's messaging behavior changed.
- **Contact's scope** (Client vs. Relationship) is unchanged — still scoped to Client, per the open question already logged in `docs/domain-model.md`.
- **When a Relationship's repeat contact should open a fresh Opportunity vs. reuse an existing Lead** — still unresolved, still not needed for anything built in this pass.
- **No global cross-venue Relationship layer** — deliberately not built; every foreign key in this migration references `venue_customer_relationships.id`, so adding one later stays a purely additive column, per the exploration doc's assessment.
- **`conversation_participants` is not populated by any code path yet** — the table and its constraints exist; deciding participant attribution is part of the still-to-come backfill/RPC work.

## Remaining Phase 2 work

- Backfill: for every Relationship, gather every Lead it's ever had, then migrate `messages` (→ `channel='email'`) and `couple_messages` (→ `channel='portal'`) rows into `conversation_messages`, joined via each Lead's linked Client (legacy tables key off `client_id`), merged chronologically.
- Couple-portal RPCs, token-authenticated, mirroring the `_resolve_portal_ids`/`get_portal_payments` pattern — with `client_portal_sessions.access_level` checked from day one (TR-G4 was this exact check being added late; not repeating that here).
- Coordinator UI cutover: the per-client "Messages" tab and the main-nav "Messaging" inbox become one Conversation view.
- Couple portal UI cutover.
- Retire `message_threads`/`messages`/`couple_threads`/`couple_messages` once the above is verified — replace, don't layer.

## Verification summary

Every change in this slice was confirmed against real query behavior in rolled-back database transactions, not code review alone:

- **Identity resolution:** `find_or_create_relationship` returns the same row on repeated calls for the same email (no duplicates created), and a genuinely new email creates exactly one new Relationship with its Conversation auto-provisioned.
- **Cross-entry-point consistency:** `create_public_lead` and `book_tour`, called twice each with the same email, each produce exactly one Lead and exactly one Relationship — matching Phase 1a's existing behavior, now with Relationship resolution layered on top rather than replacing it.
- **RLS, tested with a real per-role `authenticated` session, not a superuser bypass:** a second venue's relationship/conversation rows were confirmed invisible to the first venue's coordinator, and a real insert into `conversation_messages` as that coordinator correctly updated `last_message_at`/unread counts via the trigger.
- **A real gap was caught and fixed during this verification, not after:** the new tables initially had RLS policies but no explicit table-level `GRANT` to `authenticated` — Postgres checks grants before RLS ever applies, so the first real-session test failed with "permission denied" even though the policy itself was correct. This is the same class of gap TR-G3 found in `venue_users` earlier in the project. Found via the same real-session test technique this project uses everywhere; the migration was corrected (explicit `grant select, insert, update, delete ... to authenticated` added for all five new tables) and re-verified before this phase was considered done, rather than left as a "works for the superuser who wrote it" false positive.
- `tsc --noEmit` and `npm run build` both clean after every change.
- Migration recorded in `supabase_migrations.schema_migrations` (version `20260719000000`), matching the applied state of the local database.
