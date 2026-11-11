-- Finalize End User Terms for production wording.
-- Source of truth for public marketing pages: marketing/lib/marketing/legal.ts
-- Effective date: 2026-09-11. New version row preserves prior acceptances.
-- Does not rewrite historical migrations or mutate legal_acceptances rows.

update public.legal_documents
set
  is_active = false,
  updated_at = now()
where document_type = 'couple_end_user_terms'
  and is_active = true;

insert into public.legal_documents (
  document_type,
  title,
  version,
  effective_date,
  content,
  is_published,
  is_active
) values
  (
    'couple_end_user_terms',
    'End User Terms',
    '2026-09-11.1',
    '2026-09-11',
    $eut$
# End User Terms

Effective date: September 11, 2026

These End User Terms govern your access to and use of Hello to Cheers (“HTC,” “we,” “us,” or “our”), operated by QuickCloud LLC, a Massachusetts limited liability company, as a couple, client, guest, or other invited participant. By accessing a planning portal, wedding website tools, or related features, you agree to these Terms.

## 1. Who These Terms Cover

These Terms apply to couples, clients, guests, and other people invited to use Hello to Cheers in connection with an event hosted or managed by a participating venue (together, “you” or “End Users”).

They do not replace any separate agreement you may have with a venue or with any vendor. Venue subscribers are also subject to the Venue Subscription Agreement. Invited vendors are subject to the Vendor Terms.

## 2. The Software We Provide

Hello to Cheers provides software and related online tools that venues use to plan, communicate, and coordinate events (the “Services”).

We make the software available. We do not operate your venue, run your event, or provide event services.

## 3. Your Venue Manages the Event

The venue (or other hospitality business) that invited you manages the event relationship—including planning decisions, communications, vendors, and guest experience configuration within Hello to Cheers.

Hello to Cheers is not a party to contracts between you and the venue, and is not a party to contracts between you and any vendors engaged for the event. Venues and vendors are responsible for their own contracted services, pricing, cancellations, refunds, and delivery, subject to applicable law.

## 4. Contracts, Invoices, and Event Payments

Your venue may use Hello to Cheers to prepare, send, and manage event-service contracts, including collecting your signature and the venue’s countersignature. These contracts are between you and your venue. Hello to Cheers provides the software used to facilitate the process but is not a party to those agreements.

Your venue may also use Hello to Cheers to issue invoices, establish payment schedules, and display balances and payment-status information for your event.

When you make an event payment through Hello to Cheers, Stripe processes the payment on your venue’s connected Stripe account. Hello to Cheers does not process event payments or collect event funds.

Your venue is responsible for its event pricing, contractual obligations, cancellation policies, refunds, and delivery of services, subject to applicable law. Questions or disputes about event-service charges, refunds, or cancellations should be directed to your venue and, where appropriate, Stripe.

Vendor contracts and payments are handled independently of Hello to Cheers. The platform does not create, execute, manage, or process vendor contracts or vendor payments.

## 5. What We Are Not Responsible For

Hello to Cheers is not responsible for the venue’s or a vendor’s independent services, pricing, planning decisions, or event execution, or for disputes arising from the event or your relationship with the venue or vendors, subject to applicable law.

Questions about your booking, timeline, vendors, amounts you owe the venue or a vendor, or day-of logistics should be directed to your venue (or the relevant vendor).

## 6. Accounts and Credentials

If you create or receive login credentials, you are responsible for protecting them and for activity that occurs under your account.

Notify your venue or Hello to Cheers promptly if you believe your access has been compromised.

## 7. Lawful Use

You may use the Services only for lawful purposes and in accordance with these Terms and our Acceptable Use Policy.

You agree not to misuse the platform, interfere with its security or integrity, or use it to harm others.

## 8. Privacy

Customer and End User information is protected according to our Privacy Policy, which explains how we collect, use, share, and safeguard information.

Where Hello to Cheers processes information on behalf of a venue, the venue’s instructions and privacy practices may also apply.

Text messaging for venues using Hello to Cheers is described in the “Text Messaging and Communication Information” section of our Privacy Policy, including opt-out via STOP. Accepting these Terms is not SMS consent.

## 9. Suspension

Hello to Cheers may suspend or limit accounts for abuse, security risk, or violations of these Terms or the Acceptable Use Policy.

## 10. Related Policies

Our Privacy Policy and Acceptable Use Policy are incorporated into these Terms by reference. Please review them together with this page.

## 11. Contact

Questions about these Terms: legal@hellotocheers.com

Privacy questions: privacy@hellotocheers.com

General support: the contact methods listed on hellotocheers.com
$eut$,
    true,
    true
  )
on conflict (document_type, version) do update
  set
    title = excluded.title,
    effective_date = excluded.effective_date,
    content = excluded.content,
    is_published = excluded.is_published,
    is_active = excluded.is_active,
    updated_at = now();

update public.legal_documents
set
  is_active = false,
  updated_at = now()
where document_type = 'couple_end_user_terms'
  and version is distinct from '2026-09-11.1'
  and is_active = true;

update public.legal_documents
set
  is_active = true,
  updated_at = now()
where document_type = 'couple_end_user_terms'
  and version = '2026-09-11.1'
  and is_active = false;

notify pgrst, 'reload schema';
