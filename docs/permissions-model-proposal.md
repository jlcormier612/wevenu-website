# Permissions Model — Decided (TR-G1)

**Status:** Model agreed 2026-07-07. Not yet implemented — this doc is now the spec for Track B of Phase 1; the Implementation Sketch section below is ready to execute.
**Date:** 2026-07-07
**Resolves:** `docs/trust-risk-register.md` TR-G1 — `StaffRole` (`owner`/`manager`/`staff`) currently exists only as a label; nothing server-side or at the RLS layer enforces it.

**Decided:** four roles for the initial build (Owner, Manager, Coordinator, Staff) — no custom/configurable roles, no Read-only, for now. Refunds are Owner-only once TR-M3 is built (Manager-optional held open as a future toggle, not built initially). Custom permissions are a real future direction, explicitly deferred — ship the four fixed roles first.

---

## Design decisions made before the matrix, worth agreeing on first

**1. I'm recommending four roles for the initial build, not five.** Owner, Manager, Coordinator, Staff. Read-only is fully specified below because you asked for it and it's a legitimate persona (a bookkeeper, an accountant, a new hire shadowing before real access) — but I'd build it as a fast-follow rather than day one. Reasoning: it adds a fifth column to every gate check in the system for a persona that may not exist yet on most venue teams, and nothing about the other four roles blocks adding it later — it's purely additive. Tell me if you already have a bookkeeper-type user in mind for the beta cohort and I'll fold it into the initial build instead.

**2. Signed and sent contracts are immutable for every role, including Owner.** This isn't a permission — it's a system invariant that shipped with TR-L1/TR-L2 (`docs/trust-risk-register.md`). No role gets "edit a signed contract" as a capability, because that capability no longer exists for anyone. The matrix below reflects this by only offering Edit/Delete on `draft`/`cancelled` contracts.

**3. Financial visibility is venue-wide, not per-event, for this version.** Scoping "Coordinator can only see balances for events they're assigned to" would be a real, valuable feature — but it requires assignment-based data scoping (a "my events" concept) that doesn't exist anywhere in the codebase yet today. Building that is itself flagged as an Operational Completeness gap in the Product Completion Roadmap (lead-to-team-member assignment). Recommend shipping role-based (not assignment-based) financial gating now, and revisiting per-event scoping once assignment infrastructure exists.

**4. Enforcement has to happen in two places, not one.** Every finding this session that turned out to matter (the RLS infinite-recursion bug, the engagement-event guard regression, the missing auth checks on several RPCs) came from a gap between what the UI shows and what the server actually allows. This model is only real if it's enforced (a) in server actions/services — the first line, gives good error messages — and (b) at the RLS layer for the tables it touches — the backstop, closes the same "direct API call bypasses the UI" class of gap this whole register exists to close. The vendor-side role system (`lib/vendor-packages/service.ts`) already does this correctly for a different role set — replicate that pattern, don't design a new one.

**5. Migration path:** `venue_staff.role` currently has a check constraint limited to `('owner', 'manager', 'staff')`. Widening it to include `'coordinator'` (and `'readonly'` if built) is a schema migration. Existing `'staff'` rows need a decision: my recommendation is to backfill them all to `'coordinator'` (the closest match to how "staff" is actually used today — full day-to-day operational access) rather than `'staff'` under the new, more restricted definition below, since nobody currently using the app has been operating under the new Staff role's narrower scope. You (or the venue owner) can then manually downgrade specific people to the new, more limited `'staff'` if that's genuinely what they want.

---

## The Roles

- **Owner** — the business owner. Full access to everything, always exactly one per venue (already enforced by a unique index). Cannot be removed or demoted by anyone but themself transferring ownership (not in scope here).
- **Manager** — a senior operational lead (ops manager, lead coordinator who also handles the business side). Full day-to-day access including financial visibility and most mutations; the line between Manager and Owner is mainly account-level settings and user management.
- **Coordinator** — the primary day-to-day user running weddings: creates and edits events, tasks, timelines, vendor assignments; sees financial *status* (what's owed, what's paid) to do their job, but can't change money or delete financial/legal records.
- **Staff** — day-of execution: completing tasks, checking in vendors, viewing the timeline. Read-heavy, narrow write access, no financial visibility, no create/delete on core records.
- **Read-only** *(proposed, not recommended for the initial build — see above)* — view everything a Manager can see, mutate nothing, anywhere.

