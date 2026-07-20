# Manager Permissions Architecture Remediation — Implementation Plan

Status: **Plan only — no code written yet.** This document is the review gate before implementation, per the working agreement: Product Completion work is paused until these three trust-boundary findings from `docs/manager-permissions-release-readiness-assessment.md` are resolved and re-validated live.

All three findings trace back to the same root pattern: TR-G1 ("Permissions are entirely cosmetic," `docs/trust-risk-register.md`) closed the specific line items in its own stated scope — contract/payment/invoice deletion and `venue_staff` role management — and was marked ✅ Resolved on that basis. It never claimed broader coverage, but nothing since has re-verified the boundary of what it actually covers, so the gap wasn't visible until this phase's live testing. Register entries are proposed below (**TR-G5, TR-G6, TR-G7**) to bring the register back in sync with what's actually true, rather than tracking these fixes anywhere new.

**Non-goals, stated up front:**
- No new permission system, permission-flags table, or custom-role mechanism. Every fix below reuses `current_user_role()` and the existing `role`/RLS pattern TR-G1 already established — extension, not invention.
- No change to the four-role model (owner/manager/coordinator/staff) or to who can invite/change roles — that boundary already tested correctly in the audit.
- The UI-transparency and roster-visibility gaps from the audit's "Product Completion Items" list are explicitly **not** part of this remediation. This pass is scoped to the three items that were classified as Architecture Issues because they're live-exploitable trust-boundary gaps, not UX incompleteness.

---

## Acceptance Criteria

Explicit before/after, per finding — these are the pass/fail tests the validation phase runs against, not a subjective "looks fixed" judgment. Each "After" row is tested with a real account holding that real role, the same way the original audit was conducted.

### TR-G5 — Refund RLS backstop

| Actor | Action | Before | After (pass condition) |
|---|---|---|---|
| Manager | Raw `PATCH` on `payment_line_items` setting `status='refunded'` | Succeeds (live-confirmed in audit) | **RLS denial** — 0 rows affected, no data change |
| Coordinator | Same raw refund attempt | Succeeds (inferred from shared SELECT-visibility mechanism; not separately re-tested in audit) | **RLS denial** — 0 rows affected |
| Staff | Same raw refund attempt | Already denied (SELECT-exclusion blocks UPDATE visibility) | **Still denied** — no regression |
| Owner | Same raw refund attempt, and the real `refundLineItem_` app flow | Succeeds | **Still succeeds**, unchanged — this is the no-regression check |
| Any role | Non-refund update to a `payment_line_items` row (e.g. editing `due_date`, recording payment via the real app flow) | Succeeds | **Still succeeds**, unchanged — confirms the fix is scoped to the refund transition only |

### TR-G6 — DELETE role-gate on the 40-table set

