import type { Metadata } from "next";

import Link from "next/link";

import { WelcomeBackForm } from "@/components/marketing/welcome-back-form";
import { HOVER_LINK, TYPE_HERO_SHELL } from "@/lib/marketing/rhythm";

export const metadata: Metadata = {
  title: "Welcome Back",
  description:
    "Former Weven venues can subscribe anytime and note Welcome Back at checkout. Optional introductions welcome.",
};

/**
 * Optional Welcome Back introduction — not part of the purchase flow.
 * Checkout is open to everyone; verification happens after subscription in CRM.
 */
export default function WelcomeBackPage() {
  return (
    <div className="bg-[var(--true-white)]">
      <section className={TYPE_HERO_SHELL}>
        <div className="mx-auto max-w-[65ch]">
          <h1 className="font-heading text-[2.52rem] font-medium leading-[1.16] tracking-tight text-[var(--forest-sage)] md:text-[4.2rem]">
            Welcome Back
          </h1>
          <div className="mt-8 space-y-5 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg">
            <p>
              If you previously used Weven, we&apos;d love to welcome you back to Hello to
              Cheers.
            </p>
            <p>
              You can subscribe anytime on{" "}
              <Link href="/pricing#plans" className={HOVER_LINK}>
                Pricing
              </Link>
              . At checkout, check the optional Welcome Back box if your venue was part of
              the Weven family — no approval is needed before you purchase.
            </p>
            <p>
              Prefer to say hello first? Leave a short note below. We&apos;ll follow up —
              verification happens after you&apos;re enrolled, not before.
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 pb-28 md:pb-36">
        <div className="mx-auto max-w-lg">
          <WelcomeBackForm />
        </div>
      </section>
    </div>
  );
}
