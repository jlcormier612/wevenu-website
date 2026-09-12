import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "SMS Opt-In · Hello to Cheers",
  description:
    "How Hello to Cheers venues collect optional SMS consent on inquiry and tour forms — for Twilio A2P reviewers and the public.",
};

/**
 * Public, no-login evidence page for Twilio A2P MessageFlow verification.
 * Mirrors the production inquiry/tour SMS consent UX (optional, unchecked).
 * This page does not submit leads; it illustrates the consent control and
 * links to the live inquiry/tour forms venues embed on their own sites.
 */
export default function SmsOptInEvidencePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-[#3D2F30]">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#9ca3af]">
        Hello to Cheers · Public evidence
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Optional text-message permission
      </h1>
      <p className="mt-4 text-base leading-relaxed text-[#5c534c]">
        When a venue using Hello to Cheers has texting set up, that venue may send
        relationship texts about an inquiry, tour, or event. Those messages are sent
        by the venue through Hello to Cheers — not by a third-party marketer.
      </p>
      <p className="mt-3 text-base leading-relaxed text-[#5c534c]">
        Venues may show the following control on their public inquiry form and
        tour-booking form. SMS consent is separate from submitting an inquiry or
        booking a tour. The checkbox is optional, unchecked by default, and is not
        required to complete those actions or to use Hello to Cheers.
      </p>

      <section
        className="mt-10 space-y-3 rounded-2xl border border-[#e8e0d6] bg-[#fdfbf8] p-6"
        aria-labelledby="sms-permission-demo"
      >
        <h2 id="sms-permission-demo" className="text-sm font-semibold">
          Text message permission{" "}
          <span className="font-normal text-[#6b7280]">(optional)</span>
        </h2>
        <p className="text-xs text-[#6b7280]">
          Optional — you can submit your inquiry or book your tour without agreeing
          to text messages. Providing a phone number alone does not authorize texts.
        </p>
        <label className="flex items-start gap-3 text-sm leading-relaxed">
          <input
            type="checkbox"
            defaultChecked={false}
            className="mt-1 h-4 w-4 shrink-0"
            aria-required="false"
            aria-label="Optional text message permission (illustration)"
            disabled
          />
          <span>
            Yes, I’d like to receive text messages from this venue about my inquiry,
            tour, or event. Message and data rates may apply. Reply STOP to opt out.
          </span>
        </label>
        <p className="text-[11px] text-[#6b7280]">
          See our{" "}
          <Link href="/privacy" className="underline underline-offset-2">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/end-user-terms" className="underline underline-offset-2">
            End User Terms
          </Link>
          . Accepting those terms is not SMS consent.
        </p>
      </section>

      <ul className="mt-10 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[#5c534c]">
        <li>Phone number entry alone is not SMS consent.</li>
        <li>Choosing “Text message” as a preferred contact method is not SMS consent.</li>
        <li>Accepting Privacy Policy or End User Terms is not SMS consent.</li>
        <li>SMS consent is not required to inquire, book a tour, or use Hello to Cheers.</li>
        <li>
          Message frequency varies with the inquiry, tour, and event planning —
          occasional relationship messages, not a fixed daily volume.
        </li>
        <li>Message and data rates may apply.</li>
        <li>Reply STOP to opt out; reply START to opt back in; reply HELP for help.</li>
        <li>
          For help with these texts, contact{" "}
          <a href="mailto:privacy@hellotocheers.com" className="underline underline-offset-2">
            privacy@hellotocheers.com
          </a>
          .
        </li>
      </ul>

      <p className="mt-10 text-sm leading-relaxed text-[#5c534c]">
        The live opt-in mechanism is the optional checkbox on a venue’s Hello to Cheers
        inquiry form or tour-booking form (same control as illustrated above). This
        page is the public review path; it does not itself collect a phone number.
      </p>

      <p className="mt-6 text-sm text-[#6b7280]">
        Legal:{" "}
        <Link href="/privacy" className="underline underline-offset-2">
          Privacy Policy
        </Link>
        {" · "}
        <Link href="/end-user-terms" className="underline underline-offset-2">
          End User Terms
        </Link>
      </p>
    </main>
  );
}