| Actor | Action | Before | After (pass condition) |
|---|---|---|---|
| Staff | Raw `DELETE` on `clients` (and spot-checked on 2–3 other tables from the 40-table list, e.g. `leads`, `documents`) | Succeeds (live-confirmed: a real client was hard-deleted) | **RLS denial** — 0 rows affected, row still exists |
| Coordinator | Same raw delete attempt | Not separately tested in audit; same policy shape as Staff | **RLS denial** — 0 rows affected |
| Manager | Same raw delete attempt | Succeeds (no role gate existed) | **Succeeds** — matches the intended policy (owner/manager delete, same tier as contracts/payments/invoices) |
| Owner | Same raw delete attempt | Succeeds | **Still succeeds**, unchanged |
| Any role | INSERT/UPDATE on any of the 40 tables (e.g. Staff editing a client's guest count) | Succeeds | **Still succeeds**, unchanged — confirms the fix is DELETE-only, no collateral restriction on normal editing |

### TR-G7 — Invite identity check

| Actor | Action | Before | After (pass condition) |
|---|---|---|---|
| Unrelated already-registered account | Accepts an invite addressed to a different email via the token URL | Succeeds (live-confirmed: a Manager test account claimed a `coordinator` invite meant for someone else) | **RPC rejects** with `{ok: false, error: 'email_mismatch'}`; no `venue_staff` row is mutated |
| The actual invited person (matching email, freshly authenticated) | Accepts their own correctly-addressed invite | Succeeds | **Still succeeds**, unchanged — this is the no-regression check |
| Owner | Invites the same already-active member a second time (accidental double-invite), invitee accepts | No prior guard; would produce a second active row | **Unique-index violation surfaces as a clean `{ok:false}`**, not a raw Postgres error, and no second active row is created |
| Any team member | Holds exactly one active role at one venue at a time | Could be violated (the live-tested bug produced two) | **Structurally impossible** — confirmed by querying `venue_staff` for duplicate active rows per `(venue_id, user_id)` after the above attempts; zero found |
| A user who is legitimately staff at two *different* venues | Accepts invites at both | Succeeds | **Still succeeds**, unchanged — the unique index is scoped per-venue, not per-user globally |

---

## Finding 1 — No RLS backstop on refunds

**Root cause.** `refundLineItem_` (`lib/payments/service.ts:271-292`) is the only owner-only check for a refund, and it's app-layer only. The `payment_line_items_update` RLS policy (`supabase/migrations/20260716000000_tr_g1_permissions_enforcement.sql:85-87`) has no role clause — just `venue_id = current_user_venue_id()`. Every sibling financial action from the same migration (contract delete, payment-line-item delete, payment-schedule delete) has a matching RLS role clause alongside its app-layer check; refund is the one place the two layers disagree. Live-tested: a real Manager account issued a refund via a raw `PATCH` against the table directly, bypassing `refundLineItem_` entirely.

**Smallest fix.** RLS `UPDATE` policies can inspect the *resulting* row via `WITH CHECK`, so the fix doesn't need a new mechanism — it needs one additional condition on the existing policy: a non-owner may update a `payment_line_items` row for any reason **except** landing it in `status = 'refunded'`. This blocks exactly the one transition that should be owner-only, and doesn't touch any other legitimate update (recording a payment, editing a due date, adding a note) that Manager/Coordinator/Staff already do today.

```sql
drop policy payment_line_items_update on public.payment_line_items;

create policy payment_line_items_update on public.payment_line_items for update
  using (venue_id = current_user_venue_id())
  with check (
    venue_id = current_user_venue_id()
    and (status <> 'refunded' or current_user_role() = 'owner')
  );
```

`payment_schedules` doesn't carry its own refund state (the `refunded_amount`/`refunded_at`/`refund_reason`/`status='refunded'` fields live only on `payment_line_items`), so no equivalent change is needed there — confirmed by schema, not assumed.

**Layer breakdown:**
- **Database policy:** the one change above. This is the entire fix.
- **Application layer:** none required. `refundLineItem_` already blocks non-owners in the normal UI flow; this migration only closes the raw-API path around it, which is exactly what RLS is for.
- **Invitation flow:** not applicable.

**Migration:** `supabase/migrations/20261001000000_tr_g5_refund_rls_backstop.sql` (new).

---

## Finding 2 — No role differentiation on ~40 core-data tables

**Root cause.** Sprint 107 (`20260708120000_sprint107_team_collaboration.sql`) gave 44 tables a blanket `for all using (venue_id = current_user_venue_id())` policy — no role clause, by design at the time, since role-awareness didn't exist yet. TR-G1 later replaced that blanket policy with role-aware split policies for exactly 4 of those 44 tables (`contracts`, `invoices`, `payment_line_items`, `payment_schedules`) plus `venue_staff` itself. The other **40 tables were never revisited** and still allow any active team member — including Staff — full INSERT/UPDATE/DELETE, confirmed by diffing the two migrations directly:

```
calendar_blocks, client_activities, client_key_dates, client_notes, clients,
contract_activities, contract_templates, date_holds, documents, event_activities,
event_notes, event_questionnaires, event_tasks, event_team, event_vendor_assignments,
events, floor_plan_objects, floor_plans, invoice_activities, invoice_line_items,
lead_activities, lead_notes, lead_signal_events, lead_tasks, leads, luv_drafts,
luv_settings, message_attachments, message_events, message_threads, messages,
package_items, packages, payment_activities, playbook_tasks, playbook_templates,
timeline_entries, venue_business_hours, venue_capacity_rules, venue_spaces
```

Live-tested: a real Staff account hard-deleted a `clients` row via a raw `DELETE`, with zero permission check anywhere in the path — a capability the app's own UI doesn't expose to any role.

**Design decision needed before implementation.** The live-tested harm was specifically a **DELETE** — irreversible, and not a capability the app UI exposes to anyone for most of these tables (no delete-client, delete-event, delete-lead feature exists at all). INSERT/UPDATE on these same tables is different: Staff editing a client's guest count, adding a lead note, or placing a floor plan object is normal, expected, everyday collaborative use today, with no evidence from this audit that it's unwanted. Folding an INSERT/UPDATE role restriction into this fix would be a real product-behavior change, not just closing a security gap, and risks breaking legitimate workflows no one has asked to change.

**Recommendation: gate DELETE only**, extending the exact precedent TR-G1 already set for contracts/payments/invoices — one clause, one pattern, reused 40 times, not invented:

```sql
create policy {table}_delete on public.{table} for delete
  using (venue_id = current_user_venue_id() and current_user_role() in ('owner', 'manager'));
```

applied per table by first dropping the relevant clause of the existing `for all` policy and splitting it into `select`/`insert`/`update` (unchanged, still venue-scoped only) plus this new `delete` policy — same restructuring shape TR-G1 already used on `payment_line_items`/`payment_schedules`, applied mechanically across the 40-table list above.

This closes the exact live-tested exploit (irreversible data loss with no permission check) with zero behavior change to any workflow currently in use. If you want INSERT/UPDATE role restrictions on any of these tables too — e.g. matching the original `docs/permissions-model-proposal.md` Core-Objects matrix's "Staff gets no create" aspiration — that's a separate, explicit product decision worth its own review, not something to decide as a side effect of closing a security gap. Flagging it here rather than choosing silently.

**Layer breakdown:**
- **Database policy:** the change above, applied to 40 tables. This is the entire fix.
- **Application layer:** none required — no delete UI exists for these tables today, so there's nothing to update.
- **Invitation flow:** not applicable.

**Migration:** `supabase/migrations/20261002000000_tr_g6_core_object_delete_role_gate.sql` (new). One migration, 40 mechanical policy replacements — large in line count, small in concept.

---

## Finding 3 — Invite acceptance has no identity check

**Root cause.** `accept_team_invitation(p_token)` (`supabase/migrations/20260708120000_sprint107_team_collaboration.sql:68-99`) matches purely on `invite_token` and sets `user_id = auth.uid()` for whoever calls it — it never compares the calling session's email to the `venue_staff.email` the invite names. Live-tested: an invite addressed to `unclaimed.invitee@example.com` (coordinator) was successfully claimed by an unrelated, already-registered account, which ended up holding two simultaneous, differently-roled rows at the same venue. `current_user_role()` has no `ORDER BY` on its underlying lookup, so which of the two roles governs a given request is Postgres's arbitrary choice, not a designed invariant — confirmed live, it resolved to `manager` in testing, with nothing guaranteeing that outcome.

**Smallest fix, two parts closing both the immediate bug and the state it produces:**

1. **Email match inside the RPC** — the token remains the primary lookup (unchanged), but acceptance additionally requires the authenticated user's email (from `auth.users`, keyed by `auth.uid()`) to case-insensitively match the invited `venue_staff.email` before `user_id`/`accepted_at` are set:

```sql
create or replace function public.accept_team_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_staff   record;
  v_email   text;
begin
  select email into v_email from auth.users where id = auth.uid();

  select * into v_staff from public.venue_staff
    where invite_token = p_token and accepted_at is null and is_active = true;

  if v_staff.id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_or_used_token');
  end if;

  if v_staff.email is not null and lower(trim(v_staff.email)) <> lower(trim(v_email)) then
    return jsonb_build_object('ok', false, 'error', 'email_mismatch');
  end if;

  update public.venue_staff
    set user_id = auth.uid(), accepted_at = now(), invite_token = null
    where id = v_staff.id;

  return jsonb_build_object('ok', true, 'venueId', v_staff.venue_id, 'role', v_staff.role);
end;
$$;
```
(Exact body to be reconciled against the current function during implementation — this shows the one added branch, not a full rewrite. The `v_staff.email is not null` guard preserves current behavior for the theoretical case of an invite created without an email.)

2. **A structural guard against the resulting state**, independent of how it's reached — a partial unique index making "one user, two simultaneous active roles at the same venue" impossible at the schema level, not just discouraged by the RPC:

```sql
create unique index venue_staff_one_active_role_per_user
  on public.venue_staff (venue_id, user_id)
  where accepted_at is not null and is_active = true;
```

This doesn't restrict a user being staff at *two different venues* (still fine, still scoped per-venue) — it only makes the specific duplicate-role-at-one-venue state the live test produced structurally unreachable, including the adjacent edge case of the same person being invited twice by mistake with the correct email both times (which the email-match fix alone wouldn't catch).

