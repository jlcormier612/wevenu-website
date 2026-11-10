-- Finalize Cookie Policy for production wording.
-- Source of truth for public marketing pages: marketing/lib/marketing/legal.ts
-- Effective date unchanged: 2026-07-15. New version row preserves prior acceptances.
-- Does not rewrite historical migrations or mutate legal_acceptances rows.

update public.legal_documents
set
  is_active = false,
  updated_at = now()
where document_type = 'cookie_policy'
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
    'cookie_policy',
    'Cookie Policy',
    '2026-07-15.2',
    '2026-07-15',
    $cookies$
# Cookie Policy

Effective date: July 15, 2026

This Cookie Policy explains how Hello to Cheers (“HTC,” “we,” “us,” or “our”), operated by QuickCloud LLC, a Massachusetts limited liability company, uses cookies and similar technologies on our marketing website and product applications.

For how we handle personal information more broadly, see our Privacy Policy. You can manage nonessential cookie preferences at any time at /cookies.

## 1. What Are Cookies?

Cookies are small text files stored on your device when you visit a website. Similar technologies include local storage, session storage, and scripts that help a site remember preferences, keep you signed in, or understand how pages are used.

We use the word “cookies” in this Policy to include those similar technologies where helpful.

## 2. How We Use Cookies

We use cookies and similar technologies to:

- Operate essential website and product functionality.
- Authenticate users and maintain secure sessions in our venue, client, and vendor experiences.
- Remember preferences, including your cookie-consent choices.
- Support security, integrity, and troubleshooting.
- Optionally measure aggregate use of our marketing website (and, where a venue enables it, certain public venue forms) so we can improve Hello to Cheers—only when analytics is enabled as described below.

## 3. Types of Cookies and Similar Technologies

### Strictly necessary

Required for core features, security, and network operation. These include authentication and session cookies used to keep you signed in to the appropriate Hello to Cheers experience, and limited functional cookies that remember context such as which venue you are working in. They cannot be turned off through our preference controls without breaking sign-in or basic product use.

### Preferences

Help us remember choices you make—most importantly, your cookie preferences stored in your browser (for example in local storage on our marketing site). Preference storage itself is used to honor your selections.

### Analytics

Help us understand aggregate traffic and feature use so we can improve Hello to Cheers.

On our marketing website, analytics is provided through Google Analytics (GA4) when (1) a Measurement ID is configured for that environment and (2) you have turned Analytics on in Cookie Preferences. Analytics is off by default. If analytics is off, or if no Measurement ID is configured, we do not load the Google Analytics script for that surface.

Some venues may optionally configure analytics on their own public inquiry or tour forms. That consent is collected separately on the form and is not controlled by the marketing-site preferences at /cookies.

We design analytics events to avoid sending names, email addresses, or phone numbers as analytics parameters.

### Marketing

We do not currently use advertising pixels, remarketing tags, or similar third-party advertising identifiers on the Hello to Cheers marketing website.

Meta Lead Ads and similar tools that a venue may connect inside the product are venue integrations for receiving leads. They are not advertising cookies placed by the Hello to Cheers marketing site, and they are described further in our Privacy Policy.

## 4. Your Choices

You can manage nonessential cookies for our marketing website at /cookies.

On that page you can keep Analytics off (the default), turn it on, or change your choices later at any time. You can also review links to this Cookie Policy and our Privacy Policy.

Your marketing-site preferences are stored in your browser so they can persist across visits on that device. Clearing site data or using another browser or device may reset them.

You can also control cookies through your browser settings. Blocking some cookies may affect sign-in or other site functionality.

## 5. Updates

We may update this Cookie Policy as our practices evolve. When we do, we will post the revised policy with an updated effective date.

## 6. Contact

Questions about this Cookie Policy:

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

update public.legal_documents
set
  is_active = false,
  updated_at = now()
where document_type = 'cookie_policy'
  and version is distinct from '2026-07-15.2'
  and is_active = true;

update public.legal_documents
set
  is_active = true,
  updated_at = now()
where document_type = 'cookie_policy'
  and version = '2026-07-15.2'
  and is_active = false;

notify pgrst, 'reload schema';
