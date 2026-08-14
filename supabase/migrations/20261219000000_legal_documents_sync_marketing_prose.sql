-- Sync marketing counsel prose into active legal_documents versions.
-- Deactivates placeholder seeds and inserts immutable new active, published
-- versions for Venue Subscription Agreement (terms_of_service), legacy
-- venue_terms_of_service (activate still links it), Privacy, Cookie, and AUP.
-- couple_end_user_terms / vendor_end_user_terms already hold counsel drafts.
-- Effective dates align with marketing/lib/marketing/legal.ts (July 15, 2026).

update public.legal_documents
set
  is_active = false,
  updated_at = now()
where document_type in (
  'terms_of_service',
  'venue_terms_of_service',
  'privacy_policy',
  'cookie_policy',
  'acceptable_use_policy'
)
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
    'terms_of_service',
    'Venue Subscription Agreement',
    '2026-07-15.1',
    '2026-07-15',
    $vsa$
# Venue Subscription Agreement

Effective date: July 15, 2026

These Terms of Service govern your access to and use of Hello to Cheers. By creating an account or using the Services, you agree to these Terms. If you are accepting on behalf of a venue or organization, you represent that you have authority to bind that entity.

## 1. Overview

Hello to Cheers provides cloud software and related services to help venues manage sales, planning, operations, communication, financial workflows, and guest experiences (the “Services”).

These Terms form a binding agreement between you and Hello to Cheers. Additional product-specific terms, order forms, or policies (including our Privacy Policy, Cookie Policy, and Acceptable Use Policy) are incorporated by reference.

## 2. Accounts and Eligibility

You must provide accurate account information and keep it updated. You are responsible for safeguarding credentials and for activity under your account.

You must be able to form a binding contract and use the Services only for lawful business purposes related to venue or hospitality operations.

## 3. Subscriptions and Billing

Paid plans are offered on a month-to-month basis unless otherwise stated in writing. Fees are charged in advance for each billing period through our payment processor.

Except where required by law or stated in our 30-Day Happiness Promise, fees are generally non-refundable once a billing period begins.

We may change prices with notice before the change takes effect for subsequent billing periods. Continued use after the effective date constitutes acceptance of the updated pricing.

You authorize us and our payment processor to charge the payment method on file for recurring fees and applicable taxes.

## 4. 30-Day Happiness Promise

If you are a new paying subscriber and Hello to Cheers is not the right fit during your first 30 days, you may request a refund of your first month’s subscription fee.

After the first 30 days, your subscription continues month-to-month until canceled. This Promise does not apply to third-party fees, custom professional services, or amounts charged by venues to their own clients.

## 5. Cancellation

You may cancel your subscription at any time through account billing settings (or another method we provide).

Cancellation stops future renewals. You generally retain access through the end of the then-current paid period unless otherwise stated.

We do not charge cancellation fees for standard monthly subscriptions.

## 6. Your Data and Ownership

You retain ownership of the content and data you submit to the Services (“Customer Data”).

You grant Hello to Cheers a limited license to host, process, transmit, display, and otherwise use Customer Data solely to provide and improve the Services and as otherwise permitted in these Terms and our Privacy Policy.

You are responsible for the accuracy of Customer Data and for obtaining any consents needed to collect and process information about your clients, guests, vendors, and staff through Hello to Cheers.

## 7. Data Export and Departure

We intend for you to be able to export Customer Data through product export tools before cancellation, without requiring a support ticket for ordinary export needs.

After cancellation or account closure, we may delete or de-identify Customer Data according to our retention practices, except where we must retain records for legal, security, or billing reasons.

## 8. Acceptable Use

You agree not to misuse the Services. Prohibited conduct includes unauthorized access, interference with system integrity, unlawful content, harassment, spam, infringement of others’ rights, or attempts to reverse engineer the Services except where prohibited by law from restricting that activity.

Additional details appear in our Acceptable Use Policy.

## 9. Third-Party Services

The Services may integrate with third parties (including Stripe and communications providers). Your use of those services may be subject to their terms. Hello to Cheers is not responsible for third-party services we do not control.

## 10. Intellectual Property

Hello to Cheers and its licensors own the Services, software, branding, and related intellectual property. Except for the limited rights expressly granted, no rights are transferred to you.

Feedback you provide may be used by Hello to Cheers to improve the Services without obligation to you.

