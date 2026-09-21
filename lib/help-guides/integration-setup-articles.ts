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
    body: `### Before you start

**Have your Stripe account ready**

You'll be taken to Stripe to securely connect your business account. Stripe may ask you to confirm your business information, verify your identity, and provide bank details before payments can be enabled.

**Hello to Cheers never sees your Stripe password or holds your money.**

### You'll need

- A Stripe account for the venue/business.
- Access to the business's Stripe account.
- Business/legal information.
- Information about the person responsible for the Stripe account.
- Bank/payout information.
- The ability to complete Stripe's identity/business verification.

### Step 1 — Connect Stripe

In Hello to Cheers, open **Your Venue → Settings → Financials & Integrations**.

Click **Connect with Stripe**.

You'll be taken to Stripe to complete the secure connection and account setup.

### Step 2 — Sign in to Stripe

**Already use Stripe?**

Sign in to your existing Stripe account for this venue. Don't create a second Stripe account just for Hello to Cheers.

If you don't already have a Stripe account for your venue, Stripe may allow you to create one during setup.

### Step 3 — Enter your business information

**Use your venue's real business information**

Enter the legal/business information associated with the Stripe account. This should describe your venue business, not Hello to Cheers.

Stripe may ask for:

- Business type
- Legal business name
- Business address
- Industry/business description
- Website
- Business representative/owner information

### Step 4 — Complete identity verification

Use the information for the person Stripe identifies as the business representative.

If Stripe asks for identification, complete that step directly with Stripe. Hello to Cheers does not need a copy of your ID.

### Step 5 — Enter bank/payout information

Use the bank account where you want your venue's Stripe payments deposited.

Double-check the account information before continuing.

**Your customers pay your Stripe account. Hello to Cheers does not hold your money.**

### Step 6 — Review and authorize

Review the information Stripe shows you, then approve the connection to Hello to Cheers.

### Step 7 — Return to Hello to Cheers

Back in Settings → Financials & Integrations, look at the Stripe card. You may see one of two states:

**Connected**

Your Stripe account is connected and ready to accept payments.

**Connected, setup incomplete**

A Stripe account is linked, but it can't accept charges yet.

Stripe still needs something before the account can accept payments.

Finish the outstanding verification or bank-information steps in Stripe. You do not need to reconnect your account.

### Step 8 — Choose your accepted payment methods

After Stripe is connected, choose your accepted payment methods inside Hello to Cheers on the Stripe card. This choice is made in Hello to Cheers — not in a separate payment system.

> **Which payment methods should I turn on?**
>
> **Credit/Debit Card**
>
> Choose this if you want couples to pay by card and receive confirmation quickly.
>
> **ACH Bank Transfer**
>
> Choose this if you also want couples to pay directly from a U.S. bank account. ACH takes longer to settle.
>
> You can choose both.
>
> If you're unsure, start with Credit/Debit Card. You can change your payment-method selection later.

### Official Stripe documentation

For Stripe's own account and verification details, see [Stripe's documentation](https://stripe.com/docs). The steps above are the Hello to Cheers setup path — start here, not with a long Stripe article.`,
  },
  {
    slug: "how-to-connect-quickbooks-online",
    title: "How to Connect QuickBooks Online",
    category: "Contracts & Payments",
    relatedFeatures: [
      { href: "/settings/integrations#quickbooks", label: "Open QuickBooks settings" },
    ],
    body: `### Before you start

**Before you connect**

Make sure you are a QuickBooks Online Primary Admin or Company Admin and know which QuickBooks company should receive this venue's customers, invoices, payments, and refunds.

### Step 1 — Connect QuickBooks

In Hello to Cheers, open **Your Venue → Settings → Financials & Integrations**.

Click **Connect with QuickBooks**.

### Step 2 — Sign in to Intuit

Sign in using the Intuit account that has access to the QuickBooks company you want to connect.

If you already use QuickBooks, do not create another Intuit account.

### Step 3 — Choose the QuickBooks company

> **Choose carefully**
>
> Select the QuickBooks company that belongs to this venue.
>
> This is where Hello to Cheers will sync this venue's customers, invoices, payments, and refunds.
>
> If you manage multiple businesses in QuickBooks, do not simply choose the first company shown.

### Step 4 — Authorize Hello to Cheers

Review the connection and select Connect / Authorize.

You are giving Hello to Cheers permission to sync the accounting information described above. You are not giving Hello to Cheers your QuickBooks password.

### Step 5 — Return to Hello to Cheers

You should see:

**Connected to [QuickBooks company name]**

You're done. You don't need to manually export invoices or payments.

Hello to Cheers will automatically send supported customers, invoices, payments, and refunds to the connected QuickBooks company.

### What QuickBooks syncs

Hello to Cheers syncs:

- Customers
- Invoices
- Payments
- Refunds

### Will QuickBooks change my Hello to Cheers records?

No. Hello to Cheers remains the source of truth for your venue's customer, invoice, payment, and refund records. QuickBooks receives the accounting sync.

### Sync problems

If a sync fails, Hello to Cheers retries automatically.

If an item ultimately needs attention, you'll see the sync status in the QuickBooks section of Settings.

### Official QuickBooks documentation

For Intuit account and company help, see [QuickBooks support](https://quickbooks.intuit.com/learn-support/). Use the steps above as your Hello to Cheers setup path.`,
  },
  {
    slug: "how-to-connect-facebook-instagram-lead-ads",
    title: "How to Connect Facebook & Instagram Lead Ads",
    category: "Finding & Booking Clients",
    relatedFeatures: [
      { href: "/settings/integrations#facebook", label: "Open Facebook & Instagram Lead Ads settings" },
    ],
    body: `### Before you start

**Before you connect Facebook / Instagram Lead Ads**

Make sure:

- You have access to the Facebook Page used by your Lead Ads.
- You know which Page you want to connect.
- You have already created the Lead Ads form(s) you want to use.
- You know which forms should send leads into Hello to Cheers.

Instagram does not need to be connected separately.

Instagram Lead Ads associated with the connected Facebook Page can flow through the same connection.

### Step 1 — Connect Facebook

In Hello to Cheers, open **Your Venue → Settings → Financials & Integrations**.

Click **Connect with Facebook**.

You'll first authorize Hello to Cheers with Meta. Then you'll choose the Facebook Page and Lead Ads forms you want to connect.

> **Important:** Connecting Facebook alone does not send leads into Hello to Cheers. You must select at least one Lead Ads form.

### Step 2 — Sign in to Meta

Sign in using the Facebook account that manages your venue's Facebook Page.

If Meta shows the wrong Facebook account, stop and switch to the Facebook account that manages the venue's Page before continuing.

### Step 3 — Review Meta permissions

**Meta is asking for permission to connect your Page**

These permissions allow Hello to Cheers to:

- see the Facebook Pages you manage;
- find your Lead Ads forms;
- receive lead submissions from the forms you select;
- maintain the connection to your Page.

These permissions are required for the integration to work.

Select Continue / Allow to complete the connection.

### Step 4 — Choose your business and Page in Meta

> **Choose your business and Page**
>
> If Meta asks which business or Page you want to connect:
>
> Choose the business and Facebook Page that belong to your venue.
>
> Do not stop after simply selecting Continue as [your name] if Meta then asks you to select business/Page assets.

### Step 5 — Select a Facebook Page in Hello to Cheers

Back in Hello to Cheers you will see:

**Step 1 of 2 — Select a Facebook Page**

Choose the Facebook Page whose Lead Ads should become leads in Hello to Cheers.

If you have multiple Pages, choose the Page for this venue.

Do not choose another location, personal Page, sister business, or test Page.

> **Which Page should I choose?**
>
> Choose the Page that your venue's Lead Ads campaigns use.
>
> If your ads are for “Jen's Fancy Venue,” choose the Facebook Page for Jen's Fancy Venue.

### Step 6 — Choose Lead Ads forms

Next you will see:

**Step 2 of 2 — Choose Lead Ads forms**

Select every Lead Ads form that you want to send new leads into Hello to Cheers.

You can select more than one.

For example, if you have:

- Wedding Inquiry
- Wedding Tour Request
- General Venue Inquiry

and you want all three to create HTC Leads, select all three.

Do not select old, test, or unrelated forms.

Any selected form can send leads into Hello to Cheers.

You must select at least one form. If you don't select a form, Facebook is connected but no leads will come into Hello to Cheers.

When you're ready, choose **Connect selected forms**.

### Step 7 — Connected

You should see:

**Connected to [Page Name]**

Your connected Lead Ads forms will automatically send new leads to Hello to Cheers.

You can return here later to:

- connect another form;
- stop a form from sending new leads;
- change the connected Page;
- reconnect Facebook if Meta permissions change.

### Official Meta documentation

For Meta's own Lead Ads form creation help, see [Meta Business Help](https://www.facebook.com/business/help). Use the steps above as your Hello to Cheers setup path.`,
  },
];
