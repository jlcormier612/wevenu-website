import Image from "next/image";
import { HospitalityHeart } from "@/components/marketing/brand-accents";
import { InquiryWorkspaceMock } from "@/components/marketing/journey/inquiry-workspace-mock";
import { JourneyNav } from "@/components/marketing/journey/journey-nav";
import { MarketingCta, WalkthroughCtas } from "@/components/marketing/marketing-cta";
import { FILM } from "@/lib/marketing/film";
import { EDITORIAL_BLEED, EDITORIAL_BREAK_Y, EDITORIAL_FRAME, EDITORIAL_IMAGE, TYPE_HERO_SHELL } from "@/lib/marketing/rhythm";

const HOW_IT_WORKS = [
  {
    n: "01",
    title: "Capture Everything",
    body: "Website forms, email inquiries, referrals, phone calls, and walk-ins all begin the same connected journey.",
  },
  {
    n: "02",
    title: "Know Your Client",
    body: "Preferences, conversations, notes, and history stay together from day one.",
  },
  {
    n: "03",
    title: "Never Lose Context",
    body: "No searching through inboxes. No wondering who replied last. Everything lives together.",
  },
] as const;

const RELATIONSHIP_FLOW = [
  "Inquiry",
  "Tour",
  "Proposal",
  "Contract",
  "Planning",
  "Event Day",
] as const;

type InquiryExperienceProps = {
  prev?: { id: string; title: string } | null;
  next: { id: string; title: string };
};

/**
 * Inquiry journey chapter — welcoming, hopeful magazine piece.
 * Visual personality distinct from later chapters.
 */
export function InquiryExperience({ prev = null, next }: InquiryExperienceProps) {
  return (
    <div className="bg-[var(--true-white)]">
      {/* ── Section 1 · Hero ── */}
      <section className={TYPE_HERO_SHELL}>
        <div className="mx-auto max-w-[65ch]">
          <p className="text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/82">
            Connected journey · 01
          </p>
          <h1 className="mt-8 font-heading text-[3.36rem] font-medium leading-[1.1] tracking-tight text-[var(--forest-sage)] md:text-[4.2rem] lg:text-[5.04rem]">
            Inquiry
          </h1>
          <p className="mt-4 font-heading text-2xl italic text-[var(--forest-sage)]/80 md:text-3xl">
            A first hello that feels personal.
          </p>
          <p className="mt-8 max-w-[65ch] text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg">
            Every conversation begins a relationship. Whether it arrives from your website,
            marketing or social media site, email, phone call, or referral, Hello to Cheers brings
            everything in, and keeps it all together, from the very first moment.
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

      {/* ── Section 2 · Large Visual Story ── 60/40 */}
      <section className="px-6 pb-28 md:pb-36">
        <div className="mx-auto grid max-w-6xl items-start gap-8 md:grid-cols-[3fr_2fr] md:gap-10">
          <div className={`relative aspect-[16/10] w-full md:aspect-[5/3] ${EDITORIAL_FRAME}`}>
            <Image
              src={FILM.inquiryWelcome}
              alt="Let's start something beautiful — the first hello that begins a relationship"
              fill
              className={EDITORIAL_IMAGE}
              sizes="(max-width:768px) 100vw, 60vw"
              priority
            />
          </div>
          <div className="flex flex-col justify-center self-stretch">
            <InquiryWorkspaceMock />
            <p className="mt-6 text-sm tracking-wide text-[var(--forest-sage)]/55">
              Every conversation becomes part of one living record.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 3 · How It Works ── */}
      <section className="px-6 py-28 md:py-36">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-3 md:gap-12">
          {HOW_IT_WORKS.map((card) => (
            <div
              key={card.n}
              className="border-t border-[var(--taupe-medium)]/70 pt-8"
            >
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

      {/* ── Quiet hospitality detail ── */}
      <section className={`px-6 ${EDITORIAL_BREAK_Y}`}>
        <div className={`relative mx-auto aspect-[2/1] max-w-6xl ${EDITORIAL_FRAME}`}>
          <Image
            src={FILM.inquiryConversation}
            alt="Venue foyer welcome table with inquiry notification — every relationship starts with feeling understood"
            fill
            className={EDITORIAL_IMAGE}
            sizes="100vw"
          />
        </div>
      </section>

      {/* ── Section 4 · Real Difference ── */}
      <section className="bg-[var(--warm-gray)] px-6 py-28 md:py-36">
        <div className="mx-auto grid max-w-6xl gap-14 md:grid-cols-2 md:gap-20 md:items-start">
          <h2 className="font-heading text-[2.1rem] font-medium leading-[1.21] text-[var(--forest-sage)] md:text-[3.36rem]">
            Most software tracks inquiries.
            <br />
            Hello to Cheers remembers relationships.
          </h2>
          <div>
            <p className="text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
              Traditional CRMs create another contact.
            </p>
            <p className="mt-5 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
              Hello to Cheers creates the beginning of a living booking that stays connected through
              planning, payments, guests, vendors, and celebration.
            </p>
            <ol className="mt-14 space-y-0">
              {RELATIONSHIP_FLOW.map((label, i) => (
                <li key={label} className="flex flex-col items-start">
                  <span className="font-heading text-xl text-[var(--forest-sage)] md:text-2xl">
                    {label}
                  </span>
                  {i < RELATIONSHIP_FLOW.length - 1 ? (
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
              One uninterrupted flow.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 6 · Closing Quote ── */}
      <section className="px-6 py-28 md:py-36">
        <div className="mx-auto max-w-3xl text-center">
          <HospitalityHeart size={14} className="mx-auto mb-6 opacity-[0.8]" />
          <p className="font-heading text-3xl italic leading-snug text-[var(--forest-sage)] md:text-5xl">
            “The best hospitality begins long before the event day.”
          </p>
          <p className="mt-8 text-sm tracking-wide text-[var(--forest-sage)]/55 md:text-base">
            Hello to Cheers simply makes sure it never gets forgotten.
          </p>
        </div>
      </section>

      {/* ── Bottom Navigation ── */}
      <div className="pb-28 md:pb-36">
        <JourneyNav prev={prev} next={next} />
      </div>
    </div>
  );
}
