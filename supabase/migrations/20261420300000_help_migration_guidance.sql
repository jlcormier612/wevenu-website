-- Practical migration onboarding checklist for venues.
-- Help articles are served from success_library_articles when Supabase is configured.

update public.success_library_articles
set
  title = 'How to Bring Your Business Over',
  why_it_matters = $body$You don't need a perfect setup before you start working in Hello to Cheers. If you already keep clients, a calendar, or booked-event paperwork somewhere else, use this checklist so you bring the right records into the right place — and know what still needs a human look.

---

**Two paths (pick the one that matches what you have)**

**Import Data** (Settings → Import Data) — for a **small, clean list** of clients, leads, vendors, inventory templates, or package templates. Upload CSV, Excel, Word, PDF, or paste a list, then map your columns. Past client event dates can create historical calendar events; future dates stay on the client until you book.

**Migration Center** (Settings → Migration Center) — for a **real cutover**: events, tours, date holds, calendar blocks, packages, documents, and **booked-event invoices, payment schedules, and signed agreements**, with review before anything is created. Upload CSV for those types. Excel/Word/PDF contact lists still use Import Data.

You can also start from **Setup → Bring Your Business**, which opens the same Migration Center and Import Data destinations.

---

**Suggested order**

1. **Venue basics** — Settings → Business & Brand for your venue information.
2. **Calendar & Availability** (recommended before dated events) — Settings → Availability. Add named event spaces and capacity if you host in more than one space. Single-space venues with no dated calendar import can skip ahead.
3. **Clients and leads** — Import Data or Migration Center.
4. **Vendors, inventory templates, and package templates** — Import Data (or packages in Migration Center). Package imports keep included-item descriptions; they do **not** automatically link to inventory stock.
5. **Events, tours, date holds, and calendar blocks** — Migration Center only, one type at a time. Review duplicates and calendar conflicts before you commit.
6. **Booked-event finances** — After the client and event exist, open Migration Center and choose **Booked-event finances (invoice, payments, signed agreement)**. Upload the signed PDF/DOCX or paste booking text, review the proposal, then confirm. Use **Documents** for contract files on a client or event.
7. **Review what was skipped** — Resolve unclear rows in the import session. Session history lets you leave and resume later.
8. **Verify in the product** — Check Clients, Leads, Calendar, Packages, and the event's invoice and documents. Counts on Import Data show live venue records, not only import history.

---

**What will not transfer automatically**

- Standalone payment-only CSV files and retired key-date imports are not available.
- Package templates do not create inventory stock links.
- There is **no one-click undo** of a finished Migration Center session. Keep your source files; remove individual records where the product allows, or use session cleanup for attributed rows when offered.

---

**Day-one setup if you are not migrating yet**

1. Confirm venue information under Settings.
2. Add at least one Package when you are ready to create bookings and invoices.
3. Review Leads → Pipeline so new inquiries match how you work.

You can refine templates, questionnaires, and automation as you go.$body$,
  updated_at = now()
where slug = 'what-should-i-set-up-before-i-start'
  and status = 'published';
