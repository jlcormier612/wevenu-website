# Vendor Network — Charter Review

**Status:** Review only, no code. Written against the Wevenu Product Strategy Operating Charter, at explicit request, before any further vendor implementation (including the acquisition-paths and Assets work already drafted in `docs/vendor-onboarding-and-assets-design.md`).
**Method:** Every finding below was verified directly against the current code and migrations — not inferred from documentation alone. Where a finding was already suspected from earlier session work, it's re-confirmed here with the exact file/line evidence, not just repeated.

---

## Verdict, up front

The Vendor Network's data model is fundamentally sound — `vendors` (global identity) and `venue_vendor_relationships` (per-venue relationship) is the right shape, and it's the same shape the Relationship work already validated on the customer side. The problems aren't architectural at the core; they're in **duplication that accumulated at the edges** (a dead second portal, two signals for one fact, one entry point with no reconciliation) and in **cognitive load created by breadth, not depth** (many pages, not many hard decisions). Nothing here requires re-architecting the Vendor Network — it requires deleting some of it and adding one dedup check.

---

## System of Record violations

### 1. Two vendor portals — one real, one dead, both still shipping

`/vendor/*` (12 pages, `components/vendor-app/*`, actively developed) is the real system. `/v/[token]` (`components/vendor-portal/vendor-portal-shell.tsx`, 682 lines, plus `lib/vendor-portal/service.ts`) is a second, separate implementation — **already confirmed broken** (its core RPC throws on every call, per the architecture audit), and **nothing in the app links to it anymore** (no code path generates a `/v/${token}` URL). This is 729 lines of dead code presented as if it might still be a live surface.

This is exactly the shape Engineering Standard #9 exists to catch: two implementations of the same concept, one clearly superseding the other, with no reconciliation pass ever run. The fix is deletion, not a fix — there's no reconciliation needed because nothing depends on it.

**Recommendation:** Remove `app/v/[token]`, `components/vendor-portal/`, and `lib/vendor-portal/` entirely. Confirm zero remaining references first (already checked — there are none), then delete. This is the single highest-leverage, lowest-risk cleanup available in the whole Vendor Network.

### 2. Two signals for "has this vendor accepted," and they never sync

`vendors.is_claimed` (boolean) and `vendor_invitations.status` (`pending`/`accepted`/`expired`/`revoked`) both exist to answer the same question. Traced the actual claim flow: `claim_vendor_profile()` sets `vendors.is_claimed = true` and clears `claim_token` — but **never touches `vendor_invitations.status`**. A vendor who fully claims their profile still shows as `pending` in `vendor_invitations` forever.

This isn't a theoretical gap — `vendor_invitations.status` is actively read by real screens: `lib/hq/venue-detail-service.ts`, `lib/hq/support-service.ts`, and `lib/vendor-auth/service.ts`. Wevenu HQ staff looking at a venue's vendor activation can see a vendor as permanently "pending" when that vendor has been active for months.

**Recommendation:** One authoritative signal. Either `claim_vendor_profile()` also updates the matching `vendor_invitations` row to `accepted` (the smaller fix), or `vendor_invitations.status` is retired as a read source in favor of always deriving from `vendors.is_claimed` (the more thorough one, since it removes a field that can drift by construction rather than patching the one place it currently does). Recommend the second — it's the "replace, don't layer" instinct already established this program, applied here.

### 3. No dedup on vendor creation — the same gap Leads had before Phase 1a, unfixed for Vendors

`createVendor()` → `repo.insertVendor()` inserts a new `vendors` row unconditionally, every time, with no match-by-name/email check. CSV import (`importVendorsAction`) calls this exact function in a loop per row — meaning re-importing an updated vendor list, or two coordinators each importing overlapping vendor rosters, silently creates duplicate `vendors` rows for the same real business.

This matters more here than it would look at first, because `vendors` is a **global** table (the same vendor can be shared across multiple venues via `venue_vendor_relationships`, and that global architecture is precisely what makes "Search Existing Wevenu Vendors" possible per the vendor onboarding design). Duplicate vendor rows don't just clutter one venue's list — they fragment the same real-world business across multiple global identities, undermining the shared-directory model before it's even built.

