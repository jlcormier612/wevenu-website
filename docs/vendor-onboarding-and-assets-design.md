# Vendor Onboarding & Vendor Documents — Design

**Status:** Design only — no code yet. Written per explicit request to redesign vendor acquisition around four paths and unify vendor documents, before touching implementation.
**Relationship to other docs:** This is a concrete application of `docs/product-completion-roadmap.md` principle 5 (the venue should experience customers, not architecture — same principle, now applied to vendors) and principle 4 (the eventual unified Asset model — contracts, invoices, floor plans, and now vendor documents, one concept). It's also the second real instance of the North Star: *every completed phase should reduce cognitive load for the venue owner.*

**Guiding principle, stated plainly:** A venue shouldn't feel like they're creating a vendor record. They should feel like they're adding someone they already work with. Manual entry is the exception, never the default.

---

## Current state (grounded, not assumed)

Before designing anything, here's what's actually real today:

- **Manual entry** (`components/vendors/vendor-form.tsx`) is the only path most coordinators see. `websiteUrl` and `logoUrl` are plain text inputs — nothing fetches or reads the page at that URL today.
- **CSV import already works**, further along than the other three paths: `lib/import/types.ts`'s `VENDOR_FIELDS`, wired through `components/settings/import-wizard.tsx` and `importVendorsAction`, genuinely creates real `vendors` + `venue_vendor_relationships` rows. Two real gaps: it only accepts `.csv` today (the file input's `accept` is `.csv` — no `.xlsx`), and it's tucked inside Settings → Import rather than surfaced from the Vendors page itself, where a coordinator adding their first vendors would actually be looking.
- **Vendors are already a global, shared table** — `vendors` (the business's own identity) is separate from `venue_vendor_relationships` (this venue's specific relationship to them), unique per `(venue_id, vendor_id)`. This is the same split the Relationship/Person exploration cited as the precedent for the customer side. It means a "search existing Wevenu vendors" feature is not a schema change — it's a search UI over a table that already supports exactly this shape.
- **A real vendor invite/claim flow already exists** (`app/(app)/vendors/actions.ts`, `app/vendor/accept`): a venue emails a claim link, a vendor claims their own profile and gets their own login. This matters for path 3 below — vendors already have a self-service identity distinct from any one venue's copy of them, which is the mechanism a shared directory would build on.
- **Vendor documents have exactly one real upload path today**: the venue coordinator's `DocumentsSection` (`entityType="vendor"`) on `components/vendors/vendor-detail.tsx` — the same shared component used for lead/client/event documents. The vendor's own portal page for this (`app/vendor/documents/page.tsx`) is a **hardcoded stub** — "No documents yet," wired to nothing. Vendors cannot upload anything of their own today.
- The `documents` table has **no uploader/ownership column at all** — no `uploaded_by_type`, no `uploaded_by_id`. Every row looks identical regardless of who (eventually) puts it there.

That last point matters more than it looks: because there's only one real writer today, this is the cheapest possible moment to add ownership metadata — before a second writer (vendor self-upload) exists to retrofit against.

---

## The four acquisition paths

### 1. Import Existing Vendor List (CSV/Excel/CRM)

**Already the most real of the four.** What's actually needed:
- Accept `.xlsx` in addition to `.csv` (currently CSV-only) — "Excel" is explicitly named and isn't supported yet.
- Surface this as a first-class entry point *from the Vendors page itself* (an empty-state "Import your vendor list" action), not just from Settings — a coordinator adding vendors for the first time is looking at the Vendors page, not Settings.
- "CRM" isn't a separate mechanism — the import wizard was already made generic this session ("works with any spreadsheet export," per the CSV template work) — a HoneyBook/Aisle Planner/etc. export is just a CSV, already covered.

### 2. Paste Vendor Website (auto-discover)

