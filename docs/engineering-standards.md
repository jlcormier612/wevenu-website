# Engineering Standards — Permanent, Not Phase-Specific

**Status:** Adopted 2026-07-07. These are architectural standards for every future feature, not a Trust Foundation checklist — they outlive Program 1. Each one is grounded in a specific bug this session actually found and fixed; that's deliberate, so they read as lessons rather than generic best-practice advice.
**Relationship to other docs:** `docs/product-promise.md` states *what we owe the customer* (six promises). This document states *how we build so those promises stay true* — the engineering patterns that make the promises structurally hard to violate, not just policy asking people to remember them.

---

## 1. Recompute derived values from source data on every write — never patch them in place

`recomputeInvoiceTotals` used to set `balance_due = total` unconditionally on any line-item edit, silently erasing a payment that had already been collected (TR-M2). The fix wasn't a special case for "editing after a payment" — it was making the function always recompute from the actual source tables (line items + payment records) instead of assuming its own field was still correct.

**Standard:** any derived or denormalized field (a total, a balance, a status, a count) must be recalculated from its full source of truth on every code path that can affect it. If two different functions both need to know "how much has been paid," they call the same shared computation — never two independent ones that can silently drift apart (this is exactly why `getTotalPaidForInvoice` and `reconcileInvoiceBalance` were written to use identical logic, and why TR-M3's refund work extended both rather than adding a third).

## 2. A business invariant enforced on one entry point must be enforced on every entry point

The tour-booking widget correctly blocked double-booking; manual event creation — the everyday coordinator path — didn't (TR-B1). The rule existed; it just wasn't everywhere the effect it protects against could happen. The same shape resurfaced this session in the calendar/lead-dedup research: tour bookings write to `tour_appointments`, but the calendar's "tour" source still reads only the older `leads.tour_date` field, so a real booking can be structurally invisible on the calendar.

**Standard:** when adding a guard, a trigger, or a piece of automation, explicitly enumerate every code path that can produce the effect it's meant to govern — not just the one being worked on. If a second entry point is added later (a new API route, a new form, a new automation), it inherits the same invariant by construction, not by remembering to copy a check.

## 3. Enforcement lives in two places: the server action (clear error) and RLS (backstop)

Every meaningful trust fix this session that involved a permission or a state guard was implemented twice on purpose — once in the service layer (so the UI gets a specific, actionable error message) and once in an RLS policy (so a direct API call, a bug in the UI, or a future forgotten check still can't bypass it). TR-G1's role model, TR-M5's paid-record delete guard, and TR-L1/TR-L2's contract-status guards all follow this shape.

**Standard:** UI hiding a button is not enforcement — it's a courtesy. Any action gated by role, status, or ownership needs a server-side check that returns a real error, and a database-level policy that would reject the same action even if the server-side check were somehow skipped. Neither layer alone is sufficient; this session's specific finding was that RLS checks calling `current_user_role()`/`current_user_venue_id()` (both `SECURITY DEFINER`) don't recurse against the tables they gate, which is what makes this pattern practical to apply broadly rather than something to reach for only occasionally.

## 4. Anything that represents an executed commitment is append-only, never edited in place

A signed contract (TR-L1/TR-L2), a collected payment (TR-M3's refund model), an audit log entry — once a record represents something that has actually happened, changing it destroys the history of what happened. The fix in every case was the same shape: a new record referencing the old one (a refund entry alongside the original payment, a future contract amendment referencing the original contract) rather than mutating the original.

**Standard, stated for contracts specifically as a permanent product principle:** a signed contract is a historical artifact — amend, version, or replace it with a new record, never edit it in place. Generalized: **any record representing a completed legal or financial fact is append-only.** When "undoing" something is needed (a refund, a correction, a cancellation), model it as a new record that references and offsets the original, not as a change to the original's fields.

## 5. When hardening a gate, find and close every alternate path to the same effect

Adding the e-signature consent requirement wasn't just adding a new parameter — the old two-argument `sign_contract()` overload had to be explicitly dropped, because leaving it callable would have meant the new consent check was decorative (anyone could call the old signature and skip it entirely). The fix confirmed the *dropped* overload still failed closed rather than either erroring unhelpfully or silently bypassing the check.

**Standard:** when tightening a security- or trust-relevant check on an existing action, explicitly audit for every other way to reach the same underlying effect (an old function overload, a direct table write, a second API route) and close each one — don't assume the one code path you edited is the only door.

## 6. Trust-relevant changes are verified against real data, not just read

Every fix in the Trust Risk Register was confirmed with an executed test — a rolled-back database transaction simulating the actual scenario, a real per-role session (not a superuser bypassing RLS), a unit test of the exact guard logic — before being marked Resolved. Code review alone was treated as insufficient evidence for anything touching money, legal state, bookings, or permissions.

**Standard:** a change to financial, legal, booking, or permission logic isn't done when it compiles — it's done when there's a specific, repeatable test that was actually executed against the behavior it's meant to guarantee, and the result is recorded (this is why every register entry has a "Test performed" field, not just a "Test Plan").

## 7. When a new table becomes the real source of truth, update every reader that assumed the old one

`tour_appointments` was added to properly model bookings, but the calendar's tour-visibility logic was never updated to read from it — it still reads the older, manually-set `leads.tour_date` field. Two representations of "does this lead have a tour" now exist, and they can silently disagree.

**Standard:** introducing a new table or field that supersedes an older one for representing some fact requires updating every existing reader in the same change, not as a follow-up. If that's not feasible in one pass, the old field must be explicitly marked deprecated and the divergence risk written down — silently leaving two sources of truth for the same fact is exactly how a feature ends up "appearing to work but not" for a subset of real usage.

## 8. Migration history is verified, not assumed

An orphaned, uncommitted migration file (`20260711000000_sprint108_5_beta_command_center.sql`) sat in the working tree for an unknown period — byte-identical to an already-committed, already-applied migration under a different timestamp, left behind after a timestamp collision was resolved by renaming rather than by removing the original. It was harmless only because it happened to never be re-applied — that's luck, not a guarantee.

**Standard:** a schema change isn't done when the migration file is written — it's done when it's the one and only committed file for that change, its timestamp doesn't collide with another migration, and it's confirmed present in `supabase_migrations.schema_migrations` matching the applied state of the database. Before any push, an untracked file under `supabase/migrations/` is a question that needs answering (orphaned-but-wanted, generated-and-safe-to-delete, or a duplicate of something already applied) — never something to leave for later.

---

## How this list should grow

This document should gain an entry whenever a bug reveals a *pattern*, not just a fix — the test is whether the lesson would have prevented a *class* of future bugs, not just the one found. Not every fix belongs here; the ones that do share a shape with the eight above: a gap between what the system appears to guarantee and what it actually enforces, discovered by building something real rather than by inspection alone.
