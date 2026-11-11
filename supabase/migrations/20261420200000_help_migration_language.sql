-- Honest Import Data vs Migration Center directions on the Getting Started help article.
-- Body lives in success_library_articles.why_it_matters (Help article renderer).

update public.success_library_articles
set
  why_it_matters = $body$You don't need a perfect setup before you start working in Hello to Cheers.

For most venues, start with three things:

**1. Your venue information**

Go to **Your Venue → Settings** and make sure your basic venue information is correct.

**2. Your basic offerings**

If you're ready to start creating bookings and invoices, make sure you have at least one Package set up.

**3. Your inquiry process**

Take a look at **Your Relationships → Leads** and make sure your Pipeline makes sense for the way your venue handles new inquiries.

You can build message templates, questionnaires, planning templates, inventory, and other reusable pieces as you need them.

You don't need to finish everything on day one.

Hello to Cheers is designed so you can build on it as your venue works.

---

**Bringing existing data over**

If you already keep clients, leads, or a calendar somewhere else, choose the path that matches what you have:

**Import Data** (Your Venue → Settings → Import Data) is for a small, clean list of **Clients, Leads, Vendors, Inventory templates, or Package templates**. You can use CSV, Excel, Word, PDF, or a pasted list. Past Client event dates can create historical calendar Events; future dates stay on the Client until you book.

**Migration Center** (Your Venue → Settings → Migration Center) is for a real cutover: **Events, tours, date holds, calendar blocks**, plus clients/leads/vendors/packages with review before anything is created. It is also where you bring over **invoices, payment schedules, and signed agreements** (Active commitment) and **contract or other files** (Documents). Migration Center accepts CSV for those entity types; Excel/Word/PDF contact lists still use Import Data.

Before you import dated Events, set up **Calendar & Availability** (spaces and capacity) if you host in more than one named space.

Standalone payment CSV and retired key-date imports are not available. Package imports bring description-based included items, not inventory stock links.

If an import looks wrong after you commit, keep the original file and use individual record deletes where the product allows — there is no one-click undo of a finished Migration Center session.$body$,
  updated_at = now()
where slug = 'what-should-i-set-up-before-i-start'
  and status = 'published';
