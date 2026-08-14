-- Help & Guides P0 content — approved article set (18 new + 1 existing unchanged).
-- Taxonomy: existing 12 areas only. Automation articles → Finding & Booking Clients.
-- "Planning Events" in editorial source maps to canonical "Building the Event".
-- Does not modify getting-started-your-first-morning or the five original articles.

insert into public.success_library_articles
  (slug, title, goal_category, why_it_matters, when_to_use, best_practices, common_mistakes, related_features, linked_gap_keys, status)
values
  (
    'getting-started-what-to-set-up-before-i-start',
    'What should I set up before I start?',
    'Getting Started',
    'You don''t need to configure everything before you can use Hello to Cheers.

Start with the few things that make the rest of the system useful, then add the rest as you need it.',
    'Go to:

Your Venue → Settings

Under Venue information, complete the fields marked required, then create your first Package.',
    '1. Complete your basic venue information

Go to:

Your Venue → Settings

Under Venue information, complete the fields marked required:

- Venue name
- Owner name
- Time zone

Then click:

Save changes

Other information such as your legal business name, email, phone, website, address, venue type, and maximum capacity can be completed when you''re ready.

2. Your brand colors are optional

Scroll to:

Brand colors

You''ll see:

- Primary
- Secondary
- Accent
- Neutral

Hello to Cheers already has sensible defaults, so you don''t need to choose colors before you can get started.

If you want to customize them, make your selections and click:

Save changes

3. Create your first Package

Go to:

Library → Pricing & Packages → Packages

Then choose the option to create a package.

You can also go directly to:

/packages/new

Enter your:

Package name

That''s the only required field.

You can add:

- Base price
- Category
- Description

The Base price field is optional. If you haven''t decided on pricing yet, leave it blank rather than entering $0.

Click:

Create Package

You''re ready

Your new package will appear in the Packages list immediately.',
    'You do not need to configure every part of Hello to Cheers before you start using it.',
    '[{"label":"Open Settings","href":"/settings"},{"label":"Create a package","href":"/packages/new"}]'::jsonb,
    array[]::text[],
    'published'
  ),
  (
    'how-does-my-pipeline-work',
    'How does my Pipeline work?',
    'Finding & Booking Clients',
    'Your Pipeline gives you a visual way to see where each lead is in your sales process.',
    'Go to:

Sales → Leads

Then open the:

Pipeline

view.

You can also go directly to the Pipeline view from the Leads area.',
    'How the board works

Each column represents a Pipeline stage.

Each stage shows:

- the stage name;
- the number of leads in that stage;
- the running dollar total for that stage.

A lead appears as a card in the stage where they currently are.

Move a lead

To move a lead, drag their card from one stage to another.

You can move a lead forward or backward as your sales process changes.

If the destination stage has an active Automation, Hello to Cheers will show you a confirmation before the move. See:

What happens when I move a lead into a stage with an Automation?

How you''ll know it worked

The lead card appears in the new Pipeline column.',
    'If the destination stage has an active Automation, Hello to Cheers will show you a confirmation before the move.',
    '[{"label":"Open Leads","href":"/leads"}]'::jsonb,
    array[]::text[],
    'published'
  ),
  (
    'can-i-customize-my-pipeline-stages',
    'Can I customize my Pipeline stages?',
    'Finding & Booking Clients',
    'Yes. You can customize the names and order of your sales stages so the Pipeline matches the way your venue actually works.',
    'Go to:

Sales → Leads

Open the:

Pipeline

view.

Then choose:

Pipeline Templates',
    'Edit your Pipeline

On the Pipeline Templates list, choose:

Edit

for the template you want to customize.

For each stage you can edit:

Stage name

This is the name your team sees on the Pipeline board.

You can also configure:

Probability %

and the stage''s display color.

One field is different

You''ll also see:

Canonical stage

This is a system value used by Hello to Cheers behind the scenes.

It connects your customized stage to system behavior such as reporting and Automation triggers.

You can customize the Stage name, but the Canonical stage is not free-form text.

When you''re finished, click:

Save changes

How you''ll know it worked

Return to the Pipeline.

Your new stage name appears on the Pipeline column.',
    'You can customize the Stage name, but the Canonical stage is not free-form text.',
    '[{"label":"Pipeline Templates","href":"/library/pipeline-templates"},{"label":"Open Leads","href":"/leads"}]'::jsonb,
    array[]::text[],
    'published'
  ),
  (
    'what-happens-when-i-move-a-lead-into-a-stage-with-an-automation',
    'What happens when I move a lead into a stage with an Automation?',
    'Finding & Booking Clients',
    'Hello to Cheers will warn you before moving the lead if the destination stage has an active Automation that would enroll that person.

This protects you from accidentally triggering a customer-facing message simply because you were reorganizing your Pipeline.',
    'Drag a lead into the destination stage.

If an active Automation would enroll that lead, a confirmation appears before anything changes.',
    'What happens

Drag a lead into the destination stage.

If an active Automation would enroll that lead, a confirmation appears before anything changes.

The dialog says:

"This stage has an active Automation. Moving this lead here will enroll them and may send the messages you''ve configured."

You''ll also see a preview of the first message that would be sent.

If you choose Cancel

Click:

Cancel

The lead stays in its original stage.

- The lead is not moved.
- No Automation enrollment occurs.
- No message is sent.

If you choose Continue

Click:

Continue

The lead moves to the new stage and is enrolled in the Automation.

The Automation then follows its normal schedule.

How you''ll know it worked

The lead appears in the new Pipeline column.

You can also open the lead''s relationship and check:

Activity

for the Automation enrollment.',
    'If you choose Cancel

Click:

Cancel

The lead stays in its original stage.

- The lead is not moved.
- No Automation enrollment occurs.
- No message is sent.',
    '[{"label":"Open Leads","href":"/leads"},{"label":"Automations","href":"/communication/series"}]'::jsonb,
    array[]::text[],
    'published'
  ),
  (
    'whats-the-difference-between-a-lead-and-a-client',
    'What''s the difference between a Lead and a Client?',
    'Finding & Booking Clients',
    'The easiest way to think about it is:

Lead = someone you''re still trying to book.

Client = someone who has booked.',
    'Leads live under:

Sales → Leads

Booked relationships live under:

Clients → Clients',
    'Leads

Leads live under:

Sales → Leads

This is where you manage people who are still moving through your sales process.

When someone books

When a lead reaches the booked/won outcome, Hello to Cheers automatically creates their Client record.

You do not need to manually create a second person or copy their information.

Clients

Booked relationships live under:

Clients → Clients

Their existing lead history remains connected to the relationship.

If you can''t find someone under Leads

If someone has already booked, look under:

Clients → Clients

They haven''t disappeared. They''ve moved into the client side of the relationship.',
    'You do not need to manually create a second person or copy their information when someone books.',
    '[{"label":"Open Leads","href":"/leads"},{"label":"Open Clients","href":"/clients"}]'::jsonb,
    array[]::text[],
    'published'
  ),
  (
    'who-signs-a-contract-first-and-what-happens-after',
    'Who signs a contract first, and what happens after?',
    'Contracts & Payments',
    'Hello to Cheers uses a deliberate signing order:

Venue signs first → Release to client → Client signs → Finalize',
    'Go to:

Financials → Contracts

Choose:

+ New Contract',
    '1. Create the contract

Go to:

Financials → Contracts

Choose:

+ New Contract

On the New Contract screen:

1. Choose a Template.
2. Select the Client.
3. Enter the Contract title.
4. Review the Contract content.

You can use:

Preview with client details

to see the contract with its client information resolved.

Then click:

Create draft contract

2. Sign as the venue

Open the new contract and choose:

Sign contract

The Sign as venue panel opens.

Enter:

Full legal name

Then confirm:

I agree this constitutes my legal signature on this agreement.

Click:

Sign contract

If you signed by mistake and the contract has not yet been released, you can use:

Withdraw signature

3. Release it to the client

After the venue signs, the primary action becomes:

Release to client

This is a separate step.

The client does not receive the contract simply because the venue signed it.

When you release it, each required client signer receives their own signing link.

4. Client signs

After the required client signer or signers complete signing, the contract becomes:

Fully signed

5. Finalize

Once everyone has signed, choose:

Finalize Contract

The finalized contract can then be downloaded as a final PDF.',
    'The important thing to remember

Signing and releasing are two different actions.

Your signature does not automatically send the contract to the client.',
    '[{"label":"Contracts","href":"/contracts"}]'::jsonb,
    array[]::text[],
    'published'
  ),
  (
    'can-more-than-one-person-sign-a-contract',
    'Can more than one person sign a contract?',
    'Contracts & Payments',
    'Yes. You can require more than one client contact to sign the same agreement.',
    'Before you start

The client needs multiple contacts with email addresses.

Start from:

Financials → Contracts → + New Contract

Select the Client.',
    'Choose the required signers

After selecting the client, look for:

Required client signers

You''ll see the client''s eligible contacts.

The product explains:

Choose who must sign this agreement. Leave unchecked to use the default primary contact only — the system never assumes a couple needs two signers.

Check every person who must sign.

Important

A contact without an email address cannot be made a required signer.

If you see a message saying that the contact has no email on file, add their email to the client''s contact information first.

How signing works

Each required signer receives their own signing link after the contract is released.

The contract tracks each person''s signing progress.',
    'A contact without an email address cannot be made a required signer. Leave unchecked to use the default primary contact only — the system never assumes a couple needs two signers.',
    '[{"label":"New Contract","href":"/contracts/new"}]'::jsonb,
    array[]::text[],
    'published'
  ),
  (
    'can-couples-pay-online',
    'Can couples pay online?',
    'Contracts & Payments',
    'Yes. You can connect your Stripe account to Hello to Cheers so couples can pay deposits and invoices online.

Your money goes directly to your connected Stripe account. Hello to Cheers never holds or touches your funds.',
    'Go to:

Your Venue → Settings

Find:

Online Payment Collection',
    'Before you start

Have the following available:

- Access to the Stripe account you want to use, if you already have one.
- Your venue''s business information.
- Information about the people who own or control the business.
- Your bank/payout information.
- A government-issued ID if Stripe asks you to complete identity verification.

Stripe''s exact requirements vary depending on your country, business type, and account circumstances. You may not be asked for every item above.

1. Start in Hello to Cheers

Go to:

Your Venue → Settings

Find:

Online Payment Collection

Before connecting, you''ll see:

Not connected

You''ll also see an explanation that connecting your Stripe account allows couples to pay deposits and invoices directly.

Click:

Connect with Stripe

This takes you to Stripe to complete the connection.

2. Complete your Stripe setup

Once you''re on Stripe, follow the account setup instructions Stripe gives you.

Depending on your situation, Stripe may ask for information about:

- your business;
- your business address;
- the people who own or control the business;
- your identity;
- your bank account for payouts;
- your website or the goods/services you''re selling.

Stripe may also ask you to upload an identity document or provide additional information if it cannot verify you automatically.

Your Stripe screens may look different from someone else''s

That''s normal.

Stripe changes the questions it asks based on your country, business type, account status, and the information it still needs to verify.

Do not worry if you don''t see every item listed above.

If Stripe asks you to create an account, follow Stripe''s signup process.

If you''re connecting an existing eligible Stripe account, follow the connection instructions Stripe provides.

If you already use Stripe with another platform, Stripe may require a separate account depending on its platform-connection rules.

Keep your Stripe credentials in Stripe

Complete Stripe''s account and verification steps directly on Stripe.

Never paste your Stripe password, secret API key, or other Stripe credentials into Hello to Cheers.

3. Return to Hello to Cheers

When Stripe finishes the connection, Stripe sends you back to Hello to Cheers.

You''ll see:

Stripe connected successfully.

Your status will change to:

Connected

If Stripe still needs you to finish verification or provide additional information, you may instead see:

Connected, setup incomplete

That means the Stripe connection exists, but Stripe isn''t ready to accept charges yet.

Finish the outstanding requirements in Stripe. Hello to Cheers will pick up the updated status automatically.

4. Choose accepted payment methods

Once connected, find:

Accepted payment methods

You can choose:

Credit/Debit Card

Confirms instantly.

and/or:

ACH Bank Transfer

Lower processing fees; takes 4–5 business days to settle.

Choose the payment methods you want to offer.

You''re ready when

You see:

Connected

and:

Your Stripe account is connected and ready to accept payments

If you see "Connected, setup incomplete"

Go back into Stripe and look for the outstanding account or verification requirements.

These can include identity information, business information, website information, or bank information.

The fix is in Stripe, not in Hello to Cheers.

If you cancel Stripe setup

Stripe returns you to Hello to Cheers and Hello to Cheers displays a Stripe error explaining the reason.

You won''t be left wondering whether the connection worked.',
    'Never paste your Stripe password, secret API key, or other Stripe credentials into Hello to Cheers. Stripe''s exact requirements vary depending on your country, business type, and account circumstances — your Stripe screens may look different from someone else''s.',
    '[{"label":"Open Settings","href":"/settings"}]'::jsonb,
    array[]::text[],
    'published'
  ),
  (
    'what-do-sent-paid-and-void-mean-on-an-invoice',
    'What do Sent, Paid, and Void mean on an invoice?',
    'Contracts & Payments',
    'Invoice statuses tell you where an invoice is in its lifecycle.',
    'Go to:

Financials → Invoices',
    'You''ll see these statuses:

Draft

Not yet sent to client

The invoice exists, but it has not been delivered to the client.

Sent

Delivered to client

The invoice has been sent to the client.

Paid

Fully paid

The invoice has been paid in full.

Void

Cancelled / superseded

The invoice is no longer active.',
    'Draft means the invoice exists, but it has not been delivered to the client.',
    '[{"label":"Invoices","href":"/invoices"}]'::jsonb,
    array[]::text[],
    'published'
  ),
  (
    'whats-the-difference-between-a-package-inventory-and-an-inventory-template',
    'What''s the difference between a Package, Inventory, and an Inventory Template?',
    'Building the Event',
    'These three things are related, but they serve different purposes.',
    'Go to:

Library → Pricing & Packages → Packages

Library → Planning → Inventory

Library → Planning → Inventory Templates',
    'Package

Go to:

Library → Pricing & Packages → Packages

A Package is what your venue sells.

It defines your offering, including its inclusions and price, before you add it to an event or invoice.

Think:

What do we offer?

Inventory

Go to:

Library → Planning → Inventory

Inventory is what your venue owns or provides.

It is your catalog of items and amenities that can be used to build event-specific inventory.

Think:

What do we have?

Editing your catalog does not send anything to a client.

Inventory Template

Go to:

Library → Planning → Inventory Templates

An Inventory Template is a reusable starter bundle of inventory for a typical event.

For example, a template might contain the items you normally use for:

- Ceremony + Reception
- Reception Only

Think:

What do we normally start with?

How inventory gets onto an event

Inside a client''s event, open:

Inventory

You can choose:

Start blank

or start from an Inventory Template.

Then choose:

Start Event Inventory

The event gets its own editable inventory.

The simple rule

Package = what you sell

Inventory = what you have

Inventory Template = a reusable starting list of what you have',
    'Editing your catalog does not send anything to a client.',
    '[{"label":"Packages","href":"/packages"},{"label":"Inventory","href":"/library/inventory"},{"label":"Inventory Templates","href":"/library/inventory-templates"}]'::jsonb,
    array[]::text[],
    'published'
  ),
  (
    'what-do-the-floor-plan-studio-icons-mean',
    'What do the Floor Plan Studio icons mean?',
    'Building the Event',
    'You don''t have to memorize the Floor Plan Studio toolbar.

The controls provide tooltips when you hover over them.',
    'Open a client''s event.

Go to:

Floor Plans

Then open a floor plan.',
    'Common toolbar controls

Grid

Hover over the grid control to see:

Show grid

or:

Hide grid

This turns the background grid on or off.

Magnet

Hover over the magnet control to see:

Snap to grid: on

or:

Snap to grid: off

This controls whether objects snap to the grid as you move them.

Lock / Unlock

The lock control appears for a selected object.

Locking an object prevents it from being moved or resized.

Other controls

The toolbar also includes controls for actions such as:

- zooming;
- duplicating;
- rotating;
- deleting;
- changing the layer order.

If you''re unsure what an icon does, hover over it first.',
    'If you''re unsure what an icon does, hover over it first.',
    '[{"label":"Clients","href":"/clients"}]'::jsonb,
    array[]::text[],
    'published'
  ),
  (
    'how-do-i-move-an-object-thats-behind-another-one',
    'How do I move an object that''s behind another one?',
    'Building the Event',
    'If two objects overlap in your floor plan, you can change which object appears in front.',
    'Open a client''s event.

Go to:

Floor Plans

Open the floor plan and select the object you want to move.',
    'Change the object''s layer

When an object is selected, its selection toolbar includes layering controls.

Use the controls to:

bring the selected object forward

or:

send the selected object back

This changes which object appears on top when they overlap.

How you''ll know it worked

The selected object moves visually in front of or behind the other object.',
    'The exact toolbar icon may vary visually, so hover over the control if you''re unsure which layering action it represents.',
    '[{"label":"Clients","href":"/clients"}]'::jsonb,
    array[]::text[],
    'published'
  ),
  (
    'what-is-an-automation',
    'What is an Automation?',
    'Finding & Booking Clients',
    'An Automation lets Hello to Cheers handle follow-up communication automatically so you don''t have to remember every message yourself.',
    'Go to:

Communication → Automations',
    'You''ll see Automations such as:

- a Welcome Automation for new inquiries;
- a Reminder Automation before a tour;
- Automations triggered when a lead reaches a particular Pipeline stage.

The purpose is simple:

Communication should never require you to remember what to send next.

What you''ll see

Each Automation shows:

- its name;
- whether it is Active or Paused;
- the event that triggers it.

For example:

A new inquiry comes in

or:

A lead reaches a pipeline stage

Once an Automation is active, Hello to Cheers handles the scheduled follow-up according to the Automation you''ve configured.',
    'Communication should never require you to remember what to send next.',
    '[{"label":"Automations","href":"/communication/series"}]'::jsonb,
    array[]::text[],
    'published'
  ),
  (
    'can-i-pause-an-automation-for-just-one-person',
    'Can I pause an Automation for just one person?',
    'Finding & Booking Clients',
    'Yes.

You can pause one person''s enrollment without pausing the Automation for everyone else.',
    'Go to:

Communication → Automations

Open the Automation.

Find the enrollment list showing the people currently enrolled.',
    'Pause one person

On that person''s enrollment row, click:

Pause

This pauses that person''s enrollment only.

It does not pause the Automation itself.

How you''ll know it worked

That person''s row shows:

Paused

Everyone else enrolled in the same Automation continues normally.

Resume later

When you''re ready to continue that person''s Automation, click:

Resume

The enrollment continues from where it was paused.',
    'Important distinction

There are two different things you can pause:

Automation-wide Pause

Pauses the Automation itself.

Person-level Pause

Pauses one person''s enrollment.

If you only need to stop messages for one person, use the Pause control on that person''s enrollment row.',
    '[{"label":"Automations","href":"/communication/series"}]'::jsonb,
    array[]::text[],
    'published'
  ),
  (
    'why-did-this-person-get-this-message',
    'Why did this person get this message?',
    'Finding & Booking Clients',
    'If you need to understand why an automated message was sent, start with the person''s relationship Activity.',
    'Open the person''s:

Client

or:

Lead

record.

Then open:

Activity',
    'The Activity timeline records Automation events alongside the rest of the relationship history.

What you may see

For example:

Enrolled in automation: [name]

You may also see:

Automation completed: [name]

Automation stopped (replied): [name]

Automation stopped (booked): [name]

Automation stopped (lost): [name]

Automation stopped (cancelled): [name]

Automation cancelled: [name]

Why this is useful

The Activity timeline tells you both:

- which Automation was involved;
- what happened to that Automation afterward.

You don''t need to look in a separate history system.',
    'You don''t need to look in a separate history system.',
    '[{"label":"Open Leads","href":"/leads"},{"label":"Open Clients","href":"/clients"}]'::jsonb,
    array[]::text[],
    'published'
  ),
  (
    'what-happens-to-an-automation-if-someone-is-marked-lost-cancelled-or-books',
    'What happens to an Automation if someone is marked Lost, Cancelled, or books?',
    'Finding & Booking Clients',
    'You don''t need to manually remember to stop a person''s active Automations when their relationship outcome changes.

Hello to Cheers handles this automatically.',
    'You don''t need to manually remember to stop a person''s active Automations when their relationship outcome changes.

Hello to Cheers handles this automatically.',
    'If they book

When the relationship books, their active Automation enrollments stop.

If they''re marked Lost

Their active Automation enrollments stop.

If they''re marked Cancelled

Their active Automation enrollments stop.

This happens automatically before any new stage-based Automation can begin.

What you''ll see

The relationship''s:

Activity

timeline records the reason.

You may see:

- Automation stopped (booked): [name]
- Automation stopped (lost): [name]
- Automation stopped (cancelled): [name]

The simple rule

Once the relationship has reached one of these outcomes, Hello to Cheers stops the previous automated follow-up for that person.

You don''t have to clean it up manually.',
    'This happens automatically before any new stage-based Automation can begin. You don''t have to clean it up manually.',
    '[{"label":"Open Leads","href":"/leads"}]'::jsonb,
    array[]::text[],
    'published'
  ),
  (
    'where-do-my-venue-colors-actually-show-up',
    'Where do my venue colors actually show up?',
    'Your Venue',
    'Your venue colors define your venue''s visual identity where Hello to Cheers presents your brand to clients and in venue-branded collateral.

They do not recolor the Hello to Cheers workspace.',
    'Go to:

Your Venue → Settings

Find:

Brand colors',
    'You''ll see:

- Primary
- Secondary
- Accent
- Neutral

Each has a color swatch and:

Change

control.

Make your selections and click:

Save changes

You''ll also see a:

Preview

on the settings page.

Where your colors are used

Your venue colors appear in client-facing and venue-branded experiences such as:

- the Couple Portal;
- Contracts;
- other supported venue-branded documents and collateral.

Where they do not apply

Your venue colors do not recolor the Hello to Cheers administrative workspace.

They also do not control the visual theme of:

- the Hosted Wedding Website;
- RSVP pages.

Those experiences use the couple''s own separate color system.

How you''ll know it worked

Open a supported client-facing experience, such as a Couple Portal or Contract.

Your venue branding should appear there.',
    'Your venue colors do not recolor the Hello to Cheers administrative workspace. They also do not control the Hosted Wedding Website or RSVP pages — those use the couple''s own separate color system.',
    '[{"label":"Open Settings","href":"/settings"}]'::jsonb,
    array[]::text[],
    'published'
  ),
  (
    'how-do-i-start-collecting-inquiries-from-my-website',
    'How do I start collecting inquiries from my website?',
    'Finding & Booking Clients',
    'You can give prospective clients a way to contact your venue and have those inquiries become Leads automatically in Hello to Cheers.

There are two simple ways to put your inquiry form in front of prospects:

1. share a direct link;
2. embed the form directly on your website.',
    'Go to:

Your Venue → Settings

Find:

Inquiry Form

This is separate from:

Tour Scheduling',
    'Option 1: Share a direct link

Under the Inquiry Form section, find:

Direct link

Hello to Cheers provides a unique URL for your inquiry form.

The product explains:

Share this URL directly — email signatures, QR codes, social media.

Click:

Copy

Then paste that link anywhere you want prospects to click it, such as:

- your website;
- your email signature;
- social media;
- printed materials or QR codes.

When someone submits the form, the inquiry becomes a Lead automatically.

Option 2: Embed the form on your website

Under Inquiry Form, find:

Website embed

Hello to Cheers provides an iframe snippet for your form.

The product explains:

Paste this snippet into your website HTML to embed the form inline.

Click:

Copy embed code

Then paste the provided code into the HTML/page editor for the page on your website where you want the inquiry form to appear.

Do not edit the generated code unless you know your website platform requires it.

How you''ll know it is working

Submit a test inquiry through the form.

Then go to:

Sales → Leads

The submission should appear as a Lead.

You can also use Tour Scheduling

For visitors who are ready to schedule a tour, Hello to Cheers has a separate:

Tour Scheduling

section.

It provides a:

Booking link

you can share on your website.

The product explains:

Let clients schedule a tour directly from your website. Every booking creates a lead in Hello to Cheers automatically.

Other lead sources

Hello to Cheers also supports other lead sources, including:

- Facebook / Instagram Lead Ads
- QR code campaigns

QR campaigns are available through:

Library → Marketing → QR Campaigns

The simple rule

Inquiry Form = people who want to contact you

Tour Scheduling = people who want to book a tour

Both can feed your:

Sales → Leads

pipeline automatically.',
    'Do not edit the generated embed code unless you know your website platform requires it. Inquiry Form is separate from Tour Scheduling.',
    '[{"label":"Open Settings","href":"/settings"},{"label":"Open Leads","href":"/leads"},{"label":"QR Campaigns","href":"/library/qr-campaigns"}]'::jsonb,
    array[]::text[],
    'published'
  )
on conflict (slug) do nothing;