**Layer breakdown:**
- **Invitation flow:** the `accept_team_invitation` RPC change (item 1) — this *is* the invitation flow; it's the sole entry point, so fixing it here closes the gap completely without touching anything else.
- **Database policy:** the unique index (item 2) is schema, not RLS, but lands in the same migration since it's the direct structural companion to the RPC fix.
- **Application layer:** `acceptTeamInvitation` (`lib/team/service.ts:170-188`) and `/join` (`app/join/page.tsx`) currently only handle a generic failure state. They need one additional branch to show a clear, specific message for `error: 'email_mismatch'` (e.g. "This invite was sent to a different email address — sign in with that email, or ask your venue owner to resend it.") instead of falling through to a generic error. This is the one place across all three findings where a small application-layer change is warranted, and it's purely about surfacing an already-correct rejection more clearly, not enforcing anything new.

**Migration:** `supabase/migrations/20261003000000_tr_g7_invite_identity_check.sql` (new).

---

## Cross-Cutting

**Trust Risk Register.** Propose adding TR-G5, TR-G6, TR-G7 to `docs/trust-risk-register.md` (Governance category, following the exact `TR-G1`–`TR-G4` format: Risk/Customer Impact/What shipped/Scorecard impact), and updating TR-G1's own status note to point forward to these three rather than leaving it reading as unconditionally closed. This keeps the register accurate rather than creating a second, competing record of the same class of issue — consistent with reusing existing architecture rather than adding a parallel one.

