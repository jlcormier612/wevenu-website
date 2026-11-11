-- Guidance: replace Vendors article body with portal/shared-relationship copy.
-- Editorial source: lib/help-guides/final-articles.ts (same wording).
-- Same slug/title — update only, do not insert a duplicate.

update public.success_library_articles
   set why_it_matters = $body$Vendors can be invited into Hello to Cheers so everyone is working from the same information.

When you invite a vendor, they can create or access their own portal and maintain their business information, contact details, services, and other profile information. You don't have to keep updating their information for them.

Once a vendor is connected to an event, clients can see the vendor information you've made available to them, communicate with the vendor, and make vendor choices directly when appropriate.

Those interactions stay connected to the event, so your venue can see the pertinent details without having to chase information across emails, texts, and separate vendor systems.

Vendor = owns their information.

Client = can connect and make choices.

Venue = stays connected to the whole relationship.

The goal is simple: everyone works together, while the venue keeps the context it needs to manage the event.$body$,
       updated_at = timezone('utc', now())
 where slug = 'how-do-vendors-work-in-hello-to-cheers';
