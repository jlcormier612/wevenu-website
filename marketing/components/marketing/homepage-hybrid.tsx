import Image from "next/image";
import Link from "next/link";

import { MarketingCta } from "@/components/marketing/marketing-cta";
import { UiPlaceholder } from "@/components/marketing/ui-placeholder";
import { FILM } from "@/lib/marketing/film";
import { VISION } from "@/lib/marketing/vision";

const RELATIONSHIPS = [
  {
    name: "Venue",
    line: "The operating system for how your venue actually runs—sales, planning, operations, and hospitality in one living record.",
  },
  {
    name: "Client",
    line: "A planning experience that feels like your property—warm, personal, and continuous between conversations.",
  },
  {
    name: "Guest & Vendor",
    line: "Informed guests and trusted partners who arrive prepared—because they already share the same celebration.",
  },
] as const;

/**
 * Home — why Wevenu exists.
 * Belief and hospitality first. Product journey lives on /product.
 */
export function HomepageHybrid() {
  return (
    <div>
      {/* ── Hero ── */}
      <section className="mx-auto max-w-5xl px-6 pb-24 pt-20 text-center md:pb-32 md:pt-28">
        <h1 className="mx-auto max-w-4xl font-heading text-[2.35rem] font-medium leading-[1.15] tracking-tight text-[var(--forest-sage)] md:text-5xl lg:text-[3.5rem]">
          Every venue owner got into this business because they love creating unforgettable
          celebrations.
        </h1>
        <p className="mx-auto mt-10 max-w-2xl text-base leading-relaxed text-[var(--forest-sage)]/65 md:mt-12 md:text-lg">
          Almost no one imagined spending their days chasing emails, spreadsheets, vendors,
          payments, and elusive details—or wondering whether something had been missed.
        </p>
        <p className="mx-auto mt-14 max-w-3xl font-heading text-2xl font-medium leading-[1.2] text-[var(--forest-sage)] md:mt-[72px] md:text-4xl">
          Wevenu gives you back the time to create unforgettable celebrations—and the peace of
          mind to enjoy them.
        </p>
        <div className="mt-14 flex flex-wrap items-center justify-center gap-4 md:mt-[72px]">
          <MarketingCta />
          <Link
            href="/product#follow"
            className="inline-flex items-center rounded-full border border-[var(--heritage-sage)]/40 px-6 py-3 text-sm tracking-wide text-[var(--forest-sage)] transition hover:bg-[var(--linen)]"
          >
            Follow one booking
          </Link>
        </div>
        <div className="relative mx-auto mt-16 aspect-[16/9] w-full max-w-4xl overflow-hidden md:mt-20 md:aspect-[2.1/1]">
          <Image
            src={FILM.heroCrop}
            alt="Quiet editorial tablescape — soft florals and linen"
            fill
            priority
            className="object-cover object-center"
            sizes="(max-width:768px) 100vw, 80vw"
          />
        </div>
      </section>

      {/* ── Philosophy — calm conversation ── */}
      <section className="border-y border-[var(--taupe-light)] bg-[var(--linen)] px-6 py-28 md:py-40">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-heading text-3xl font-medium leading-[1.15] text-[var(--forest-sage)] md:text-5xl">
            You were never looking for software.
          </h2>

          <p className="mt-14 font-heading text-2xl leading-[1.25] text-[var(--forest-sage)]/75 md:mt-16 md:text-3xl">
            You were looking for fewer repeated conversations.
          </p>

          <p className="mt-10 font-heading text-xl leading-[1.3] text-[var(--forest-sage)]/65 md:mt-12 md:text-2xl">
            For calmer mornings.
          </p>

          <p className="mt-8 font-heading text-xl leading-[1.3] text-[var(--forest-sage)]/65 md:mt-10 md:text-2xl">
            For more confidence that nothing has been forgotten.
          </p>

          <p className="mt-8 font-heading text-xl leading-[1.3] text-[var(--forest-sage)]/65 md:mt-10 md:text-2xl">
            For more time creating unforgettable celebrations...
          </p>

          <p className="mt-6 font-heading text-xl leading-[1.3] text-[var(--forest-sage)]/65 md:mt-8 md:text-2xl">
            ...and less time chasing the details behind them.
          </p>

          <p className="mt-14 max-w-2xl font-heading text-xl leading-[1.35] text-[var(--forest-sage)]/70 md:mt-16 md:text-2xl">
            Because hospitality was never meant to be stitched together from disconnected
            systems.
          </p>

          <p className="mt-16 text-center font-heading text-2xl font-medium leading-[1.2] text-[var(--forest-sage)] md:mt-20 md:text-4xl">
            One place where all the magic of your venue comes together.
          </p>
        </div>
      </section>

      {/* ── Bridge — hospitality over departments ── */}
      <section className="px-6 pb-28 md:pb-36">
        <div className="mx-auto max-w-6xl">
          <div className="relative aspect-[16/10] w-full overflow-hidden md:aspect-[2.1/1]">
            <Image
              src={FILM.tourGrounds}
              alt="Independent venue grounds in natural light — hospitality first"
              fill
              className="object-cover object-[center_40%]"
              sizes="100vw"
            />
          </div>
          <div className="mx-auto mt-12 max-w-2xl space-y-5 text-center text-base leading-relaxed text-[var(--forest-sage)]/70 md:mt-14 md:text-lg">
            <p>
              Independent venues deserve software built around hospitality—not around
              departments.
            </p>
            <p>Your venue isn&apos;t defined by the type of event you host.</p>
            <p>It&apos;s defined by the experience people remember long after it&apos;s over.</p>
          </div>
        </div>
      </section>

      {/* ── Relationships ── */}
      <section className="border-y border-[var(--taupe-light)] bg-[var(--linen)] px-6 py-28 md:py-36">
        <div className="mx-auto max-w-5xl">
          <h2 className="max-w-2xl font-heading text-3xl font-medium leading-[1.15] text-[var(--forest-sage)] md:text-5xl">
            Hospitality is bigger than one relationship.
          </h2>
          <div className="mt-8 max-w-xl space-y-4 text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
            <p>Your venue is about more than one relationship.</p>
            <p>It coordinates vendors.</p>
            <p>Welcomes guests.</p>
            <p>Guides families.</p>
            <p>Supports your staff.</p>
            <p className="pt-2 text-[var(--forest-sage)]/80">
              Wevenu keeps every relationship connected—so everyone experiences the same
              thoughtful hospitality.
            </p>
          </div>
          <div className="mt-16 grid gap-12 md:grid-cols-3 md:gap-10">
            {RELATIONSHIPS.map((party) => (
              <div key={party.name} className="border-t border-[var(--taupe-medium)]/70 pt-6">
                <h3 className="font-heading text-2xl text-[var(--forest-sage)] md:text-3xl">
                  {party.name}
                </h3>
                <p className="mt-4 text-sm leading-relaxed text-[var(--forest-sage)]/65 md:text-base">
                  {party.line}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Workspace ── */}
      <section className="px-6 py-28 md:py-36">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs tracking-[0.22em] uppercase text-[var(--heritage-sage)]">
            The Workspace
          </p>
          <h2 className="mt-4 max-w-2xl font-heading text-3xl whitespace-pre-line text-[var(--forest-sage)] md:text-5xl">
            Calm enough for a workday.{"\n"}Connected enough for an entire venue.
          </h2>
          <div className="mt-8 max-w-lg space-y-3 text-base leading-relaxed text-[var(--forest-sage)]/70">
            <p>Everything your venue needs lives in one thoughtful workspace.</p>
            <p>Morning priorities.</p>
            <p>Bookings.</p>
            <p>Planning.</p>
            <p>Conversations.</p>
            <p>Financials.</p>
            <p>Tasks.</p>
            <p className="pt-2">Without switching between systems.</p>
          </div>
          <div className="mt-14">
            <UiPlaceholder
              moment="The workspace"
              capture="Full product screenshot — morning priorities, bookings, planning, conversations, financials, and tasks in one calm frame."
              aspect="wide"
              className="min-h-[360px] md:min-h-[520px]"
            />
          </div>
        </div>
      </section>

      {/* ── Luv — beneath workspace ── */}
      <section className="px-6 py-28 md:py-36">
        <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2 md:gap-16">
          <div className="flex flex-col justify-center">
            <p className="text-xs tracking-[0.22em] uppercase text-[var(--heritage-sage)]">
              Meet Luv
            </p>
            <h2 className="mt-5 font-heading text-3xl text-[var(--forest-sage)] md:text-5xl">
              Intelligence that stays quietly behind the scenes.
            </h2>
            <div className="mt-6 space-y-4 text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg">
              <p>We&apos;ve shown you the workspace.</p>
              <p>
                Here&apos;s the intelligence quietly helping behind the scenes—not the reason
                to buy Wevenu, but a thoughtful extension of the hospitality you already offer.
              </p>
              <p className="pt-2 text-[var(--forest-sage)]/60">
                Real recommendations. Real conversations. Included with the platform.
              </p>
            </div>
          </div>
          <UiPlaceholder
            moment="Workspace · Luv notices"
            capture="Product screenshot — workspace with Luv notices visible. Real recommendations in context."
            aspect="tall"
          />
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="border-t border-[var(--taupe-light)] bg-[var(--header-linen)] px-6 py-24 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-4xl text-[var(--forest-sage)] md:text-5xl">
            {VISION.cta.headline}
          </h2>
          <p className="mt-5 text-[var(--forest-sage)]/70">{VISION.cta.body}</p>
          <div className="mt-10 flex justify-center">
            <MarketingCta />
          </div>
        </div>
      </section>
    </div>
  );
}
