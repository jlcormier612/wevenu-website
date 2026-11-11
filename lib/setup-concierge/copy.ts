import type { SetupDomainId, SetupDomainState, SetupDomainStateKind } from "@/lib/setup-concierge/types";

const PROFILE_HELP = {
  helpHref: "/help/where-do-my-venue-colors-actually-show-up",
  helpTitle: "Where Do My Venue Colors Actually Show Up?",
};
const PACKAGE_HELP = {
  helpHref: "/help/whats-the-difference-between-a-package-inventory-and-an-inventory-template",
  helpTitle: "What's the Difference Between a Package, Inventory, and an Inventory Template?",
};
const STRIPE_HELP = {
  helpHref: "/help/how-to-connect-stripe-for-online-payments",
  helpTitle: "How to Connect Stripe for Online Payments",
};
const TEXTING_HELP = {
  helpHref: "/help/how-texting-setup-works",
  helpTitle: "How Texting Setup Works",
};
const FACEBOOK_HELP = {
  helpHref: "/help/how-to-connect-facebook-instagram-lead-ads",
  helpTitle: "How to Connect Facebook & Instagram Lead Ads",
};

type Copy = Pick<
  SetupDomainState,
  | "what"
  | "why"
  | "whatYouDo"
  | "whatHtcDoes"
  | "doneLooksLike"
  | "cannotSee"
  | "href"
  | "ctaLabel"
  | "helpHref"
  | "helpTitle"
>;

