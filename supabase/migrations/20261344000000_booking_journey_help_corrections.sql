-- ============================================================================
-- Booking Journey Help corrections — align articles with commercial Booked
-- (agreement executed + deposit paid) and Selected Package language.
-- ============================================================================

update public.success_library_articles
set
  why_it_matters = 'A booking is real when the agreement is done and the initial deposit is paid — that is the moment they are Booked in Hello to Cheers.',
  when_to_use = 'After the couple chooses a package. Start a booking file if you need a client workspace, then send an offer (Path A) or create a contract (Path B), collect the deposit, and celebrate Booked only after the deposit is paid.',
  best_practices = 'Select the package on the lead first so the price carries forward. Use Send offer or Create contract from the Selected Package — do not retype the amount. After they accept or sign, use Set up payments to create the $ commitment and deposit request. Start booking file only opens the workspace; it is not Booked yet.',
  common_mistakes = 'Treating Start booking file as Booked. Creating invoices without a Selected Package and retyping prices. Skipping the deposit and assuming a signed contract alone means Booked.',
  updated_at = now()
where slug = 'signing-your-first-contract';

update public.success_library_articles
set
  why_it_matters = 'Cash flow stays healthy when the package total, deposit, and remaining balance are clear from day one — and couples can see what they owe.',
  when_to_use = 'As soon as the agreement is accepted or signed — use Set up payments on the booking to create the commitment invoice and deposit schedule.',
  best_practices = 'Use Set up payments from the Booking Journey (not Retainer vs Full Invoice as equal choices). Confirm the package total, set the deposit, and create the remaining balance on one payment plan. Request the deposit, then watch remaining payments after they are Booked.',
  common_mistakes = 'Building a payment schedule with no invoice. Asking the couple to choose among Retainer / Full Invoice / New Invoice. Waiting until the first due date is close to set anything up.',
  updated_at = now()
where slug = 'getting-paid-on-time';

update public.success_library_articles
set
  why_it_matters = 'Library packages are reusable offerings. A Selected Package is the frozen copy of what this couple actually bought — Library edits never change it.',
  when_to_use = 'Build packages in the Library any time. Select a package on a lead when you know what they are buying.',
  best_practices = 'Price packages in the Library before selecting them for a couple. After selection, use Send offer or Create contract — the Selected Package carries name, total, and inclusions forward.',
  common_mistakes = 'Expecting a Library price change to update an existing couple''s Selected Package. Forgetting to set a Library price before trying to select a package.',
  updated_at = now()
where slug = 'creating-your-first-package';

notify pgrst, 'reload schema';
