import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "System Status",
  description: "Current operational status for Hello to Cheers services.",
};

/**
 * System Status — calm status home.
 * Live incident feeds can be connected later without changing the editorial frame.
 */
export default function SystemStatusPage() {
  return (
    <div className="bg-[var(--true-white)] px-6 pt-[140px] pb-28 md:pb-36">
      <div className="mx-auto max-w-3xl">
        <p className="text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/82">
          Reliability
        </p>
        <h1 className="mt-8 font-heading text-[2.52rem] font-medium leading-[1.16] tracking-tight text-[var(--forest-sage)] md:text-[4.2rem]">
          System Status
        </h1>
        <p className="mt-8 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg">
          This is where we share Hello to Cheers&apos;s operational status—quietly, clearly, and without
          drama.
        </p>

        <div className="mt-14 border border-[var(--taupe-medium)]/50 bg-[var(--linen)]/50 px-8 py-10">
          <p className="text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/82">
            Current status
          </p>
          <p className="mt-4 font-heading text-3xl text-[var(--forest-sage)]">All systems normal</p>
          <p className="mt-4 text-sm leading-[1.7] text-[var(--forest-sage)]/65">
            We haven&apos;t published an active incident. When maintenance or disruptions occur,
            you&apos;ll find updates here.
          </p>
        </div>

        <div className="mt-16 space-y-5 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg">
          <p>
            Hello to Cheers is monitored continuously. If something needs your attention, we aim to
            communicate with honesty and pace—hospitality first, even when the news is
            technical.
          </p>
          <p>
            For Trust, security, and privacy context, visit our{" "}
            <Link href="/trust" className="underline-offset-4 hover:underline">
              Trust
            </Link>{" "}
            page.
          </p>
        </div>
      </div>
    </div>
  );
}
