-- Client-first contract signing Help + Event Readiness location.

update public.success_library_articles
   set title = 'How Does Contract Signing Work?',
       why_it_matters = $body$Hello to Cheers uses a client-first signing process.

When you create a contract, you prepare it and send it to the client for review.

The client can read through the contract and ask questions or request changes before signing.

Once the client is comfortable with the agreement, the client signs it first.

After the client signs, the contract comes back to you for review and your signature.

The sequence is:

Create → Send to Client → Client Reviews → Client Signs → Venue Signs → Fully Executed

If changes are needed while the client is reviewing the contract, you can make those changes before the client signs.

Once the client has signed, the version they signed is preserved. If you need to make changes instead of signing, the signed version remains part of the contract history and the revised version must go through the review and signing process again.

Once both the client and venue have signed, the contract is Fully Executed and becomes locked.

The completed contract then appears in Documents for both the venue and the client.

Contracts and payments are related, but they are separate records in Hello to Cheers. Signing a contract does not automatically create an invoice or payment plan.$body$,
       updated_at = now()
 where slug = 'who-signs-a-contract-first-and-what-happens-after';

update public.success_library_articles
   set why_it_matters = $body$Event Readiness gives you a quick way to see whether an event has something that needs your attention.

You'll find it on the client's booking workspace:

**Clients → open the client → Overview → Event Readiness**

It isn't another task list.

If something needs actual work, you'll find that work in places such as **Task Center**, **Requests**, **Financials**, or the relevant planning area of the event.

Think of Event Readiness as a quick question:

**Is there anything about this event that needs my attention right now?**

Use the underlying workspace to do the actual work.$body$,
       updated_at = now()
 where slug = 'what-does-event-readiness-mean';
