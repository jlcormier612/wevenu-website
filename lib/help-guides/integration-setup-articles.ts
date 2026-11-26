/**
 * Integration setup guides — customer-facing step-by-step articles for
 * Settings → Financials & Integrations. Copy is product-locked; do not
 * casually rewrite. Bodies use HelpProse markers: ### headings, **bold**,
 * - bullets, 1. ordered lists, > callouts, [label](url) links.
 */

type IntegrationSetupArticle = {
  slug: string;
  title: string;
  category: string;
  body: string;
  relatedFeatures: readonly { href: string; label: string }[];
};

export const INTEGRATION_SETUP_ARTICLES: readonly IntegrationSetupArticle[] = [
  {
    slug: "how-to-connect-stripe-for-online-payments",
    title: "How to Connect Stripe for Online Payments",
    category: "Contracts & Payments",
    relatedFeatures: [
      { href: "/settings/integrations#stripe", label: "Open Stripe settings" },
    ],
    body: `Make paying for an event as easy as planning one.

By connecting your venue's Stripe account to Hello to Cheers, you can give your clients a convenient way to make online payments through their client portal and keep track of those payments alongside their event details.

Stripe processes your clients' online payments and deposits funds according to your Stripe payout settings. Your venue maintains its own Stripe account.

Whether you already use Stripe or are setting it up for the first time, we'll walk you through the process.

### Before you begin

If you already have a Stripe account for your venue, have your login information handy.

If you're creating a new account, it's helpful to have the following information available:

- Your legal business name and address.
- Your business structure and tax identification information, as applicable.
- Your venue's website.
- Information about the business owner or authorized representative.
- Your business banking information.
- Identification documents, if requested by Stripe.

You'll provide this information securely within Stripe. You do not need to send Hello to Cheers your Stripe password, banking credentials or identification documents.

Don't have everything handy? You can return and finish your setup later.

### Step 1 — Connect Stripe

In Hello to Cheers, navigate to:

**Your Venue → Settings → Financials & Integrations**

Find the **Online Payment Collection** section and click **Connect Stripe**.

You'll be taken to Stripe to connect or create your venue's account.

### Step 2 — Sign in or create your account

Stripe will ask you to enter your email address.

### Already have a Stripe account?

Use the email address associated with your existing Stripe account.

If Stripe displays multiple businesses or accounts, select the account that belongs to the venue you are connecting to Hello to Cheers.

You don't need to create another account simply because you're using Hello to Cheers.

### New to Stripe?

Follow Stripe's prompts to create an account for your venue.

If you already use Stripe for a different business, you may be offered the option to create a new account under your existing Stripe login. Make sure the account you connect represents the correct business.

### Step 3 — Tell Stripe about your venue

Stripe may ask you to provide information about your business, including its legal structure, business name, address, website and the services you provide.

Enter the information associated with your venue's actual business.

### Choosing your industry

When Stripe asks you to select an industry, choose the category that most accurately describes your business.

For many independent wedding and private event venues, the following category may be appropriate:

**Entertainment and recreation → Other entertainment and recreation**

If your primary business is a hotel, restaurant, catering company or another type of business, a different category may be more appropriate.

Your industry selection should reflect what your business actually does. If you're unsure which category best describes your venue, Stripe Support can help.

### Describing your services

If Stripe asks for a description of your business, briefly explain what you offer and how clients pay for your services.

For example, an independent wedding venue might use a description such as:

*We provide a private event venue for weddings, celebrations and corporate events. Clients reserve their event dates in advance and make payments according to their signed venue agreements.*

Customize this description to accurately reflect your own business and services.

### Step 4 — Verify your business and identity

Stripe may ask for additional information about your business, its owners or the person responsible for managing the account.

Follow the prompts and provide any requested information directly to Stripe.

These verification steps help Stripe establish and maintain your account's eligibility to accept payments.

The information requested may vary depending on your business structure, location and existing Stripe account status.

### Step 5 — Set up your bank account

If you're creating a new Stripe account, Stripe will ask where you'd like to receive your payouts.

Select or enter the bank account associated with your venue's business.

If Stripe offers banking information from another business you manage, make sure you select the correct account before continuing.

You can manage your banking information, payout preferences and Stripe account details directly in your Stripe Dashboard.

### Step 6 — Review and authorize the connection

Review your information and follow Stripe's prompts to complete the connection to Hello to Cheers.

Once you return to Hello to Cheers, your Stripe connection status will appear in the **Online Payment Collection** section.

### Step 7 — Confirm you're ready to accept payments

Your Stripe connection will display one of the following statuses.

### Connected

Your Stripe account is connected and Stripe has confirmed that your account can accept charges.

You're ready to configure your accepted online payment methods.

### Connected, setup incomplete

Your Stripe account has been successfully linked, but Stripe still needs additional information or verification before you can accept online payments.

To continue:

1. Click **Complete Stripe Setup**.
2. Follow Stripe's prompts to complete any outstanding requirements.
3. Return to Hello to Cheers.

Your status will refresh when you return. You can also click **Refresh status** to check for updates.

There's no need to disconnect or create another Stripe account. You can return to complete your existing setup whenever you're ready.

### Not connected

Your venue does not currently have a Stripe account linked to Hello to Cheers.

Click **Connect Stripe** to get started.

### Step 8 — Choose your accepted payment methods

Once your Stripe account is ready, choose which available online payment methods you'd like to offer your clients.

### Credit/Debit Card

Allow clients to make payments using a supported credit or debit card.

This is a convenient option for clients who prefer paying by card.

### ACH Bank Transfer

Allow eligible clients to make payments directly from a U.S. bank account.

ACH payments generally take longer to clear than card payments. Processing fees and settlement times are determined by Stripe.

You can enable both methods if you'd like to give your clients more flexibility.

You can return to **Financials & Integrations** to update your accepted payment methods at any time.

### What happens next?

As you create invoices and payment schedules for your events, your clients can make eligible online payments through their client portal.

Hello to Cheers helps you keep track of payments alongside the rest of your event's financial information.

Your Stripe Dashboard is where you manage your Stripe account, view processing fees, review payouts and update banking information.

You can also continue to record payments received outside of Stripe, such as checks or other offline payments, directly in Hello to Cheers.

### Frequently asked questions

**Do I need to create a new Stripe account?**

No. If you already have a Stripe account for your venue, you can connect it.

**Can I finish setting up Stripe later?**

Absolutely. If your account is connected but setup is incomplete, click **Complete Stripe Setup** whenever you're ready to continue.

**Do I have to use Stripe to use Hello to Cheers?**

No. You can manage your events, invoices and payment schedules and record offline payments without connecting Stripe. Connecting Stripe allows you to offer online payment collection through the client portal.

**Where does my money go?**

Stripe processes your clients' online payments and sends payouts to the bank account associated with your Stripe account, according to your Stripe payout settings.

**Where can I find my processing fees?**

You can review applicable pricing, processing fees and payout information directly through Stripe.

**What if Stripe needs more information?**

Return to your Stripe account or click **Complete Stripe Setup** in Hello to Cheers if that option is available. Follow the outstanding verification instructions provided by Stripe.

**What if I connected the wrong account?**

If you haven't received client payments, you can disconnect the incorrect account and connect the correct one.

If you've already received payments, review any outstanding payouts, refunds or disputes in your Stripe Dashboard before changing accounts. Previously processed transactions remain associated with the Stripe account through which they were processed.

Stripe Support can provide guidance on managing those transactions and your account.

**Can I disconnect Stripe?**

Yes. Return to **Your Venue → Settings → Financials & Integrations** and click **Disconnect Stripe**.

Disconnecting stops new online payment collection through Hello to Cheers until an eligible Stripe account is connected again. It does not close your Stripe account.

### Additional Stripe resources

For questions about business verification, banking information, processing fees, account requirements or payouts, visit [Stripe Support](https://support.stripe.com/).
`,
  },
  {
    slug: "how-to-connect-quickbooks-online",
    title: "How to Connect QuickBooks Online",
    category: "Contracts & Payments",
    relatedFeatures: [
      { href: "/settings/integrations#quickbooks", label: "Open QuickBooks settings" },
    ],
    body: `Your event management and accounting should work together.

By connecting QuickBooks Online to Hello to Cheers, you can spend less time entering the same information in multiple places and more time taking care of your clients and growing your venue business.

Hello to Cheers automatically syncs supported customer and financial records with your connected QuickBooks company, helping you and your bookkeeper stay organized.

### Before you begin

To connect QuickBooks Online, you'll need:

- An active QuickBooks Online account for your business.
- Access as a QuickBooks Primary Admin or Company Admin.
- The name of the QuickBooks company you use for your venue's accounting.

If your accountant or bookkeeper manages your QuickBooks account, you may want to coordinate with them before connecting.

### Step 1 — Connect QuickBooks

In Hello to Cheers, navigate to:

**Your Venue → Settings → Financials & Integrations**

Find the **QuickBooks Online** section and click **Connect QuickBooks**.

You'll be taken to Intuit, the company behind QuickBooks, to securely connect your account.

### Step 2 — Sign in to your Intuit account

Sign in using the email address, user ID or phone number associated with your QuickBooks Online account.

### Already using QuickBooks Online?

Use your existing Intuit login. There's no need to create another account to connect with Hello to Cheers.

### New to QuickBooks Online?

You can create an Intuit account by following the **Create an account** link on the sign-in page.

You'll also need to establish your QuickBooks Online subscription and set up your company before completing the connection.

If you're working with an accountant or bookkeeper, they can help you choose the QuickBooks setup that's right for your business.

### Step 3 — Select your QuickBooks company

If you manage more than one company through QuickBooks, you may be asked to choose which company you'd like to connect.

Select the company where you maintain your venue's accounting records.

This is where your customers, invoices, payments and refunds from Hello to Cheers will be synced.

If you're unsure which company to select, check with your accountant or bookkeeper before continuing.

### Step 4 — Authorize the connection

Intuit will ask you to review and approve the connection between QuickBooks Online and Hello to Cheers.

Follow the prompts to authorize the connection.

This allows Hello to Cheers to sync the accounting information needed for your venue. Your Intuit login credentials remain with Intuit.

### Step 5 — Confirm your connection

You'll be returned to Hello to Cheers.

In the **QuickBooks Online** section of Financials & Integrations, you should see your connected status and the name of your QuickBooks company.

Take a moment to confirm that the company name is correct.

### Step 6 — Review your accounting preferences

If an income account selection is available, choose the appropriate account for your venue's event revenue.

Your accountant or bookkeeper can help you determine which income account best fits your existing accounting structure.

Once you're connected and your preferences are configured, Hello to Cheers can begin syncing supported records with QuickBooks Online.

### What information syncs with QuickBooks?

### Customers

Keep supported customer records available in QuickBooks without having to manually enter the same client information in both platforms.

### Invoices

Sync supported invoices created in Hello to Cheers with your connected QuickBooks company.

### Payments

Keep supported client payment records reflected in your accounting system.

### Refunds

Sync supported refund records to help maintain accurate financial information.

### Working with Hello to Cheers and QuickBooks together

Think of Hello to Cheers as the home for your venue's event management and QuickBooks as the home for your business accounting.

Continue managing your clients, events, invoices, payment schedules and payment records in Hello to Cheers.

Your accountant or bookkeeper can continue using QuickBooks for bookkeeping, bank reconciliation, accounting reports and other business financial activities.

The integration sends supported accounting information from Hello to Cheers to QuickBooks. Changes made directly in QuickBooks do not automatically update your corresponding event records in Hello to Cheers.

For event-related financial changes, make the appropriate updates in Hello to Cheers so your event records remain accurate.

### Checking your connection and sync activity

You can review your QuickBooks connection at any time by visiting:

**Your Venue → Settings → Financials & Integrations**

### Connected

Your QuickBooks account is connected.

Review your recent sync activity to see how your accounting records are being updated.

### Connected, last sync failed

Your account is still connected, but a recent accounting record could not be synced successfully.

Hello to Cheers automatically retries eligible syncs. Review your recent sync activity and any available details to identify items that need attention.

### Reconnect required

Occasionally, Intuit may require you to authorize your connection again.

Click **Reconnect QuickBooks**, sign in to your Intuit account and follow the prompts.

Be sure to select the same QuickBooks company you were previously using.

### Not connected

Your venue does not currently have a QuickBooks company connected.

Click **Connect QuickBooks** whenever you're ready to get started.

### Frequently asked questions

**Do I need QuickBooks to use Hello to Cheers?**

No. You can manage your venue's events, clients, invoices and payments in Hello to Cheers without connecting QuickBooks.

The integration is available for venues that would like to connect their event financial records with their accounting software.

**Can I use my existing QuickBooks company?**

Yes. You can connect the QuickBooks Online company you already use for your venue.

**Does this work with QuickBooks Desktop?**

This integration is designed for QuickBooks Online.

**Do I need to connect Stripe first?**

No. Stripe and QuickBooks serve different purposes.

Stripe allows your clients to make online payments, while QuickBooks helps you manage your business accounting.

You can connect QuickBooks without connecting Stripe.

**Do I still need to enter invoices and payments manually in QuickBooks?**

Supported records sync automatically from Hello to Cheers, reducing the need for duplicate data entry.

Your accountant or bookkeeper should continue reviewing your books and completing any necessary reconciliation.

**What about my existing accounting records?**

Connecting QuickBooks is not the same as importing or migrating your historical accounting records.

If you've already recorded event invoices and payments in QuickBooks, avoid manually recreating those same transactions. Review your existing accounting records before syncing corresponding information from Hello to Cheers.

Your accountant or bookkeeper can help you determine the best approach to maintaining accurate records and avoiding duplicate entries.

**Does connecting QuickBooks replace my accountant or bookkeeper?**

No. The integration helps reduce manual data entry and keeps supported accounting information connected.

Your accountant or bookkeeper can continue managing your business accounting as usual.

**What if I connected the wrong QuickBooks company?**

Return to Financials & Integrations and disconnect QuickBooks. When reconnecting, select the correct company.

Disconnecting does not remove records that have already been synced. If records were synced to the wrong company, review those transactions with your accountant or bookkeeper before making accounting adjustments.

**Can I disconnect QuickBooks?**

Yes. Return to **Your Venue → Settings → Financials & Integrations** and click **Disconnect QuickBooks**.

Disconnecting stops future syncing through the integration. It does not cancel your QuickBooks subscription or remove accounting records that have already been synced.

### Additional QuickBooks resources

For questions about your QuickBooks subscription, Intuit login or company settings, visit [QuickBooks Support](https://quickbooks.intuit.com/learn-support/).

For advice about your chart of accounts, income categories, taxes or bookkeeping practices, we recommend working with your accountant or bookkeeper.
`,
  },
  {
    slug: "how-to-connect-facebook-instagram-lead-ads",
    title: "How to Connect Facebook & Instagram Lead Ads",
    category: "Finding & Booking Clients",
    relatedFeatures: [
      { href: "/settings/integrations#facebook", label: "Open Facebook & Instagram Lead Ads settings" },
    ],
    body: `Turn interest in your venue into new opportunities.

When someone submits an inquiry through one of your connected Facebook or Instagram Lead Ads forms, their information flows directly into Hello to Cheers.

Your team can manage those inquiries alongside leads from your website, wedding directories and other sources, giving you one organized place to follow up with prospective clients.

### Before you begin

To connect Facebook and Instagram Lead Ads, you'll need:

- A Facebook account with permission to manage your venue's business assets.
- A Facebook business Page for your venue.
- Access to your venue's Meta Business Portfolio and lead information.
- At least one Instant Form created for your venue's Lead Ads.

If an advertising agency or marketing professional manages your Meta advertising, make sure you have the appropriate access to your venue's Page and lead forms before connecting.

### Understanding your Meta accounts

Meta uses several different accounts and tools to manage business advertising. Here's how they work together:

**Your personal Facebook account** is how you sign in and access the business assets you manage.

**Your Facebook Page** represents your venue on Facebook.

**Your Meta Business Portfolio** brings together your business assets, such as your Facebook Page, Instagram account and advertising account.

**Your Instant Forms** are the inquiry forms prospective clients complete when responding to your Lead Ads.

You'll use your Facebook login to authorize the connection, select your venue's Page and choose which forms send inquiries to Hello to Cheers.

### Step 1 — Connect Facebook

In Hello to Cheers, navigate to:

**Your Venue → Settings → Financials & Integrations**

Find the **Facebook & Instagram Lead Ads** section and click **Connect Facebook**.

You'll be taken to Meta to securely authorize the connection.

### Step 2 — Sign in to Facebook

Sign in using the Facebook account you normally use to manage your venue's business Page.

If you're already signed in, Meta may ask you to continue using your current account.

Make sure you're using an account that has the necessary permissions to manage your venue's Page and access its leads.

### Step 3 — Select your business and Page

Meta may ask you to choose which business assets you'd like to connect.

### Choose your Business Portfolio

Select the existing business that owns or manages your venue's Facebook Page.

If you already have a Business Portfolio for your venue, you can continue using it.

### Choose your Facebook Page

Select the Facebook Page that represents your venue.

If you manage multiple businesses or Pages, take a moment to confirm that you've selected the correct one.

### Step 4 — Review and authorize permissions

Meta will display the permissions needed to connect your venue's Page and receive information from your Lead Ads forms.

Review the requested permissions and follow the prompts to authorize the connection.

These permissions allow Hello to Cheers to identify your Page, find its lead forms and receive new inquiries from the forms you choose to connect.

Once you've completed Meta's authorization process, you'll be returned to Hello to Cheers.

### Step 5 — Confirm your Facebook Page

In Hello to Cheers, select your venue's Facebook Page from the available Pages.

Confirm your selection to complete the Page connection.

You're almost there! Now it's time to choose which inquiry forms you'd like to connect.

### Step 6 — Choose your Lead Ads forms

Under **Choose Lead Ads forms**, you'll see the available forms associated with your selected Facebook Page.

Select the forms you'd like to send inquiries into Hello to Cheers.

For example, you might have separate forms for:

- Wedding inquiries.
- Corporate event inquiries.
- Private celebrations.
- Open houses or venue showcases.

You can connect multiple forms, giving you the flexibility to run different advertising campaigns while managing your inquiries in one place.

Click **Connect selected forms** to save your selections.

Your chosen forms should now appear under **Connected forms**.

**Your setup is complete when your Page is connected and at least one lead form is enabled.**

### Don't have any lead forms yet?

You can create Instant Forms through Meta Ads Manager when preparing a lead-generation campaign.

Once you've created and published your form, return to Hello to Cheers and update your form selections.

For instructions on creating Instant Forms and setting up Lead Ads campaigns, visit the [Meta Business Help Center](https://www.facebook.com/business/help).

### Step 7 — Include your Instagram Lead Ads

If you advertise on Instagram, you can use the same connection to receive inquiries from both Facebook and Instagram Lead Ads.

There's no separate Instagram connection to set up in Hello to Cheers.

### Connect your Instagram business account to your Facebook Page

If your venue's Facebook and Instagram accounts are already connected through Meta, you're ready to move on to your advertising setup.

If you haven't connected them yet:

1. Open [Meta Business Suite](https://business.facebook.com/).
2. Select your venue's Business Portfolio.
3. Open Settings and locate your Instagram accounts.
4. Add your venue's Instagram business account and associate it with your venue's Facebook Page.
5. Follow Meta's prompts to complete the connection.

For additional instructions, visit [Getting Started with Meta Business Suite](https://secure.facebook.com/business/tools/meta-business-suite/get-started).

### Set up your Instagram Lead Ads

When creating a lead-generation campaign in [Meta Ads Manager](https://www.facebook.com/adsmanager/):

1. Select **Leads** as your campaign objective.
2. Choose **Instant forms** as your conversion location.
3. Include Instagram in your advertising placements. You can also use Meta's automatic placement options when appropriate.
4. Confirm that the advertisement uses your venue's correct Facebook Page and Instagram identity.
5. Select an Instant Form you've connected to Hello to Cheers, or create a new form.

If you create a new form, remember to return to Hello to Cheers and add it to your connected forms.

For more detailed advertising instructions, follow Meta's official guide: [Generate Leads with Instant Forms](https://secure.facebook.com/business/ads/ad-objectives/lead-generation/lead-ads-with-forms).

### You're ready to go!

Once your accounts, advertising campaign and lead forms are configured, new Instant Form submissions from your Facebook and Instagram advertisements can arrive in the same Leads workspace in Hello to Cheers.

You can manage your inquiries together while continuing to manage your advertising through Meta.

### Step 8 — Test your connection

Before relying on your new connection, it's a good idea to submit a test inquiry.

Meta provides a Lead Ads Testing Tool that allows eligible users to submit test leads without running a paid advertisement.

1. Open the [Meta Lead Ads Testing Tool](https://developers.facebook.com/tools/lead-ads-testing/).
2. Select your venue's Facebook Page.
3. Select one of the Instant Forms you've connected to Hello to Cheers.
4. Create a test lead using the available testing options.
5. Return to Hello to Cheers and open **Leads**.
6. Confirm that your test inquiry appears with the expected information.

Allow a little time for the inquiry to arrive.

If you're connecting multiple forms, testing each one is a helpful way to confirm your setup.

### What happens next?

As prospective clients submit inquiries through your connected Lead Ads forms, their information is added to your Leads workspace in Hello to Cheers.

From there, you can follow up, manage correspondence, schedule tours and move prospective clients through your booking process.

Your existing lead-management workflow stays in one place, regardless of where the inquiry originated.

Continue using Meta Ads Manager to create advertisements, manage campaigns, set budgets and review advertising performance.

### Managing your connected forms

You can return to your Facebook & Instagram Lead Ads settings whenever you'd like to review or update your connected forms.

If you create a new advertising campaign with a new Instant Form, remember to add that form to your connected forms in Hello to Cheers.

You can also remove forms associated with campaigns you no longer wish to receive inquiries from.

### Troubleshooting your connection

### My Facebook Page isn't listed

Check that you're signed in to the correct Facebook account and that you have the appropriate access to your venue's Page.

You can review your Page access and business permissions through Meta Business Suite or your Meta business settings.

Once your permissions are correct, return to Hello to Cheers and reconnect.

### My Page is connected, but I don't see any forms

Confirm that you have created and published an Instant Form for the Facebook Page you selected.

Instant Forms are the forms used specifically for Meta lead-generation advertising.

Once your form is available, return to Hello to Cheers and select it under Choose Lead Ads forms.

### My new inquiries aren't appearing

Review the following:

- Your Facebook Page is connected.
- The form being used in your advertisement is enabled in Hello to Cheers.
- Your Meta account still has the necessary Page and lead-access permissions.
- Hello to Cheers has the appropriate lead access in your Meta business settings.
- Your connection does not require renewed authorization.

After checking these settings, submit another test lead to confirm your connection.

### My connection needs to be renewed

Meta may occasionally require you to authorize your connection again, particularly if your account permissions or security settings have changed.

Return to your Facebook & Instagram Lead Ads settings and follow the available connection prompts.

Select your existing venue Page and confirm your connected forms.

### Frequently asked questions

**Do I need to run Facebook or Instagram ads to use Hello to Cheers?**

No. This integration is an optional way to bring advertising inquiries into your venue's lead-management workspace.

You can continue receiving inquiries through your website, email and other lead sources without connecting Meta.

**Do I need separate connections for Facebook and Instagram?**

No. Both platforms use the same Meta connection and connected Instant Forms.

**Can I connect more than one lead form?**

Yes. You can select multiple forms associated with your connected Facebook Page.

**Does Hello to Cheers create or manage my advertisements?**

You continue to create and manage your advertising campaigns through Meta Ads Manager.

Hello to Cheers brings inquiries from your connected forms into your lead-management workspace.

**Will my previous Facebook and Instagram leads automatically appear?**

The integration is designed to receive new inquiries from your connected forms.

You can access historical Lead Ads submissions through Meta's lead-management and download tools, subject to Meta's data availability policies.

**Can I disconnect Facebook?**

Yes. Return to your Facebook & Instagram Lead Ads settings and use the disconnect option.

Disconnecting stops new inquiries from being delivered through this integration until you reconnect. It does not stop your advertising campaigns or remove leads already received in Hello to Cheers.

### Additional Meta resources

For help managing your Facebook Page, Business Portfolio, Instagram account, account permissions, Instant Forms or advertising campaigns, visit the [Meta Business Help Center](https://www.facebook.com/business/help).

You can also access your business and advertising tools directly through [Meta Business Suite](https://business.facebook.com/) and [Meta Ads Manager](https://www.facebook.com/adsmanager/).
`,
  },
  {
    slug: "how-to-automatically-forward-inquiries-to-hello-to-cheers",
    title: "How to Automatically Forward Inquiries to Hello to Cheers",
    category: "Finding & Booking Clients",
    relatedFeatures: [
      { href: "/settings/leads#email-intake", label: "Open Email Inquiry Intake settings" },
    ],
    body: `Spend less time checking different inboxes and more time connecting with prospective clients.

Whether your inquiries come from wedding directories, venue listing websites, advertising platforms or other sources, Hello to Cheers helps you bring them together in one organized Leads workspace.

By setting up automatic email forwarding, new inquiries can arrive in Hello to Cheers without your team having to manually enter each prospective client's information.

### Step 1 — Find your unique inquiry email address

In Hello to Cheers, navigate to:

**Your Venue → Settings → Leads & Booking → Email Inquiry Intake**

Your venue has its own unique inquiry email address.

Click **Copy** to copy your address.

You'll use this address when setting up automatic forwarding or updating your inquiry delivery preferences with other services.

You can use the same address for multiple inquiry sources.

### Step 2 — Choose how you'd like to receive your inquiries

There are two convenient ways to automatically bring email inquiries into Hello to Cheers.

### Option A — Forward inquiries automatically from your existing inbox

**Recommended for most venues.**

If you already receive inquiry notifications in your business email account, you can set up email forwarding rules to automatically send those inquiries to Hello to Cheers.

You'll continue receiving your original emails as usual, while your inquiries are also added to your Leads workspace.

You can create separate forwarding rules for each of your inquiry sources.

### Option B — Receive inquiries directly from your listing or advertising service

Some wedding directories, venue listing websites and advertising services allow you to choose where inquiry notifications are delivered.

If your service offers this option, you may be able to add your unique Hello to Cheers inquiry email address as a recipient.

This allows inquiries to arrive directly in Hello to Cheers without first passing through your business inbox.

Where multiple recipients are supported, you can keep your existing business email address and add your Hello to Cheers address.

### Step 3 — Set up your inquiry sources

### The Knot and WeddingWire

If you advertise through The Knot or WeddingWire, you can bring inquiry information into Hello to Cheers using email forwarding.

Sign in to your WeddingPro account.

Review your inquiry notification settings.

Confirm that inquiry notifications are being delivered to your business email address.

Open one of your recent inquiry emails and identify its sender address and subject line.

Create an automatic forwarding rule in your email account using the Gmail or Outlook instructions below.

Test your forwarding rule with a representative inquiry.

If your notification includes the prospective client's inquiry details, Hello to Cheers can use that information to create a lead.

Some notifications may simply alert you that a new message is waiting in your WeddingPro inbox. If additional inquiry details are available only within WeddingPro, open the inquiry there and use the available contact information to complete your lead record.

Continue managing your listings, advertising and WeddingPro account through WeddingPro.

For information about inquiry notification settings, visit the [WeddingPro Help Center](https://weddingpro.zendesk.com/hc/en-us).

### Here Comes The Guide

If you receive inquiries from Here Comes The Guide by email, you can automatically bring them into Hello to Cheers.

Review the email address associated with your venue listing.

Open a recent inquiry notification and identify its sender and subject line.

Create an automatic forwarding rule using the instructions for your email provider below.

If your listing allows additional inquiry recipients, you can also add your unique Hello to Cheers inquiry email address.

For questions about your venue listing or inquiry delivery preferences, visit [Here Comes The Guide](https://www.herecomestheguide.com/).

### Other wedding directories, listing websites and advertising services

You can use email inquiry intake with a variety of services that deliver prospective client information by email.

The setup is generally the same:

Identify where your inquiry notifications are delivered.

Create an automatic forwarding rule for those notifications.

Use your unique Hello to Cheers inquiry email address as the forwarding destination.

Test the connection.

If the service allows you to specify additional inquiry email recipients, you can also arrange for inquiries to be delivered directly.

You don't need a separate Hello to Cheers email address for each service.

### Step 4 — Set up automatic forwarding in your email account

### Gmail and Google Workspace

You can use Gmail's filters to automatically forward inquiry notifications from selected sources.

First, add your forwarding address.

Open Gmail on your computer.

Open Settings and select See all settings.

Locate the forwarding settings under Forwarding and POP/IMAP or Forwarding.

Select Add a forwarding address.

Paste your unique Hello to Cheers inquiry email address.

Follow Google's address-verification prompts.

### Completing Google's verification in Hello to Cheers

When Google sends a forwarding confirmation to your unique Hello to Cheers inquiry email address, a notice appears directly beneath your inquiry email address in:

**Your Venue → Settings → Leads & Booking → Email Inquiry Intake**

Select **Confirm forwarding with Google** to open Google's confirmation and follow the instructions provided.

If Google provides a confirmation code, you can also copy the code from Hello to Cheers and enter it in your Gmail forwarding settings.

Once you've confirmed your forwarding address, return to Gmail to create your selective forwarding rules using the instructions below.

Finally, send a test inquiry and check that it appears in your Leads workspace.

Google requires verification of your forwarding destination before automatic forwarding can begin.

If your organization manages your Google Workspace account, forwarding may also be subject to your organization's email settings.

Next, create an inquiry forwarding filter.

Once your forwarding address is verified:

Open the advanced search options in Gmail.

Enter information that identifies your inquiry notifications, such as the sender's email address or words in the subject line.

Preview the matching emails to make sure they are the inquiry notifications you intend to forward.

Create a filter using those search criteria.

Choose the forwarding action and select your Hello to Cheers inquiry email address.

Save your filter.

Repeat this process for each additional inquiry source.

Your original messages will remain available in Gmail.

For Google's complete instructions, including address verification and forwarding filters, visit [Automatically forward Gmail messages to another account](https://support.google.com/mail/answer/10957).

### Outlook and Microsoft 365

Outlook allows you to create inbox rules that automatically forward selected messages.

For Outlook on the web or the new Outlook:

Open Outlook and enter Settings.

Navigate to Mail and then Rules.

Create a new rule.

Give your rule a descriptive name, such as Wedding Directory Inquiries.

Add conditions that identify your inquiry notifications, using the sender's address or relevant subject line.

Set the rule's action to Forward to and enter your unique Hello to Cheers inquiry email address.

Save your rule.

Repeat the process for any additional inquiry sources you'd like to connect.

If your organization manages your Microsoft 365 account, external forwarding may be governed by your organization's security settings.

For instructions covering different Outlook versions, visit [Use rules to automatically forward messages](https://support.microsoft.com/en-us/outlook/mail/use-rules-to-automatically-forward-messages).

### Other email providers

Many email services offer automatic forwarding, filters or inbox rules.

Look for these options in your email account settings.

Create a rule that identifies your incoming inquiry notifications and forwards them to your unique Hello to Cheers inquiry email address.

Your email provider's Help Center will have instructions specific to your account.

### Step 5 — Test your automatic forwarding

Once you've created your forwarding rules, confirm that inquiries are arriving correctly.

Submit a test inquiry through one of your connected inquiry sources, where available.

Confirm that the inquiry notification arrives in your business inbox if you're using automatic forwarding.

Open Leads in Hello to Cheers.

Locate the new inquiry and review the available information.

Depending on the information included in the original inquiry email, your lead may contain details such as:

- Prospective client's name.
- Email address.
- Phone number.
- Requested event date.
- Event type.
- Inquiry message.

If additional details are needed, you can complete the lead record in Hello to Cheers.

Repeat this test for each inquiry source you've configured.

Once you've confirmed that your rules are working, new matching inquiry emails can be forwarded automatically.

### Forwarding individual inquiries

You can also forward an inquiry whenever you receive one that you'd like to add to Hello to Cheers.

Simply open the original inquiry email, forward it to your unique Hello to Cheers inquiry email address and review the resulting lead in your Leads workspace.

This is especially useful for business referrals, occasional inquiries and other sources that don't need their own automatic forwarding rule.

Keep the original inquiry information intact so Hello to Cheers has as much information as possible to identify the prospective client.

### Managing your incoming inquiries

As inquiries arrive, review them alongside your other leads in Hello to Cheers.

From there, you can manage correspondence, schedule tours, send proposals and guide prospective clients through your booking process.

You can also review your email intake activity in Settings to identify incoming messages that may need attention.

### Troubleshooting

### My inquiry isn't appearing in Hello to Cheers

Check that:

- Your forwarding rule is enabled.
- The forwarding destination matches your unique Hello to Cheers inquiry email address.
- The inquiry email matches the sender or subject criteria in your rule.
- Your email provider permits external forwarding.
- The original message contains the prospective client's inquiry information.

Review your email intake activity and test your forwarding rule again.

### Some of my inquiry information is missing

Different inquiry sources include different amounts of information in their email notifications.

Open the lead in Hello to Cheers and add any additional details available from the original source.

### I receive inquiries from several different email addresses

You can create individual forwarding rules for each inquiry source.

Use descriptive names for your rules so they're easy to identify and update as your advertising changes.

### Frequently asked questions

**Can I receive inquiries from multiple sources at the same time?**

Absolutely. You can forward inquiries from multiple email accounts, directories and advertising services using the same unique Hello to Cheers inquiry email address.

**Will I still receive my original inquiry emails?**

Yes, when using forwarding rules that retain your original emails. Your normal business inbox remains available to you.

**Do I have to forward each new inquiry manually?**

No. Once automatic forwarding is configured and tested, matching inquiry emails can be forwarded without any additional steps from your team.

**Does Hello to Cheers need access to my email account?**

No. Your forwarding rules are managed within your own email account. You don't need to provide Hello to Cheers with your email password.

**Can I bring over inquiries I received before setting up automatic forwarding?**

### Bringing over existing inquiries

Already have a collection of prospective clients you'd like to bring into Hello to Cheers?

Our Bring Your Business tools help you import existing lead information, review your records and get your Leads workspace organized without having to start from scratch.

Visit **Bring Your Business** in your Setup Hub to explore your import options.

**Can I stop forwarding inquiries from a particular source?**

Yes. Simply disable or remove the corresponding forwarding rule in your email account, or update your inquiry delivery preferences with the original service.

Your previously received leads remain available in Hello to Cheers.

### Additional resources

For help configuring your email account, forwarding rules or email security settings, refer to your email provider's official documentation:

- [Gmail Help](https://support.google.com/mail/)
- [Microsoft Outlook Support](https://support.microsoft.com/en-us/outlook)

For questions about your directory listings, advertising accounts or inquiry notification preferences, refer to the respective service's business account settings and Help Center.
`,
  },
  {
    slug: "how-to-add-your-inquiry-form-to-your-website",
    title: "How to Add Your Inquiry Form to Your Website",
    category: "Finding & Booking Clients",
    relatedFeatures: [
      { href: "/settings/leads#inquiry", label: "Open Website Inquiry Form settings" },
    ],
    body: `Make it easy for prospective clients to take the first step toward celebrating at your venue.

Your Hello to Cheers inquiry form allows website visitors to share their contact information, event details and questions with your team. Each submitted inquiry is added directly to your Leads workspace, helping you stay organized from the very first hello.

You can display your form directly on your existing website or share a link that takes visitors to your form.

### Step 1 — Make your inquiry form your own

In Hello to Cheers, navigate to:

**Your Venue → Settings → Leads & Booking**

Review your inquiry form settings and customize the available options to reflect your venue and the types of events you host.

Consider what information would be most helpful when receiving a new inquiry, such as the prospective client's contact information, event type, preferred date and anticipated guest count.

If you've enabled online tour scheduling, review your tour availability and the options available to prospective clients through your inquiry experience.

Save your settings and select **Open form** to preview what prospective clients will see.

### Step 2 — Choose how to share your form

You have two convenient options, and you can use both at the same time.

### Option A — Display your form directly on your website

Embedding your form allows prospective clients to complete their inquiry without leaving your website.

This is a great option for your Contact, Inquire or Request Information page.

Hello to Cheers provides the embed code you need. Simply copy it into the appropriate section of your website.

### Option B — Share a direct link to your form

Your inquiry form also has its own unique web address.

You can share this link anywhere you'd like to invite prospective clients to inquire, including:

- Website buttons such as **Inquire Now** or **Request Information**.
- Instagram and Facebook profiles.
- Email signatures.
- Digital brochures and marketing materials.
- Venue listings that allow external inquiry links.

When someone clicks your link, they'll be taken directly to your venue's inquiry form.

Both options send inquiries directly into Hello to Cheers.

### Step 3 — Embed your form on your website

If you'd like to display the form directly on your website:
1. Locate the Website Inquiry Form section in Hello to Cheers.
2. Select **Copy embed code**.
3. Open your website editor.
4. Navigate to the page where you'd like your inquiry form to appear.
5. Add an HTML, Code or Embed section, depending on your website provider.
6. Paste the embed code provided by Hello to Cheers.
7. Preview your page and adjust the available display settings as needed.
8. Save and publish your website changes.
You don't need to write any code yourself. Hello to Cheers provides the code for your venue's form.

### Squarespace

To add your inquiry form to a Squarespace website:
1. Sign in to Squarespace and open your website.
2. Navigate to the page where you'd like your inquiry form to appear.
3. Select Edit.
4. Add a Code Block in the desired location.
5. Set the block to HTML, where applicable.
6. Paste your Hello to Cheers embed code.
7. Save your changes and preview the page.
Some Squarespace subscription plans have restrictions on embedded content.

For detailed instructions and information about plan requirements, visit [Squarespace — Code Blocks](https://support.squarespace.com/hc/en-us/articles/206543167-Add-custom-code-to-a-page-with-code-blocks).

### Wix

To add your inquiry form to a Wix website:
1. Sign in to Wix and open your website editor.
2. Navigate to your desired inquiry or contact page.
3. Open the Add Elements menu.
4. Locate the Embed Code or HTML embed option.
5. Add an HTML embed element to your page.
6. Paste your Hello to Cheers embed code.
7. Adjust the element's size so the form is comfortably displayed.
8. Preview and publish your changes.
Review both the desktop and mobile versions of your page.

For detailed instructions, visit [Wix — Embedding a Site or a Widget](https://support.wix.com/en/article/wix-editor-embedding-a-site-or-a-widget).

### WordPress

To add your inquiry form to a WordPress website:
1. Sign in to your WordPress dashboard.
2. Open the page where you'd like to display your inquiry form.
3. Add a Custom HTML block.
4. Paste your Hello to Cheers embed code.
5. Preview the page.
6. Save or publish your changes.
If you use a WordPress page builder, such as Elementor, look for its HTML or Embed widget instead.

Your ability to embed external content may depend on your WordPress hosting plan, user permissions and website configuration.

For additional instructions, visit [WordPress — Custom HTML Block](https://wordpress.org/documentation/article/custom-html/).

### Other website providers

Most website builders offer an option to display external content using an HTML, Code or Embed element.

Look for one of these options in your website editor and paste the embed code provided by Hello to Cheers.

If your website provider doesn't support embedded forms, you can still connect your website to Hello to Cheers using your direct inquiry form link.

If someone else manages your website, simply send them your embed code and let them know where you'd like the form displayed.

### Step 4 — Add your inquiry form link to your website

If you prefer to have prospective clients open your inquiry form by clicking a button:
1. Return to your Website Inquiry Form settings in Hello to Cheers.
2. Select **Copy link**.
3. Open your website editor.
4. Add a button or select an existing inquiry button.
5. Choose the option to link the button to a web address or external URL.
6. Paste your Hello to Cheers inquiry form link.
7. Save and publish your changes.
You can use button text that reflects your venue's personality and booking process.

For example:
- Inquire Now
- Let's Start Planning
- Request Information
- Tell Us About Your Event
- Let's Celebrate Together
You can also update existing inquiry buttons throughout your website to use the same link.

### Step 5 — Share your form beyond your website

Your inquiry form link can be used wherever prospective clients discover your venue.

### Instagram

Add your inquiry form link to your Instagram profile links, making it easy for visitors to inquire after exploring your photos and videos.

### Facebook

Include your inquiry form link in your Page's available website or action-button settings, or share it in relevant posts.

### Email signatures

Add an inquiry link to your team's email signatures so prospective clients can easily share their event information.

### Marketing materials

Include your inquiry form link in digital brochures, email campaigns and other online promotional materials.

For printed brochures, bridal shows and venue open houses, you can also explore the QR code tools available in Hello to Cheers.

### Step 6 — Test your inquiry experience

Before sharing your updated website or inquiry link with prospective clients, take a moment to experience it yourself.
1. Open your published website or direct inquiry form link.
2. Review the form on a computer and a mobile device.
3. Complete the form using clearly identifiable test information.
4. Submit your inquiry.
5. Open Leads in Hello to Cheers.
6. Confirm that your test inquiry appears with the information you submitted.
If you've enabled online tour scheduling, review that experience as well.

If your venue has enabled automatic inquiry responses, remember that your test submission may also trigger those communications. Use an email address and phone number you control when testing.

Once you've confirmed that everything is working as expected, your inquiry form is ready to welcome prospective clients.

### Updating your inquiry form

As your business evolves, you can return to your inquiry form settings in Hello to Cheers to update the available options.

Changes saved to your existing inquiry form are reflected wherever that same form is linked or embedded.

You don't need to update your website every time you adjust the settings of your existing form.

### Troubleshooting

### My embedded form isn't appearing

Confirm that you've copied the complete embed code into an HTML, Code or Embed element rather than a regular text section.

Check that your website changes have been saved and published.

Some website providers restrict embedded content based on your subscription plan or website settings. Refer to your provider's documentation for applicable requirements.

You can also use your direct inquiry form link as an alternative.

### My form is cut off or doesn't fit the page

Adjust the size of the HTML or Embed element within your website editor.

Review the form on both desktop and mobile devices to make sure visitors can comfortably complete all fields and access the submit button.

Your website provider's documentation can help you adjust embedded content for different screen sizes.

### My inquiry button isn't opening the form

Confirm that you've copied the direct inquiry form link rather than the embed code.

Check that your website button is linked to the correct web address and that your changes have been published.

### My test inquiry isn't appearing

Open your inquiry form directly from Hello to Cheers and submit a test inquiry.

Make sure you've completed all required fields and received the form's submission confirmation.

Check your Leads workspace for the submitted name or email address.

If the direct form works but the embedded version does not, review your website's embed settings and your provider's requirements for external content.

### Frequently asked questions

**Do I need a new website to use Hello to Cheers?**

No. You can continue using your existing website and website provider.

Simply add your inquiry form using the provided embed code or direct link.

**Can I use both the embedded form and the direct link?**

Absolutely. You can embed the form on your website and share the direct link through social media, emails and other marketing channels at the same time.

**Do prospective clients need a Hello to Cheers account to inquire?**

No. Your public inquiry form allows prospective clients to share their event information without creating an account.

**Can I replace my existing website contact form?**

Yes. If your existing contact form is used to collect event inquiries, you can replace it with your Hello to Cheers inquiry form.

If you also use your contact page for unrelated business questions, employment inquiries or general correspondence, you may wish to retain a separate contact option for those purposes.

**Do I need to manually create a lead after someone submits the form?**

No. Submitted inquiries are added directly to your Leads workspace in Hello to Cheers.

**Can my website designer add the form for me?**

Absolutely. Send your website designer the embed code or direct inquiry form link and let them know where you'd like it placed.

They don't need access to your Hello to Cheers account to add the form to your website.

### Additional website resources

For help editing your website, adding embedded content, configuring buttons or adjusting your page layout, refer to your website provider's official documentation:

- [Squarespace Help Center](https://support.squarespace.com/hc/en-us)
- [Wix Help Center](https://support.wix.com/)
- [WordPress Support](https://wordpress.org/support/)
- [Elementor Help Center](https://elementor.com/help/)

Your existing website and Hello to Cheers can work together, giving prospective clients a welcoming inquiry experience and your team an organized place to manage every new opportunity.
`,
  },
  {
    slug: "how-texting-setup-works",
    title: "How to Set Up Text Messaging",
    category: "Working With Clients",
    relatedFeatures: [
      { href: "/settings/communications#texting", label: "Open Text messaging setup" },
    ],
    body: `A quick question about a tour, a reminder about an upcoming appointment or a conversation about wedding-day details — sometimes a text is the easiest way to stay connected.

With Hello to Cheers, your team can send and receive text messages using a dedicated business texting number, keeping those conversations organized alongside your other client communications.

### Before you begin

To enable text messaging, you'll complete a one-time business registration.

Mobile carriers require businesses to register their identity and explain how they intend to use text messaging. This helps protect recipients from unwanted messages and supports responsible business communications.

You can complete your registration directly within Hello to Cheers. There's no separate texting service account to create.

### What you'll need

Having the following information available will make your setup easier:

- Your legal business name.
- Your business address and website.
- Your business structure, such as an LLC or corporation.
- Your Employer Identification Number (EIN), where applicable.
- Contact information for an authorized business representative.
- Information about how your venue uses text messaging.
- Information about how prospective clients and clients agree to receive texts from your business.

Some of this information may already be available in your venue profile.

### Step 1 — Start your texting setup

In Hello to Cheers, navigate to:

**Your Venue → Settings → Communications → Text Messaging**

Select **Enable text messaging** to begin.

The guided setup will walk you through the information needed to register your business and establish your dedicated texting number.

### Step 2 — Confirm your business information

Review the business information already available in your venue profile.

You'll be asked to confirm details such as your:

- Legal business name.
- Business address.
- Website.
- Business contact email.
- Business contact phone number.

Make any necessary updates before continuing.

### What if my venue name is different from my legal business name?

Many venues operate under a name that is different from their registered legal business name.

For business registration, use the legal name associated with your business registration and tax records when requested. Use your venue's public-facing name where the form asks for your business or brand name.

For example, a venue called The Willow Grove might operate under a registered business called Willow Grove Hospitality LLC.

### Step 3 — Provide your business registration details

Depending on your business structure, you may be asked to provide additional information.

### Business type

Select the structure that accurately represents your registered business, such as a limited liability company, corporation or sole proprietorship.

### Industry

Choose the available industry category that best describes your business activities.

### Employer Identification Number (EIN)

If an EIN is required for your registration, enter the number issued to your business by the IRS.

You can typically find your EIN on your IRS confirmation letter, business tax returns or other official business records.

Your legal business name and EIN should match your official registration records.

For information about locating or obtaining an EIN, visit the [IRS Employer Identification Numbers guide](https://www.irs.gov/businesses/small-businesses-self-employed/employer-id-numbers).

### Authorized business representative

Provide the requested information for someone authorized to represent your business, such as an owner, officer or authorized manager.

### Step 4 — Describe how your venue will use text messaging

You'll be asked to explain how your business intends to communicate by text.

For many venues, texting is a convenient way to communicate with prospective clients and booked clients about their inquiries, tours and upcoming events.

### Example messaging purpose

Here's an example of how a venue might describe its texting activities:

Our venue uses text messaging to communicate with prospective clients and booked clients who have agreed to receive text messages. Conversations may include responses to event inquiries, tour scheduling, appointment reminders, event planning questions and updates related to upcoming events.

Use this example as a starting point and adjust it to accurately reflect how your venue intends to communicate.

### Example text messages

You may also be asked to provide examples of the messages your venue expects to send.

**Inquiry follow-up**

Hi Emma! This is Sarah from The Willow Grove. Thank you for your interest in our venue! We'd love to learn more about your wedding plans. Reply STOP to opt out.

**Tour reminder**

Hi Emma! This is The Willow Grove. We're looking forward to your venue tour tomorrow at 2 PM. Please let us know if you need to reschedule. Reply STOP to opt out.

**Event planning**

Hi Emma! This is Sarah from The Willow Grove. Just checking in to confirm the details for our upcoming planning appointment. Reply STOP to opt out.

Your examples should reflect the types of messages your business actually intends to send.

### Step 5 — Explain how people agree to receive texts

An important part of business texting is making sure recipients have agreed to communicate with your business by text.

Hello to Cheers includes tools to help your venue capture and manage texting consent.

### Through your Hello to Cheers inquiry form

Prospective clients can provide their phone number and indicate whether they agree to receive text messages from your venue through the available consent options.

If you use your Hello to Cheers inquiry form on your website, you can incorporate texting consent into your existing inquiry experience.

### Through other inquiry or booking processes

If your venue collects texting consent through another form or process, describe how that consent is obtained and recorded.

For example, you may collect consent through an external inquiry form or a separate written agreement that clearly explains your texting practices.

Your registration answers should reflect the methods your business actually uses.

### Example consent description

Prospective clients can agree to receive text messages from our venue through an optional consent selection on our online inquiry form. Text messages relate to their event inquiries, tours and event planning. Recipients can opt out of receiving messages at any time by replying STOP.

Adapt this example to your actual consent process.

Providing a phone number alone does not establish permission to receive business text messages.

### Step 6 — Review and submit your registration

Review your business information, messaging examples and consent details.

Confirm that the information accurately represents your business and its communication practices.

Submit your registration using the available option.

Your information will be used to complete the business texting registration and establish your venue's dedicated texting number.

### Step 7 — Follow your registration progress

You can return to your Text Messaging settings at any time to review your progress.

Business texting registration involves review by messaging providers and mobile carriers. Processing times can vary.

You can continue using Hello to Cheers, including your other available communication channels, while your texting registration is being completed.

### Setting up

Your business information has been saved and your texting setup is underway.

### Under review

Your business texting registration has been submitted for review.

### Needs attention

Additional information or a correction is needed to continue your registration.

Review the details provided, make the necessary updates and select **Update details & resubmit**.

### Setting up your number

Your registration has progressed to the stage where your dedicated texting number is being configured.

### Ready

Your venue's texting number is available, and you can begin sending and receiving text messages with eligible recipients.

### Step 8 — Start texting

Once your texting status shows **Ready**, you'll see your dedicated business texting number in your settings.

You can begin using text messaging through your available communication tools in Hello to Cheers.

When composing a message to an eligible lead or client, select the text messaging channel.

Replies are received through your venue's texting number and organized within your communication workspace.

Your team can continue conversations without using their personal mobile numbers.

### Managing texting consent

Hello to Cheers helps you manage texting consent and recipient preferences.

Before sending a text, make sure the recipient has agreed to receive the type of communication you're sending.

If a recipient withdraws their consent or replies STOP, respect that preference and use another appropriate communication channel when necessary.

A recipient who has opted out must provide valid renewed consent before texting can resume.

### A few good texting practices

- Identify your venue clearly when starting a conversation.
- Keep messages relevant to the recipient's inquiry or event.
- Send messages at considerate times.
- Respect recipient communication preferences.
- Obtain the appropriate consent before sending promotional messages.

Consent for event-related conversations should not automatically be treated as consent for unrelated marketing campaigns.

### Checking your texting status

You can review your texting registration and assigned number in:

**Your Venue → Settings → Communications → Text Messaging**

You can also review your communication activity and delivery information through your Communication Health tools.

### Frequently asked questions

**Do I need to create a separate Twilio account?**

No. Your texting setup is managed directly within Hello to Cheers.

**Will my venue have its own texting number?**

Yes. Your venue receives a dedicated business texting number as part of its completed setup.

**Do I need to use my personal cell phone?**

No. Your team can send and receive messages through Hello to Cheers using your venue's dedicated texting number.

**Can multiple team members use our venue's texting number?**

Yes. Team members with the appropriate permissions can participate in your venue's text conversations.

**How long does registration take?**

Registration involves review by messaging providers and mobile carriers. Processing times vary depending on the business information provided and the review process.

You can follow your registration progress directly within Hello to Cheers.

**Can I start texting before my registration is approved?**

Text messaging becomes available when your setup is complete and your status shows Ready.

You can continue using your other available communication channels in the meantime.

**What if my registration needs additional information?**

Review the information displayed in your Text Messaging settings, update the requested details and resubmit your registration.

Make sure your business information matches your official records and that your messaging and consent descriptions accurately reflect your practices.

**What if someone doesn't want to receive texts?**

Respect their communication preferences and continue using another appropriate channel, such as email.

Recipients can also opt out by replying STOP.

**Can I continue using my existing business phone number?**

Absolutely. Your dedicated Hello to Cheers texting number is separate from your existing business phone service.

You can continue using your existing number for your normal business calls and other communications.

### Additional resources

For information about business registration and Employer Identification Numbers, visit the [IRS Business Resources](https://www.irs.gov/businesses).

For general information about business text messaging registration and carrier requirements, visit [Twilio's A2P 10DLC registration resources](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc).

Your venue's texting setup and registration progress are managed directly within Hello to Cheers.
`,
  },
  {
    slug: "refer-a-venue-one-referral-one-free-month",
    title: "Refer a Venue — One Referral. One FREE Month.",
    category: "Contracts & Payments",
    relatedFeatures: [
      { href: "/settings/referrals", label: "Open Refer a Venue" },
    ],
    body: `Good things are even better when shared.

We know how valuable recommendations from fellow venue owners can be. If Hello to Cheers is making a difference in your business, we'd love for you to share it with others.

Our Refer a Venue program is our way of saying thank you.

For every qualifying venue you introduce to Hello to Cheers, you'll receive a subscription credit equal to one month of your venue's subscription.

And the best part? You can keep referring venues and earning rewards!

### How it works

### Step 1 — Tell us about a venue

Open **Refer a Venue** in Hello to Cheers and select the option to submit a referral.

We'll ask for a few details about the venue you're introducing:

- Venue name.
- Website.
- City and state.
- Contact name.
- Role or title, if known.
- Business contact email address.

Please provide accurate contact information for someone who can make or participate in business decisions for the venue, such as an owner, general manager or venue director.

If you've already spoken with them about Hello to Cheers, even better!

Submit your referral, and we'll take it from there.

### Step 2 — We'll introduce them to Hello to Cheers

We'll reach out to the venue, introduce them to Hello to Cheers and give them an opportunity to explore how the platform could work for their business.

There's no obligation for the venue to subscribe, and you don't need to manage the sales process yourself.

### Step 3 — Enjoy your reward

When your referred venue becomes a new paying Hello to Cheers customer and completes 30 days as a qualifying paying subscriber, your referral becomes eligible for a reward.

Once approved, you'll receive a subscription credit equal to one month of your venue's applicable subscription price.

Your credit will be applied toward your next eligible subscription invoice.

It's our way of thanking you for helping us grow our community of venues.

### Keep sharing. Keep earning.

Know more than one venue that would love Hello to Cheers?

Wonderful! You can submit a separate referral for each venue.

There's no limit to the number of qualifying referrals you can make. Each successful, qualifying referral earns its own reward.

### Track your referrals

Visit your Refer a Venue page at any time to review your submitted referrals and their progress.

You can see which referrals are in progress, which have qualified for rewards and which rewards have been issued.

You can also review your available referral credits through your Subscription & Billing settings.

### Frequently asked questions

**Who can I refer?**

You can refer independent wedding venues, event spaces, hospitality properties and other venues that could benefit from Hello to Cheers.

The referred venue must be a new, independently paying Hello to Cheers customer and meet the program's eligibility requirements.

**Do I need to convince the venue to subscribe?**

Not at all. Simply introduce us to a venue you think would benefit from Hello to Cheers.

We'll handle the introduction, product information and subscription process.

**Can I refer more than one venue?**

Absolutely! Each qualifying referral earns its own subscription credit.

**When will I receive my reward?**

Your referral becomes eligible once the referred venue has completed 30 days as a qualifying paying customer and the applicable payment requirements have been satisfied.

Once approved, your credit will be available for your next eligible subscription invoice.

**How much is my reward worth?**

Your reward is equal to one month of your venue's applicable subscription price.

For example, if your monthly subscription is $199, a qualifying referral earns you a $199 subscription credit.

**Can I earn referral rewards if I already receive a subscription discount?**

Yes. Eligible customers can participate in the referral program even if they receive a Founding Member, Welcome Back or other applicable subscription discount.

Your reward is based on your applicable subscription price.

**What if the venue I refer doesn't subscribe?**

There's no obligation for either of you.

A referral reward is earned when the referred venue becomes a qualifying paying customer. You're always welcome to introduce us to other venues.

**Can I refer another venue that I own?**

The referral program is designed to reward introductions to new, independently paying venues.

If you're adding another property to your own business, explore the additional venue and group pricing options available through your Subscription & Billing settings.

**What if another customer has already referred the same venue?**

Each new qualifying venue can generate one referral reward. Duplicate referrals are reviewed to determine eligibility.

**Can I receive my reward as cash instead?**

Referral rewards are issued as subscription credits toward your Hello to Cheers subscription.

### A few things to know

To keep our referral program fair for everyone:

- Referrals must represent genuine introductions to new, independently paying venues.
- Each qualifying venue can generate one referral reward.
- Self-referrals and duplicate rewards are not eligible.
- Referred venues must complete the required qualifying period with eligible, settled subscription payments.
- Refunded or disputed payments may affect referral eligibility.
- Rewards are issued as subscription credits rather than cash payments.

Thank you for being part of Hello to Cheers and for helping us introduce more venues to a better way of managing their businesses.

Here's to more connections, more celebrations and more reasons to cheers!
`,
  },
];

/** Slugs that use the enhanced instructional Help presentation (seven customer guides). */
export function isIntegrationSetupArticleSlug(slug: string): boolean {
  return INTEGRATION_SETUP_ARTICLES.some((a) => a.slug === slug);
}
