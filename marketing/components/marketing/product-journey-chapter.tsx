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
import { Reveal } from "@/components/marketing/reveal";
import { JOURNEY_CHAPTER_FILM } from "@/lib/marketing/journey-chapters";
import type { ProductJourneyId } from "@/lib/marketing/journey";
import { EDITORIAL_FRAME, EDITORIAL_IMAGE, HOVER_WHISPER } from "@/lib/marketing/rhythm";
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

export type JourneyChapterStatus = "active" | "past" | "upcoming";

type ProductJourneyChapterProps = {
  id: ProductJourneyId;
  index: number;
  title: string;
  emotion: string;
  body: string;
  /** SEND 5 — reading position in the continuous story */
  status?: JourneyChapterStatus;
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
  status = "upcoming",
  reverse,
}: ProductJourneyChapterProps) {
  const film = JOURNEY_CHAPTER_FILM[id];
  const Mock = MOCKS[id];
  const n = String(index + 1).padStart(2, "0");
  const isActive = status === "active";

  return (
    <section
      id={`ch-${id}`}
      data-journey-status={status}
      className={cn(
        "journey-chapter relative scroll-mt-28 py-28 md:py-36",
        status === "active" && "opacity-100",
        status === "past" && "opacity-[0.52]",
        status === "upcoming" && "opacity-[0.62]",
      )}
    >
      {/* Spine node — sits on the story line (in the pl-10 gutter) */}
      <span
        aria-hidden
        className={cn(
          "journey-chapter-node absolute top-28 -left-10 hidden h-2 w-2 -translate-x-1/2 rounded-full md:block",
          isActive
            ? "bg-[var(--heritage-sage)]"
            : status === "past"
              ? "bg-[var(--heritage-sage)]/40"
              : "bg-[var(--taupe-medium)]",
        )}
      />

      <Reveal>
        <p
          className={cn(
            "flex items-center gap-3 text-[0.7125rem] tracking-[0.22em] uppercase transition-colors duration-200 ease-out",
            isActive
              ? "text-[var(--heritage-sage)]"
              : "text-[var(--heritage-sage)]/82",
          )}
        >
          <span
            className={cn(
              "text-[15px] transition-colors duration-200 ease-out md:text-[1.05rem]",
              isActive
                ? "text-[var(--heritage-sage)]"
                : "text-[var(--heritage-sage)]/65",
            )}
          >
            {n}
          </span>
          <span aria-hidden className="text-[var(--taupe-dark)]">
            ·
          </span>
          <span>{title}</span>
        </p>
        <h2 className="mt-7 max-w-2xl font-heading text-[2.1rem] whitespace-pre-line text-[var(--forest-sage)] md:text-[3.36rem]">
          {emotion}
        </h2>
        <p className="mt-5 max-w-4xl text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg">
          {body}
        </p>
      </Reveal>

      <div
        className={cn(
          "mt-14 grid items-start gap-8 md:grid-cols-[11fr_9fr] md:gap-10",
          reverse && "md:[&>*:first-child]:order-2",
        )}
      >
        <div
          className={cn(
            "relative aspect-[16/10] w-full md:aspect-[5/3]",
            EDITORIAL_FRAME,
          )}
        >
          <Image
            src={film.src}
            alt={film.alt}
            fill
            className={EDITORIAL_IMAGE}
            sizes="(max-width:768px) 100vw, 55vw"
          />
        </div>
        <Link
          href={`/product/journey/${id}`}
          aria-label={`See ${title}`}
          className={`group flex flex-col justify-center self-stretch transition-opacity duration-200 ease-out ${HOVER_WHISPER} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--heritage-sage)]`}
        >
          {Mock()}
        </Link>
      </div>

      <div className="mt-12">
        <Link
          href={`/product/journey/${id}`}
          className={`inline-flex items-center font-heading text-xl text-[var(--forest-sage)] underline-offset-8 transition duration-200 ease-out hover:underline md:text-2xl`}
        >
          See {title} →
        </Link>
      </div>
    </section>
  );
}
