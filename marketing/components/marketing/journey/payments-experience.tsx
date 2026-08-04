import Image from "next/image";
import { JourneyNav } from "@/components/marketing/journey/journey-nav";
import { PaymentsWorkspaceMock } from "@/components/marketing/journey/payments-workspace-mock";
import { MarketingCta, WalkthroughCtas } from "@/components/marketing/marketing-cta";
import { FILM } from "@/lib/marketing/film";
import { EDITORIAL_BLEED, EDITORIAL_FRAME, EDITORIAL_IMAGE, TYPE_HERO_SHELL } from "@/lib/marketing/rhythm";

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
      <section className={TYPE_HERO_SHELL}>
        <div className="mx-auto max-w-[65ch]">
          <p className="text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/82">
            Connected journey · 05
          </p>
          <h1 className="mt-8 font-heading text-[3.36rem] font-medium leading-[1.1] tracking-tight text-[var(--forest-sage)] md:text-[4.2rem] lg:text-[5.04rem]">
            Payments
          </h1>
          <p className="mt-4 font-heading text-2xl italic text-[var(--forest-sage)]/80 md:text-3xl">
            Money stays connected to the celebration.
          </p>
          <p className="mt-8 max-w-[65ch] text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg">
            Deposits, auto-generated invoices, flexible payment schedules, balances and built-in
            reminders all stay connected to the same booking—so everyone always knows where things
            stand without spreadsheets, disjointed email threads or chasing payments.
          </p>
          <WalkthroughCtas className="mt-14">
            <MarketingCta
              href="/product#connected-journey"
              label="Back to Journey"
              variant="ghost"
            />
          </WalkthroughCtas>
        </div>
      </section>

      {/* ── Section 2 · Emotional Photography ── */}
      <section className="px-6 pb-28 md:pb-36">
        <div className={`relative mx-auto aspect-[16/10] max-w-6xl md:aspect-[2/1] ${EDITORIAL_FRAME}`}>
          <Image
            src={FILM.paymentsConsult}
            alt="Payment overview for Elena & James — deposits, schedules, and balances kept clear"
            fill
            className={EDITORIAL_IMAGE}
            sizes="100vw"
            priority
          />
        </div>
      </section>

      {/* ── Section 3 · Three Principles ── */}
      <section className="px-6 py-28 md:py-36">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-3 md:gap-12">
          {PRINCIPLES.map((card) => (
            <div key={card.n} className="border-t border-[var(--taupe-medium)]/70 pt-8">
              <p className="font-heading text-sm text-[var(--heritage-sage)]/60">{card.n}</p>
              <h2 className="mt-4 font-heading text-2xl text-[var(--forest-sage)] md:text-[2.1rem]">
                {card.title}
              </h2>
              <p className="mt-4 text-sm leading-[1.7] text-[var(--forest-sage)]/70 md:text-base">
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
            <h2 className="font-heading text-[2.1rem] font-medium leading-[1.21] text-[var(--forest-sage)] md:text-[3.36rem]">
              Financial clarity shouldn&apos;t require detective work.
            </h2>
            <p className="mt-6 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
              Too many venues spend time trying to determine which numbers are correct.
            </p>
            <p className="mt-5 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
              Hello to Cheers keeps every payment connected to the same record the entire team already
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
          <PaymentsWorkspaceMock className={`min-h-[420px] md:min-h-[480px] ${EDITORIAL_FRAME} bg-[var(--true-white)]`} />
          <div>
            <h2 className="font-heading text-[2.1rem] text-[var(--forest-sage)] md:text-[2.52rem]">
              Every dollar has context.
            </h2>
            <p className="mt-6 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg max-w-[65ch]">
              Payments aren&apos;t isolated transactions.
            </p>
            <p className="mt-5 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg max-w-[65ch]">
              They&apos;re simply another chapter in the booking.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 6 · Hospitality Image ── */}
      <section className={`relative aspect-[16/10] w-full md:aspect-[1024/521] ${EDITORIAL_BLEED}`}>
        <Image
          src={FILM.paymentsCelebrate}
          alt="Team reviewing finances together — financial confidence creates better hospitality"
          fill
          className={EDITORIAL_IMAGE}
          sizes="100vw"
        />
      </section>

      {/* ── Section 7 · The Hello to Cheers Difference ── */}
      <section className="px-6 py-28 md:py-36">
        <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-2 md:items-start md:gap-20">
          <h2 className="font-heading text-[2.1rem] text-[var(--forest-sage)] md:text-[3.36rem]">
            Finance shouldn&apos;t interrupt hospitality.
          </h2>
          <div className="space-y-5 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
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
