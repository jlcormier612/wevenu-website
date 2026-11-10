-- Finalize Privacy Policy and Venue Subscription Agreement for production wording.
-- Source of truth for public marketing pages: marketing/lib/marketing/legal.ts
-- Effective date unchanged: 2026-09-23. New version rows preserve prior acceptances.
-- Includes payment-responsibility reconciliation (HTC SaaS software; Stripe processes event payments).
-- Does not rewrite historical migrations or mutate legal_acceptances rows.

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
    '2026-09-23.2',
    '2026-09-23',
    $vsa$
# Venue Subscription Agreement

Effective date: September 23, 2026

These Terms of Service (the “Terms” or this “Venue Subscription Agreement”) govern your access to and use of Hello to Cheers. By creating an account, completing checkout, or using the Services, you agree to these Terms. If you are accepting on behalf of a venue or organization, you represent that you have authority to bind that entity.

## 1. Overview

Hello to Cheers provides cloud software and related services to help venues manage sales, planning, operations, communication, financial workflows, and guest experiences (the “Services”).

In these Terms, “Hello to Cheers,” “we,” “us,” and “our” refer to Hello to Cheers, operated by QuickCloud LLC, a Massachusetts limited liability company.

These Terms form a binding agreement between the subscribing venue or organization (“you,” “Venue,” or “Customer”) and Hello to Cheers. Additional product-specific terms, order forms, or policies (including our Privacy Policy, Cookie Policy, and Acceptable Use Policy) are incorporated by reference.

Hello to Cheers is a three-sided platform used by venues, their clients and guests, and invited vendors. These Terms apply to the Venue’s subscription and workspace. Couples, clients, guests, and other invited participants are also subject to our End User Terms. Invited vendors are also subject to our Vendor Terms. Venue staff and collaborators use the Services under the Venue’s account and authority.

## 2. Accounts and Eligibility

You must provide accurate account information and keep it updated. You are responsible for safeguarding credentials and for activity under your account, including activity by staff and collaborators you invite.

You must be able to form a binding contract and use the Services only for lawful business purposes related to venue or hospitality operations.

## 3. Subscriptions and Billing

Paid plans are offered on a month-to-month basis unless otherwise stated in writing. Fees are charged in advance for each billing period through our payment processor (currently Stripe).

Plan eligibility and pricing are described on our Pricing page (or another offer we present in writing), including event-volume tiers (currently Gather, Celebrate, and Flourish), founding or promotional percentage discounts when available, and optional one-time setup fees such as White Glove Setup when you purchase them. All current subscription plans include the core feature set; tiers differ by qualifying event volume as described on Pricing.

Except where required by applicable law, subscription fees are generally non-refundable once a billing period begins. Unused days in a paid period are not refunded if you cancel mid-period.

We may change prices with notice before the change takes effect for subsequent billing periods. Continued use after the effective date constitutes acceptance of the updated pricing for those later periods.

You authorize us and our payment processor to charge the payment method on file for recurring fees, applicable taxes, and any optional one-time fees you select at checkout or in-product.

If a payment fails, we (and our payment processor) may retry charges. Access may continue for a limited grace period and then be suspended if fees remain unpaid, as described in our product entitlement practices and Stripe’s payment retry behavior.

## 4. Cancellation

You may cancel your subscription at any time through account billing settings (Stripe Customer Billing Portal) or another method we provide.

Cancellation stops future renewals. You generally retain access through the end of the then-current paid period unless otherwise stated.

We do not charge cancellation fees for standard monthly subscriptions. Canceling does not, by itself, entitle you to a refund of fees already paid for the current period, except where required by law.

## 5. Venue-Client Contracts and Event Payments

Hello to Cheers provides software that helps Venues create and manage contracts, invoices, payment schedules, and related records, and that can open Stripe payment flows for amounts clients owe the Venue.

Contracts for venue or event services are between you (the Venue) and your client. Hello to Cheers is not a party to those contracts and is not the provider of your event or hospitality services.

When a client pays an amount related to your event through a payment flow opened from Hello to Cheers, Stripe processes that payment on your connected Stripe account. Hello to Cheers does not process event payments, does not collect event funds, and is not the merchant of record for those venue-client transactions. Stripe’s terms and privacy notices also apply.

You remain responsible for your prices, contracts, cancellations, refunds, taxes, chargebacks, and service delivery to your clients. Disputes, refunds, and chargebacks relating to amounts your clients pay you are between you, your client, and Stripe, as applicable. Hello to Cheers may provide software access to related records without becoming a party to the underlying transaction.

