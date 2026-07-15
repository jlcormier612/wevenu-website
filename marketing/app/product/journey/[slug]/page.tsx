import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CelebrationExperience } from "@/components/marketing/journey/celebration-experience";
import { ClientExperience } from "@/components/marketing/journey/client-experience";
import { ContractExperience } from "@/components/marketing/journey/contract-experience";
import { FloorExperience } from "@/components/marketing/journey/floor-experience";
import { GuestExperience } from "@/components/marketing/journey/guest-experience";
import { InquiryExperience } from "@/components/marketing/journey/inquiry-experience";
import { JourneyNav } from "@/components/marketing/journey/journey-nav";
import { PaymentsExperience } from "@/components/marketing/journey/payments-experience";
import { PlanningExperience } from "@/components/marketing/journey/planning-experience";
import { ProposalExperience } from "@/components/marketing/journey/proposal-experience";
import { TimelineExperience } from "@/components/marketing/journey/timeline-experience";
import { TourExperience } from "@/components/marketing/journey/tour-experience";
import { VendorsExperience } from "@/components/marketing/journey/vendors-experience";
import { MarketingCta } from "@/components/marketing/marketing-cta";
import {
  JOURNEY_LEGACY_REDIRECTS,
  PRODUCT_JOURNEY,
  type ProductJourneyId,
} from "@/lib/marketing/journey";

type Params = { slug: string };

function resolveStep(slug: string) {
  const legacy = JOURNEY_LEGACY_REDIRECTS[slug];
  if (legacy) return { redirectTo: legacy as ProductJourneyId };
  const index = PRODUCT_JOURNEY.findIndex((s) => s.id === slug);
  if (index < 0) return null;
  return { index, step: PRODUCT_JOURNEY[index] };
}

export function generateStaticParams() {
  return [
    ...PRODUCT_JOURNEY.map((step) => ({ slug: step.id })),
    ...Object.keys(JOURNEY_LEGACY_REDIRECTS).map((slug) => ({ slug })),
  ];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const resolved = resolveStep(slug);
  if (!resolved) return { title: "Journey" };
  if ("redirectTo" in resolved) {
    const step = PRODUCT_JOURNEY.find((s) => s.id === resolved.redirectTo)!;
    return { title: `${step.title} · Product Journey`, description: step.emotion };
  }
  return {
    title: `${resolved.step.title} · Product Journey`,
    description: resolved.step.emotion,
  };
}

export default async function ProductJourneyPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const resolved = resolveStep(slug);
  if (!resolved) notFound();
  if ("redirectTo" in resolved) {
    redirect(`/product/journey/${resolved.redirectTo}`);
  }

  const { index, step } = resolved;
  const prev = index > 0 ? PRODUCT_JOURNEY[index - 1] : null;
  const next = index < PRODUCT_JOURNEY.length - 1 ? PRODUCT_JOURNEY[index + 1] : null;

  // Rich magazine chapters — each gets its own visual personality as we build them.
  if (step.id === "inquiry" && next) {
    return <InquiryExperience prev={prev} next={next} />;
  }
  if (step.id === "tour" && prev && next) {
    return <TourExperience prev={prev} next={next} />;
  }
  if (step.id === "proposal" && prev && next) {
    return <ProposalExperience prev={prev} next={next} />;
  }
  if (step.id === "contract-inventory" && prev && next) {
    return <ContractExperience prev={prev} next={next} />;
  }
  if (step.id === "invoice-payment" && prev && next) {
    return <PaymentsExperience prev={prev} next={next} />;
  }
  if (step.id === "planning" && prev && next) {
    return <PlanningExperience prev={prev} next={next} />;
  }
  if (step.id === "vendors" && prev && next) {
    return <VendorsExperience prev={prev} next={next} />;
  }
  if (step.id === "timeline" && prev && next) {
    return <TimelineExperience prev={prev} next={next} />;
  }
  if (step.id === "floor-seating" && prev && next) {
    return <FloorExperience prev={prev} next={next} />;
  }
  if (step.id === "client-portal-website" && prev && next) {
    return <ClientExperience prev={prev} next={next} />;
  }
  if (step.id === "guest-portal" && prev && next) {
    return <GuestExperience prev={prev} next={next} />;
  }
  if (step.id === "celebration" && prev) {
    return <CelebrationExperience prev={prev} next={next} />;
  }

  return (
    <div className="bg-[var(--true-white)] px-6 pt-[140px] pb-[120px]">
      <article className="mx-auto max-w-[700px]">
        <p className="text-xs tracking-[0.18em] uppercase text-[var(--heritage-sage)]">
          Connected journey · {String(index + 1).padStart(2, "0")}
        </p>
        <h1 className="mt-6 font-heading text-5xl font-medium leading-[1.05] text-[var(--forest-sage)] md:text-6xl">
          {step.title}
        </h1>
        <p className="mt-6 font-heading text-2xl italic text-[var(--forest-sage)]/80 md:text-3xl">
          {step.emotion}
        </p>
        <p className="mt-10 max-w-[620px] text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
          {step.body}
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
      </article>
      <div className="mx-auto mt-24 max-w-6xl">
        <JourneyNav prev={prev} next={next} className="px-0" />
      </div>
    </div>
  );
}
