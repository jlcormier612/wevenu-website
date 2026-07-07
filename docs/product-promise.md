# Wevenu Product Promise

**Status:** Adopted 2026-07-07 — standing engineering principle, not a phase-specific document.
**Purpose:** Every feature proposal, code review, and roadmap decision should be checked against this list. It doesn't expire when Trust Beta ships — it's the bar for everything built after it too.

The question to ask before shipping anything: **does this violate one of our promises?** If yes, the feature does not ship until it doesn't — either fix it, disable it, or clearly label it as not-yet-built (per the honestly-absent-vs-misleading distinction below).

---

## The Promises

### 1. Financial Integrity
**We will never silently alter financial history.** A balance, total, or payment record only changes through an explicit, attributable action — never as a side effect of an unrelated edit. If money moved, there's a reason a human can point to.

### 2. Legal Integrity
**A signed agreement becomes a permanent historical artifact.** Once signed, a contract is never edited — only amended, versioned, or replaced with a new contract that references the original. Editing history is not an option for any role, including Owner.

### 3. Operational Integrity
**The platform will never knowingly allow a double booking.** If a space is already committed to an event on a given date and time, the system rejects the conflicting booking — it does not merely warn and let the user proceed.

### 4. Transparency
**Features are either production-ready or clearly identified as coming soon. Nothing misleading.** A feature that is honestly absent is acceptable — it can be communicated as roadmap. A feature that appears to work but doesn't is not. The required response to a misleading feature is always one of: fix it, disable it, or clearly label it.

### 5. Data Ownership
**Your data belongs to you. You can export it whenever you choose.** A venue owner (and a couple, on their side of the portal) should never be trapped — able to get a complete, real copy of their own records out of Wevenu on demand.

### 6. Auditability
**Every significant action affecting money, contracts, bookings, or permissions is traceable.** Who did what, when, is recorded — not reconstructed after the fact from memory or inference.

---

## How this is used

- **Feature proposals:** before scoping new work, ask whether it violates any promise above. If it does, the fix (or the disable/label decision) is part of the scope, not a follow-up.
- **Code review:** a change that touches money, contracts, bookings, or permissions should be checked against the relevant promise explicitly, not just for correctness of the immediate diff.
- **Roadmap sequencing:** [[product-completion-roadmap]] Program 1 (Trust Foundation) exists specifically to bring the current codebase into compliance with all six promises before any other Program gets sustained attention. The [[trust-risk-register]] is the tracked list of current violations.
- **New hires / contributors:** this document is the one-page version of "how we think about trust here" — read it before the detailed register.
