import Image from "next/image";

import { ClosingCta } from "@/components/marketing/closing-cta";
import { CelebrationWhisper, HospitalityHeart } from "@/components/marketing/brand-accents";
import { LuvQuietMoment } from "@/components/marketing/luv-quiet-moment";
import { MarketingCta } from "@/components/marketing/marketing-cta";
import { Reveal } from "@/components/marketing/reveal";
import { SharedTruthArchitecture } from "@/components/marketing/shared-truth-architecture";
import { FILM } from "@/lib/marketing/film";
import {
  EDITORIAL_BLEED,
  EDITORIAL_FRAME,
  EDITORIAL_IMAGE,
  EDITORIAL_IMAGE_UI,
  HOME_HERO_SHELL,
} from "@/lib/marketing/rhythm";
import { VISION, VISION_PHOTO } from "@/lib/marketing/vision";
import { cn } from "@/lib/utils";

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
    name: "Vendor & Guest",
    line: "Trusted partners and informed guests who arrive prepared—because they already share the same celebration.",
  },
] as const;

/**
 * Home — why Hello to Cheers exists.
 * Belief and hospitality first. Product journey lives on /product.
 */
export function HomepageHybrid() {
  return (
    <div>
      {/* ── Hero ── */}
      <section className={cn("mx-auto max-w-5xl", HOME_HERO_SHELL)}>
        <h1 className="mx-auto max-w-4xl font-heading text-[2.63rem] font-medium leading-[1.21] tracking-tight text-[var(--forest-sage)] md:text-[3.36rem] lg:text-[3.92rem]">
          Every venue owner got into this business because they love creating unforgettable
          celebrations.
        </h1>
        <p className="mx-auto mt-8 max-w-[65ch] text-base leading-[1.7] text-[var(--forest-sage)]/65 md:mt-10 md:text-lg">
          Almost none imagined spending their days chasing emails, spreadsheets, vendors,
          payments, and elusive details—or wondering whether something had been missed.
        </p>
        <p className="mx-auto mt-14 max-w-3xl font-heading text-2xl font-medium leading-[1.26] text-[var(--forest-sage)] md:mt-[72px] md:text-4xl">
          Hello to Cheers gives you back the time—and peace of mind—to create unforgettable celebrations.
        </p>
        <div className="mt-14 flex flex-wrap items-center justify-center gap-4 md:mt-[72px]">
          <MarketingCta />
          <MarketingCta
            href="/product#follow"
            label="Follow one booking"
            variant="ghost"
          />
        </div>
      </section>

      {/* ── Hero divider — hospitality prep ── */}
      <section
        className={`relative aspect-[21/9] min-h-[50vh] w-full md:min-h-[55vh] ${EDITORIAL_BLEED}`}
      >
        <Image
          src={FILM.heroCrop}
          alt="A host carefully finishing a guest table — hospitality before arrival"
          fill
          priority
          className={EDITORIAL_IMAGE}
          style={{ objectPosition: "35% 45%" }}
          sizes="100vw"
        />
      </section>

      {/* ── One Shared Truth ── */}
      <section className="px-6 py-28 md:py-36">
        <Reveal className="mx-auto max-w-[1200px] text-center">
          <h2 className="mx-auto max-w-3xl font-heading text-[2.1rem] font-medium leading-[1.21] whitespace-pre-line text-[var(--forest-sage)] md:text-[3.36rem]">
            {"One Event.\nThree Perspectives.\nOne Shared Truth."}
          </h2>

          <div className="mx-auto mt-10 max-w-2xl space-y-5 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:mt-12 md:text-lg">
            <p>
              Every conversation, document, payment, timeline, vendor, and guest belongs to one
              shared celebration.
            </p>
            <p>
              Hello to Cheers doesn&apos;t create separate software for venues, couples, and
              vendors.
            </p>
            <p>
              It gives each participant their own experience while everyone stays connected to the
              same source of truth.
            </p>
          </div>
        </Reveal>

        <div className="mx-auto mt-14 max-w-[1200px] md:mt-16">
          <SharedTruthArchitecture />
        </div>

        <div className="mt-14 flex justify-center md:mt-16">
          <MarketingCta href="/product" label="Explore the Connected Journey →" />
        </div>
      </section>

      {/* ── Philosophy — calm conversation ── */}
      <section className="border-y border-[var(--taupe-light)] bg-[var(--linen)] px-6 py-28 md:py-36">
        <Reveal className="mx-auto max-w-3xl">
          <h2 className="font-heading text-[2.1rem] font-medium leading-[1.21] text-[var(--forest-sage)] md:text-[3.36rem]">
            You were never looking for software.
          </h2>

          <p className="mt-14 font-heading text-2xl leading-[1.25] text-[var(--forest-sage)]/75 md:mt-16 md:text-3xl">
            You were looking for calmer mornings.
          </p>

          <p className="mt-10 font-heading text-xl leading-[1.3] text-[var(--forest-sage)]/65 md:mt-12 md:text-2xl">
            For fewer repeated conversations.
          </p>

          <p className="mt-8 font-heading text-xl leading-[1.3] text-[var(--forest-sage)]/65 md:mt-10 md:text-2xl">
            For confidence that nothing had been forgotten.
          </p>

          <p className="mt-8 font-heading text-xl leading-[1.3] text-[var(--forest-sage)]/65 md:mt-10 md:text-2xl">
            For more time creating unforgettable celebrations...
          </p>

          <p className="mt-6 font-heading text-xl leading-[1.3] text-[var(--forest-sage)]/65 md:mt-8 md:text-2xl">
            ...and less time managing the details behind them.
          </p>

          <p className="mt-14 max-w-2xl font-heading text-xl leading-[1.35] text-[var(--forest-sage)]/70 md:mt-16 md:text-2xl">
            Because hospitality was never meant to be stitched together across disconnected
            systems.
          </p>

          <p className="mt-16 text-center font-heading text-2xl font-medium leading-[1.26] text-[var(--forest-sage)] md:mt-20 md:text-4xl">
            One place where all the perfectly curated pieces of your venue come together.
          </p>
        </Reveal>
      </section>

      {/* ── Bridge — hospitality over departments ── */}
      <section className="px-6 pb-28 md:pb-36">
        <div className="mx-auto max-w-6xl">
          <div className={`relative aspect-[16/10] w-full md:aspect-[2.1/1] ${EDITORIAL_FRAME}`}>
            <Image
              src={FILM.homeVenueMagic}
              alt="A sunlit reception patio prepared for celebration — hospitality gathered in one place"
              fill
              className={EDITORIAL_IMAGE}
              sizes="100vw"
            />
            <CelebrationWhisper />
          </div>
          <div className="mx-auto mt-12 max-w-4xl space-y-5 text-center text-base leading-[1.7] text-[var(--forest-sage)]/70 md:mt-14 md:text-lg">
            <p>
              Unique venues deserve software built around hospitality—not around departments.
            </p>
            <p>Your venue isn&apos;t defined by the type of event you host.</p>
            <p>It&apos;s defined by the experience people remember long after it&apos;s over.</p>
          </div>
        </div>
      </section>

      {/* ── Relationships ── */}
      <section className="border-y border-[var(--taupe-light)] bg-[var(--linen)] px-6 py-28 md:py-36">
        <div className="mx-auto max-w-5xl">
          <HospitalityHeart size={14} className="mb-5 opacity-[0.8]" />
          <h2 className="max-w-2xl font-heading text-[2.1rem] font-medium leading-[1.21] text-[var(--forest-sage)] md:text-[3.36rem]">
            Hospitality is bigger than one relationship.
          </h2>
          <div className="mt-8 max-w-xl space-y-4 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg">
            <p>Your venue is about more than one relationship.</p>
            <p>It coordinates vendors.</p>
            <p>Welcomes guests.</p>
            <p>Guides families.</p>
            <p>Supports your staff.</p>
            <p className="pt-2 text-[var(--forest-sage)]/80">
              Hello to Cheers keeps every relationship connected—so everyone experiences the same
              thoughtful hospitality.
            </p>
          </div>
          <div className="mt-16 grid gap-12 md:grid-cols-3 md:gap-10">
            {RELATIONSHIPS.map((party) => (
              <div key={party.name} className="border-t border-[var(--taupe-medium)]/70 pt-6">
                <h3 className="font-heading text-2xl text-[var(--forest-sage)] md:text-3xl">
                  {party.name}
                </h3>
                <p className="mt-4 text-sm leading-[1.7] text-[var(--forest-sage)]/65 md:text-base">
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
          <p className="text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/82">
            The Workspace
          </p>
          <h2 className="mt-7 max-w-2xl font-heading text-[2.1rem] whitespace-pre-line text-[var(--forest-sage)] md:text-[3.36rem]">
            One calm workspace.{"\n"}For an entire venue.
          </h2>
          <div className="mt-8 max-w-lg space-y-3 text-base leading-[1.7] text-[var(--forest-sage)]/70">
            <p>Everything your venue needs lives in one thoughtful workspace.</p>
            <p>Morning priorities.</p>
            <p>Bookings.</p>
            <p>Planning.</p>
            <p>Conversations.</p>
            <p>Financials.</p>
            <p>Tasks.</p>
            <p className="pt-2">Without switching between systems.</p>
          </div>
        </div>
        <div className="mx-auto mt-12 grid max-w-7xl gap-4 md:mt-14 md:grid-cols-2 md:gap-6">
          <div className={`relative aspect-[1024/584] ${EDITORIAL_FRAME} bg-[var(--linen)]`}>
            <Image
              src={VISION_PHOTO.dashboardOverview}
              alt="Hello to Cheers workspace — Luv notices, venue health, and morning priorities"
              fill
              className={EDITORIAL_IMAGE_UI}
              sizes="(max-width:768px) 100vw, 640px"
            />
          </div>
          <div className={`relative aspect-[1024/584] ${EDITORIAL_FRAME} bg-[var(--linen)]`}>
            <Image
              src={VISION_PHOTO.dashboardOps}
              alt="Hello to Cheers workspace — who needs attention, communication, and payments"
              fill
              className={EDITORIAL_IMAGE_UI}
              sizes="(max-width:768px) 100vw, 640px"
            />
          </div>
        </div>
      </section>

      {/* ── Luv — beneath workspace ── */}
      <section className="px-6 py-28 md:py-36">
        <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2 md:gap-10">
          <div className="flex flex-col justify-center">
            <LuvQuietMoment />
            <h2 className="mt-7 font-heading text-[2.1rem] text-[var(--forest-sage)] md:text-[3.36rem]">
              Your quiet teammate behind the scenes.
            </h2>
            <div className="mt-6 space-y-4 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg">
              <p>Luv quietly helps your venue stay one step ahead.</p>
              <p>
                She notices what&apos;s changing, surfaces thoughtful recommendations, prepares
                helpful drafts, and keeps important details from slipping through the
                cracks—always in service of the hospitality only your team can provide.
              </p>
            </div>
            <div className="mt-10 space-y-4 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg">
              <p>She isn&apos;t here to replace people.</p>
              <p>She handles the details.</p>
              <p className="font-medium text-[var(--forest-sage)]">
                Your team creates the moments.
              </p>
            </div>
          </div>
          <div className="flex justify-center">
            <div className={`w-[103%] ${EDITORIAL_FRAME}`}>
              <Image
                src={VISION_PHOTO.luvNoticed}
                alt="Luv in Hello to Cheers — notices, remembers, and learning for your venue"
                width={1024}
                height={873}
                className={`h-auto w-full ${EDITORIAL_IMAGE_UI}`}
                sizes="(max-width:768px) 100vw, 505px"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="border-t border-[var(--taupe-light)] bg-[var(--header-linen)] px-6 py-28 md:py-36">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-[2.52rem] text-[var(--forest-sage)] md:text-[3.36rem]">
            {VISION.cta.headline}
          </h2>
          <p className="mt-5 text-[var(--forest-sage)]/70">{VISION.cta.body}</p>
          <div className="mt-8 flex justify-center">
            <ClosingCta />
          </div>
        </div>
      </section>
    </div>
  );
}
