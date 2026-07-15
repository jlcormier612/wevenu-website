"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { MarketingCta } from "@/components/marketing/marketing-cta";
import { UiPlaceholder } from "@/components/marketing/ui-placeholder";
import { FILM } from "@/lib/marketing/film";
import { PRODUCT_JOURNEY } from "@/lib/marketing/journey";
import { VISION } from "@/lib/marketing/vision";
import { cn } from "@/lib/utils";

const EMOTIONAL_LINES = [
  "You were never looking for software.",
  "You were looking for fewer repeated conversations.",
  "One place where everything you do to make your venue special comes together.",
] as const;

/**
 * Homepage — opening chapter to the Product journey.
 * Editorial restraint. Same cadence as Product pages.
 */
export function HomepageHybrid() {
  const [active, setActive] = useState<string>(PRODUCT_JOURNEY[0].id);

  useEffect(() => {
    const nodes = PRODUCT_JOURNEY.map((s) => document.getElementById(`ch-${s.id}`)).filter(
      Boolean,
    ) as HTMLElement[];

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActive(visible.target.id.replace("ch-", ""));
      },
      { rootMargin: "-40% 0px -45% 0px", threshold: [0.15, 0.4, 0.7] },
    );

    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, []);

  return (
    <div>
      {/* ── Hero — leave alone ── */}
      <section className="mx-auto max-w-5xl px-6 pb-10 pt-20 md:pb-14 md:pt-28">
        <h1 className="max-w-4xl font-heading text-[2.35rem] font-medium leading-[1.05] tracking-tight text-[var(--forest-sage)] md:text-6xl lg:text-[4rem]">
          From first inquiry to final celebration — connected, not integrated.
        </h1>
        <div className="mt-12 flex flex-wrap items-center gap-4">
          <MarketingCta />
          <a
            href="#follow"
            className="inline-flex items-center rounded-full border border-[var(--heritage-sage)]/40 px-6 py-3 text-sm tracking-wide text-[var(--forest-sage)] transition hover:bg-[var(--linen)]"
          >
            Follow one booking
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24 md:pb-32">
        <div className="relative ml-auto aspect-[16/9] w-full max-w-4xl overflow-hidden md:aspect-[2.1/1]">
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

      {/* ── Philosophy — emotional bridge before the journey ── */}
      <section className="border-y border-[var(--taupe-light)] bg-[var(--linen)] px-6 py-28 md:py-40">
        <div className="mx-auto max-w-3xl space-y-10 md:space-y-14">
          {EMOTIONAL_LINES.map((line, i) => (
            <p
              key={line}
              className={cn(
                "font-heading leading-[1.15] text-[var(--forest-sage)]",
                i === 0 && "text-3xl md:text-5xl",
                i === 1 && "text-2xl text-[var(--forest-sage)]/80 md:text-4xl",
                i === 2 && "text-2xl text-[var(--heritage-sage)] md:text-[2.35rem]",
              )}
            >
              {line}
            </p>
          ))}
        </div>
      </section>

      {/* ── Follow one booking — magazine opening, not a collage ── */}
      <section id="follow" className="scroll-mt-28 px-6 py-28 md:py-36">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs tracking-[0.22em] uppercase text-[var(--heritage-sage)]">
            Follow one booking
          </p>
          <h2 className="mt-5 max-w-2xl font-heading text-3xl text-[var(--forest-sage)] md:text-5xl">
            One celebration. One continuous story.
          </h2>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
            From the first hello to the last glass—exactly the way your venue actually works.
          </p>

          <div className="relative mt-16 aspect-[16/10] w-full overflow-hidden md:mt-20 md:aspect-[2.2/1]">
            <Image
              src={FILM.emptyChairs}
              alt="Reception chairs waiting under warm string lights — the quiet before a celebration"
              fill
              className="object-cover object-[center_40%]"
              sizes="100vw"
            />
          </div>

          <div className="relative mx-auto mt-6 aspect-[16/9] w-full max-w-3xl overflow-hidden md:mt-8">
            <Image
              src={FILM.morningLight}
              alt="Soft morning light over the grounds"
              fill
              className="object-cover"
              sizes="(max-width:768px) 100vw, 60vw"
            />
          </div>

          <nav
            className="mt-20 flex gap-1 overflow-x-auto border-t border-[var(--taupe-medium)]/50 pt-8 pb-2 md:flex-wrap md:justify-center md:gap-2"
            aria-label="Booking chapters"
          >
            {PRODUCT_JOURNEY.map((step) => (
              <a
                key={step.id}
                href={`#ch-${step.id}`}
                className={cn(
                  "shrink-0 px-3 py-2 text-xs tracking-wide transition md:px-4",
                  active === step.id
                    ? "text-[var(--forest-sage)]"
                    : "text-[var(--forest-sage)]/45 hover:text-[var(--forest-sage)]/70",
                )}
              >
                {step.title}
              </a>
            ))}
          </nav>
        </div>
      </section>

      {/* ── Inquiry ── */}
      <section id="ch-inquiry" className="scroll-mt-28 border-t border-[var(--taupe-light)] px-6 py-24 md:py-28">
        <div className="mx-auto grid max-w-6xl items-stretch gap-8 md:grid-cols-2">
          <div>
            <ChapterEyebrow n="01" title="Inquiry" />
            <h2 className="mt-3 font-heading text-3xl text-[var(--forest-sage)] md:text-4xl">
              A first hello that feels personal.
            </h2>
            <div className="relative mt-8 aspect-[4/5] overflow-hidden">
              <Image
                src={FILM.propertyWalk}
                alt="First look — a quiet emotional moment before the celebration"
                fill
                className="object-cover object-[center_30%]"
                sizes="50vw"
              />
            </div>
          </div>
          <div className="flex flex-col justify-end">
            <UiPlaceholder
              moment="Inquiry & pipeline"
              capture="Zoom into a single new lead — details, source, and first response. Not the whole CRM."
              aspect="tall"
            />
          </div>
        </div>
      </section>

      {/* ── Tour ── */}
      <section id="ch-tour" className="scroll-mt-28">
        <div className="relative min-h-[70vh] md:min-h-[85vh]">
          <Image
            src={FILM.gardenPath}
            alt="Garden path through the venue grounds"
            fill
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-[rgba(47,55,47,0.35)]" />
          <div className="relative z-10 mx-auto flex min-h-[70vh] max-w-6xl flex-col justify-end px-6 pb-14 md:min-h-[85vh] md:pb-20">
            <ChapterEyebrow n="02" title="Tour" light />
            <h2 className="mt-3 max-w-xl font-heading text-4xl text-[var(--true-white)] md:text-5xl">
              Time on property — remembered beautifully.
            </h2>
          </div>
        </div>
        <div className="mx-auto max-w-4xl px-6 py-12 md:py-16">
          <UiPlaceholder
            moment="Tour scheduling"
            capture="Availability, tour notes, and who walked the grounds — a calm strip, not a crowded calendar."
            aspect="wide"
          />
        </div>
      </section>

      {/* ── Proposal — hospitality experience, not stationery aesthetics ── */}
      <section id="ch-proposal" className="scroll-mt-28 bg-[var(--linen)] px-6 py-28 md:py-36">
        <div className="mx-auto max-w-2xl text-center">
          <ChapterEyebrow n="03" title="Proposal" className="justify-center" />
          <h2 className="mt-4 font-heading text-4xl text-[var(--forest-sage)] md:text-5xl">
            A beautiful yes begins with a beautiful proposal.
          </h2>
          <p className="mx-auto mt-6 max-w-lg text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
            The couple opens something that already knows them—continuing the conversation that
            began on your property, with the same care they felt during the tour.
          </p>
        </div>
        <div className="mx-auto mt-14 max-w-xl">
          <UiPlaceholder
            moment="Proposal preview"
            capture="A personal proposal — packages and details from the tour, ready when they are."
            aspect="tall"
            className="shadow-[0_1px_0_rgba(79,95,79,0.06)]"
          />
        </div>
      </section>

      {/* ── Booking Confirmed ── */}
      <section id="ch-contract-inventory" className="scroll-mt-28 px-6 py-24 md:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2">
          <div>
            <ChapterEyebrow n="04" title="Booking Confirmed" />
            <h2 className="mt-3 font-heading text-3xl text-[var(--forest-sage)] md:text-4xl">
              Every promise becomes something your team can deliver.
            </h2>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-[var(--forest-sage)]/65">
              Contracts, packages, and inventory stay connected—on one living record.
            </p>
          </div>
          <UiPlaceholder
            moment="Contract & inventory"
            capture="Accepted package flowing into inventory and timeline—connected, not bolted together."
            aspect="tall"
          />
        </div>
      </section>

      {/* ── Payments ── */}
      <section id="ch-invoice-payment" className="scroll-mt-28 px-6 py-28 md:py-32">
        <div className="mx-auto max-w-lg">
          <ChapterEyebrow n="05" title="Payments" />
          <h2 className="mt-4 font-heading text-3xl text-[var(--forest-sage)] md:text-4xl">
            Money stays connected to the celebration.
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-[var(--forest-sage)]/65">
            Deposits. Schedules. Balances. No chasing which spreadsheet was current.
          </p>
          <div className="mt-10">
            <UiPlaceholder
              moment="Invoice & payment schedule"
              capture="One invoice and one payment schedule — simple, quiet, honest."
              aspect="wide"
            />
          </div>
        </div>
      </section>

      {/* ── Planning ── */}
      <section
        id="ch-planning"
        className="scroll-mt-28 border-y border-[var(--taupe-light)] bg-[var(--linen)] px-6 py-24 md:py-28"
      >
        <div className="mx-auto max-w-6xl">
          <div className="max-w-xl">
            <ChapterEyebrow n="06" title="Planning" />
            <h2 className="mt-3 font-heading text-3xl text-[var(--forest-sage)] md:text-5xl">
              Everyone planning together—not everyone planning separately.
            </h2>
          </div>
          <div className="mt-14 grid gap-8 md:grid-cols-[1.4fr_0.8fr] md:gap-10">
            <div className="relative min-h-[360px] overflow-hidden md:min-h-[520px]">
              <Image
                src={FILM.floralsSoft}
                alt="Soft dusty-rose florals in natural light"
                fill
                className="object-cover"
                sizes="60vw"
              />
            </div>
            <div className="flex flex-col justify-end">
              <UiPlaceholder
                moment="Playbooks & planning"
                capture="Zoom into planning tasks — collaborative, not corporate."
                aspect="wide"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Vendors ── */}
      <section
        id="ch-vendors"
        className="scroll-mt-28 bg-[var(--forest-sage)] px-6 py-24 text-[var(--true-white)] md:py-28"
      >
        <div className="mx-auto max-w-6xl">
          <ChapterEyebrow n="07" title="Vendors" light />
          <h2 className="mt-3 max-w-2xl font-heading text-3xl md:text-5xl">
            Every partner, perfectly informed.
          </h2>
          <div className="mt-14 grid gap-8 md:grid-cols-[1.2fr_0.8fr] md:gap-10">
            <div className="relative min-h-[320px] overflow-hidden md:min-h-[420px]">
              <Image
                src={FILM.floristWork}
                alt="Florist preparing arrangements"
                fill
                className="object-cover"
                sizes="60vw"
              />
            </div>
            <div className="flex flex-col justify-end border border-white/20 bg-[var(--heritage-sage)] p-6 md:p-8">
              <p className="text-[10px] tracking-[0.22em] uppercase text-white/55">
                Product proof · placeholder
              </p>
              <p className="mt-3 font-heading text-xl text-white md:text-2xl">
                Vendor collaboration
              </p>
              <p className="mt-2 text-sm leading-relaxed text-white/65">
                Invitation, confirmations, and shared day details—the vendor’s clear window into
                the event.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Timeline ── */}
      <section id="ch-timeline" className="scroll-mt-28 px-6 py-24 md:py-28">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[0.9fr_1.1fr] md:items-end">
          <div>
            <ChapterEyebrow n="08" title="Timeline" />
            <h2 className="mt-3 font-heading text-3xl text-[var(--forest-sage)] md:text-4xl">
              The celebration is ready before the day begins.
            </h2>
            <div className="mt-8">
              <UiPlaceholder
                moment="Day timeline"
                capture="Run of show — notifications, who’s next. Capture from wedding day ops."
                aspect="mobile"
              />
            </div>
          </div>
          <div className="relative aspect-[5/6] overflow-hidden md:aspect-[4/5]">
            <Image
              src={FILM.aisleCalm}
              alt="Ceremony aisle in soft natural light"
              fill
              className="object-cover"
              sizes="50vw"
            />
          </div>
        </div>
      </section>

      {/* ── Floor Plans ── */}
      <section
        id="ch-floor-seating"
        className="scroll-mt-28 border-y border-[var(--taupe-light)] bg-[var(--linen)] px-6 py-24 md:py-28"
      >
        <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2">
          <div>
            <ChapterEyebrow n="09" title="Floor Plans" />
            <h2 className="mt-3 font-heading text-3xl text-[var(--forest-sage)] md:text-4xl">
              Every space prepared with confidence.
            </h2>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-[var(--forest-sage)]/65">
              Floor plans, seating, inventory, and guest counts stay with the booking—so the room
              you&apos;re preparing is always the room you&apos;re expecting.
            </p>
          </div>
          <UiPlaceholder
            moment="Floor plans"
            capture="Floor plan workspace with tables, inventory, guest count, and placements — calm, attached to the event."
            aspect="wide"
          />
        </div>
      </section>

      {/* ── Client Experience ── */}
      <section id="ch-client-portal-website" className="scroll-mt-28 px-6 py-24 md:py-32">
        <div className="mx-auto max-w-5xl text-center">
          <ChapterEyebrow n="10" title="Client Experience" className="justify-center" />
          <h2 className="mt-4 font-heading text-3xl text-[var(--forest-sage)] md:text-5xl">
            Your hospitality doesn&apos;t stop after the tour.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base text-[var(--forest-sage)]/70">
            Every booking includes a beautiful planning experience that reflects your venue—calm,
            personal, and welcoming between conversations.
          </p>
        </div>
        <div className="mx-auto mt-14 max-w-3xl">
          <UiPlaceholder
            moment="Client experience"
            capture="Venue-branded client portal — planning, messages, timeline, documents in one calm place."
            aspect="wide"
          />
        </div>
      </section>

      {/* ── Guest Portal ── */}
      <section id="ch-guest-portal" className="scroll-mt-28 px-6 py-24 md:py-32">
        <div className="mx-auto max-w-5xl text-center">
          <ChapterEyebrow n="11" title="Guest Portal" className="justify-center" />
          <h2 className="mt-4 font-heading text-3xl text-[var(--forest-sage)] md:text-5xl">
            Every guest arrives a little more prepared.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base text-[var(--forest-sage)]/70">
            Directions, RSVPs, travel, and updates live in one welcoming place—so guests arrive
            ready, and your team fields fewer of the same questions.
          </p>
        </div>
        <div className="mx-auto mt-14 max-w-3xl">
          <UiPlaceholder
            moment="Guest portal"
            capture="Guest event homepage — RSVP, travel, map, timeline, FAQ, gallery with venue branding."
            aspect="wide"
          />
        </div>
      </section>

      {/* ── Celebration ── */}
      <section id="ch-celebration" className="scroll-mt-28">
        <div className="relative min-h-[80vh]">
          <Image
            src={FILM.celebrationNight}
            alt="Warm celebration lights at night"
            fill
            className="object-cover"
            sizes="100vw"
            priority={false}
          />
          <div className="absolute inset-0 bg-[rgba(40,48,40,0.4)]" />
          <div className="relative z-10 mx-auto flex min-h-[80vh] max-w-4xl flex-col items-center justify-center px-6 text-center text-[var(--true-white)]">
            <ChapterEyebrow n="12" title="Celebration" light className="justify-center" />
            <h2 className="mt-4 font-heading text-4xl md:text-6xl">
              The celebration ends. The relationship doesn&apos;t.
            </h2>
            <p className="mt-6 max-w-lg text-base text-white/75">
              Photos, memories, reviews, and referrals become part of a complete story—and the next
              inquiry starts from the same thread.
            </p>
          </div>
        </div>
        <div className="mx-auto max-w-3xl px-6 py-14">
          <UiPlaceholder
            moment="Completed celebration"
            capture="Event complete — financial summary, reviews, gallery, referrals preserved as history."
            aspect="wide"
          />
        </div>
      </section>

      {/* ── Connected story — after the journey, almost poetic ── */}
      <section className="border-y border-[var(--taupe-light)] bg-[var(--linen)] px-6 py-28 md:py-36">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs tracking-[0.22em] uppercase text-[var(--heritage-sage)]">
            {VISION.connected.eyebrow}
          </p>
          <h2 className="mt-5 font-heading text-3xl text-[var(--forest-sage)] md:text-5xl">
            {VISION.connected.headline}
          </h2>
          <ol className="mt-14 space-y-0">
            {VISION.connected.continuum.map((line, i) => (
              <li key={line} className="flex flex-col items-start">
                <span className="font-heading text-2xl text-[var(--forest-sage)] md:text-3xl">
                  {line}
                </span>
                {i < VISION.connected.continuum.length - 1 ? (
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
          <div className="mt-14 space-y-3 border-t border-[var(--taupe-medium)]/60 pt-10">
            {VISION.connected.proofLines.map((line) => (
              <p
                key={line}
                className="font-heading text-xl text-[var(--forest-sage)]/80 md:text-2xl"
              >
                {line}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* ── Luv — after the story is understood ── */}
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
              <p>We&apos;ve shown you the connected experience.</p>
              <p>
                Now here&apos;s the intelligence quietly helping behind the scenes—not the reason
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

      {/* ── Close ── */}
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

function ChapterEyebrow({
  n,
  title,
  light,
  className,
}: {
  n: string;
  title: string;
  light?: boolean;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex items-center gap-3 text-xs tracking-[0.22em] uppercase",
        light ? "text-white/65" : "text-[var(--heritage-sage)]",
        className,
      )}
    >
      <span>{n}</span>
      <span aria-hidden className={light ? "text-white/35" : "text-[var(--taupe-dark)]"}>
        ·
      </span>
      <span>{title}</span>
    </p>
  );
}