## 11. Confidentiality

Each party may receive confidential information from the other. The receiving party will protect that information with reasonable care and use it only as needed to perform under these Terms, except where disclosure is required by law.

## 12. Disclaimers

THE SERVICES ARE PROVIDED “AS IS” AND “AS AVAILABLE.” TO THE MAXIMUM EXTENT PERMITTED BY LAW, HELLO TO CHEERS DISCLAIMS ALL WARRANTIES, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.

We do not warrant that the Services will be uninterrupted, error-free, or free of harmful components, or that all content will be secure or not lost.

## 13. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, HELLO TO CHEERS WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL.

TO THE MAXIMUM EXTENT PERMITTED BY LAW, HELLO TO CHEERS’ TOTAL LIABILITY ARISING OUT OF OR RELATED TO THE SERVICES WILL NOT EXCEED THE AMOUNTS PAID BY YOU TO HELLO TO CHEERS FOR THE SERVICES IN THE TWELVE (12) MONTHS BEFORE THE EVENT GIVING RISE TO LIABILITY.

Some jurisdictions do not allow certain limitations; in those cases, our liability is limited to the fullest extent permitted.

## 14. Indemnification

You will defend and indemnify Hello to Cheers against claims arising from your Customer Data, your use of the Services in violation of these Terms, or your violation of law or third-party rights.

## 15. Suspension and Termination

We may suspend or terminate access if you breach these Terms, create risk or possible legal exposure, fail to pay fees, or if required by law. We will provide notice when reasonable and practical.

## 16. Changes to the Services or Terms

We may improve or modify the Services. We may also update these Terms. Material changes will be posted with an updated effective date. Continued use after changes become effective constitutes acceptance.

## 17. Governing Law

These Terms are governed by the laws of the State of Delaware, excluding conflict-of-law rules, unless mandatory local law provides otherwise for consumers where applicable. Venue and jurisdiction will lie in courts located in Delaware, except where prohibited.

## 18. Contact

Questions about these Terms: legal@hellotocheers.com

Billing and account questions: through in-product support or the contact methods on our website.
$vsa$,
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
    'venue_terms_of_service',
    'Venue Terms of Service',
    '2026-07-15.1',
    '2026-07-15',
    $vtos$
# Venue Terms of Service

Effective date: July 15, 2026

These Terms of Service govern your access to and use of Hello to Cheers. By creating an account or using the Services, you agree to these Terms. If you are accepting on behalf of a venue or organization, you represent that you have authority to bind that entity.

## 1. Overview

Hello to Cheers provides cloud software and related services to help venues manage sales, planning, operations, communication, financial workflows, and guest experiences (the “Services”).

These Terms form a binding agreement between you and Hello to Cheers. Additional product-specific terms, order forms, or policies (including our Privacy Policy, Cookie Policy, and Acceptable Use Policy) are incorporated by reference.

## 2. Accounts and Eligibility

You must provide accurate account information and keep it updated. You are responsible for safeguarding credentials and for activity under your account.

You must be able to form a binding contract and use the Services only for lawful business purposes related to venue or hospitality operations.

## 3. Subscriptions and Billing

Paid plans are offered on a month-to-month basis unless otherwise stated in writing. Fees are charged in advance for each billing period through our payment processor.

Except where required by law or stated in our 30-Day Happiness Promise, fees are generally non-refundable once a billing period begins.

We may change prices with notice before the change takes effect for subsequent billing periods. Continued use after the effective date constitutes acceptance of the updated pricing.

You authorize us and our payment processor to charge the payment method on file for recurring fees and applicable taxes.

## 4. 30-Day Happiness Promise

If you are a new paying subscriber and Hello to Cheers is not the right fit during your first 30 days, you may request a refund of your first month’s subscription fee.

After the first 30 days, your subscription continues month-to-month until canceled. This Promise does not apply to third-party fees, custom professional services, or amounts charged by venues to their own clients.

## 5. Cancellation

You may cancel your subscription at any time through account billing settings (or another method we provide).

Cancellation stops future renewals. You generally retain access through the end of the then-current paid period unless otherwise stated.

We do not charge cancellation fees for standard monthly subscriptions.

## 6. Your Data and Ownership

You retain ownership of the content and data you submit to the Services (“Customer Data”).

You grant Hello to Cheers a limited license to host, process, transmit, display, and otherwise use Customer Data solely to provide and improve the Services and as otherwise permitted in these Terms and our Privacy Policy.

