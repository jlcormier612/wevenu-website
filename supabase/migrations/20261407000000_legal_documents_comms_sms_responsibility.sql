-- Sync Customer Communications / SMS responsibility language into active
-- legal_documents for Privacy Policy and Venue Subscription Agreement.
-- Source of truth for public marketing pages: marketing/lib/marketing/legal.ts
-- Effective date: 2026-09-23.

update public.legal_documents
set
  is_active = false,
  updated_at = now()
where document_type in (
  'terms_of_service',
  'venue_terms_of_service',
  'privacy_policy'
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
    '2026-09-23.1',
    '2026-09-23',
    $vsa$
# Venue Subscription Agreement

Effective date: September 23, 2026

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

## 9. Customer Communications and Messaging

Customers are responsible for the communications they send or initiate through the Service, including ensuring that they have any permissions, consents, authorizations, and other legal bases required to contact their recipients.

Hello to Cheers provides communication tools and does not determine whether a customer's particular communication is lawful or whether a recipient has provided legally sufficient consent.

Customers are solely responsible for the content, timing, recipients, frequency, and legal compliance of communications sent through the Service and for obtaining and maintaining any consent required for those communications.

If you use text messaging features, you are responsible for obtaining and maintaining all consent required to send text messages to your recipients. You must not use the Service to send text messages to recipients who have not provided the required permission.

Hello to Cheers will not send text messages through the Service where the required SMS permission has not been recorded. A permission record in Hello to Cheers is a product control for Hello to Cheers’ own messaging requirements; it is not a determination by Hello to Cheers that you were legally entitled to obtain that permission or that any particular message complies with applicable law.

You are responsible for maintaining appropriate records of consent and complying with applicable telecommunications, messaging, privacy, marketing, and consumer-protection laws and regulations.

Hello to Cheers may require evidence of consent, restrict messaging, suspend messaging functionality, or take other action where required by our messaging providers, carriers, applicable law, or our agreements with messaging providers.

## 10. Third-Party Services

The Services may integrate with third parties (including Stripe and communications providers). Your use of those services may be subject to their terms. Hello to Cheers is not responsible for third-party services we do not control.

## 11. Intellectual Property

Hello to Cheers and its licensors own the Services, software, branding, and related intellectual property. Except for the limited rights expressly granted, no rights are transferred to you.

Feedback you provide may be used by Hello to Cheers to improve the Services without obligation to you.

## 12. Confidentiality

Each party may receive confidential information from the other. The receiving party will protect that information with reasonable care and use it only as needed to perform under these Terms, except where disclosure is required by law.

## 13. Disclaimers

The Services are provided “as is” and “as available.” To the maximum extent permitted by law, Hello to Cheers disclaims all warranties, whether express, implied, or statutory, including merchantability, fitness for a particular purpose, and non-infringement.

We do not warrant that the Services will be uninterrupted, error-free, or free of harmful components, or that all content will be secure or not lost.

## 14. Limitation of Liability

To the maximum extent permitted by law, Hello to Cheers will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or any loss of profits, revenue, data, or goodwill.

To the maximum extent permitted by law, Hello to Cheers’ total liability arising out of or related to the Services will not exceed the amounts paid by you to Hello to Cheers for the Services in the twelve (12) months before the event giving rise to liability.

Some jurisdictions do not allow certain limitations; in those cases, our liability is limited to the fullest extent permitted.

## 15. Indemnification

You will defend and indemnify Hello to Cheers against claims arising from your Customer Data, your use of the Services in violation of these Terms, or your violation of law or third-party rights.

## 16. Suspension and Termination

We may suspend or terminate access if you breach these Terms, create risk or possible legal exposure, fail to pay fees, or if required by law. We will provide notice when reasonable and practical.

## 17. Changes to the Services or Terms

We may improve or modify the Services. We may also update these Terms. Material changes will be posted with an updated effective date. Continued use after changes become effective constitutes acceptance.

## 18. Governing Law

These Terms are governed by the laws of the State of Delaware, excluding conflict-of-law rules, unless mandatory local law provides otherwise for consumers where applicable. Venue and jurisdiction will lie in courts located in Delaware, except where prohibited.

## 19. Contact

Questions about these Terms: legal@hellotocheers.com

Billing and account questions: through in-product support or the contact methods on our website.
$vsa$,
    true,
    true
  ),
  (
    'venue_terms_of_service',
    'Venue Subscription Agreement',
    '2026-09-23.1',
    '2026-09-23',
    $vsa2$
# Venue Subscription Agreement

Effective date: September 23, 2026

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

## 9. Customer Communications and Messaging

Customers are responsible for the communications they send or initiate through the Service, including ensuring that they have any permissions, consents, authorizations, and other legal bases required to contact their recipients.

Hello to Cheers provides communication tools and does not determine whether a customer's particular communication is lawful or whether a recipient has provided legally sufficient consent.

Customers are solely responsible for the content, timing, recipients, frequency, and legal compliance of communications sent through the Service and for obtaining and maintaining any consent required for those communications.

If you use text messaging features, you are responsible for obtaining and maintaining all consent required to send text messages to your recipients. You must not use the Service to send text messages to recipients who have not provided the required permission.

Hello to Cheers will not send text messages through the Service where the required SMS permission has not been recorded. A permission record in Hello to Cheers is a product control for Hello to Cheers’ own messaging requirements; it is not a determination by Hello to Cheers that you were legally entitled to obtain that permission or that any particular message complies with applicable law.

You are responsible for maintaining appropriate records of consent and complying with applicable telecommunications, messaging, privacy, marketing, and consumer-protection laws and regulations.

Hello to Cheers may require evidence of consent, restrict messaging, suspend messaging functionality, or take other action where required by our messaging providers, carriers, applicable law, or our agreements with messaging providers.

## 10. Third-Party Services

The Services may integrate with third parties (including Stripe and communications providers). Your use of those services may be subject to their terms. Hello to Cheers is not responsible for third-party services we do not control.

## 11. Intellectual Property

Hello to Cheers and its licensors own the Services, software, branding, and related intellectual property. Except for the limited rights expressly granted, no rights are transferred to you.

Feedback you provide may be used by Hello to Cheers to improve the Services without obligation to you.

## 12. Confidentiality

Each party may receive confidential information from the other. The receiving party will protect that information with reasonable care and use it only as needed to perform under these Terms, except where disclosure is required by law.

## 13. Disclaimers

The Services are provided “as is” and “as available.” To the maximum extent permitted by law, Hello to Cheers disclaims all warranties, whether express, implied, or statutory, including merchantability, fitness for a particular purpose, and non-infringement.

We do not warrant that the Services will be uninterrupted, error-free, or free of harmful components, or that all content will be secure or not lost.

## 14. Limitation of Liability

To the maximum extent permitted by law, Hello to Cheers will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or any loss of profits, revenue, data, or goodwill.

To the maximum extent permitted by law, Hello to Cheers’ total liability arising out of or related to the Services will not exceed the amounts paid by you to Hello to Cheers for the Services in the twelve (12) months before the event giving rise to liability.

Some jurisdictions do not allow certain limitations; in those cases, our liability is limited to the fullest extent permitted.

## 15. Indemnification

You will defend and indemnify Hello to Cheers against claims arising from your Customer Data, your use of the Services in violation of these Terms, or your violation of law or third-party rights.

## 16. Suspension and Termination

We may suspend or terminate access if you breach these Terms, create risk or possible legal exposure, fail to pay fees, or if required by law. We will provide notice when reasonable and practical.

## 17. Changes to the Services or Terms

We may improve or modify the Services. We may also update these Terms. Material changes will be posted with an updated effective date. Continued use after changes become effective constitutes acceptance.

## 18. Governing Law

These Terms are governed by the laws of the State of Delaware, excluding conflict-of-law rules, unless mandatory local law provides otherwise for consumers where applicable. Venue and jurisdiction will lie in courts located in Delaware, except where prohibited.

## 19. Contact

Questions about these Terms: legal@hellotocheers.com

Billing and account questions: through in-product support or the contact methods on our website.
$vsa2$,
    true,
    true
  ),
  (
    'privacy_policy',
    'Privacy Policy',
    '2026-09-23.1',
    '2026-09-23',
    $priv$
# Privacy Policy

Effective date: September 23, 2026

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
- Communication-related information where applicable (phone numbers, email addresses, communication preferences, text-messaging permission and opt-out status, consent timestamps and source or method, message history, delivery or status information, and related communication metadata).
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
- Messaging and communications service providers that help us provide, deliver, monitor, or support email, text messaging, and related communications on behalf of Hello to Cheers and its customers.
- Professional advisors (legal, accounting) when reasonably necessary.
- Authorities when required by law or to protect rights, safety, and security.
- A successor entity in connection with a merger, acquisition, or asset transfer, subject to appropriate protections.

## 7. Customer Content and Venue Relationships

Venues control much of the content they store in Hello to Cheers. Clients, guests, and vendors interacting through a venue’s workspace are generally engaging with that venue’s configuration of the Services.

Hello to Cheers may process that content to deliver the product features the venue enables (portals, messaging, planning, payments records, and related tools).

When a venue uses Hello to Cheers to communicate with its leads, clients, guests, or other recipients, Hello to Cheers may process communication-related information on behalf of that venue as described in this Privacy Policy. The venue remains responsible for the communications it sends or initiates and for obtaining and maintaining any permission required to contact those recipients.

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

## Text Messaging and Communication Information

When a venue uses Hello to Cheers to communicate with you by text message, your phone number and related messaging information may be processed by Hello to Cheers and our messaging service providers to deliver those messages.

Hello to Cheers may maintain communication preference and consent records, including whether text messaging permission has been recorded, when that permission was recorded, how it was obtained, and whether it was subsequently withdrawn.

Text messaging is only enabled through Hello to Cheers where the required recipient permission has been recorded. Recording permission in Hello to Cheers means Hello to Cheers has a product record used to enforce its own text-messaging requirements; it does not mean Hello to Cheers has determined that a venue was legally entitled to obtain that permission or that a particular message is lawful.

Communication information may be processed by service providers that help us provide, deliver, monitor, or support communications on behalf of Hello to Cheers and its customers.

Venues that use Hello to Cheers may communicate with leads and clients by text message about their inquiry, tour or appointment, event planning, and related booking logistics.

How we collect mobile numbers: A mobile number may be collected when you submit a venue’s Hello to Cheers inquiry or tour-booking form, or when you otherwise provide it to the venue in connection with your event.

Phone number is not SMS consent: Entering or providing a mobile number is not, by itself, permission to send SMS.

Communication preference is not SMS consent: Selecting “Text message” as a preferred way to be contacted is a preference only and is not SMS permission.

Explicit SMS permission: When the venue enables the text-message permission request on its form, you may separately check an optional box (unchecked by default) authorizing texts. Checking that box is voluntary. You can submit an inquiry or book a tour without agreeing to text messages. SMS consent is not required to use Hello to Cheers or to complete the underlying inquiry or tour transaction. The permission language presented on that form is the consent language we record when you opt in.

Message frequency: Message frequency varies with your inquiry, tour, and event planning. You may receive occasional texts when the venue team needs to reach you about your visit or celebration; you will not receive a fixed daily message volume.

Message and data rates may apply.

Opt out / opt in: Reply STOP to opt out of further texts from that venue messaging program. Reply START to opt back in. Ordinary inbound replies, other than STOP/START and related carrier keywords, are not treated as ongoing SMS permission.

No sale/share of SMS consent for marketing: We do not sell, rent, or share mobile numbers or SMS consent/opt-in information with third parties or affiliates for their marketing or promotional purposes. Mobile numbers and related messaging records are used to operate venue relationship communications through Hello to Cheers and as otherwise described in this Privacy Policy, including service providers that process messages on our behalf.

## 11. International Transfers

Hello to Cheers may process information in the United States and other countries where we or our service providers operate. Where required, we use appropriate safeguards for cross-border transfers.

## 12. Children’s Privacy

Hello to Cheers is built for business use by venues and related professionals. The Services are not directed to children under 16, and we do not knowingly collect personal information from children for marketing purposes.

## 13. Changes to This Policy

We may update this Privacy Policy from time to time. We will post the updated version with a revised effective date and, when changes are material, provide additional notice as appropriate.

## 14. Contact

For privacy questions or requests: privacy@hellotocheers.com

For general support: the contact methods listed on hellotocheers.com
$priv$,
    true,
    true
  );
