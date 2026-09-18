-- Lead vs Client / Booking terminology: venue-centric definition.
-- Replaces internal "client/event workspace" language with the approved
-- customer-facing copy. Contracts and payments remain separately tracked;
-- "booked" is explicitly venue-defined.

update public.success_library_articles
   set why_it_matters = $body$A **Lead** is someone you're working with as a potential booking.

A **Client** is a Lead who has become a booking.

**You decide what "booked" means for your venue.**

For some venues, a booking might mean the contract has been signed. For others, it might mean a deposit has been paid, both have happened, or another milestone has been reached.

Hello to Cheers lets you define your sales process around the way your venue actually works. When a Lead becomes booked, that relationship becomes a Client so your team can continue managing the event and everything that follows.

Contracts and payments are tracked separately, so you can always see what has actually been signed, invoiced, and paid.$body$,
       updated_at = now()
 where slug = 'whats-the-difference-between-a-lead-and-a-client';