**Doesn't exist today — a genuinely new capability.** Design:
- A single URL field + "Fetch" action, replacing (or preceding) the current blank manual form.
- Server-side: fetch the page, parse OpenGraph/meta tags for name, description, and a preview image; best-effort regex/pattern extraction for an email, phone number, and social links (Instagram/Facebook/etc. URLs are structurally predictable).
- **Pre-fill, never auto-save.** This follows the exact trust pattern already established for Luv drafts elsewhere in this app: the system proposes, a human reviews and edits before anything is committed. Real business websites vary too much for this to ever be a guarantee — treat it as a strong starting point, not a promise. Every pre-filled field stays a normal editable field.
- Honest scoping: some sites will yield a name and logo but nothing else; that's success, not failure — it's still less typing than starting blank.

### 3. Search Existing Wevenu Vendors (future Marketplace, architecture now)

**Architecturally close to free, given the schema already described above.** Design:
- A search step (by business name, category, location) over the global `vendors` table, shown before the "create new" fallback.
- Selecting a match doesn't create a new `vendors` row — it creates a new `venue_vendor_relationships` row pointing at the existing one. This is the identical "find or create" shape already used everywhere in Program 2 (`find_or_create_relationship`, `find_lead_by_email`) — the same pattern, applied to the vendor side.
- **One real, deliberate open question, not a schema gap:** should every claimed vendor be searchable by every venue automatically, or does a vendor need to explicitly opt into a shared directory beyond just claiming their profile? This is the mirror image of the caution raised in the earlier Relationship/Person exploration — but the answer likely points the other way here: vendors already have a self-service identity and a login precisely because they're independent businesses that expect to be found by more than one venue, unlike customers. Recommendation: claiming a profile is a reasonable default signal of "wants to be discoverable," but this should be a named, confirmed product decision before building the search, not an assumption baked in silently.

### 4. Manual Entry (the exception)

Stays exactly as it is today (`vendor-form.tsx`) — the fallback when the other three don't find or produce a usable match. The only change is *positioning*: today it's likely the single, default "+ New Vendor" action. It should become the last option in a small chooser, not the first thing a coordinator sees.

---

## Vendor Documents → Assets: one list, ownership metadata

The instinct to resist here is the same one already named for Conversation: don't let "venue uploaded this" and "vendor uploaded that" become two systems that happen to relate to the same vendor, the way `message_threads` and `couple_threads` did for messaging.

Because there's only one real writer today, the fix is cheap and should happen **before** vendor self-upload is built, not after:

1. Add ownership metadata to the existing `documents` table: `uploaded_by_type` (`venue` | `vendor`), `uploaded_by_id`. A small, additive migration against a system with exactly one current writer — the easy version of a change that gets much harder once two independent writers exist.
2. When vendor self-upload is eventually built (giving vendors a real way to submit their own COI, insurance, W9), it writes into this same table, through the same `DocumentsSection` component already shared across leads/clients/events/vendors — not a new table, not a new component, not a second page.
3. The only visible UI change: a small "Uploaded by [Venue name] / [Vendor name]" attribution on each document. One list, regardless of origin — exactly the ask.
4. This is the vendor-side instance of the Asset model already sketched in `docs/domain-model.md` and `docs/product-completion-roadmap.md` principle 4 (Type / Visibility / Linked To) — ownership is a natural extension of that same model, not a separate concept invented for vendors specifically.

## Sequencing recommendation

Not all four paths are equally far from done, and the cheapest, highest-leverage step is the documents fix, not any of the acquisition paths:

1. **Documents ownership metadata** — small, safe, and strictly easier now than later. Do this first regardless of which acquisition path comes next.
2. **CSV import promotion + `.xlsx` support** — the path that's already real; this is mostly surfacing and widening what exists, not building something new.
3. **Paste Vendor Website** — the biggest genuinely new build of the four, but self-contained and doesn't depend on the other paths.
4. **Search Existing Wevenu Vendors** — architecturally ready, but shouldn't start until the discoverability/opt-in question above is actually decided, not assumed.

No code has been written for any of this — this document is the checkpoint before that starts, consistent with how every other significant design shift this project has made was handled.