This is also a direct **Trust First** violation as named in the Charter's own example list: *"Import reconciliation"* is explicitly called out as something the system should propose and a human should confirm. Today there is no reconciliation step at all — silent or otherwise.

**Recommendation:** Apply the exact pattern Phase 1a already proved for Leads (`find_lead_by_email`, later generalized into `find_or_create_relationship`): a `find_vendor_by_name_or_email()` match, with CSV import surfacing "this looks like an existing vendor — link or create new?" for anything that matches, rather than silently forking. This is also a direct prerequisite for the "Search Existing Wevenu Vendors" acquisition path proposed separately — that path assumes vendors are already deduplicated; today they aren't.

---

## Where "System proposes. Human confirms." is not yet upheld

Distinct from the import-reconciliation gap above:

- **Nowhere in the vendor space does the system propose anything yet.** There's no vendor enrichment (the "paste website" path doesn't exist today — already scoped correctly, propose-then-confirm, in the vendor onboarding design), no pricing suggestions, no package recommendations. This isn't a violation so much as an absence — worth naming only so that when those features are built, they inherit the same discipline already correctly applied in this session's other designs (Luv drafts, the paste-website proposal), not a shortcut.
- **CSV import's confirmation is batch-level, not row-level.** A coordinator confirms once, for the whole file — reasonable for the common case, but it means a duplicate silently created inside a batch of 40 rows was never actually shown to anyone as a decision. This is the same finding as the dedup gap above, restated from the confirmation-UX angle rather than the data angle.

## Cognitive load

- **The vendor's own portal has 12 top-level pages** (Dashboard, Events, Tasks, Messages, Inquiries, Luv, Packages, Profile, Availability, Documents, Venues, plus Accept). That's real breadth for what should be a focused, professional tool. I don't have evidence this is actively overwhelming vendors today (no complaint or usage data to point to) — naming it as worth a lighter-touch pass (grouping Profile/Availability/Packages under one "My Business" area, for instance) rather than a confirmed problem to fix now. Flagging honestly rather than manufacturing urgency.
- **Vendor category, pricing tier, and preference level are three separate fields** (`VENDOR_CATEGORIES`, `PRICING_TIERS`, `PREFERENCE_LEVELS`) — worth confirming this isn't redundant before assuming it needs simplifying: it isn't. Each answers a genuinely different question (what kind of vendor / how much do they cost / how much does this venue like working with them). This is a case where the Charter's "simplify before expanding" instinct is satisfied already — noted for balance, not every finding in a review should be a problem.

## What's already correctly designed, not a finding but worth confirming

The vendor onboarding design already drafted this session (paste-website enrichment as propose-then-confirm, search-existing-vendors reusing the find-or-create shape, manual entry repositioned as the fallback) is consistent with every principle in the Charter as written. The dedup gap found here (finding #3) is a prerequisite that design already implicitly assumed — it should be sequenced *before* "Search Existing Wevenu Vendors," not after, exactly as that document's own sequencing section already recommended for a different reason (the discoverability/opt-in question). Both reasons point to the same order.

---

## Recommended sequence

1. **Delete the dead `/v/[token]` portal.** Zero risk, zero dependency, immediate reduction in System of Record confusion and maintenance surface.
2. **Fix the claim/invitation sync** (retire `vendor_invitations.status` as a read source, or update it inside `claim_vendor_profile()`). Small, contained, fixes a real HQ-facing misreport today.
3. **Add vendor dedup matching**, applied to `createVendor()` so both manual entry and CSV import inherit it automatically — the same "fix it once, at the shared function" shape already used for Leads and Relationships. This is a prerequisite for the vendor onboarding redesign's later paths, not a separate project.
4. Everything in `docs/vendor-onboarding-and-assets-design.md` follows after, in the order already given there.

No code changes made in this pass — this is the review requested, ahead of implementation.
