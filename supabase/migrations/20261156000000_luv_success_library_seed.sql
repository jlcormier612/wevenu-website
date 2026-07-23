-- Luv's Success Library — starter content (2026-07-22). Real articles, not
-- placeholder copy, so the Library isn't empty the first time a venue
-- opens it. More is meant to be authored through /admin/success-library
-- without a deploy — this migration only seeds the first few.
insert into public.success_library_articles
  (slug, title, goal_category, why_it_matters, when_to_use, best_practices, common_mistakes, related_features, linked_gap_keys, status)
values
  (
    'creating-your-first-package',
    'Creating Your First Package',
    'Growing Your Venue',
    'A package is the thing a couple actually books — without one, there is nothing for a lead to say yes to, no matter how good your follow-up is.',
    'Set this up before you send your first real inquiry response, and revisit it any time your pricing or included services change.',
    'Keep the name and price couples would actually search for. List what''s included in plain language, not internal jargon. Start with one solid all-in package before building variants — you can always add more later.',
    'Waiting until "everything is perfect" before publishing. Bundling so much in one package that couples can''t compare it to anything. Forgetting to update it when your pricing changes.',
    '[{"label": "Create a package", "href": "/packages/new"}]'::jsonb,
    array['first_package'],
    'published'
  ),
  (
    'inviting-your-first-couple',
    'Inviting Your First Couple to Their Portal',
    'Growing Your Venue',
    'Until a couple opens their portal, they have no home for their planning — no timeline, no guest list, nowhere to see what''s next. Every follow-up still happens over email until this first invite goes out.',
    'As soon as a lead is ready to book, or right after their contract is signed.',
    'Send the invite yourself with a short personal note rather than relying on the email alone. Mention one specific thing they can do first (like confirming their guest count) so the portal isn''t just an empty room.',
    'Sending the invite and never following up if they don''t open it. Assuming the invite email speaks for itself without any personal context.',
    '[{"label": "View clients", "href": "/clients"}]'::jsonb,
    array['first_portal_invite', 'first_portal_open'],
    'published'
  ),
  (
    'getting-paid-on-time',
    'Getting Paid, On Time',
    'Getting Paid',
    'Cash flow keeps the venue running. A payment schedule that''s clear from day one is the single biggest lever for avoiding awkward, late collection conversations later.',
    'Set up a payment schedule as soon as a contract is signed — don''t wait until the first due date is close.',
    'Break the total into a deposit plus a small number of milestone payments tied to real dates (booking, 90 days out, final balance). Let the platform send reminders automatically instead of chasing manually.',
    'Only tracking payments outside the platform (spreadsheets, memory) so nothing reminds anyone when something is overdue. Setting due dates that don''t leave you room to react if a payment slips.',
    '[{"label": "View payments", "href": "/payments"}]'::jsonb,
    array['first_payment_received'],
    'published'
  ),
  (
    'signing-your-first-contract',
    'Turning a Lead into a Signed Client',
    'Booking More Tours',
    'A booking isn''t real until the contract is signed — this is the moment a lead actually becomes a client, and the moment your calendar hold becomes permanent.',
    'Right after a couple confirms they want to book, ideally while their excitement from the tour is still fresh.',
    'Send the contract the same day you agree on terms — momentum fades fast. Use a template so nothing important is missing, and follow up once if it sits unsigned for more than a few days.',
    'Letting a verbal "yes" sit for a week before sending paperwork. Sending a contract with placeholder terms that still need manual fixing before it can be signed.',
    '[{"label": "View clients", "href": "/clients"}, {"label": "Contract templates", "href": "/library/contracts"}]'::jsonb,
    array['first_contract_signed'],
    'published'
  ),
  (
    'working-with-your-vendor-network',
    'Getting the Most from Your Vendor Network',
    'Working with Vendors',
    'Your preferred vendors are the difference between a couple scrambling to find a photographer and a couple trusting you to have already solved that problem for them.',
    'Build your vendor directory before you need it — the first time a couple asks "do you have anyone you recommend," you want a real answer.',
    'Keep your directory current: mark vendors as preferred once you''ve worked with them and trust them. Assign a vendor to the timeline as soon as they''re booked so they know exactly when and where to show up.',
    'Only remembering to recommend a vendor after a couple already found someone else on their own. Never assigning a booked vendor to the actual event timeline, so they find out details late.',
    '[{"label": "Vendor directory", "href": "/vendors"}]'::jsonb,
    array['first_vendor_assigned'],
    'published'
  )
on conflict (slug) do nothing;
