-- Register the existing Date Availability Guidance article in the published
-- index. The article already exists in lib/help-guides/final-articles.ts and
-- is already routable from Calendar. The 31-article seed never inserted this
-- slug, so the Guidance landing page omitted it.
-- Same slug/title/body — insert only if missing. Do not create a duplicate.

insert into public.success_library_articles
  (slug, title, goal_category, why_it_matters, when_to_use, best_practices, common_mistakes, related_features, linked_gap_keys, status)
select
  'how-does-date-availability-work',
  'How Does Date Availability Work?',
  'Finding & Booking Clients',
  $body$You decide when a date is protected.

HTC does not automatically reserve a date because a couple submits an inquiry, names a preferred date, signs a contract, or makes a payment.

A date is protected in HTC in one of two ways:

• Hold: You deliberately place a Hold on the date.
• Booked: You move the relationship to Booked, either yourself or through an automation you've configured.

Your venue may have its own booking process. HTC records and enforces the booking decision you make; it does not impose its own definition of when a couple is booked.

A preferred date is not a reservation. A couple can tell you they want June 14, but June 14 remains available until you deliberately protect it.

A Hold is not a booking. Whether a Hold prevents another booking is your availability setting, and that setting applies wherever HTC checks availability.

Choose whether tours can be scheduled when a booked event is occupying the date. This setting applies wherever HTC checks tour availability.

Blocked time, and an appointment configured to block availability, make that time unavailable. They are not bookings.

Preparing a client's planning workspace does not reserve their date. You can do that work ahead of booking. You control when the client becomes Booked.$body$,
  '',
  '',
  '',
  '[]'::jsonb,
  array[]::text[],
  'published'
where not exists (
  select 1
  from public.success_library_articles
  where slug = 'how-does-date-availability-work'
);
