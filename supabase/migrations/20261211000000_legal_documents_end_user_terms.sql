-- Replace placeholder Couple End User Terms with full End User Terms prose.
-- Appends a new immutable active version and deactivates prior versions.

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
  is_active
) values
  (
    'couple_end_user_terms',
    'End User Terms',
    '2026-07-15.1',
    '2026-07-15',
    $eut$
# End User Terms

Effective date: July 15, 2026

These End User Terms govern your access to and use of Hello to Cheers as a couple, client, guest, or other invited participant. By accessing a planning portal, wedding website tools, or related features, you agree to these Terms.

## 1. Who These Terms Cover

These Terms apply to couples, clients, guests, and other people invited to use Hello to Cheers in connection with an event hosted or managed by a participating venue (together, "you" or "End Users").

They do not replace any separate agreement you may have with a venue. Venue subscribers are also subject to the Venue Subscription Agreement.

## 2. The Platform We Provide

Hello to Cheers provides the software platform and related online tools that venues use to plan, communicate, and coordinate events (the "Services").

We make the technology available; we do not operate your venue or run your event.

## 3. Your Venue Manages the Event

The venue (or other hospitality business) that invited you manages the event relationship—including planning decisions, communications, vendors, and guest experience configuration within Hello to Cheers.

Hello to Cheers is not a party to contracts between you and the venue, and is not a party to contracts between you and any vendors engaged for the event.

## 4. What We Are Not Responsible For

Hello to Cheers is not responsible for venue pricing, planning decisions, vendor selection, event execution, or disputes arising from the event or your relationship with the venue or vendors.

Questions about your booking, timeline, vendors, payments owed to the venue, or day-of logistics should be directed to your venue.

## 5. Accounts and Credentials

If you create or receive login credentials, you are responsible for protecting them and for activity that occurs under your account.

Notify your venue or Hello to Cheers promptly if you believe your access has been compromised.

## 6. Lawful Use

You may use the Services only for lawful purposes and in accordance with these Terms and our Acceptable Use Policy.

You agree not to misuse the platform, interfere with its security or integrity, or use it to harm others.

## 7. Privacy

Customer and End User information is protected according to our Privacy Policy, which explains how we collect, use, share, and safeguard information.

Where Hello to Cheers processes information on behalf of a venue, the venue's instructions and privacy practices may also apply.

## 8. Suspension

Hello to Cheers may suspend or limit accounts for abuse, security risk, or violations of these Terms or the Acceptable Use Policy. We will provide notice when reasonable and practical.

## 9. Related Policies

Our Privacy Policy and Acceptable Use Policy are incorporated into these Terms by reference. Please review them together with this page.

## 10. Contact

Questions about these Terms: legal@hellotocheers.com

Privacy questions: privacy@hellotocheers.com

General support: the contact methods listed on hellotocheers.com
$eut$,
    true
  )
on conflict (document_type, version) do update
  set
    title = excluded.title,
    effective_date = excluded.effective_date,
    content = excluded.content,
    is_active = excluded.is_active,
    updated_at = now();

-- Ensure only this version is active if upsert re-ran against a prior active row.
update public.legal_documents
set
  is_active = false,
  updated_at = now()
where document_type = 'couple_end_user_terms'
  and version is distinct from '2026-07-15.1'
  and is_active = true;

update public.legal_documents
set
  is_active = true,
  updated_at = now()
where document_type = 'couple_end_user_terms'
  and version = '2026-07-15.1'
  and is_active = false;

notify pgrst, 'reload schema';