You are responsible for the accuracy of Customer Data and for obtaining any consents needed to collect and process information about your clients, guests, vendors, and staff through Hello to Cheers.

## 7. Data Export and Departure

We intend for you to be able to export Customer Data through product export tools before cancellation, without requiring a support ticket for ordinary export needs.

After cancellation or account closure, we may delete or de-identify Customer Data according to our retention practices, except where we must retain records for legal, security, or billing reasons.

## 8. Acceptable Use

You agree not to misuse the Services. Prohibited conduct includes unauthorized access, interference with system integrity, unlawful content, harassment, spam, infringement of others’ rights, or attempts to reverse engineer the Services except where prohibited by law from restricting that activity.

Additional details appear in our Acceptable Use Policy.

## 9. Third-Party Services

The Services may integrate with third parties (including Stripe and communications providers). Your use of those services may be subject to their terms. Hello to Cheers is not responsible for third-party services we do not control.

## 10. Intellectual Property

Hello to Cheers and its licensors own the Services, software, branding, and related intellectual property. Except for the limited rights expressly granted, no rights are transferred to you.

Feedback you provide may be used by Hello to Cheers to improve the Services without obligation to you.

## 11. Confidentiality

Each party may receive confidential information from the other. The receiving party will protect that information with reasonable care and use it only as needed to perform under these Terms, except where disclosure is required by law.

## 12. Disclaimers

THE SERVICES ARE PROVIDED “AS IS” AND “AS AVAILABLE.” TO THE MAXIMUM EXTENT PERMITTED BY LAW, HELLO TO CHEERS DISCLAIMS ALL WARRANTIES, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.

We do not warrant that the Services will be uninterrupted, error-free, or free of harmful components, or that all content will be secure or not lost.

## 13. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, HELLO TO CHEERS WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL.

TO THE MAXIMUM EXTENT PERMITTED BY LAW, HELLO TO CHEERS’ TOTAL LIABILITY ARISING OUT OF OR RELATED TO THE SERVICES WILL NOT EXCEED THE AMOUNTS PAID BY YOU TO HELLO TO CHEERS FOR THE SERVICES IN THE TWELVE (12) MONTHS BEFORE THE EVENT GIVING RISE TO LIABILITY.

Some jurisdictions do not allow certain limitations; in those cases, our liability is limited to the fullest extent permitted.

## 14. Indemnification

You will defend and indemnify Hello to Cheers against claims arising from your Customer Data, your use of the Services in violation of these Terms, or your violation of law or third-party rights.

## 15. Suspension and Termination

We may suspend or terminate access if you breach these Terms, create risk or possible legal exposure, fail to pay fees, or if required by law. We will provide notice when reasonable and practical.

## 16. Changes to the Services or Terms

We may improve or modify the Services. We may also update these Terms. Material changes will be posted with an updated effective date. Continued use after changes become effective constitutes acceptance.

## 17. Governing Law

These Terms are governed by the laws of the State of Delaware, excluding conflict-of-law rules, unless mandatory local law provides otherwise for consumers where applicable. Venue and jurisdiction will lie in courts located in Delaware, except where prohibited.

## 18. Contact

Questions about these Terms: legal@hellotocheers.com

Billing and account questions: through in-product support or the contact methods on our website.
$vtos$,
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
    'privacy_policy',
    'Privacy Policy',
    '2026-07-15.1',
    '2026-07-15',
    $privacy$
# Privacy Policy

Effective date: July 15, 2026

This Privacy Policy explains how Hello to Cheers collects, uses, shares, and protects information when you use our websites, products, and related services. Please review it carefully. We will update this page when our practices change.

## 1. Who We Are

Hello to Cheers provides software and related services for independent venues and hospitality businesses (the “Services”). In this Privacy Policy, “Hello to Cheers,” “we,” “us,” and “our” refer to the Hello to Cheers operating entity that provides the Services.

If you have privacy questions, contact us at privacy@hellotocheers.com (or the support address listed on our website).

## 2. Scope

This Privacy Policy applies to our marketing website, product applications, customer accounts, support communications, and related online experiences.

Hello to Cheers is used by venue owners, venue staff, couples, clients, guests, vendors, and other invited collaborators.

Depending on your role, Hello to Cheers may act either as the direct provider of services to you or as a service provider processing information on behalf of a participating venue.