Subscription fees you pay Hello to Cheers for the Services are a separate relationship and are processed by Stripe for Hello to Cheers subscription billing.

## 6. Your Data and Ownership

You retain ownership of the content and data you and your authorized users submit to the Services (“Customer Data”), including operational records about your clients, guests, vendors, and events.

You grant Hello to Cheers a limited license to host, process, transmit, display, and otherwise use Customer Data solely to provide, maintain, secure, and support the Services (including optional assistive features that may use third-party artificial-intelligence providers as described in our Privacy Policy) and as otherwise permitted in these Terms and our Privacy Policy.

You are responsible for the accuracy of Customer Data and for obtaining any consents needed to collect and process information about your clients, guests, vendors, and staff through Hello to Cheers.

Clients, guests, and vendors may also submit information through portals or tools you enable. That information is processed to provide the Services and, where it is your Customer Data, remains subject to your instructions and responsibilities as described in these Terms and the Privacy Policy.

## 7. Data Export and Departure

You may export Customer Data through in-product export tools before cancellation. A recovery export path may remain available for a limited period after access ends, where provided in the product.

When a venue’s subscription ends—meaning the effective end of paid access to the Services, not merely the date cancellation is scheduled—Hello to Cheers ordinarily retains the venue’s account data for a 90-day recovery period. During that period, recovery or export may be available through supported product mechanisms, subject to account status and applicable restrictions.

After that 90-day recovery period, you should not expect account data to remain accessible, recoverable, or available for export. Hello to Cheers may delete or de-identify data after the recovery period in accordance with its retention practices. These Terms do not promise that every record is automatically deleted on day 90.

Some records may be retained longer for legitimate legal, financial, security, operational, backup, or third-party processing purposes—including billing records and information held by payment or communications providers.

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

The Services may integrate with third parties (including Stripe, communications providers, and artificial-intelligence providers used for optional assistive features). Your use of those services may be subject to their terms. Hello to Cheers is not responsible for third-party services we do not control.

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

You will defend and indemnify Hello to Cheers against claims arising from your Customer Data, your use of the Services in violation of these Terms, your communications, your event services or venue-client payment practices, or your violation of law or third-party rights.

## 16. Suspension and Termination

We may suspend or terminate access if you breach these Terms, create risk or possible legal exposure, fail to pay fees, or if required by law. We will provide notice when reasonable and practical.

## 17. Changes to the Services or Terms

We may improve or modify the Services. We may also update these Terms. Material changes will be posted with an updated effective date. Continued use after changes become effective constitutes acceptance.

## 18. Governing Law

These Terms are governed by the laws of the Commonwealth of Massachusetts, excluding conflict-of-law rules, unless mandatory local law provides otherwise. Venue and jurisdiction will lie in state or federal courts located in Massachusetts, except where prohibited.

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
    '2026-09-23.2',
    '2026-09-23',
    $vsa2$
# Venue Subscription Agreement

Effective date: September 23, 2026

These Terms of Service (the “Terms” or this “Venue Subscription Agreement”) govern your access to and use of Hello to Cheers. By creating an account, completing checkout, or using the Services, you agree to these Terms. If you are accepting on behalf of a venue or organization, you represent that you have authority to bind that entity.

## 1. Overview

Hello to Cheers provides cloud software and related services to help venues manage sales, planning, operations, communication, financial workflows, and guest experiences (the “Services”).

In these Terms, “Hello to Cheers,” “we,” “us,” and “our” refer to Hello to Cheers, operated by QuickCloud LLC, a Massachusetts limited liability company.

These Terms form a binding agreement between the subscribing venue or organization (“you,” “Venue,” or “Customer”) and Hello to Cheers. Additional product-specific terms, order forms, or policies (including our Privacy Policy, Cookie Policy, and Acceptable Use Policy) are incorporated by reference.

Hello to Cheers is a three-sided platform used by venues, their clients and guests, and invited vendors. These Terms apply to the Venue’s subscription and workspace. Couples, clients, guests, and other invited participants are also subject to our End User Terms. Invited vendors are also subject to our Vendor Terms. Venue staff and collaborators use the Services under the Venue’s account and authority.

## 2. Accounts and Eligibility

You must provide accurate account information and keep it updated. You are responsible for safeguarding credentials and for activity under your account, including activity by staff and collaborators you invite.

