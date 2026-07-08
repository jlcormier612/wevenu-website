# Contract Lifecycle & Versioning — Design Proposal

**Status:** Design proposal — not yet implemented. Adopted 2026-07-07 as the target architecture for Program 1's contract work beyond today's same-day guards (TR-L1/TR-L2/TR-L3/TR-L5/TR-L6, all shipped). This document is the permanent-fix companion those items were narrow patches toward.
**Relationship to other docs:** `docs/product-promise.md`'s Legal Integrity promise is written against this design. `docs/engineering-standards.md` #4 ("anything representing an executed commitment is append-only") is the general principle; this document is its concrete application to contracts specifically.

---

## Why this exists

Today's contract model has exactly one signer (the couple) and one mutable-until-signed record. TR-L1/TR-L2/TR-L3/TR-L5/TR-L6 (all resolved 2026-07-07) closed every gap in *that* model — a signed contract genuinely can't be edited, deleted, re-sent, or read without its token anymore. But the model itself is narrower than what a real venue contract needs: no venue-side countersignature, no way to make a legitimate post-signature change (a date adjustment, a guest-count update, a payment-schedule tweak) without either breaking the immutability guarantee or leaving the couple stuck with a wrong document forever. This design closes that gap the right way — not by loosening immutability, but by making change itself a new, linked record.

## The lifecycle

**1. Draft.** Venue builds the contract. Fully editable — pricing, inventory, clauses, anything. Status: `draft`.

**2. Issued** *(renaming "sent" for clarity)*. Venue sends the contract. A content snapshot is created — every merge field resolves, pricing/inventory/package/timeline all freeze. From this point the document is a historical record in progress, not a template anymore. Status: `issued`.

**3. Client Review → Client Signed.** The couple opens the link, reads, signs. Timestamp, IP, user-agent, and explicit consent are captured (already shipped — TR-L3). Status: `client_signed` *(new — see "What's new" below)*.

**4. Venue Review → Fully Executed.** The venue reviews the signed document and countersigns. Status: `executed`.

**Once `executed`: everything locks, forever.** No edits, no delete, no resend, no regenerate, no overwrite — for any role, including Owner. This isn't a permission that could theoretically be granted; the capability doesn't exist for anyone, matching the already-adopted principle for `signed` contracts.

If something needs to change after execution, the answer is never "unlock the record" — it's one of:

### Amendment (small change)
A lightweight follow-on record for things like a date change, payment-schedule adjustment, guest-count update, menu selection, or rain plan. The amendment references the original contract; it never replaces or edits it. Signed and executed the same way as a primary contract. The visible history becomes:

```
Contract v1 — Executed
  └─ Amendment 1 — Executed
  └─ Amendment 2 — Executed
```

### Clone / New Version (major revision)
For a substantial rewrite, the venue clicks "Clone Contract," which copies everything (package, pricing, inventory, payment schedule, clauses, notes, custom text) into a new `draft` record — `version_number` incremented, `parent_contract_id` pointing at the original. The venue edits, issues, both parties sign, it locks. The old version is untouched and stays queryable forever.

## Why both, not just one

An amendment is the right shape for "this contract, one detail changed" — it's fast, and it reads naturally as a rider on an existing agreement. A clone is the right shape for "this needs to be substantially different" — a full new document, but with real lineage back to what it replaced. Exposing both gives the coordinator the right tool for the size of the change, rather than forcing every change through the heavier flow.

## Schema sketch

```sql
alter table contracts
  add column version_number integer not null default 1,
  add column parent_contract_id uuid references contracts(id),
  add column supersedes_contract_id uuid references contracts(id),
  add column is_current boolean not null default true;
```

`parent_contract_id` links a clone/version back to what it was cloned from (for "show me every version of this contract" queries). `supersedes_contract_id` links an amendment or new version to the specific record it supersedes for `is_current` purposes — when Contract v2 executes, v1's `is_current` flips to `false` in the same transaction, never mutating v1's own content/status/signer fields. `status` gains `client_signed` as a real intermediate state between `sent`/`issued` and fully `executed`, so the two-party signing sequence (couple signs → venue countersigns) is representable, which it isn't today (today's `signed` conflates "one party signed" with "done").

## What this closes, beyond today's fixes

- **Two-party execution.** Today only the couple signs; the venue's own countersignature doesn't exist as a concept. A dispute over "was this actually agreed by the venue" has nothing to point to.
- **The "I need to change one thing" problem.** Today, a post-signature change has no legitimate path at all (by design, per TR-L1/TR-L2/TR-L5) — which is correct, but leaves coordinators with no answer when a couple reasonably needs a small adjustment. Amendments give a real, trust-preserving answer instead of either breaking immutability or telling the couple no.
- **Business intelligence that requires history.** "Show me every contract we've issued," "how often do couples request changes," "which clauses get amended most" are all unanswerable if contracts are overwritten — and become straightforward, valuable reporting once every version and amendment is a durable, linked record.
- **A Luv hook that only exists because history is preserved.** Once amendments are tracked, an observation like *"this contract has been amended three times before execution — that often indicates uncertainty around pricing, consider reviewing your package structure"* becomes possible. That's a direct example of the kind of intelligence `docs/architecture-audit.md`'s Luv findings flagged as currently unrealized potential — this is a concrete, buildable instance of it, contingent on this design shipping first.

## Sequencing

This is Program-level work — a real schema change, a countersignature UI, an amendment/clone flow, and a version-history view (`Contract v1 — Executed → Amendment 1 — Executed → Amendment 2 — Executed`, per the mockup above) — not a same-day guard fix. Recommend sequencing it as the first Program 1 "permanent fix" item once Track 1/Track 2's same-day items are fully closed, since it directly extends TR-L1/TR-L2/TR-L3/TR-L5/TR-L6 rather than opening new risk surface.