Where Hello to Cheers processes information on behalf of a venue, the venue's instructions and privacy practices also apply.

## 3. Information We Collect

Depending on how you interact with Hello to Cheers, we may collect:

- Account and profile information (name, email, phone, role, venue details).
- Business and operational data you enter into Hello to Cheers (events, clients, planning details, messages, documents, financial records related to venue operations).
- Billing and transaction metadata associated with your subscription (processed with our payment providers).
- Communications you send us (support requests, walkthrough requests, feedback).
- Usage and device information (IP address, browser type, approximate location derived from IP, pages viewed, feature usage, diagnostic logs).
- Cookies and similar technologies as described in our Cookie Policy.

## 4. How We Use Information

We use information to:

- Provide, operate, maintain, and improve the Services.
- Authenticate users, manage accounts, and enforce permissions.
- Process subscriptions and send billing-related notices.
- Provide customer support and respond to requests.
- Communicate product updates, security notices, and service messages.
- Detect, prevent, and investigate fraud, abuse, and security incidents.
- Comply with law and enforce our terms.
- Analyze aggregated or de-identified trends to improve hospitality workflows—not to sell personal profiles.

## 5. What We Do Not Do

We do not sell your personal information.

We do not rent customer databases to third parties for their independent marketing.

We do not use venue customer operational data to build advertising profiles for unrelated products.

## 6. Sharing Information

We share information only as needed to run Hello to Cheers responsibly:

- Service providers who help us host, secure, support, analyze, or process payments (under contractual obligations to protect data).
- Payment processors such as Stripe for subscription billing and related payment operations.
- Professional advisors (legal, accounting) when reasonably necessary.
- Authorities when required by law or to protect rights, safety, and security.
- A successor entity in connection with a merger, acquisition, or asset transfer, subject to appropriate protections.

## 7. Customer Content and Venue Relationships

Venues control much of the content they store in Hello to Cheers. Clients, guests, and vendors interacting through a venue’s workspace are generally engaging with that venue’s configuration of the Services.

Hello to Cheers may process that content to deliver the product features the venue enables (portals, messaging, planning, payments records, and related tools).

## 8. Data Retention

We retain information for as long as needed to provide the Services, comply with legal obligations, resolve disputes, and enforce agreements.

When accounts are canceled, we provide export pathways and retain limited records as required for billing, security, and legal compliance before deletion or anonymization according to our retention practices.

## 9. Security

We implement administrative, technical, and organizational safeguards designed to protect personal information. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.

If we become aware of a breach affecting your personal information, we will notify affected customers and regulators as required by applicable law.

## 10. Your Choices and Rights

Depending on your location, you may have rights to access, correct, delete, export, or restrict certain personal information, or to object to certain processing.

You may also manage cookie preferences where available, and unsubscribe from promotional emails using the link in those messages. Service and billing messages may still be sent as needed to operate your account.

To exercise privacy rights, contact privacy@hellotocheers.com. We may need to verify your request before responding.

## 11. International Transfers

Hello to Cheers may process information in the United States and other countries where we or our service providers operate. Where required, we use appropriate safeguards for cross-border transfers.

## 12. Children’s Privacy

Hello to Cheers is built for business use by venues and related professionals. The Services are not directed to children under 16, and we do not knowingly collect personal information from children for marketing purposes.

## 13. Changes to This Policy

We may update this Privacy Policy from time to time. We will post the updated version with a revised effective date and, when changes are material, provide additional notice as appropriate.

## 14. Contact

For privacy questions or requests: privacy@hellotocheers.com

For general support: the contact methods listed on hellotocheers.com
$privacy$,
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
    'cookie_policy',
    'Cookie Policy',
    '2026-07-15.1',
    '2026-07-15',
    $cookies$
# Cookie Policy

Effective date: July 15, 2026

This Cookie Policy explains how Hello to Cheers uses cookies and similar technologies on our websites and applications.

## 1. What Are Cookies?

Cookies are small text files stored on your device. Similar technologies include local storage, pixels, and session identifiers. They help sites remember preferences, keep you signed in, and understand how experiences are used.

## 2. How We Use Cookies

We may use cookies and similar technologies to:

- Operate essential site and product functionality.
- Authenticate users and maintain secure sessions.
- Remember preferences, including cookie consent choices.
- Understand aggregate traffic and improve our marketing site and product.
- Support security, fraud prevention, and troubleshooting.