You must be able to form a binding contract and use the Services only for lawful business purposes related to venue or hospitality operations.

## 3. Subscriptions and Billing

Paid plans are offered on a month-to-month basis unless otherwise stated in writing. Fees are charged in advance for each billing period through our payment processor (currently Stripe).

Plan eligibility and pricing are described on our Pricing page (or another offer we present in writing), including event-volume tiers (currently Gather, Celebrate, and Flourish), founding or promotional percentage discounts when available, and optional one-time setup fees such as White Glove Setup when you purchase them. All current subscription plans include the core feature set; tiers differ by qualifying event volume as described on Pricing.

Except where required by applicable law, subscription fees are generally non-refundable once a billing period begins. Unused days in a paid period are not refunded if you cancel mid-period.

We may change prices with notice before the change takes effect for subsequent billing periods. Continued use after the effective date constitutes acceptance of the updated pricing for those later periods.

You authorize us and our payment processor to charge the payment method on file for recurring fees, applicable taxes, and any optional one-time fees you select at checkout or in-product.

If a payment fails, we (and our payment processor) may retry charges. Access may continue for a limited grace period and then be suspended if fees remain unpaid, as described in our product entitlement practices and Stripe’s payment retry behavior.

## 4. Cancellation

You may cancel your subscription at any time through account billing settings (Stripe Customer Billing Portal) or another method we provide.

Cancellation stops future renewals. You generally retain access through the end of the then-current paid period unless otherwise stated.

We do not charge cancellation fees for standard monthly subscriptions. Canceling does not, by itself, entitle you to a refund of fees already paid for the current period, except where required by law.

## 5. Venue-Client Contracts and Event Payments

Hello to Cheers provides software that helps Venues create and manage contracts, invoices, payment schedules, and related records, and that can open Stripe payment flows for amounts clients owe the Venue.

Contracts for venue or event services are between you (the Venue) and your client. Hello to Cheers is not a party to those contracts and is not the provider of your event or hospitality services.

When a client pays an amount related to your event through a payment flow opened from Hello to Cheers, Stripe processes that payment on your connected Stripe account. Hello to Cheers does not process event payments, does not collect event funds, and is not the merchant of record for those venue-client transactions. Stripe’s terms and privacy notices also apply.

You remain responsible for your prices, contracts, cancellations, refunds, taxes, chargebacks, and service delivery to your clients. Disputes, refunds, and chargebacks relating to amounts your clients pay you are between you, your client, and Stripe, as applicable. Hello to Cheers may provide software access to related records without becoming a party to the underlying transaction.

Subscription fees you pay Hello to Cheers for the Services are a separate relationship and are processed by Stripe for Hello to Cheers subscription billing.

## 6. Your Data and Ownership

You retain ownership of the content and data you and your authorized users submit to the Services (“Customer Data”), including operational records about your clients, guests, vendors, and events.

You grant Hello to Cheers a limited license to host, process, transmit, display, and otherwise use Customer Data solely to provide, maintain, secure, and support the Services (including optional assistive features that may use third-party artificial-intelligence providers as described in our Privacy Policy) and as otherwise permitted in these Terms and our Privacy Policy.

You are responsible for the accuracy of Customer Data and for obtaining any consents needed to collect and process information about your clients, guests, vendors, and staff through Hello to Cheers.

Clients, guests, and vendors may also submit information through portals or tools you enable. That information is processed to provide the Services and, where it is your Customer Data, remains subject to your instructions and responsibilities as described in these Terms and the Privacy Policy.

## 7. Data Export and Departure

You may export Customer Data through in-product export tools before cancellation. A recovery export path may remain available for a limited period after access ends, where provided in the product.

When a venue’s subscription ends—meaning the effective end of paid access to the Services, not merely the date cancellation is scheduled—Hello to Cheers ordinarily retains the venue’s account data for a 90-day recovery period. During that period, recovery or export may be available through supported product mechanisms, subject to account status and applicable restrictions.

After that 90-day recovery period, you should not expect account data to remain accessible, recoverable, or available for export. Hello to Cheers may delete or de-identify data after the recovery period in accordance with its retention practices. These Terms do not promise that every record is automatically deleted on day 90.

Some records may be retained longer for legitimate legal, financial, security, operational, backup, or third-party processing purposes—including billing records and information held by payment or communications providers.

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

The Services may integrate with third parties (including Stripe, communications providers, and artificial-intelligence providers used for optional assistive features). Your use of those services may be subject to their terms. Hello to Cheers is not responsible for third-party services we do not control.

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

