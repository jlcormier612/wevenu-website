-- Sentence-case VSA disclaimer / liability all-caps paragraphs.
-- Immutable new active versions for terms_of_service and venue_terms_of_service
-- (legacy activate still links the latter). Effective date unchanged: 2026-07-15.
-- Wording otherwise identical to 2026-07-15.1; only casing of the three
-- screaming-caps disclaimer/liability sentences is changed.

update public.legal_documents
set
  is_active = false,
  updated_at = now()
where document_type in (
  'terms_of_service',
  'venue_terms_of_service'
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
    '2026-07-15.2',
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

The Services are provided “as is” and “as available.” To the maximum extent permitted by law, Hello to Cheers disclaims all warranties, whether express, implied, or statutory, including merchantability, fitness for a particular purpose, and non-infringement.

We do not warrant that the Services will be uninterrupted, error-free, or free of harmful components, or that all content will be secure or not lost.

## 13. Limitation of Liability

To the maximum extent permitted by law, Hello to Cheers will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or any loss of profits, revenue, data, or goodwill.

To the maximum extent permitted by law, Hello to Cheers’ total liability arising out of or related to the Services will not exceed the amounts paid by you to Hello to Cheers for the Services in the twelve (12) months before the event giving rise to liability.

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
  ),
  (
    'venue_terms_of_service',
    'Venue Terms of Service',
    '2026-07-15.2',
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

The Services are provided “as is” and “as available.” To the maximum extent permitted by law, Hello to Cheers disclaims all warranties, whether express, implied, or statutory, including merchantability, fitness for a particular purpose, and non-infringement.

We do not warrant that the Services will be uninterrupted, error-free, or free of harmful components, or that all content will be secure or not lost.

## 13. Limitation of Liability

To the maximum extent permitted by law, Hello to Cheers will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or any loss of profits, revenue, data, or goodwill.

To the maximum extent permitted by law, Hello to Cheers’ total liability arising out of or related to the Services will not exceed the amounts paid by you to Hello to Cheers for the Services in the twelve (12) months before the event giving rise to liability.

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