**Consistency check performed.** All three fixes were checked against each other for interaction: Finding 3's unique index doesn't affect Finding 1 or 2's tables; Finding 2's 40-table DELETE gate doesn't touch `payment_line_items`/`payment_schedules` (already correctly gated) or `venue_staff` (has no DELETE policy at all, by design, unchanged); Finding 1's `WITH CHECK` addition doesn't affect any other status transition on `payment_line_items`. The three migrations are independent and can be applied in any order.

**Migration summary:**

| # | File | Fixes | Type |
|---|---|---|---|
| 1 | `20261001000000_tr_g5_refund_rls_backstop.sql` | Finding 1 | RLS policy replace (1 table) |
| 2 | `20261002000000_tr_g6_core_object_delete_role_gate.sql` | Finding 2 | RLS policy split + new DELETE policy (40 tables) |
| 3 | `20261003000000_tr_g7_invite_identity_check.sql` | Finding 3 | RPC replace + new unique index |

**Validation plan, once implemented.** Re-run the exact live-testing methodology from the original audit, not a new one: recreate a real Manager account and real Staff account through the actual invite/accept flow, and confirm each of the three raw-API attacks that previously succeeded now fails cleanly — the raw refund PATCH as Manager, the raw client DELETE as Staff, and accepting a mismatched-email invite. Also re-confirm the three "held up well" behaviors from the original audit (self-escalation blocking, owner-safety guards, the `venue_staff` RETURNING pattern) still hold, since Finding 3's RPC rewrite touches the same function. All test data created and fully removed afterward, per the established pattern for this review series, with a verified-empty final check.

**After validation:** update `docs/manager-permissions-release-readiness-assessment.md`'s recommendation, close out this remediation, and resume the Product Completion roadmap with Wedding Website Product Capabilities.