You will defend and indemnify Hello to Cheers against claims arising from your Customer Data, your use of the Services in violation of these Terms, your communications, your event services or venue-client payment practices, or your violation of law or third-party rights.

## 16. Suspension and Termination

We may suspend or terminate access if you breach these Terms, create risk or possible legal exposure, fail to pay fees, or if required by law. We will provide notice when reasonable and practical.

## 17. Changes to the Services or Terms

We may improve or modify the Services. We may also update these Terms. Material changes will be posted with an updated effective date. Continued use after changes become effective constitutes acceptance.

## 18. Governing Law

These Terms are governed by the laws of the Commonwealth of Massachusetts, excluding conflict-of-law rules, unless mandatory local law provides otherwise. Venue and jurisdiction will lie in state or federal courts located in Massachusetts, except where prohibited.

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
    '2026-09-23.2',
    '2026-09-23',
    $privacy$
# Privacy Policy

Effective date: September 23, 2026

This Privacy Policy explains how Hello to Cheers collects, uses, shares, and protects information when you use our websites, products, and related services. Please review it carefully. We will update this page when our practices change.

## 1. Who We Are

Hello to Cheers provides software and related services for independent venues and hospitality businesses (the “Services”). In this Privacy Policy, “Hello to Cheers,” “we,” “us,” and “our” refer to Hello to Cheers, operated by QuickCloud LLC, a Massachusetts limited liability company.

If you have privacy questions, contact us at privacy@hellotocheers.com (or the support address listed on our website).

## 2. Scope

This Privacy Policy applies to our marketing website, product applications, customer accounts, support communications, and related online experiences.

Hello to Cheers is used by venue owners, venue staff, couples, clients, guests, vendors, and other invited collaborators.

Depending on your role, Hello to Cheers may act either as the direct provider of services to you or as a service provider processing information on behalf of a participating venue.

Where Hello to Cheers processes information on behalf of a venue, the venue’s instructions and privacy practices also apply.

## 3. Information We Collect

Depending on how you interact with Hello to Cheers, we may collect:

- Account and profile information (name, email, phone, role, venue details).
- Business and operational data you enter into Hello to Cheers (events, clients, vendors, planning details, guest lists, messages, documents, and financial or payment records related to venue operations).
- Communication-related information where applicable (phone numbers, email addresses, communication preferences, text-messaging permission and opt-out status, consent timestamps and source or method, message history, delivery or status information, and related communication metadata).
- Billing and payment-related information associated with (a) Hello to Cheers subscription billing and (b), when a venue enables Stripe-connected payment workflows in the software, payment and invoice records the venue maintains about amounts its clients pay the venue (processed by Stripe on the venue’s connected account).
- Communications you send us (support requests, walkthrough requests, feedback).
- Usage and device information (IP address, browser type, approximate location derived from IP, pages viewed, feature usage, diagnostic logs).
- Cookies and similar technologies as described in our Cookie Policy (see also Cookie Preferences at /cookies).

## 4. How We Use Information

We use information to:

- Provide, operate, maintain, and improve the Services.
- Authenticate users, manage accounts, and enforce permissions.
- Process Hello to Cheers subscription billing and related notices, and provide software features that help venues organize invoices, payment schedules, and Stripe payment-workflow information.
- Provide optional assistive features (including Luv) that generate suggestions or answers for users to review.
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

- Service providers who help us host, secure, support, analyze, or operate the Services (under contractual obligations to protect data).
- Payment processors such as Stripe for (a) Hello to Cheers subscription billing and (b), when a venue connects its Stripe account, processing of venue-client event payments by Stripe on that venue’s connected account. Hello to Cheers does not process those event payments. Stripe’s use of payment information is also described in Stripe’s privacy notices.
- Artificial-intelligence providers (currently OpenAI) when a venue or invited user uses optional assistive features, as described in Section 7A.
- Messaging and communications service providers that help us provide, deliver, monitor, or support email, text messaging, and related communications on behalf of Hello to Cheers and its customers.
- Integrations a venue chooses to connect (for example accounting or advertising lead-intake tools), in which case information is shared as needed to operate that integration.
- Professional advisors (legal, accounting) when reasonably necessary.
- Authorities when required by law or to protect rights, safety, and security.
- A successor entity in connection with a merger, acquisition, or asset transfer, subject to appropriate protections.

## 7. Customer Content and Venue Relationships