## 3. Types of Cookies

- Strictly necessary — required for core features, security, and network management.
- Preferences — remember choices such as consent settings.
- Analytics — help us understand usage in aggregate so we can improve Hello to Cheers.
- Marketing — if used, help us measure campaign effectiveness; we aim to keep these limited and respectful.

## 4. Your Choices

You can manage non-essential cookies through our Cookie Preferences controls where available, and through your browser settings.

Blocking some cookies may affect site functionality.

## 5. Updates

We may update this Cookie Policy as our practices evolve. The effective date above will change when we do.

## 6. Contact

privacy@hellotocheers.com
$cookies$,
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
    'acceptable_use_policy',
    'Acceptable Use Policy',
    '2026-07-15.1',
    '2026-07-15',
    $aup$
# Acceptable Use Policy

Effective date: July 15, 2026

This Acceptable Use Policy (“AUP”) describes prohibited uses of Hello to Cheers. It helps protect venues, their clients and guests, and the integrity of the platform.

## 1. Purpose

Hello to Cheers is built for hospitality professionals. This AUP sets boundaries so the platform remains safe, lawful, and trustworthy.

## 2. Prohibited Activities

You may not use Hello to Cheers to:

- Violate applicable laws or regulations.
- Infringe intellectual property, privacy, or publicity rights.
- Upload malware, attempt unauthorized access, or disrupt the Services.
- Probe, scan, or test system vulnerability without authorization.
- Send spam, phishing, or unsolicited bulk communications unrelated to legitimate venue operations.
- Harass, threaten, or exploit individuals.
- Store or transmit unlawful content.
- Misrepresent your identity or affiliation in a deceptive manner.
- Resell or provide the Services to third parties except as expressly permitted.
- Use automated means to scrape or overload the Services beyond ordinary product use.

## 3. Customer Communications

Venues remain responsible for the content of messages and documents they send through Hello to Cheers to clients, guests, vendors, and staff, and for complying with applicable messaging and privacy laws.

## 4. Enforcement

We may investigate violations and suspend or terminate access, remove content, or report activity to authorities when appropriate.

## 5. Reporting

Report suspected abuse to abuse@hellotocheers.com or through in-product support channels.

## 6. Changes

We may update this AUP. Continued use of Hello to Cheers after updates constitutes acceptance.
$aup$,
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
where document_type = 'terms_of_service'
  and version is distinct from '2026-07-15.1'
  and is_active = true;

update public.legal_documents
set
  is_active = true,
  is_published = true,
  updated_at = now()
where document_type = 'terms_of_service'
  and version = '2026-07-15.1'
  and (is_active = false or is_published = false);

update public.legal_documents
set
  is_active = false,
  updated_at = now()
where document_type = 'venue_terms_of_service'
  and version is distinct from '2026-07-15.1'
  and is_active = true;

update public.legal_documents
set
  is_active = true,
  is_published = true,
  updated_at = now()
where document_type = 'venue_terms_of_service'
  and version = '2026-07-15.1'
  and (is_active = false or is_published = false);

update public.legal_documents
set
  is_active = false,
  updated_at = now()
where document_type = 'privacy_policy'
  and version is distinct from '2026-07-15.1'
  and is_active = true;

update public.legal_documents
set
  is_active = true,
  is_published = true,
  updated_at = now()
where document_type = 'privacy_policy'
  and version = '2026-07-15.1'
  and (is_active = false or is_published = false);

update public.legal_documents
set
  is_active = false,
  updated_at = now()
where document_type = 'cookie_policy'
  and version is distinct from '2026-07-15.1'
  and is_active = true;

update public.legal_documents
set
  is_active = true,
  is_published = true,
  updated_at = now()
where document_type = 'cookie_policy'
  and version = '2026-07-15.1'
  and (is_active = false or is_published = false);

update public.legal_documents
set
  is_active = false,
  updated_at = now()
where document_type = 'acceptable_use_policy'
  and version is distinct from '2026-07-15.1'
  and is_active = true;

update public.legal_documents
set
  is_active = true,
  is_published = true,
  updated_at = now()
where document_type = 'acceptable_use_policy'
  and version = '2026-07-15.1'
  and (is_active = false or is_published = false);

notify pgrst, 'reload schema';