export function domainCopy(
  domain: SetupDomainId,
  state: SetupDomainStateKind,
  opts: { textingCanEdit?: boolean } = {},
): Copy {
  if (domain === "profile") {
    return {
      what: "Your venue profile is missing how people find you.",
      why: "Couples and agreements need a name, a street address, and an email or phone.",
      whatYouDo: "Fill those fields in Business & Brand.",
      whatHtcDoes: "Hello to Cheers uses them on your profile and documents.",
      doneLooksLike: "The venue has a name, a street address, and an email or phone.",
      cannotSee: null,
      href: "/settings/business",
      ctaLabel: "Complete your profile",
      ...PROFILE_HELP,
    };
  }
  if (domain === "package") {
    return {
      what: "You don't have a package of your own yet.",
      why: "A starter package doesn't count until you create or convert one as your venue's offering.",
      whatYouDo: "Open Packages and add an active venue-authored package.",
      whatHtcDoes: "Inquiries will have something real to choose.",
      doneLooksLike: "At least one active package you authored exists.",
      cannotSee: null,
      href: "/library/packages",
      ctaLabel: "Create a package",
      ...PACKAGE_HELP,
    };
  }
  if (domain === "inquiry_path") {
    return {
      what: "Choose how new inquiries get into Hello to Cheers.",
      why: "Until you pick a path, we can't tell whether to wait for your website form or for you to add leads yourself.",
      whatYouDo: "Choose automated website intake, or say you'll add leads yourself.",
      whatHtcDoes: "We'll point you to the form or to adding a lead — not both.",
      doneLooksLike: "A lead-capture path is chosen.",
      cannotSee: "We cannot see tour hours, Facebook, or email forwarding as a substitute for this choice.",
      href: "/setup-hub/lead-capture",
      ctaLabel: "Set up lead intake",
      helpHref: null,
      helpTitle: null,
    };
  }
  if (domain === "website_delivery") {
    return {
      what: "Share your inquiry form and send a test so we can confirm it arrives.",
      why: "Automated intake is on, but we have not received a website inquiry yet.",
      whatYouDo: "Copy the form link or embed, put it where couples will find it, and submit a test inquiry.",
      whatHtcDoes: "When a website inquiry is saved as a lead, we'll know delivery works.",
      doneLooksLike: "At least one lead with source website is in Hello to Cheers.",
      cannotSee: "We cannot see whether the form is on your live website.",
      href: "/setup-hub/lead-capture",
      ctaLabel: "Open lead intake",
      helpHref: null,
      helpTitle: null,
    };
  }
  if (domain === "stripe") {
    if (state === "WAITING_ON_EXTERNAL") {
      return {
        what: "Stripe still needs to finish enabling charges.",
        why: "Your Stripe account is linked, but it can't accept charges yet.",
        whatYouDo: "Finish identity and bank setup in Stripe. There is nothing else to click here.",
        whatHtcDoes: "Hello to Cheers will pick up charges when Stripe enables them.",
        doneLooksLike: "Stripe can accept charges.",
        cannotSee: "We cannot see Stripe's verification screens.",
        href: "/settings/integrations#stripe",
        ctaLabel: "View status",
        ...STRIPE_HELP,
      };
    }
    return {
      what: "Connect Stripe if you want couples to pay online.",
      why: "Online payments are optional. Connect when you're ready, or skip from Setup.",
      whatYouDo: "Connect your Stripe account from Financials & Integrations.",
      whatHtcDoes: "Money goes to your Stripe account. Hello to Cheers never holds your funds.",
      doneLooksLike: "Stripe can accept charges, or you chose I'll do this later.",
      cannotSee: null,
      href: "/settings/integrations#stripe",
      ctaLabel: "Connect Stripe",
      ...STRIPE_HELP,
    };
  }
  if (domain === "texting") {
    if (state === "BLOCKED") {
      return {
        what: "Texting setup needs your attention.",
        why: "Registration hit a problem that Hello to Cheers cannot finish without you.",
        whatYouDo: opts.textingCanEdit
          ? "Update your details and resubmit."
          : "Ask an owner or manager to update texting details.",
        whatHtcDoes: "We'll keep the current status on Communications until it's resolved.",
        doneLooksLike: "Texting shows Ready and can send.",
        cannotSee: "We do not have a carrier review timeline.",
        href: "/settings/communications#texting",
        ctaLabel: opts.textingCanEdit ? "Update details" : "View status",
        ...TEXTING_HELP,
      };
    }
    if (state === "WAITING_ON_EXTERNAL") {
      return {
        what: "Hello to Cheers is still setting up texting.",
        why: "Your information is in. The rest happens outside this page.",
        whatYouDo: "You don't need to do anything right now. You can still update details if something changed.",
        whatHtcDoes: "We'll show Ready here when texting can send.",
        doneLooksLike: "Texting is Ready and a number is assigned.",
        cannotSee: "We do not have a carrier review timeline.",
        href: "/settings/communications#texting",
        ctaLabel: "View status",
        ...TEXTING_HELP,
      };
    }
    return {
      what: "Finish your texting information.",
      why: "You started texting setup. Hello to Cheers still needs the remaining details from you.",
      whatYouDo: "Continue the texting form on Communications.",
      whatHtcDoes: "We'll submit registration after you save.",
      doneLooksLike: "Texting information is saved.",
      cannotSee: "We do not have a carrier review timeline.",
      href: "/settings/communications#texting",
      ctaLabel: "Continue texting setup",
      ...TEXTING_HELP,
    };
  }
  if (state === "BLOCKED") {
    return {
      what: "Facebook Lead Ads needs to be reconnected.",
      why: "The connection is in an error state, so forms cannot deliver.",
      whatYouDo: "Reconnect Facebook from Integrations.",
      whatHtcDoes: "We'll receive leads again when the Page and an enabled form are connected.",
      doneLooksLike: "A Page is bound and at least one form is enabled.",
      cannotSee: "A connected Page alone does not mean lead ads are working.",
      href: "/settings/integrations",
      ctaLabel: "Reconnect Facebook",
      ...FACEBOOK_HELP,
    };
  }
  return {
    what: "Finish Facebook Lead Ads setup.",
    why: "You started Facebook, but a Page and an enabled form are both required before anything can deliver.",
    whatYouDo: "Choose your Page and enable at least one lead form.",
    whatHtcDoes: "We'll accept matching leads from enabled forms.",
    doneLooksLike: "A Page is bound and at least one form is enabled.",
    cannotSee: "We do not treat a Facebook lead as website form delivery.",
    href: "/settings/integrations",
    ctaLabel: "Finish Facebook setup",
    ...FACEBOOK_HELP,
  };
}