Venues control much of the content they store in Hello to Cheers. Clients, guests, and vendors interacting through a venue’s workspace are generally engaging with that venue’s configuration of the Services.

Hello to Cheers may process that content to deliver the product features the venue enables (portals, messaging, planning, payments records, and related tools).

When a venue uses Hello to Cheers to communicate with its leads, clients, guests, or other recipients, Hello to Cheers may process communication-related information on behalf of that venue as described in this Privacy Policy. The venue remains responsible for the communications it sends or initiates and for obtaining and maintaining any permission required to contact those recipients.

Clients, guests, vendors, and venue staff may need to contact the venue for many requests about Customer Data the venue controls. Hello to Cheers will assist with privacy requests as required by law and our agreements.

## 7A. Assistive AI (Luv and related features)

Optional Hello to Cheers features—including Luv drafting, Ask Luv, guest concierge answers, weekly roll-ups, and import or extraction assistance—may send limited information to a third-party artificial-intelligence provider (currently OpenAI) so the feature can generate a suggestion or answer.

Depending on the feature, that information can include venue names, staff names, client or couple names, event details, message or document content the venue already stores, published wedding-website or venue-guide content, analytics summaries (which may include engagement or payment-status indicators), and text a staff member pastes for import. These transmissions can include personal information.

These features are typically initiated by a user action (for example, generating a draft, asking a question, running an import assist, or generating a roll-up). Some features may also run when a venue enables them or requests them through product workflows. Some outputs (such as drafts or roll-ups) may be saved in the venue’s Hello to Cheers workspace for review. Luv drafting can be disabled in venue settings where provided. Features that require an AI provider are unavailable when that provider is not configured.

## 8. Data Retention

We retain information for as long as needed to provide the Services, comply with legal obligations, resolve disputes, and enforce agreements.

When a venue’s subscription ends—meaning the effective end of paid access to the Services, not merely the date cancellation is scheduled—Hello to Cheers ordinarily retains the venue’s account data for a 90-day recovery period. During that period, recovery or export may be available through supported product mechanisms, subject to account status and applicable restrictions. Clients may export certain planning information from their portal where available.

After that 90-day recovery period, you should not expect account data to remain accessible, recoverable, or available for export. Hello to Cheers may delete or de-identify data after the recovery period in accordance with its retention practices. This Policy does not promise that every record is automatically deleted on day 90.

Some records may be retained longer for legitimate legal, financial, security, operational, backup, or third-party processing purposes—including billing and payment records, security logs, and information held by payment or communications providers.

## 9. Security

We implement administrative, technical, and organizational safeguards designed to protect personal information—including access controls, encrypted connections in transit, and careful permissioning within venue workspaces. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.

If we become aware of a breach affecting your personal information, we will notify affected customers and regulators as required by applicable law.

## 10. Your Choices and Rights

Depending on your location, you may have rights to access, correct, delete, export, or restrict certain personal information, or to object to certain processing.

You may manage cookie preferences at /cookies where available, and unsubscribe from promotional emails using the link in those messages. Service and billing messages may still be sent as needed to operate your account.

To exercise privacy rights, contact privacy@hellotocheers.com. We may need to verify your request before responding.

## 11. Text Messaging and Communication Information

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

## 12. International Transfers

Hello to Cheers is operated from the United States. If you access the Services from another country, your information may be processed in the United States and in other locations where our service providers process data. Where applicable law requires a specific transfer mechanism, we will use an appropriate mechanism available under that law.

## 13. Children’s Privacy

Hello to Cheers is built for business use by venues and related professionals. The Services are not directed to children, and we do not knowingly collect personal information from children for Hello to Cheers’ own marketing.

Venues and their clients may include information about children in event-planning records—for example, guest-list entries that note a child guest, age, seating or high-chair needs, meal notes, or similar details. That information is Customer Data controlled by the venue (and entered by venue staff or by clients through tools the venue enables). Hello to Cheers processes it to provide the Services.

Parents or guardians with questions about guest-list or event information should contact the venue. If you believe a child has provided personal information to Hello to Cheers outside a venue’s event records, contact privacy@hellotocheers.com and we will take appropriate steps.

## 14. Changes to This Policy

We may update this Privacy Policy from time to time. We will post the updated version with a revised effective date and, when changes are material, provide additional notice as appropriate.

## 15. Contact

For privacy questions or requests: privacy@hellotocheers.com

For general support: the contact methods listed on hellotocheers.com
$privacy$,
    true,
    true
  );