---

## Capability Matrix — Core Objects (Events, Clients, Leads, Tasks/Playbooks, Timeline, Floor Plans, Documents, Messaging)

| Role | View | Create | Edit | Delete |
|---|:---:|:---:|:---:|:---:|
| Owner | ✅ | ✅ | ✅ | ✅ |
| Manager | ✅ | ✅ | ✅ | ✅ |
| Coordinator | ✅ | ✅ | ✅ | ❌ (can cancel/archive where that concept exists; hard delete is Manager+) |
| Staff | ✅ | ❌ | ✅ *(status/completion updates only — e.g. check off a task, mark a vendor checked in — not editing core record fields)* | ❌ |
| Read-only | ✅ | ❌ | ❌ | ❌ |

---

## Capability Matrix — Sensitive Areas

| Role | Financial Visibility | Financial Mutation | Contracts | Vendor Management | Settings | User Management | Reporting |
|---|---|---|---|---|---|---|---|
| **Owner** | Full | Full — mark paid, void, **refund** (Owner-only, decided below), delete draft/cancelled payment records | Full (create/send/cancel; edit/delete restricted to draft/cancelled for everyone, no exception — see Principle 3, "historical artifact") | Full | Full — including billing/subscriptions, exports, integrations, delete venue, transfer ownership | Full (invite, remove, change roles, manage other Owner-level settings) | Full |
| **Manager** | Full | Full **except refunds** — mark paid, void, delete draft/cancelled payment records; **cannot** issue a refund | Full, same as Owner (subject to the same historical-artifact rule) | Full | Operational settings only — **not** billing, subscriptions, exports, integrations, deleting the venue, transferring ownership, or managing the Owner's own account | Can invite/remove Staff/Coordinator; **cannot** manage Owner-level accounts | Full |
| **Coordinator** | Full view (balances, due dates, paid/unpaid) | Operational only — can create invoices/contracts and mark a payment received as part of routine work (e.g. collecting a deposit at a tour); **cannot** void, refund, or delete any financial/contract record | Can create, send, and cancel contracts; **cannot delete** any contract (draft or cancelled) — Manager+ only | Can manage vendor assignments on events; cannot remove a vendor relationship entirely or manage vendor invitations | View own profile only | None | **None** — no venue-wide/analytics reporting |
| **Staff** | None | None | View only (e.g. confirm a contract is signed before a wedding) | View only | View own profile only | None | None |
| **Read-only** *(deferred — not part of the initial build)* | Full (view) | None | Full (view) | Full (view) | View own profile only | None | Full (view) |

**Decided:** refunds are **Owner-only**. Manager gets everything else financial (mark paid, void, delete draft/cancelled records) but not refund authority — the one financial action with real potential for abuse (a Manager refunding a couple who never asked) and no operational urgency the way "mark paid" has. Held open as a possible future per-Manager toggle, not built initially.

---

## What this closes from the Trust Risk Register

- **TR-G1 directly** — permissions stop being cosmetic.
- **Reduces blast radius on TR-M5** (hard-delete of paid financial records) — even after that item's own direct fix ships, this model ensures only Owner can delete anything financial in the first place, a second layer on top of the status guard.
- **Reduces blast radius on the contract-immutability fixes (TR-L1/TR-L2)** — Coordinator/Staff can't delete contracts at all now (previously anyone with venue access could attempt it); Manager+ is required even for a draft/cancelled contract.

## Implementation sketch (once this model is approved)

1. Migration: widen `venue_staff.role` check constraint to include `coordinator` (and `readonly` if in scope); backfill existing `staff` rows to `coordinator` per the recommendation above.
2. A `current_user_role()` SQL helper (`SECURITY DEFINER`, same pattern as `current_user_venue_id()`) other RLS policies and RPCs can call.
3. New RLS policies (or amendments) on `contracts`, `payment_line_items`, `payment_schedules`, `venue_staff` (role/user management), and venue settings tables, gating `UPDATE`/`DELETE` by role per the matrix above.
4. Server-action-level guards mirroring the same rules, so error messages are good (RLS alone just fails the whole request) — same "two enforcement points" pattern used for HQ access earlier this project.
5. Update `components/settings/team-roster.tsx` and the invite flow to expose the new role options.

Not starting on this yet — flagging it as the sketch that follows once you sign off on the model above, per your instruction to get the model right before writing code.
