import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { CelebrationWorkspaceMock } from "@/components/marketing/journey/celebration-workspace-mock";
import { ClientWorkspaceMock } from "@/components/marketing/journey/client-workspace-mock";
import { ContractWorkspaceMock } from "@/components/marketing/journey/contract-workspace-mock";
import { FloorWorkspaceMock } from "@/components/marketing/journey/floor-workspace-mock";
import { GuestWorkspaceMock } from "@/components/marketing/journey/guest-workspace-mock";
import { InquiryWorkspaceMock } from "@/components/marketing/journey/inquiry-workspace-mock";
import { PaymentsWorkspaceMock } from "@/components/marketing/journey/payments-workspace-mock";
import { PlanningWorkspaceMock } from "@/components/marketing/journey/planning-workspace-mock";
import { ProposalWorkspaceMock } from "@/components/marketing/journey/proposal-workspace-mock";
import { TimelineWorkspaceMock } from "@/components/marketing/journey/timeline-workspace-mock";
import { TourWorkspaceMock } from "@/components/marketing/journey/tour-workspace-mock";
import { VendorsWorkspaceMock } from "@/components/marketing/journey/vendors-workspace-mock";
import { JOURNEY_CHAPTER_FILM } from "@/lib/marketing/journey-chapters";
import type { ProductJourneyId } from "@/lib/marketing/journey";
import { cn } from "@/lib/utils";

const MOCKS: Record<ProductJourneyId, () => ReactNode> = {
  inquiry: () => <InquiryWorkspaceMock />,
  tour: () => <TourWorkspaceMock />,
  proposal: () => <ProposalWorkspaceMock />,
  "contract-inventory": () => <ContractWorkspaceMock />,
  "invoice-payment": () => <PaymentsWorkspaceMock />,
  planning: () => <PlanningWorkspaceMock />,
  vendors: () => <VendorsWorkspaceMock />,
  timeline: () => <TimelineWorkspaceMock />,
  "floor-seating": () => <FloorWorkspaceMock />,
  "client-portal-website": () => <ClientWorkspaceMock />,
  "guest-portal": () => <GuestWorkspaceMock />,
  celebration: () => <CelebrationWorkspaceMock />,
};

type ProductJourneyChapterProps = {
  id: ProductJourneyId;
  index: number;
  title: string;
  emotion: string;
  body: string;
  /** Alternate image/mock side for visual rhythm */
  reverse?: boolean;
};

/**
 * One Product journey chapter — image, product proof, short copy, Explore →
 */
export function ProductJourneyChapter({
  id,
  index,
  title,
  emotion,
  body,
  reverse,
}: ProductJourneyChapterProps) {
  const film = JOURNEY_CHAPTER_FILM[id];
  const Mock = MOCKS[id];
  const n = String(index + 1).padStart(2, "0");

  return (
    <section id={`ch-${id}`} className="scroll-mt-28 px-6 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <p className="flex items-center gap-3 text-xs tracking-[0.22em] uppercase text-[var(--heritage-sage)]">
          <span>{n}</span>
          <span aria-hidden className="text-[var(--taupe-dark)]">
            ·
          </span>
          <span>{title}</span>
        </p>
        <h2 className="mt-4 max-w-2xl font-heading text-3xl text-[var(--forest-sage)] md:text-5xl">
          {emotion}
        </h2>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
          {body}
        </p>

        <div
          className={cn(
            "mt-14 grid items-stretch gap-8 md:grid-cols-[11fr_9fr] md:gap-10",
            reverse && "md:[&>*:first-child]:order-2",
          )}
        >
          <div className="relative min-h-[360px] overflow-hidden md:min-h-[520px]">
            <Image
              src={film.src}
              alt={film.alt}
              fill
              className="object-cover"
              sizes="(max-width:768px) 100vw, 55vw"
            />
          </div>
          <div className="flex flex-col justify-center">
            {Mock()}
          </div>
        </div>

        <div className="mt-12">
          <Link
            href={`/product/journey/${id}`}
            className="inline-flex items-center font-heading text-xl text-[var(--forest-sage)] underline-offset-8 transition hover:underline md:text-2xl"
          >
            Explore {title} →
          </Link>
        </div>
      </div>
    </section>
  );
}
