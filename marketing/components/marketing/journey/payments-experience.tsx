import Image from "next/image";
import Link from "next/link";

import { JourneyNav } from "@/components/marketing/journey/journey-nav";
import { PaymentsWorkspaceMock } from "@/components/marketing/journey/payments-workspace-mock";
import { MarketingCta } from "@/components/marketing/marketing-cta";
import { FILM } from "@/lib/marketing/film";

const PRINCIPLES = [
  {
    n: "01",
    title: "One Financial Record",
    body: "Every invoice, payment, refund, and balance belongs to the booking—not another system.",
  },
  {
    n: "02",
    title: "Always Current",
    body: "There is no second spreadsheet to reconcile. Everyone sees the same financial picture.",
  },
  {
    n: "03",
    title: "Calm Conversations",
    body: "When couples ask about payments, your team already has the answer.",
  },
] as const;

const FLOW = [
  "Proposal",
  "Contract",
  "Payment Schedule",
  "Invoices",
  "Payments",
  "Paid in Full",
] as const;

type PaymentsExperienceProps = {
  prev: { id: string; title: string };
  next: { id: string; title: string };
};

/**
 * Payments journey chapter — confidence without finance clichés.
 * Money stays connected to the celebration.
 */
export function PaymentsExperience({ prev, next }: PaymentsExperienceProps) {
  return (
    <div className="bg-[var(--true-white)]">
      {/* ── Section 1 · Hero ── */}
      <section className="px-6 pt-[140px] pb-28 md:pb-36">
        <div className="mx-auto max-w-[700px]">
          <p className="text-xs tracking-[0.18em] uppercase text-[var(--heritage-sage)]">
            Connected journey · 05
          </p>
          <h1 className="mt-6 font-heading text-5xl font-medium leading-[1.05] text-[var(--forest-sage)] md:text-6xl lg:text-7xl">
            Payments
          </h1>
          <p className="mt-6 font-heading text-2xl italic text-[var(--forest-sage)]/80 md:text-3xl">
            Money stays connected to the celebration.
          </p>
          <p className="mt-10 max-w-[620px] text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
            Deposits, payment schedules, invoices, and balances all stay connected to the same
            booking—so everyone always knows where things stand without chasing spreadsheets or
            email threads.
          </p>
          <div className="mt-14 flex flex-wrap items-center gap-5">
            <MarketingCta />
            <Link
              href="/product#connected-journey"
              className="text-sm tracking-wide text-[var(--forest-sage)]/55 underline-offset-4 transition hover:underline"
            >
              Back to Journey
            </Link>
          </div>
        </div>
      </section>

      {/* ── Section 2 · Beautiful Image + Product ── */}
      <section className="px-6 pb-28 md:pb-36">
        <div className="mx-auto grid max-w-6xl items-stretch gap-8 md:grid-cols-[3fr_2fr] md:gap-10">
          <div className="relative min-h-[420px] overflow-hidden md:min-h-[560px]">
            <Image
              src={FILM.paymentsConsult}
              alt="Couple in a warm, relaxed conversation over coffee — finances that feel easy"
              fill
              className="object-cover object-[center_35%]"
              sizes="(max-width:768px) 100vw, 60vw"
              priority
            />
          </div>
          <div className="flex flex-col justify-center">
            <PaymentsWorkspaceMock />
            <p className="mt-6 text-sm tracking-wide text-[var(--forest-sage)]/55">
              Every payment lives with the booking it belongs to.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 3 · Three Principles ── */}
      <section className="px-6 py-24 md:py-32">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-3 md:gap-12">
          {PRINCIPLES.map((card) => (
            <div key={card.n} className="border-t border-[var(--taupe-medium)]/70 pt-8">
              <p className="font-heading text-sm text-[var(--heritage-sage)]/60">{card.n}</p>
              <h2 className="mt-4 font-heading text-2xl text-[var(--forest-sage)] md:text-3xl">
                {card.title}
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-[var(--forest-sage)]/70 md:text-base">
                {card.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 4 · The Difference ── */}
      <section className="bg-[var(--warm-gray)] px-6 py-28 md:py-36">
        <div className="mx-auto grid max-w-6xl gap-14 md:grid-cols-2 md:items-start md:gap-20">
          <div>
            <h2 className="font-heading text-3xl font-medium leading-[1.15] text-[var(--forest-sage)] md:text-5xl">
              Financial clarity shouldn&apos;t require detective work.
            </h2>
            <p className="mt-8 text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg">
              Too many venues spend time trying to determine which numbers are correct.
            </p>
            <p className="mt-5 text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg">
              Wevenu keeps every payment connected to the same record the entire team already
              uses.
            </p>
          </div>
          <div>
            <ol className="space-y-0">
              {FLOW.map((label, i) => (
                <li key={label} className="flex flex-col items-start">
                  <span className="font-heading text-xl text-[var(--forest-sage)] md:text-2xl">
                    {label}
                  </span>
                  {i < FLOW.length - 1 ? (
                    <span
                      className="my-2 pl-1 text-lg leading-none text-[var(--heritage-sage)]/45"
                      aria-hidden
                    >
                      ↓
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
            <p className="mt-8 text-sm tracking-wide text-[var(--forest-sage)]/50">
              Everything stays connected.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 5 · Product Showcase ── */}
      <section className="px-6 py-28 md:py-36">
        <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-[1.35fr_0.65fr] md:gap-16">
          <PaymentsWorkspaceMock className="min-h-[420px] overflow-hidden border border-[var(--taupe-medium)]/50 bg-[var(--true-white)] shadow-[0_28px_80px_-48px_rgba(47,55,47,0.4)] md:min-h-[480px]" />
          <div>
            <h2 className="font-heading text-3xl text-[var(--forest-sage)] md:text-4xl">
              Every dollar has context.
            </h2>
            <p className="mt-6 text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
              Payments aren&apos;t isolated transactions.
            </p>
            <p className="mt-5 text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
              They&apos;re simply another chapter in the booking.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 6 · Hospitality Image ── */}
      <section className="relative min-h-[70vh] md:min-h-[85vh]">
        <Image
          src={FILM.paymentsCelebrate}
          alt="Couple celebrating together in warm candlelight — hospitality, not transactions"
          fill
          className="object-cover object-[center_30%]"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[rgba(47,55,47,0.4)]" />
        <div className="relative z-10 mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-6 text-center text-[var(--true-white)] md:min-h-[85vh]">
          <p className="font-heading text-3xl italic leading-snug md:text-5xl">
            “Financial confidence creates better hospitality.”
          </p>
          <p className="mt-8 text-sm tracking-wide text-white/70 md:text-base">
            When your team trusts the numbers, they can focus on people instead.
          </p>
        </div>
      </section>

      {/* ── Section 7 · The Wevenu Difference ── */}
      <section className="px-6 py-28 md:py-36">
        <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-2 md:items-start md:gap-20">
          <h2 className="font-heading text-3xl text-[var(--forest-sage)] md:text-5xl">
            Finance shouldn&apos;t interrupt hospitality.
          </h2>
          <div className="space-y-5 text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg">
            <p>Every payment.</p>
            <p>Every deposit.</p>
            <p>Every balance.</p>
            <p>Every invoice.</p>
            <p>
              Lives beside the conversations, planning, and celebration it belongs to.
            </p>
            <p>That&apos;s why nothing gets lost.</p>
            <p className="border-t border-[var(--taupe-medium)]/60 pt-8 text-[var(--forest-sage)]/65">
              And nobody has to ask, “Can you send me the latest spreadsheet?”
            </p>
          </div>
        </div>
      </section>

      {/* ── Bottom Navigation ── */}
      <div className="pb-28 md:pb-36">
        <JourneyNav prev={prev} next={next} />
      </div>
    </div>
  );
}
