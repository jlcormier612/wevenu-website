import type { RelatedFeatureLink } from "@/lib/success-library/types";

export type IntegrationGuideStep = {
  number: number;
  title: string;
  doThis: string;
  lookFor: string;
  dontDo?: string;
  tip?: string;
};

export type IntegrationSetupGuide = {
  slug: string;
  title: string;
  shortTitle: string;
  category: "Your Venue";
  intro: string;
  time: string;
  prerequisites: string[];
  whyItMatters: string;
  steps: IntegrationGuideStep[];
  completion: string;
  troubleshooting: string[];
  relatedFeatures: RelatedFeatureLink[];
};

/**
 * Venue-facing setup guides for integrations.
 *
 * These are intentionally prescriptive: the target audience is a venue owner
 * who should not need to understand OAuth, API credentials, webhooks, or Meta
 * Business terminology in order to complete setup.
 *
 * Keep these guides in product language, not developer language. If a third-
 * party provider changes its UI, update the affected step and checkpoint here.
 */
export const INTEGRATION_SETUP_GUIDES: readonly IntegrationSetupGuide[] = [
  {
    slug: "connect-stripe",
    title: "Connect Stripe for online payments",
    shortTitle: "Connect Stripe",
    category: "Your Venue",
    intro:
      "Connect your venue's Stripe account so couples can pay deposits and invoices directly to your connected account. Hello to Cheers never holds your money.",
    time: "About 5 minutes",
    prerequisites: [
      "A Stripe account for your venue",
      "Permission to connect that Stripe account",
      "Your Stripe login",
    ],
    whyItMatters:
      "Once Stripe is connected, payment links and invoices can use your venue's payment account instead of requiring manual payment instructions or re-entry.",
    steps: [
      {
        number: 1,
        title: "Start in Hello to Cheers",
        doThis: "Go to Settings → Financials & Integrations and find Online Payment Collection. Click Connect Stripe.",
        lookFor: "Stripe should open in a new authorization screen. You should see that you are connecting a Stripe account to Hello to Cheers.",
        dontDo: "Do not paste a Stripe secret key into Hello to Cheers. Venue connection is an authorization flow; you should not need developer credentials.",
      },
      {
        number: 2,
        title: "Sign in to Stripe",
        doThis: "Sign in using the Stripe account that belongs to your venue.",
        lookFor: "Stripe should show the account/business you are about to connect.",
        dontDo: "Do not connect a personal or unrelated Stripe account. Check the business name before continuing.",
      },
      {
        number: 3,
        title: "Authorize the connection",
        doThis: "Review the connection and approve it.",
        lookFor: "You should be returned to Hello to Cheers automatically after Stripe finishes authorization.",
      },
      {
        number: 4,
        title: "Confirm the green Connected state",
        doThis: "Back in Settings → Financials & Integrations, look at Online Payment Collection.",
        lookFor: "You should see Connected and a message that your Stripe account is ready to accept payments.",
        tip: "If you see Connected, you are done. There is nothing else to copy or configure.",
      },
    ],
    completion:
      "You're connected! Hello to Cheers can now use your venue's Stripe account for online payment collection.",
    troubleshooting: [
      "If Stripe sends you back to an error page, do not repeatedly reconnect. Return to Settings and check whether the card still says Connected.",
      "If the wrong Stripe account was connected, use Disconnect Stripe and reconnect with the correct account.",
    ],
    relatedFeatures: [{ label: "Go to Financials & Integrations", href: "/settings/integrations#stripe" }],
  },
  {
    slug: "connect-quickbooks",
    title: "Connect QuickBooks Online",
    shortTitle: "Connect QuickBooks",
    category: "Your Venue",
    intro:
      "Connect your venue's QuickBooks Online company so customer, invoice, payment, and refund activity can sync without manual re-entry.",
    time: "About 5 minutes",
    prerequisites: [
      "A QuickBooks Online account for your venue",
      "Permission to connect that QuickBooks company",
      "Your Intuit/QuickBooks login",
      "The correct QuickBooks company selected before you approve the connection",
    ],
    whyItMatters:
      "Connecting QuickBooks keeps your accounting workflow tied to the financial activity happening in Hello to Cheers and reduces duplicate data entry.",
    steps: [
      {
        number: 1,
        title: "Start in Hello to Cheers",
        doThis: "Go to Settings → Financials & Integrations and find QuickBooks Online. Click Connect QuickBooks.",
        lookFor: "An Intuit/QuickBooks authorization window or page should open.",
        dontDo: "You should not need QuickBooks developer keys or API credentials as a venue. Those are used by Hello to Cheers behind the scenes.",
      },
      {
        number: 2,
        title: "Sign in to Intuit",
        doThis: "Sign in with the Intuit account that has access to the venue's QuickBooks Online company.",
        lookFor: "Intuit should show the QuickBooks company that is about to be connected.",
      },
      {
        number: 3,
        title: "Choose the correct company",
        doThis: "If Intuit asks which company to connect, choose the venue's actual QuickBooks Online company.",
        lookFor: "The company name should match the venue you are setting up in Hello to Cheers.",
        dontDo: "Do not choose a test, old, or unrelated company unless you are intentionally testing. The connection is tied to the company you authorize.",
      },
      {
        number: 4,
        title: "Approve the connection",
        doThis: "Review the requested access and click the button that authorizes/connects QuickBooks.",
        lookFor: "You should be returned to Hello to Cheers.",
      },
      {
        number: 5,
        title: "Confirm the company name in Hello to Cheers",
        doThis: "Return to Settings → Financials & Integrations and look at QuickBooks Online.",
        lookFor: "You should see Connected and the name of the QuickBooks company you selected.",
        tip: "Seeing the correct company name is the best confirmation that you connected the right QuickBooks account.",
      },
    ],
    completion:
      "You're connected! Hello to Cheers now knows which QuickBooks Online company belongs to this venue.",
    troubleshooting: [
      "If you are sent back to an error page, return to Settings and check whether QuickBooks shows Connected before trying again.",
      "If the company name is wrong, disconnect QuickBooks and reconnect using the correct Intuit account/company.",
      "If Intuit says you do not have permission, ask the person who manages the venue's QuickBooks company to complete the connection.",
    ],
    relatedFeatures: [{ label: "Go to Financials & Integrations", href: "/settings/integrations#quickbooks" }],
  },
  {
    slug: "connect-facebook-instagram-lead-ads",
    title: "Connect Facebook & Instagram Lead Ads",
    shortTitle: "Connect Facebook & Instagram",
    category: "Your Venue",
    intro:
      "Connect your Meta/Facebook Page so leads submitted through your enabled Lead Ads forms can become Leads in Hello to Cheers automatically.",
    time: "About 10 minutes",
    prerequisites: [
      "A Facebook account that manages your venue's Facebook Page",
      "The venue's Facebook Page",
      "Access to the Meta business assets associated with that Page",
      "If you advertise on Instagram, use the Instagram account associated with the venue's Meta/Page setup",
    ],
    whyItMatters:
      "Your advertising should feed directly into your lead workflow. Once connected, a lead submitted through an enabled Meta Lead Ads form can arrive in Hello to Cheers without someone manually copying the inquiry.",
    steps: [
      {
        number: 1,
        title: "Start in Hello to Cheers",
        doThis: "Go to Settings → Financials & Integrations and find Facebook / Instagram Lead Ads. Click Connect with Facebook.",
        lookFor: "Meta will open a connection flow asking which business assets Hello to Cheers can access.",
      },
      {
        number: 2,
        title: "Choose your existing business assets",
        doThis: "When Meta asks for a Business Portfolio, choose the existing business portfolio that owns/manages your venue's Page.",
        lookFor: "Your existing business should appear as an option. Continue with that existing business.",
        dontDo: "Do not create a brand-new Business Portfolio just because Meta offers that option. Use the venue's existing business assets whenever possible.",
        tip: "If you are unsure which business owns the Page, stop here rather than guessing. The wrong business can make the correct Page appear unavailable later.",
      },
      {
        number: 3,
        title: "Select the venue's Facebook Page",
        doThis: "Select the Facebook Page that represents your venue.",
        lookFor: "The Page name should match your venue. Hello to Cheers needs this Page because Meta's Lead Ads leadgen connection is Page-based.",
        dontDo: "Do not select a different venue Page, an old Page, or a personal profile.",
      },
      {
        number: 4,
        title: "Review the permissions",
        doThis: "Read the access Meta says Hello to Cheers will receive, then continue if it matches the connection you intended to make.",
        lookFor: "You should see access related to leads, Pages, and the connected business assets.",
        tip: "Meta's permission screen can look technical. You do not need to change developer settings here; the goal is simply to authorize the Hello to Cheers Lead Ads connection.",
      },
      {
        number: 5,
        title: "Finish the Meta connection",
        doThis: "Confirm the connection in Meta. Wait for Meta to return you to Hello to Cheers.",
        lookFor: "Hello to Cheers should tell you that Facebook is connected and then ask you to select a Page if one has not already been selected.",
      },
      {
        number: 6,
        title: "Select the Page inside Hello to Cheers",
        doThis: "Choose the venue's Facebook Page from the list shown in Hello to Cheers.",
        lookFor: "The selected Page should appear in the Facebook / Instagram Lead Ads card.",
        tip: "This is an important checkpoint. Hello to Cheers does not consider the integration fully active just because Meta authorization succeeded; the Page must also be subscribed for Lead Ads notifications.",
      },
      {
        number: 7,
        title: "Choose the Lead Ads forms",
        doThis: "Hello to Cheers will load the Lead Ads forms available on the selected Page. Select the forms you want feeding into your Leads and click Connect selected forms.",
        lookFor: "The forms you selected should appear under Connected forms with an enabled switch.",
        dontDo: "Do not enable a form that belongs to another campaign, another business, or an old test unless you want those submissions imported too.",
      },
      {
        number: 8,
        title: "Instagram: no separate Hello to Cheers connection",
        doThis: "You do not connect Instagram separately inside Hello to Cheers. If your Meta advertising uses Instagram placements, keep the venue's Instagram account associated with the same Meta/Page business setup you use for the Lead Ad.",
        lookFor: "Your Hello to Cheers connection remains the Facebook / Instagram Lead Ads connection, with the venue's Facebook Page and selected Lead Ads forms shown as the source.",
        dontDo: "Do not look for a separate Instagram API key or a second Instagram Connect button in Hello to Cheers.",
        tip: "Meta handles the Facebook/Instagram advertising relationship. Our current implementation is Page-based: Hello to Cheers connects the Meta user, selects the managed Page, subscribes that Page to lead notifications, and enables the Page's Lead Ads forms.",
      },
      {
        number: 9,
        title: "Confirm the green Connected state",
        doThis: "Back in Settings → Financials & Integrations, review Facebook / Instagram Lead Ads.",
        lookFor: "You should see Connected, the selected Page, and your connected forms. New submissions from enabled forms should import as Leads automatically.",
      },
    ],
    completion:
      "You're connected! New submissions from your enabled Meta Lead Ads forms can now flow into Hello to Cheers as Leads.",
    troubleshooting: [
      "If your Page is missing, check that the Facebook account you used actually manages that Page and that the Page belongs to the business assets you selected.",
      "If Meta authorization succeeds but Hello to Cheers says the Page is not subscribed to lead notifications, do not assume the connection is complete. Re-select the Page so Hello to Cheers can establish the Page leadgen subscription.",
      "If no forms appear, make sure the selected Page actually has Lead Ads forms. A normal Facebook contact form or post is not the same thing as a Lead Ads form.",
      "If an Instagram Lead Ad does not appear as expected, first confirm that the Instagram placement is using the same Meta business/Page/form setup. This should be tested end-to-end before treating it as an integration failure.",
    ],
    relatedFeatures: [{ label: "Go to Financials & Integrations", href: "/settings/integrations#facebook" }],
  },
] as const;

export function getIntegrationSetupGuide(slug: string): IntegrationSetupGuide | null {
  return INTEGRATION_SETUP_GUIDES.find((guide) => guide.slug === slug) ?? null;
}
